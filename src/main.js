import { GPUBackend } from './compute/gpu-backend.js';
import { DT, INTRO_DURATION, OPENING_DURATION, openingLength, openingVisualLength } from './physics/pendulum.js';
import { SingleView } from './views/single.js';
import { element, setupChrome } from './ui/controls.js';
import { createEnsemble, createPixelField, cellInitial, DEG, MAP_STEPS } from './physics/ensemble.js';
import { zoomDomain, panDomain } from './physics/domain-view.js';
import { GridView } from './views/grid.js';
import { FieldView } from './views/field.js';
import { drawLegend } from './render/angle-colour.js';
import { setupAngleDomain, readDomain, readFieldDomain, writeFieldDomain } from './ui/angle-domain.js';
import { storyFrame, storyEnsemble, STORY_DURATION } from './story/grid-story.js';
import { StoryGridView } from './views/story-grid.js';
import { MapRunner } from './maps/runner.js';

setupChrome();
setupAngleDomain();
const status=element('view-status');
const renderStatus=element('render-status');
const renderFill=element('render-fill');
const renderLabel=element('render-label');
const form=/** @type {HTMLFormElement} */(element('parameters'));
const input=id=>/** @type {HTMLInputElement} */(element(id));
const number=id=>Number(input(id).value);
const canvas=/** @type {HTMLCanvasElement} */(element('view'));
const view=new SingleView(canvas);
const grid=new GridView(canvas);
const fieldView=new FieldView(canvas);
const storyView=new StoryGridView(canvas);
const cellView=new SingleView(/** @type {HTMLCanvasElement} */(element('cell-view')));
const inspector=/** @type {HTMLDialogElement} */(element('inspector'));
drawLegend(/** @type {HTMLCanvasElement} */(element('colour-legend')));
drawLegend(/** @type {HTMLCanvasElement} */(element('field-colour-legend')));
let ensemble=createEnsemble(10,{center1:0,center2:0,span1:360,span2:360});
let mode='single', requestedMode='single', selected=0, fieldRun='animate';
let pendingConfig;
let p={l1:1,l2:1,m1:1,m2:1}, grow=true, time=0, steps=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let states=new Float32Array([110*Math.PI/180,100*Math.PI/180,0,0,110*Math.PI/180+.0001,100*Math.PI/180,0,0]);
/** @type {Uint8ClampedArray|null} */ let fieldColours=null;
let backend, busy=false, resetPending=true, stepPending=false, accumulator=0, last=0, failed=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let story,storyRequested=false,replayRequested=false,exploreRequested=false;
let singleInitial=[110*DEG,100*DEG];
const mapRunner=new MapRunner();
let mapGeneration=0;
/** @type {{x:number,y:number}|null} */ let panLast=null;
/** @type {import('./physics/ensemble.js').AngleDomain|null} */ let panDomainDraft=null;
function canvasSize() {
  return {width:Math.max(2,Math.round(canvas.clientWidth)),height:Math.max(2,Math.round(canvas.clientHeight))};
}
function setPaused(value) {
  paused=value; element('pause-label').textContent=value?'Play':'Pause';
  element('pause').setAttribute('aria-label',value?'Play simulation':'Pause simulation');
}
setPaused(paused);
function setFieldEnabled(on) {
  for(const id of ['field-run','field-domain-preset','field-center1','field-center2','field-span1','field-span2']) input(id).disabled=!on;
}
function setGridEnabled(on) {
  for(const id of ['domain-preset','grid-size','center1','center2','span1','span2','cell-row','cell-col']) input(id).disabled=!on;
}
function restart() {
  setGridEnabled(requestedMode==='grid'); setFieldEnabled(requestedMode==='field');
  if(!form.reportValidity()) return;
  if(mode==='story'){story=null;mode='single';requestedMode='single';storyRequested=false;replayRequested=false;exploreRequested=false;syncMode();}
  const size=canvasSize();
  pendingConfig={p:{l1:number('length1'),l2:number('length2'),m1:number('mass1'),m2:number('mass2')},
    grow:input('opening').value==='grow',a:number('angle1')*DEG,b:number('angle2')*DEG,
    mode:requestedMode,fieldRun:input('field-run').value,
    ensemble:requestedMode==='field'?createPixelField(size.width,size.height,readFieldDomain()):createEnsemble(number('grid-size'),readDomain())};
  resetPending=true; accumulator=0; view.clear();cellView.clear();
}
form.addEventListener('submit',e=>{e.preventDefault();restart();});
element('defaults').addEventListener('click',()=>{
  form.reset();input('speed').value='1';input('trails').checked=true;input('compare').checked=false;
  input('colour-source').value='current';input('grid-transition').value='story';input('field-run').value='animate';
  restart();
});
element('restart').addEventListener('click',restart);
element('pause').addEventListener('click',()=>setPaused(!paused));
element('step').addEventListener('click',()=>{setPaused(true);stepPending=true;});
input('trails').addEventListener('change',()=>view.clear());
input('compare').addEventListener('change',()=>view.clear());
input('field-run').addEventListener('change',()=>{ if(mode==='field'){requestedMode='field';restart();} });
function syncMode() {
  const isGrid=mode==='grid', isField=mode==='field';
  element('app').classList.toggle('grid-mode',isGrid);
  element('app').classList.toggle('field-mode',isField);
  element('app').classList.toggle('story-mode',mode==='story');
  element('story-overlay').classList.toggle('hidden',mode!=='story');
  for(const id of ['settings-toggle','step'])/** @type {HTMLButtonElement} */(element(id)).disabled=mode==='story';
  for(const id of ['single-controls','opening-controls','single-display'])element(id).classList.toggle('hidden',isGrid||isField);
  for(const id of ['grid-controls','grid-display'])element(id).classList.toggle('hidden',!isGrid);
  for(const id of ['field-controls','field-display'])element(id).classList.toggle('hidden',!isField);
  setGridEnabled(isGrid); setFieldEnabled(isField);
  element('grid-toggle').setAttribute('aria-pressed',String(isGrid));
  element('field-toggle').setAttribute('aria-pressed',String(isField));
  element('grid-label').textContent=mode==='story'?'Exit':isGrid?'Single':'Grid';
  element('field-label').textContent=isField?'Single':'Field';
  element('view').setAttribute('tabindex',isGrid?'0':'-1');
  element('view').setAttribute('aria-label',isField?'Pixel field of double pendulums. Wheel zooms the angle domain; drag pans.':isGrid?'Pendulum grid. Arrow keys select a cell; Enter opens inspection.':'Animated double pendulum');
  if(isGrid) for(const id of ['cell-row','cell-col'])input(id).max=String(ensemble.size);
  if(isField) element('field-resolution').textContent=`Simulation ${ensemble.width} × ${ensemble.height} · one pendulum per CSS pixel · canvas ${canvas.clientWidth} × ${canvas.clientHeight}`;
  renderStatus.classList.toggle('hidden',!(isField&&fieldRun==='map'));
}
element('grid-toggle').addEventListener('click',()=>{
  if(mode==='story'){exploreRequested=true;return;}
  if(mode==='single'&&input('grid-transition').value==='story'){requestStory();return;}
  requestedMode=mode==='grid'?'single':'grid';restart();
});
element('field-toggle').addEventListener('click',()=>{
  if(mode==='story'){exploreRequested=true;return;}
  requestedMode=mode==='field'?'single':'field';restart();
});
function requestStory() {
  if(!backend||failed)return;
  if(mode==='story'){replayRequested=true;return;}
  if(mode==='grid'||mode==='field'){requestedMode='single';restart();}
  storyRequested=true;setPaused(reducedMotion);
}
element('play-story').addEventListener('click',requestStory);
element('replay-story').addEventListener('click',()=>{replayRequested=true;});
element('leave-story').addEventListener('click',()=>{exploreRequested=true;});
function beginStory() {
  const field=storyEnsemble(2,singleInitial[0],singleInitial[1]);
  const seed=field.initial.slice();seed.set(states.slice(0,4));
  story={elapsed:0,stage:0,reset:false,resetFrom:null,seed,field,trail:view.paths[0].map(point=>point.slice()),initialTime:time,initialSteps:steps};
  ensemble=field;states=seed.slice();backend.resetStates(seed);mode='story';storyRequested=false;
  accumulator=0;stepPending=false;syncMode();
}
function paintStory() {
  const scene=storyFrame(story.elapsed,reducedMotion);
  storyView.draw(states,p,scene,story.elapsed,story.trail,story.resetFrom);
  element('story-chapter').textContent=`${scene.chapter.number} / From one to many`;
  element('story-title').textContent=scene.chapter.title;element('story-caption').textContent=scene.chapter.text;
  element('story-copy').style.opacity=String(scene.opacity);
  element('story-progress').textContent=`${Math.floor(story.elapsed)} / ${STORY_DURATION} s${scene.done?' · complete':''}`;
  status.textContent=`WebGPU · ${ensemble.size**2} experiments · t = ${time.toFixed(2)} s · ${steps} steps${paused?' · paused':''}${!scene.running?' · experiment held':''}${accumulator>.25?' · catching up':''}`;
  return scene;
}
async function advanceStory() {
  if(replayRequested){
    ensemble=story.field;backend.resetStates(story.seed);states=story.seed.slice();story.elapsed=0;story.stage=0;story.reset=false;story.resetFrom=null;time=story.initialTime;steps=story.initialSteps;
    accumulator=0;replayRequested=false;setPaused(reducedMotion);
  }
  if(exploreRequested){
    story=null;exploreRequested=false;mode='grid';requestedMode='grid';
    input('grid-size').value=String(ensemble.size);input('domain-preset').value='custom';
    for(const key of ['center1','center2','span1','span2'])input(key).value=String(key.startsWith('center')?((ensemble.domain[key]+180)%360+360)%360-180:ensemble.domain[key]);
    for(const [id,value] of [['length1',p.l1],['length2',p.l2],['mass1',p.m1],['mass2',p.m2]])input(id).value=String(value);
    input('colour-source').value='current';select(0);syncMode();return;
  }
  const scene=storyFrame(story.elapsed,reducedMotion);
  if(scene.stage!==story.stage) {
    const previous=ensemble,oldStates=states;
    ensemble=storyEnsemble(scene.size,singleInitial[0],singleInitial[1]);
    states=ensemble.initial.slice();
    // Retain the smaller experiment until the next explicit reset, rather than popping its poses.
    for(let row=0;row<previous.size;row++)for(let col=0;col<previous.size;col++) {
      const old=(row*previous.size+col)*4,next=(row*ensemble.size+col)*4;
      states.set(oldStates.subarray(old,old+4),next);
    }
    backend.resetStates(states);story.stage=scene.stage;story.reset=false;story.resetFrom=null;accumulator=0;time=0;steps=0;
  }
  if(scene.reset&&!story.reset){story.resetFrom=states.slice();backend.resetStates(ensemble.initial);states=ensemble.initial.slice();time=0;steps=0;story.reset=true;accumulator=0;}
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
canvas.addEventListener('click',event=>{
  if(mode!=='grid')return;
  const rect=canvas.getBoundingClientRect(),index=grid.hit(event.clientX-rect.left,event.clientY-rect.top,ensemble.size);
  if(index>=0){select(index);inspect();}
});
canvas.addEventListener('keydown',event=>{
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
function resampleField(domain) {
  writeFieldDomain(domain);
  const size=canvasSize();
  ensemble=createPixelField(size.width,size.height,domain);
  backend.resetStates(ensemble.initial);
  states=ensemble.initial.slice();
  fieldColours=null;time=0;steps=0;accumulator=0;
  if(fieldRun==='map') mapGeneration=mapRunner.begin(MAP_STEPS);
  element('field-resolution').textContent=`Simulation ${ensemble.width} × ${ensemble.height} · one pendulum per CSS pixel · canvas ${size.width} × ${size.height}`;
}
canvas.addEventListener('wheel',event=>{
  if(mode!=='field')return;
  event.preventDefault();
  const hit=fieldView.hit(event.clientX,event.clientY); if(!hit)return;
  const factor=event.deltaY>0?1.25:0.8;
  resampleField(zoomDomain(ensemble.domain,factor,hit.u,hit.v));
},{passive:false});
canvas.addEventListener('pointerdown',event=>{
  if(mode!=='field'||event.button!==0)return;
  panLast={x:event.clientX,y:event.clientY};
  panDomainDraft={...ensemble.domain};
  canvas.classList.add('is-panning');
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(mode!=='field'||!panLast||!panDomainDraft)return;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(w<=0||h<=0)return;
  const du=(event.clientX-panLast.x)/w, dv=(event.clientY-panLast.y)/h;
  panLast={x:event.clientX,y:event.clientY};
  if(Math.abs(du)<1e-6&&Math.abs(dv)<1e-6)return;
  // Update the draft domain while dragging; resample once on release so full-canvas maps are not rebuilt every move.
  panDomainDraft=panDomain(panDomainDraft,du,dv);
  writeFieldDomain(panDomainDraft);
  fieldView.draw(fieldColours,ensemble.width,ensemble.height,panDomainDraft,`${ensemble.width}×${ensemble.height} · panning…`);
});
function endPan(event) {
  if(panDomainDraft&&mode==='field') resampleField(panDomainDraft);
  if(panLast&&canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  panLast=null; panDomainDraft=null; canvas.classList.remove('is-panning');
}
canvas.addEventListener('pointerup',endPan);
canvas.addEventListener('pointercancel',endPan);
function updateMapProgress() {
  const pct=Math.round(mapRunner.progress*100);
  renderFill.style.width=`${pct}%`;
  renderLabel.textContent=mapRunner.complete?`Map complete · ${MAP_STEPS} steps · T = ${(MAP_STEPS*DT).toFixed(3)} s`:`Map ${mapRunner.done} / ${MAP_STEPS}`;
}
function paintField() {
  const caption=fieldRun==='map'
    ?(mapRunner.complete?`${ensemble.width}×${ensemble.height} map · ${MAP_STEPS} steps`:`${ensemble.width}×${ensemble.height} map · computing…`)
    :`${ensemble.width}×${ensemble.height} live field`;
  fieldView.draw(fieldColours,ensemble.width,ensemble.height,ensemble.domain,caption);
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
    if(storyFrame(story.elapsed,reducedMotion).stage===story.stage)try {paintStory();}catch(error){fail(error);return;}
  }
  if(!busy && backend) {
    busy=true;
    try {
      if(resetPending) {
        if(!pendingConfig)restart();
        const config=pendingConfig;
        p=config.p;grow=config.grow;mode=config.mode;ensemble=config.ensemble;fieldRun=config.fieldRun;
        singleInitial=[config.a,config.b];
        if(mode==='grid'||mode==='field'){backend.resetStates(ensemble.initial);states=ensemble.initial.slice();fieldColours=null;}
        else {backend.reset(config.a,config.b);states=new Float32Array([config.a,config.b,0,0,config.a+.0001,config.b,0,0]);}
        if(mode==='field'&&fieldRun==='map') mapGeneration=mapRunner.begin(MAP_STEPS);
        else mapRunner.cancel();
        select(0);syncMode();
        resetPending=false;time=0;steps=0;accumulator=0;view.clear();
      }
      if(storyRequested&&mode==='single'&&(!grow||time>=(p.l2===0?INTRO_DURATION:OPENING_DURATION)))beginStory();
      if(mode==='story'){await advanceStory();return;}
      if(mode==='field') {
        if(fieldRun==='map') {
          if(!mapRunner.complete&&!paused&&!document.hidden) {
            const gen=mapGeneration;
            await mapRunner.pump(async batch=>{
              await backend.advanceInPlace(batch,p);
              steps+=batch;time=steps*DT;
            },gen,32);
            if(gen===mapGeneration) fieldColours=await backend.readColours();
          } else if(!fieldColours) fieldColours=await backend.readColours();
          updateMapProgress();
        } else {
          const count=stepPending?1:paused?0:Math.min(32,Math.floor(accumulator/DT));
          if(stepPending) stepPending=false;else if(!paused) accumulator-=count*DT;
          if(count>0){await backend.advanceInPlace(count,p);steps+=count;time=steps*DT;}
          if(count>0||!fieldColours) fieldColours=await backend.readColours();
        }
        if(resetPending)return;
        paintField();
        status.textContent=`WebGPU · ${ensemble.width}×${ensemble.height} pixels · ${fieldRun==='map'?'map N='+MAP_STEPS+' · ':''}t = ${time.toFixed(2)} s · ${steps} steps · Δt = 1/480 s${paused?' · paused':''}${accumulator>.25?' · catching up':''}`;
        return;
      }
      const count=stepPending?1:paused?0:Math.min(32,Math.floor(accumulator/DT));
      if(stepPending) stepPending=false;else if(!paused) accumulator-=count*DT;
      if(count>0) {
        if(mode==='single' && grow && time<OPENING_DURATION && p.l2>0) {
          const start=time;
          if(start+count*DT<=INTRO_DURATION)states=await backend.advance(count,{...p,l2:0});
          else states=await backend.advanceVarying(count,i=>({...p,l2:openingLength(start+i*DT,p.l2)}));
        } else { states=await backend.advance(count,p); }
        steps+=count;time=steps*DT;
      }
      if(resetPending)return;
      if(mode==='grid') {
        grid.draw(states,ensemble,p,selected,input('colour-source').value==='initial',!element('settings').classList.contains('hidden'));
        drawInspection(count>0);
      } else {
        const visual={...p,l2:grow?openingVisualLength(time,p.l2):p.l2};
        view.draw(states,visual,input('trails').checked,input('compare').checked,count>0);
      }
      const simple=mode==='single'&&(p.l2===0||(grow&&time<INTRO_DURATION));
      const extending=mode==='single'&&grow&&time>=INTRO_DURATION&&time<OPENING_DURATION&&p.l2>0;
      element('opening-title').textContent=simple?'The rhythm of\na single pendulum.':extending?'One more arm.\nA richer motion.':'Simple rules.\nComplex motion.';
      element('phase').textContent=mode==='grid'?'Many beginnings. The same rules.':simple?'A predictable rhythm':extending?'From one arm to two':'Deterministic does not mean predictable';
      element('explanation').textContent=mode==='grid'?'Position records the starting angles. Colour records the current angles, unless initial-colour reference is selected.':simple?'Back and forth, a single pendulum repeats its swing. With no friction, the same starting conditions give the same steady rhythm.':extending?'After ten seconds of regular swings, the second arm grows over eight simulation seconds. A new degree of freedom opens up richer motion.':'Compare nearby starting angles. Some trajectories separate rapidly; others stay regular.';
      status.textContent=`WebGPU · ${mode==='grid'?ensemble.size**2+' cells · ':''}t = ${time.toFixed(2)} s · ${steps} steps · Δt = 1/480 s${paused?' · paused':''}${accumulator>.25?' · catching up':''}${storyRequested?' · finishing the single-arm introduction and growth before the story':''}`;
    } catch(error) {fail(error);} finally {busy=false;}
  }
}

setGridEnabled(false); setFieldEnabled(false);
GPUBackend.create().then(gpu=>{
  backend=gpu;
  gpu.device.lost.then(info=>fail(new Error(`GPU device lost: ${info.message}. Reload to reconnect.`)));
  gpu.device.addEventListener('uncapturederror',e=>fail(new Error(e.error.message)));
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=false;
  /** @type {HTMLButtonElement} */(element('play-story')).disabled=false;
  requestAnimationFrame(frame);
}).catch(fail);
view.draw(states,{...p,l2:0},false,false,false);
