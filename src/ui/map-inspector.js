import { SingleView } from '../views/single.js';
import { DT } from '../physics/pendulum.js';

export class MapInspector {
  /** @param {{panel:HTMLElement,canvas:HTMLCanvasElement,angles:HTMLElement,clock:HTMLElement,onError:(error:any)=>void}} ui */
  constructor(ui){this.ui=ui;this.view=new SingleView(ui.canvas);this.gpu=null;this.initial=null;this.generation=0;this.busy=false;this.pending=false;this.steps=0;this.accumulator=0;this.retired=new Set();
    for(const type of ['pointerdown','wheel','click'])ui.panel.addEventListener(type,e=>e.stopPropagation());
  }
  open(source,a,b,p){this.close();this.gpu=source.fork();this.initial=[a,b];this.p={...p};this.ui.panel.classList.remove('hidden');this.restart();}
  restart(){if(!this.initial)return;this.generation++;this.pending=true;this.steps=0;this.accumulator=0;this.view.clear();
    this.states=new Float32Array([this.initial[0],this.initial[1],0,0]);
    this.ui.angles.textContent=`Initial angles: ${(this.initial[0]*180/Math.PI).toFixed(4)}°, ${(this.initial[1]*180/Math.PI).toFixed(4)}°`;this.draw();}
  draw(){this.view.draw(this.states,this.p,true,false,false);this.ui.clock.textContent=`t = ${(this.steps*DT).toFixed(3)} s · ${this.steps} steps`;}
  close(){this.generation++;const gpu=this.gpu;this.gpu=null;this.initial=null;this.ui.panel.classList.add('hidden');if(gpu){if(this.busy)this.retired.add(gpu);else gpu.destroy();}}
  async tick(elapsed,paused,speed){
    if(!this.gpu)return;if(!paused)this.accumulator+=elapsed*speed;if(this.busy)return;
    this.busy=true;const gpu=this.gpu,version=this.generation;
    try{
      if(this.pending){gpu.resetStates(this.states);this.pending=false;}
      const count=paused?0:Math.min(32,Math.floor(this.accumulator/DT));
      if(count){this.accumulator-=count*DT;const next=await gpu.advance(count,this.p);if(version!==this.generation)return;this.states=next;this.steps+=count;}
      this.draw();
    }catch(error){if(version===this.generation)this.ui.onError(error);}
    finally{this.busy=false;for(const retired of this.retired)retired.destroy();this.retired.clear();}
  }
}
