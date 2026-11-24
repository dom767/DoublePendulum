import { GPUBackend } from './compute/gpu-backend.js';
import { DT, GROW_DURATION, growthLength } from './physics/pendulum.js';
import { SingleView } from './views/single.js';
import { element, setupChrome } from './ui/controls.js';

setupChrome();
const status=element('view-status');
const form=/** @type {HTMLFormElement} */(element('parameters'));
const input=id=>/** @type {HTMLInputElement} */(element(id));
const number=id=>Number(input(id).value);
const view=new SingleView(/** @type {HTMLCanvasElement} */(element('view')));
let p={l1:1,l2:1,m1:1,m2:1}, grow=true, time=0, steps=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let states=new Float32Array([110*Math.PI/180,100*Math.PI/180,0,0,110*Math.PI/180+.0001,100*Math.PI/180,0,0]);
let backend, busy=false, resetPending=true, stepPending=false, accumulator=0, last=0, failed=false;
function setPaused(value) {
  paused=value; element('pause-label').textContent=value?'Play':'Pause';
  element('pause').setAttribute('aria-label',value?'Play simulation':'Pause simulation');
}
setPaused(paused);
function restart() {
  if(!form.reportValidity()) return;
  p={l1:number('length1'),l2:number('length2'),m1:number('mass1'),m2:number('mass2')};
  grow=input('opening').value==='grow'; resetPending=true; accumulator=0; view.clear();
}
form.addEventListener('submit',e=>{e.preventDefault();restart();});
element('defaults').addEventListener('click',()=>{form.reset();input('speed').value='1';input('trails').checked=true;input('compare').checked=false;restart();});
element('restart').addEventListener('click',restart);
element('pause').addEventListener('click',()=>setPaused(!paused));
element('step').addEventListener('click',()=>{setPaused(true);stepPending=true;});
input('trails').addEventListener('change',()=>view.clear());
input('compare').addEventListener('change',()=>view.clear());
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
function fail(error) {
  failed=true; setPaused(true); status.classList.add('error'); status.textContent=error instanceof Error?error.message:String(error);
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=true;
}

async function frame(now) {
  if(failed) return;
  const elapsed=last?(now-last)/1000:0;last=now;
  if(!paused && !document.hidden) accumulator+=elapsed*number('speed');
  if(!busy && backend) {
    busy=true;
    try {
      if(resetPending) {
        backend.reset(number('angle1')*Math.PI/180,number('angle2')*Math.PI/180);
        resetPending=false;time=0;steps=0;accumulator=0;view.clear();
      }
      const count=stepPending?1:paused?0:Math.min(32,Math.floor(accumulator/DT));
      if(stepPending) stepPending=false;else if(!paused) accumulator-=count*DT;
      // Growth uses a deterministic length per fixed step; one GPU readback per frame (not per step).
      if(grow && time<GROW_DURATION && p.l2>0) {
        const start=time;
        states=await backend.advanceVarying(count,i=>({...p,l2:growthLength(start+i*DT,p.l2)}));
        time+=count*DT;steps+=count;
      } else { states=await backend.advance(count,p);time+=count*DT;steps+=count; }
      const visual={...p,l2:grow?p.l2*Math.min(1,time/GROW_DURATION):p.l2};
      view.draw(states,visual,input('trails').checked,input('compare').checked,count>0);
      element('phase').textContent=grow&&time<GROW_DURATION?'From one arm to two':'Deterministic does not mean predictable';
      element('explanation').textContent=grow&&time<GROW_DURATION?'The second arm grows over eight simulation seconds. This opening changes the system.':'Compare nearby starting angles. Some trajectories separate rapidly; others stay regular.';
      status.textContent=`WebGPU · t = ${time.toFixed(2)} s · ${steps} steps · Δt = 1/480 s${paused?' · paused':''}${accumulator>.25?' · catching up':''}`;
    } catch(error) {fail(error);} finally {busy=false;}
  }
  requestAnimationFrame(frame);
}

GPUBackend.create().then(gpu=>{
  backend=gpu;
  gpu.device.lost.then(info=>fail(new Error(`GPU device lost: ${info.message}. Reload to reconnect.`)));
  gpu.device.addEventListener('uncapturederror',e=>fail(new Error(e.error.message)));
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=false;
  requestAnimationFrame(frame);
}).catch(fail);
view.draw(states,{...p,l2:0},false,false,false);
