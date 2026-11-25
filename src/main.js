import { GPUBackend } from './compute/gpu-backend.js';
import { DT, GROW_DURATION, growthLength } from './physics/pendulum.js';
import { SingleView } from './views/single.js';
import { element, setupChrome } from './ui/controls.js';
import { createEnsemble, cellInitial, DEG } from './physics/ensemble.js';
import { GridView } from './views/grid.js';
import { drawLegend } from './render/angle-colour.js';
import { setupAngleDomain, readDomain } from './ui/angle-domain.js';
import { storyFrame, storyEnsemble, STORY_DURATION } from './story/grid-story.js';
import { StoryGridView } from './views/story-grid.js';

setupChrome();
setupAngleDomain();
const status=element('view-status');
const form=/** @type {HTMLFormElement} */(element('parameters'));
const input=id=>/** @type {HTMLInputElement} */(element(id));
const number=id=>Number(input(id).value);
const view=new SingleView(/** @type {HTMLCanvasElement} */(element('view')));
const grid=new GridView(/** @type {HTMLCanvasElement} */(element('view')));
const storyView=new StoryGridView(/** @type {HTMLCanvasElement} */(element('view')));
const cellView=new SingleView(/** @type {HTMLCanvasElement} */(element('cell-view')));
const inspector=/** @type {HTMLDialogElement} */(element('inspector'));
drawLegend(/** @type {HTMLCanvasElement} */(element('colour-legend')));
let ensemble=createEnsemble(10,{center1:0,center2:0,span1:360,span2:360});
let mode='single', requestedMode='single', selected=0;
let pendingConfig;
let p={l1:1,l2:1,m1:1,m2:1}, grow=true, time=0, steps=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let states=new Float32Array([110*Math.PI/180,100*Math.PI/180,0,0,110*Math.PI/180+.0001,100*Math.PI/180,0,0]);
let backend, busy=false, resetPending=true, stepPending=false, accumulator=0, last=0, failed=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let story,storyRequested=false,replayRequested=false,exploreRequested=false;
let singleInitial=[110*DEG,100*DEG];
function setPaused(value) {
  paused=value; element('pause-label').textContent=value?'Play':'Pause';
  element('pause').setAttribute('aria-label',value?'Play simulation':'Pause simulation');
}
setPaused(paused);
function restart() {
  if(!form.reportValidity()) return;
  if(mode==='story'){story=null;mode='single';requestedMode='single';storyRequested=false;replayRequested=false;exploreRequested=false;syncMode();}
  pendingConfig={p:{l1:number('length1'),l2:number('length2'),m1:number('mass1'),m2:number('mass2')},
    grow:input('opening').value==='grow',a:number('angle1')*DEG,b:number('angle2')*DEG,
    mode:requestedMode,ensemble:createEnsemble(number('grid-size'),readDomain())};
  resetPending=true; accumulator=0; view.clear();cellView.clear();
}
form.addEventListener('submit',e=>{e.preventDefault();restart();});
element('defaults').addEventListener('click',()=>{form.reset();input('speed').value='1';input('trails').checked=true;input('compare').checked=false;input('colour-source').value='current';input('grid-transition').value='story';restart();});
element('restart').addEventListener('click',restart);
element('pause').addEventListener('click',()=>setPaused(!paused));
element('step').addEventListener('click',()=>{setPaused(true);stepPending=true;});
input('trails').addEventListener('change',()=>view.clear());
input('compare').addEventListener('change',()=>view.clear());
function syncMode() {
  const isGrid=mode==='grid';
  element('app').classList.toggle('grid-mode',isGrid);
  element('app').classList.toggle('story-mode',mode==='story');
  element('story-overlay').classList.toggle('hidden',mode!=='story');
  for(const id of ['settings-toggle','step'])/** @type {HTMLButtonElement} */(element(id)).disabled=mode==='story';
  for(const id of ['single-controls','opening-controls','single-display'])element(id).classList.toggle('hidden',isGrid);
  for(const id of ['grid-controls','grid-display'])element(id).classList.toggle('hidden',!isGrid);
  element('grid-toggle').setAttribute('aria-pressed',String(isGrid));
  element('grid-label').textContent=mode==='story'?'Exit':isGrid?'Single':'Grid';
  element('view').setAttribute('tabindex',isGrid?'0':'-1');
  element('view').setAttribute('aria-label',isGrid?'Pendulum grid. Arrow keys select a cell; Enter opens inspection.':'Animated double pendulum');
  for(const id of ['cell-row','cell-col'])input(id).max=String(ensemble.size);
}
element('grid-toggle').addEventListener('click',()=>{
  if(mode==='story'){exploreRequested=true;return;}
  if(mode==='single'&&input('grid-transition').value==='story'){requestStory();return;}
  if(!form.reportValidity())return;
  requestedMode=requestedMode==='single'?'grid':'single';restart();
});
function requestStory() {
  if(!backend||failed)return;
  if(mode==='story'){replayRequested=true;return;}
  if(mode==='grid'){requestedMode='single';restart();}
  storyRequested=true;setPaused(reducedMotion);
}
element('play-story').addEventListener('click',requestStory);
element('replay-story').addEventListener('click',()=>{replayRequested=true;});
element('leave-story').addEventListener('click',()=>{exploreRequested=true;});
function beginStory() {
  const field=storyEnsemble(singleInitial[0],singleInitial[1]);
  const seed=field.initial.slice();seed.set(states.slice(0,4));
  story={elapsed:0,reset:false,seed,field,trail:view.paths[0].map(point=>point.slice()),initialTime:time,initialSteps:steps};
  ensemble=field;states=seed.slice();backend.resetStates(seed);mode='story';storyRequested=false;
  accumulator=0;stepPending=false;syncMode();
}
function paintStory() {
  const scene=storyFrame(story.elapsed,reducedMotion);
  storyView.draw(states,p,scene,story.elapsed,story.trail);
  element('story-chapter').textContent=`${scene.chapter.number} / From one to many`;
  element('story-title').textContent=scene.chapter.title;element('story-caption').textContent=scene.chapter.text;
  element('story-copy').style.opacity=String(scene.opacity);
  element('story-progress').textContent=`${Math.floor(story.elapsed)} / ${STORY_DURATION} s${scene.done?' · complete':''}`;
  status.textContent=`WebGPU · 25,600 experiments · t = ${time.toFixed(2)} s · ${steps} steps${paused?' · paused':''}${accumulator>.25?' · catching up':''}`;
  return scene;
}
async function advanceStory() {
  if(replayRequested){
    backend.resetStates(story.seed);states=story.seed.slice();story.elapsed=0;story.reset=false;time=story.initialTime;steps=story.initialSteps;
    accumulator=0;replayRequested=false;setPaused(reducedMotion);
  }
  if(exploreRequested){
    story=null;exploreRequested=false;mode='grid';requestedMode='grid';
    input('grid-size').value='160';input('domain-preset').value='custom';
    for(const key of ['center1','center2','span1','span2'])input(key).value=String(key.startsWith('center')?((ensemble.domain[key]+180)%360+360)%360-180:ensemble.domain[key]);
    for(const [id,value] of [['length1',p.l1],['length2',p.l2],['mass1',p.m1],['mass2',p.m2]])input(id).value=String(value);
    input('colour-source').value='current';select(0);syncMode();return;
  }
  const scene=storyFrame(story.elapsed,reducedMotion);
  if(scene.reset&&!story.reset){backend.resetStates(ensemble.initial);states=ensemble.initial.slice();time=0;steps=0;story.reset=true;accumulator=0;}
  if(!scene.running)accumulator=0;
  const count=paused||!scene.running?0:Math.min(32,Math.floor(accumulator/DT));
  accumulator-=count*DT;
  if(count>0){states=await backend.advance(count,p);time+=count*DT;steps+=count;}
}
function select(index) {
  selected=index;input('cell-row').value=String(Math.floor(index/ensemble.size)+1);input('cell-col').value=String(index%ensemble.size+1);cellView.clear();
}
function inspect() {
  if(mode!=='grid')return;
  if(!input('cell-row').reportValidity()||!input('cell-col').reportValidity())return;
  if(![number('cell-row'),number('cell-col')].every(v=>Number.isInteger(v)&&v>=1&&v<=ensemble.size))return;
  select((number('cell-row')-1)*ensemble.size+number('cell-col')-1);
  if(!inspector.open)inspector.showModal();
  drawInspection(false);
}
element('inspect').addEventListener('click',inspect);
element('close-inspector').addEventListener('click',()=>inspector.close());
inspector.addEventListener('close',()=>element('inspect').focus());
element('view').addEventListener('click',event=>{
  if(mode!=='grid')return;
  const rect=element('view').getBoundingClientRect(),index=grid.hit(event.clientX-rect.left,event.clientY-rect.top,ensemble.size);
  if(index>=0){select(index);inspect();}
});
element('view').addEventListener('keydown',event=>{
  if(mode!=='grid')return;
  const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-ensemble.size,ArrowDown:ensemble.size};
  if(event.key in deltas){event.preventDefault();select(Math.max(0,Math.min(ensemble.size**2-1,selected+deltas[event.key])));}
  if(event.key==='Enter'){event.preventDefault();inspect();}
});
element('replay-cell').addEventListener('click',()=>{
  const initial=cellInitial(ensemble,selected),wrap=x=>((x/DEG+180)%360+360)%360-180;
  input('angle1').value=String(wrap(initial[0]));input('angle2').value=String(wrap(initial[1]));
  for(const [id,value] of [['length1',p.l1],['length2',p.l2],['mass1',p.m1],['mass2',p.m2]])input(id).value=String(value);
  input('opening').value='fixed';requestedMode='single';inspector.close();restart();
  element('grid-toggle').focus();
});
function drawInspection(sample) {
  if(!inspector.open||mode!=='grid')return;
  const initial=cellInitial(ensemble,selected),current=states.slice(selected*4,selected*4+4);
  element('cell-details').textContent=`Row ${Math.floor(selected/ensemble.size)+1}, column ${selected%ensemble.size+1} · initial θ₁ ${(initial[0]/DEG).toFixed(5)}° · θ₂ ${(initial[1]/DEG).toFixed(5)}°`;
  element('cell-state').textContent=`t = ${time.toFixed(3)} s · ${steps} steps · current θ₁ ${(current[0]/DEG).toFixed(3)}° · θ₂ ${(current[1]/DEG).toFixed(3)}°`;
  cellView.draw(current,p,true,false,sample);
}
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
function fail(error) {
  failed=true; setPaused(true); status.classList.add('error'); status.textContent=error instanceof Error?error.message:String(error);
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=true;
}

