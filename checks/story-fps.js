/**
 * Live RAF harness mirroring main.js story mode:
 * paint every animation frame; GPU advance+readback only when not busy.
 * Story time runs accelerated so the 40→160 zoom is measured in real Chrome.
 */
import { GPUBackend } from '../src/compute/gpu-backend.js';
import { DT } from '../src/physics/pendulum.js';
import { storyFrame, storyEnsemble, STORY_DURATION } from '../src/story/grid-story.js';
import { StoryGridView } from '../src/views/story-grid.js';

const hud=document.getElementById('hud');
const canvas=/** @type {HTMLCanvasElement} */(document.getElementById('view'));
const view=new StoryGridView(canvas);
const p={l1:1,l2:1,m1:1,m2:1};
const STORY_RATE=6; // story-seconds per wall-second
const buckets=[
  {name:'pre-colour ≤10', match:s=>s.cells<=10&&s.colour<0.05},
  {name:'colour @10', match:s=>s.cells<=10&&s.colour>=0.05&&s.cells<20},
  {name:'zoom→40', match:s=>s.cells>10&&s.cells<40},
  {name:'hold 40', match:s=>s.cells>=39.5&&s.cells<=40.5},
  {name:'zoom→160', match:s=>s.cells>40.5&&s.cells<159},
  {name:'hold 160', match:s=>s.cells>=159}
];
/** @type {Record<string,{frames:number,draw:number[],gpu:number[],frame:number[],cells:number[]}>} */
const stats=Object.fromEntries(buckets.map(b=>[b.name,{frames:0,draw:[],gpu:[],frame:[],cells:[]}]));

const report={done:false,error:null,summary:'',rows:[]};
/** @type {any} */(globalThis).__storyFps=report;

function push(list,value,cap=240){list.push(value);if(list.length>cap)list.shift();}
function mid(list){if(!list.length)return 0;const s=list.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)];}
function mean(list){return list.length?list.reduce((a,b)=>a+b,0)/list.length:0;}

try {
  const gpu=await GPUBackend.create();
  const field=storyEnsemble(40,1.9198621771937625,1.7453292519943295);
  let states=field.initial.slice();
  gpu.resetStates(states);
  states=await gpu.advance(32,p);
  let storyElapsed=114; // running 40×40, followed by the staged 160×160 experiment
  let activeStage=2,resetApplied=true;
  let time=32*DT, steps=32, accumulator=0, last=0, busy=false, lastGpu=0;
  let frames=0, started=performance.now();
  let dwell40Until=0, phase='dwell40';
  dwell40Until=performance.now()+2500;

  function paint(scene) {
    const t0=performance.now();
    view.draw(states,p,scene,storyElapsed,[]);
    return performance.now()-t0;
  }

  async function advance(scene) {
    if(scene.stage!==activeStage) {
      states=storyEnsemble(scene.size,1.9198621771937625,1.7453292519943295).initial.slice();
      gpu.resetStates(states);activeStage=scene.stage;resetApplied=false;accumulator=0;time=0;steps=0;
    }
    if(scene.reset&&!resetApplied){
      states=storyEnsemble(scene.size,1.9198621771937625,1.7453292519943295).initial.slice();
      gpu.resetStates(states);resetApplied=true;accumulator=0;time=0;steps=0;
    }
    if(!scene.running){accumulator=0;return 0;}
    const count=Math.min(32,Math.floor(accumulator/DT));
    accumulator-=count*DT;
    if(count<=0)return 0;
    const t0=performance.now();
    states=await gpu.advance(count,p);
    time+=count*DT;steps+=count;
    return performance.now()-t0;
  }

  function bucketFor(scene){return buckets.find(b=>b.match(scene))?.name??null;}

  function renderHud(scene,drawMs,fps) {
    const lines=[
      'Live story FPS harness (mirrors app: RAF paint + busy-gated GPU readback)',
      `story t=${storyElapsed.toFixed(1)}s  cells=${scene.cells.toFixed(1)}  colour=${scene.colour.toFixed(2)}  steps=${steps}`,
      `instant FPS=${fps.toFixed(0)}  draw=${drawMs.toFixed(1)}ms  lastGPU=${lastGpu.toFixed(1)}ms  busy=${busy}`,
      ''
    ];
    for(const b of buckets){
      const s=stats[b.name];
      if(!s.frames){lines.push(`${b.name}: (no samples yet)`);continue;}
      const fMs=mid(s.frame),dMs=mid(s.draw),gMs=mid(s.gpu);
      lines.push(`${b.name}: n=${s.frames}  medianFPS=${(1000/Math.max(fMs,0.01)).toFixed(0)}  meanFPS=${(1000/Math.max(mean(s.frame),0.01)).toFixed(0)}  draw ${dMs.toFixed(1)}ms  gpu ${gMs.toFixed(1)}ms  cells~${mid(s.cells).toFixed(1)}`);
    }
    hud.textContent=lines.join('\n');
  }

  function finalize() {
    report.done=true;
    report.rows=buckets.map(b=>{
      const s=stats[b.name];
      return {
        phase:b.name,frames:s.frames,
        medianFps:+(1000/Math.max(mid(s.frame),0.01)).toFixed(1),
        meanFps:+(1000/Math.max(mean(s.frame),0.01)).toFixed(1),
        medianDrawMs:+mid(s.draw).toFixed(2),
        medianGpuMs:+mid(s.gpu).toFixed(2),
        medianCells:+mid(s.cells).toFixed(2)
      };
    });
    report.summary=report.rows.map(r=>`${r.phase}:${r.medianFps}fps/draw${r.medianDrawMs}/gpu${r.medianGpuMs}`).join(' | ');
    document.title='DONE '+report.summary;
    hud.textContent=hud.textContent+'\n\nDONE\n'+report.summary;
  }

  function frame(now) {
    const elapsed=last?(now-last)/1000:0;last=now;
    const frameMs=elapsed*1000;
    frames++;
    accumulator+=elapsed;
    if(phase==='dwell40'){
      storyElapsed=114;
      if(performance.now()>=dwell40Until){phase='run';storyElapsed=125;}
    } else {
      storyElapsed=Math.min(STORY_DURATION,storyElapsed+Math.min(0.25,elapsed*STORY_RATE));
    }
    const scene=storyFrame(storyElapsed,false);
    const drawMs=scene.stage===activeStage?paint(scene):0;
    const name=bucketFor(scene);
    if(name&&frameMs>0&&frameMs<250){
      const s=stats[name];
      s.frames++;
      push(s.frame,frameMs);push(s.draw,drawMs);push(s.gpu,lastGpu);push(s.cells,scene.cells);
    }
    renderHud(scene,drawMs,frameMs>0?1000/frameMs:0);
    if(!busy){
      busy=true;
      advance(scene).then(ms=>{if(ms>0)lastGpu=ms;}).catch(err=>{report.error=String(err);document.title='FAIL '+err;}).finally(()=>{busy=false;});
    }
    if(storyElapsed>=STORY_DURATION&&stats['hold 160'].frames>30){finalize();return;}
    if(performance.now()-started>90000){finalize();return;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch(error) {
  report.done=true;report.error=String(error?.stack||error);
  document.title='FAIL '+error;
  hud.textContent=report.error;
}