async function frame(now) {
  if(failed) return;
  requestAnimationFrame(frame);
  const elapsed=last?(now-last)/1000:0;last=now;
  if(!paused && !document.hidden) accumulator+=elapsed*number('speed');
  if(mode==='story') {
    if(!paused&&!document.hidden)story.elapsed=Math.min(STORY_DURATION,story.elapsed+Math.min(.1,elapsed));
    try {paintStory();}catch(error){fail(error);return;}
  }
  if(!busy && backend) {
    busy=true;
    try {
      if(resetPending) {
        if(!pendingConfig)restart();
        const config=pendingConfig;
        p=config.p;grow=config.grow;mode=config.mode;ensemble=config.ensemble;
        singleInitial=[config.a,config.b];
        if(mode==='grid'){backend.resetStates(ensemble.initial);states=ensemble.initial.slice();}
        else {backend.reset(config.a,config.b);states=new Float32Array([config.a,config.b,0,0,config.a+.0001,config.b,0,0]);}
        select(0);syncMode();
        resetPending=false;time=0;steps=0;accumulator=0;view.clear();
      }
      if(storyRequested&&mode==='single'&&(!grow||time>=GROW_DURATION||p.l2===0))beginStory();
      if(mode==='story'){await advanceStory();return;}
      const count=stepPending?1:paused?0:Math.min(32,Math.floor(accumulator/DT));
      if(stepPending) stepPending=false;else if(!paused) accumulator-=count*DT;
      // Growth uses a deterministic length per fixed step; one GPU readback per frame (not per step).
      // Skip submit/readback when there is no work — dense grids pay heavily for mapAsync.
      if(count>0) {
        if(mode==='single' && grow && time<GROW_DURATION && p.l2>0) {
          const start=time;
          states=await backend.advanceVarying(count,i=>({...p,l2:growthLength(start+i*DT,p.l2)}));
        } else { states=await backend.advance(count,p); }
        time+=count*DT;steps+=count;
      }
      if(resetPending)return;
      if(mode==='grid') {
        grid.draw(states,ensemble,p,selected,input('colour-source').value==='initial',!element('settings').classList.contains('hidden'));
        drawInspection(count>0);
      } else {
        const visual={...p,l2:grow?p.l2*Math.min(1,time/GROW_DURATION):p.l2};
        view.draw(states,visual,input('trails').checked,input('compare').checked,count>0);
      }
      element('phase').textContent=mode==='grid'?'Many beginnings. The same rules.':grow&&time<GROW_DURATION?'From one arm to two':'Deterministic does not mean predictable';
      element('explanation').textContent=mode==='grid'?'Position records the starting angles. Colour records the current angles, unless initial-colour reference is selected.':grow&&time<GROW_DURATION?'The second arm grows over eight simulation seconds. This opening changes the system.':'Compare nearby starting angles. Some trajectories separate rapidly; others stay regular.';
      status.textContent=`WebGPU · ${mode==='grid'?ensemble.size**2+' cells · ':''}t = ${time.toFixed(2)} s · ${steps} steps · Δt = 1/480 s${paused?' · paused':''}${accumulator>.25?' · catching up':''}${storyRequested?' · finishing the opening arm before the story':''}`;
    } catch(error) {fail(error);} finally {busy=false;}
  }
}

GPUBackend.create().then(gpu=>{
  backend=gpu;
  gpu.device.lost.then(info=>fail(new Error(`GPU device lost: ${info.message}. Reload to reconnect.`)));
  gpu.device.addEventListener('uncapturederror',e=>fail(new Error(e.error.message)));
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=false;
  /** @type {HTMLButtonElement} */(element('play-story')).disabled=false;
  requestAnimationFrame(frame);
}).catch(fail);
view.draw(states,{...p,l2:0},false,false,false);
