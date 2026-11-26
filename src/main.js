import { setupSingleDrag } from './ui/single-drag.js';
import { setupMapGestures } from './ui/map-gestures.js';
import { MapInspector } from './ui/map-inspector.js';
import { GPUBackend } from './compute/gpu-backend.js';
import { DT, INTRO_DURATION, OPENING_DURATION, openingLength, openingVisualLength } from './physics/pendulum.js';
import { SingleView } from './views/single.js';
import { element, setupChrome } from './ui/controls.js';
import { createEnsemble, createPixelField, sampleField, sampleTile, pixelInitial, cellInitial, DEG, presets } from './physics/ensemble.js';
import { zoomDomain, panDomain, wrap180 } from './physics/domain-view.js';
import { GridView } from './views/grid.js';
import { FieldView } from './views/field.js';
import { drawLegend } from './render/angle-colour.js';
import { setupAngleDomain, readDomain, readFieldDomain, writeFieldDomain } from './ui/angle-domain.js';
import { storyFrame, storyEnsemble, STORY_DURATION } from './story/grid-story.js';
import { StoryGridView } from './views/story-grid.js';
import { MapRunner } from './maps/runner.js';
import { DEFAULT_MAP_STEPS, MAP_METRICS, isValidMetric, isValidDtDenom, formatDt, physicalDuration, drawMetricLegend } from './maps/metrics.js';
import { BookmarkStore } from './maps/bookmarks.js';
import { encodeShareHash, decodeShareHash } from './maps/state.js';

setupChrome(()=>{if(!matchMedia('(min-width: 768px)').matches)pointInspector.close();});
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
const fieldLegendCanvas=/** @type {HTMLCanvasElement} */(element('field-colour-legend'));
drawLegend(/** @type {HTMLCanvasElement} */(element('colour-legend')));
let ensemble=createEnsemble(10,{center1:0,center2:0,span1:360,span2:360});
let mode='single', requestedMode='single', selected=0, fieldRun='animate';
/** @type {import('./maps/metrics.js').MapMetricId} */ let mapMetric='final-angle';
let mapSteps=DEFAULT_MAP_STEPS, mapDtDenom=480, mapPreview=true;
let pendingConfig;
let p={l1:1,l2:1,m1:1,m2:1}, grow=false, time=0, steps=0, paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let states=new Float32Array([110*Math.PI/180,100*Math.PI/180,0,0,110*Math.PI/180+.0001,100*Math.PI/180,0,0]);
/** @type {Uint8ClampedArray|null} */ let fieldColours=null;
let backend, busy=false, resetPending=true, stepPending=false, accumulator=0, last=0, failed=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let story,storyRequested=false,replayRequested=false,exploreRequested=false;
let singleInitial=[110*DEG,100*DEG];
const mapRunner=new MapRunner();
const bookmarkStore=new BookmarkStore();
let mapGeneration=0;
let panMoved=false;
/** @type {{theta1:number,theta2:number,u:number,v:number}|null} */ let fieldProbe=null;

function canvasSize() {
  return {width:Math.max(2,Math.round(canvas.clientWidth)),height:Math.max(2,Math.round(canvas.clientHeight))};
}
function readMapMetric() {
  const raw=input('map-metric').value;
  return isValidMetric(raw)?raw:'final-angle';
}
function readMapSteps() {
  input('map-steps').value=String(DEFAULT_MAP_STEPS);
  return DEFAULT_MAP_STEPS;
}
function readMapDtDenom() {
  const d=Number(input('map-dt').value);
  return isValidDtDenom(d)?d:480;
}
function updateDurationReadout() {
  const n=readMapSteps(), dt=readMapDtDenom(), T=physicalDuration(n,dt);
  element('map-duration').textContent=`T = N·Δt = ${T.toFixed(3)} s (${n} × ${formatDt(dt)})`;
}
function updateFieldLegend() {
  const activeMetric=fieldRun==='map'?mapMetric:'final-angle';
  const info=MAP_METRICS[activeMetric];
  element('field-legend-title').textContent=info.title;
  element('field-legend-copy').textContent=info.description;
  drawMetricLegend(fieldLegendCanvas,activeMetric,mapSteps,mapDtDenom);
}
function updateProbeUI() {
  const box=element('field-probe');
  if(!fieldProbe||mode!=='field') { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  element('field-probe-text').textContent=`Selected start: θ₁ ${(fieldProbe.theta1/DEG).toFixed(4)}°, θ₂ ${(fieldProbe.theta2/DEG).toFixed(4)}°`;
}
function renderBookmarks(selectId) {
  const {builtin,saved}=bookmarkStore.list();
  const builtinGroup=element('builtin-bookmarks-group');
  const savedGroup=element('saved-bookmarks-group');
  builtinGroup.textContent=''; savedGroup.textContent='';
  for(const bm of builtin) {
    const opt=document.createElement('option');
    opt.value=bm.id; opt.textContent=bm.name;
    builtinGroup.appendChild(opt);
  }
  for(const bm of saved) {
    const opt=document.createElement('option');
    opt.value=bm.id; opt.textContent=bm.name;
    savedGroup.appendChild(opt);
  }
  const selectEl=input('bookmark-select');
  const targetId=selectId&&bookmarkStore.find(selectId)?selectId:(builtin[0]?.id||'');
  if(targetId) selectEl.value=targetId;
  syncBookmarkButtons();
}
function syncBookmarkButtons() {
  const chosen=bookmarkStore.find(input('bookmark-select').value);
  /** @type {HTMLButtonElement} */(element('bookmark-delete')).disabled=!chosen||chosen.builtin;
  /** @type {HTMLButtonElement} */(element('bookmark-clear')).disabled=bookmarkStore.list().saved.length===0;
}
function setPaused(value) {
  paused=value; element('pause-label').textContent=value?'Play':'Pause';
  element('pause').setAttribute('aria-label',value?'Play simulation':'Pause simulation');
}
setPaused(paused);
function setFieldEnabled(on) {
  const mapOn=on&&input('field-run').value==='map';
  for(const id of ['field-run','field-domain-preset','field-center1','field-center2','field-span1','field-span2']) input(id).disabled=!on;
  for(const id of ['map-metric','map-steps','map-dt','map-preview']) input(id).disabled=!mapOn;
  element('map-controls').classList.toggle('hidden',!mapOn);
}
function setGridEnabled(on) {
  for(const id of ['domain-preset','grid-size','center1','center2','span1','span2','cell-row','cell-col']) input(id).disabled=!on;
}
function makeFieldEnsemble(width,height,domain,run) {
  if(run==='map') return {size:Math.max(width,height),width,height,domain:{...domain},initial:new Float32Array(0)};
  return createPixelField(width,height,domain);
}
function restart() {
  setGridEnabled(requestedMode==='grid'); setFieldEnabled(requestedMode==='field');
  if(!form.reportValidity()) return;
  if(mode==='story'){story=null;mode='single';requestedMode='single';storyRequested=false;replayRequested=false;exploreRequested=false;syncMode();}
  const size=canvasSize(), run=input('field-run').value==='map'?'map':'animate';
  pendingConfig={p:{l1:number('length1'),l2:number('length2'),m1:number('mass1'),m2:number('mass2')},
    grow:input('opening').value==='grow',a:number('angle1')*DEG,b:number('angle2')*DEG,
    mode:requestedMode,fieldRun:run,metric:readMapMetric(),mapSteps:readMapSteps(),mapDtDenom:readMapDtDenom(),
    mapPreview:input('map-preview').checked,
    ensemble:requestedMode==='field'?makeFieldEnsemble(size.width,size.height,readFieldDomain(),run):createEnsemble(number('grid-size'),readDomain())};
  cancelInteractions(); mapRunner.cancel(); mapGeneration++; pointInspector.close();
  resetPending=true; stepPending=false; accumulator=0; fieldProbe=null; updateProbeUI(); view.clear(); cellView.clear(); fieldView.clear();
}
function applyShareState(state) {
  for(const [id,val] of [['length1',state.p.l1],['length2',state.p.l2],['mass1',state.p.m1],['mass2',state.p.m2]]) input(id).value=String(val);
  if(state.mode==='field') {
    input('field-run').value=state.fieldRun;
    input('map-metric').value=state.metric;
    input('map-steps').value=String(state.steps);
    input('map-dt').value=String(state.dtDenom);
    writeFieldDomain(state.domain);
    updateDurationReadout();
    requestedMode='field';
  } else if(state.mode==='grid') {
    input('domain-preset').value='custom';
    for(const key of ['center1','center2','span1','span2']) input(key).value=String(state.domain[key]);
    requestedMode='grid';
  } else {
    input('angle1').value=String(state.domain.center1);
    input('angle2').value=String(state.domain.center2);
    input('opening').value='fixed';
    requestedMode='single';
  }
  restart();
}
function loadShareHash(hash) {
  const decoded=decodeShareHash(hash);
  if(!decoded) return false;
  if(decoded.ok===false) { element('share-status').textContent=decoded.error; return false; }
  applyShareState(decoded.state);
  element('share-status').textContent=decoded.notice||'Loaded shared view.';
  return true;
}
form.addEventListener('submit',e=>{e.preventDefault();restart();});
element('defaults').addEventListener('click',()=>{
  form.reset();input('speed').value='1';input('trails').checked=true;input('compare').checked=false;
  input('colour-source').value='current';input('field-run').value='animate';
  input('map-metric').value='final-angle';input('map-steps').value=String(DEFAULT_MAP_STEPS);
  input('map-dt').value='480';input('map-preview').checked=true;
  element('share-status').textContent=''; element('bookmark-status').textContent='';
  try { if(globalThis.location?.hash) globalThis.history?.replaceState?.(null,'',globalThis.location.pathname+globalThis.location.search); } catch {}
  updateDurationReadout();
  restart();
});
element('restart').addEventListener('click',restart);
element('pause').addEventListener('click',()=>setPaused(!paused));
element('step').addEventListener('click',()=>{setPaused(true);stepPending=true;});
input('trails').addEventListener('change',()=>view.clear());
input('compare').addEventListener('change',()=>view.clear());
input('field-run').addEventListener('change',()=>{
  setFieldEnabled(mode==='field'||requestedMode==='field');
  if(mode==='field'){requestedMode='field';restart();}
});
input('map-metric').addEventListener('change',()=>{
  if(mode==='field'&&fieldRun==='map'){requestedMode='field';restart();}
});
input('map-preview').addEventListener('change',()=>{
  mapPreview=input('map-preview').checked;
  if(mode==='field'&&fieldRun==='map'){requestedMode='field';restart();}
});
input('map-steps').addEventListener('input',updateDurationReadout);
input('map-dt').addEventListener('change',updateDurationReadout);
function updateFieldResolutionText() {
  const size=canvasSize();
  if(fieldRun==='map') {
    const T=physicalDuration(mapSteps,mapDtDenom);
    element('field-resolution').textContent=`Map ${ensemble.width} × ${ensemble.height} · ${MAP_METRICS[mapMetric].shortLabel} · N = ${mapSteps}, Δt = ${formatDt(mapDtDenom)}, T = ${T.toFixed(3)} s · canvas ${size.width} × ${size.height}`;
  } else {
    element('field-resolution').textContent=`Simulation ${ensemble.width} × ${ensemble.height} · one pendulum per CSS pixel · canvas ${size.width} × ${size.height}`;
  }
}
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
  element('single-toggle').setAttribute('aria-pressed',String(mode==='single'));
  element('grid-label').textContent='Grid';
  element('field-label').textContent='Map';
  element('view').setAttribute('tabindex','0');
  element('view').setAttribute('aria-label',isField?'Pixel field and fixed-duration map. Wheel or pinch zooms; drag pans; click selects a starting point. Arrow keys pan, plus/minus zoom, Enter previews the centre.':isGrid?'Pendulum grid. Arrow keys select a cell; Enter opens inspection.':'Animated double pendulum');
  if(isGrid) for(const id of ['cell-row','cell-col'])input(id).max=String(ensemble.size);
  if(isField) { updateFieldResolutionText(); updateFieldLegend(); updateProbeUI(); }
  renderStatus.classList.toggle('hidden',!(isField&&fieldRun==='map'));
}
for(const [id,next] of [['single-toggle','single'],['grid-toggle','grid'],['field-toggle','field']]) {
  element(id).addEventListener('click',()=>{
    story=null;storyRequested=false;replayRequested=false;exploreRequested=false;
    if(mode==='story')mode='single';
    requestedMode=next;if(next==='single')input('opening').value='fixed';restart();
  });
}
element('shot').addEventListener('click',()=>{
  const link=document.createElement('a');link.download='double-pendulum.png';link.href=canvas.toDataURL('image/png');link.click();
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
  if(mode==='field') {
    const rect=canvas.getBoundingClientRect();
    if(event.key==='Enter'){event.preventDefault();choosePoint(rect.left+rect.width/2,rect.top+rect.height/2);}
    const shifts={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};
    if(event.key in shifts){event.preventDefault();const [x,y]=shifts[event.key];queuedDomain=panDomain(ensemble.domain,x,y);}
    if(event.key==='+'||event.key==='-'){event.preventDefault();queuedDomain=zoomDomain(ensemble.domain,event.key==='+'?.8:1.25,.5,.5);}
    return;
  }
  if(mode!=='grid')return;
  const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-ensemble.size,ArrowDown:ensemble.size};
  if(event.key in deltas){event.preventDefault();select(Math.max(0,Math.min(ensemble.size**2-1,selected+deltas[event.key])));}
  if(event.key==='Enter'){event.preventDefault();inspect();}
});
function replayAnglesInSingle(theta1,theta2) {
  input('angle1').value=String(wrap180(theta1/DEG));
  input('angle2').value=String(wrap180(theta2/DEG));
  for(const [id,value] of [['length1',p.l1],['length2',p.l2],['mass1',p.m1],['mass2',p.m2]]) input(id).value=String(value);
  input('opening').value='fixed';
  requestedMode='single';
  restart();
}
element('replay-cell').addEventListener('click',()=>{
  const initial=cellInitial(ensemble,selected);
  inspector.close();
  replayAnglesInSingle(initial[0],initial[1]);
  element('grid-toggle').focus();
});
element('field-replay-point').addEventListener('click',()=>{
  if(!fieldProbe) return;
  replayAnglesInSingle(fieldProbe.theta1,fieldProbe.theta2);
  element('field-toggle').focus();
});
function drawInspection(sample) {
  if(!inspector.open||mode!=='grid')return;
  const initial=cellInitial(ensemble,selected),current=states.slice(selected*4,selected*4+4);
  element('cell-details').textContent=`Row ${Math.floor(selected/ensemble.size)+1}, column ${selected%ensemble.size+1} · initial θ₁ ${(initial[0]/DEG).toFixed(5)}° · θ₂ ${(initial[1]/DEG).toFixed(5)}°`;
  element('cell-state').textContent=`t = ${time.toFixed(3)} s · ${steps} steps · current θ₁ ${(current[0]/DEG).toFixed(3)}° · θ₂ ${(current[1]/DEG).toFixed(3)}°`;
  cellView.draw(current,p,true,false,sample);
}
function startMapJob() {
  fieldView.clear();
  fieldColours=null;
  mapGeneration=mapRunner.begin({
    width:ensemble.width,
    height:ensemble.height,
    target:mapSteps,
    dtDenom:mapDtDenom,
    metric:mapMetric,
    preview:mapPreview
  });
}
function resampleField(domain) {
  writeFieldDomain(domain);
  const size=canvasSize();
  ensemble=makeFieldEnsemble(size.width,size.height,domain,fieldRun);
  fieldProbe=null; updateProbeUI();
  fieldColours=null; time=0; steps=0; accumulator=0;
  if(fieldRun==='map') {
    startMapJob();
  } else {
    backend.resetStates(ensemble.initial);
    states=ensemble.initial.slice();
    fieldView.clear();
  }
  updateFieldResolutionText();
}
element('field-zoom-in').addEventListener('click',()=>{
  if(mode!=='field') return;
  queuedDomain=zoomDomain(ensemble.domain,0.5,0.5,0.5);
});
element('field-zoom-out').addEventListener('click',()=>{
  if(mode!=='field') return;
  queuedDomain=zoomDomain(ensemble.domain,2,0.5,0.5);
});
element('field-reset-view').addEventListener('click',()=>{
  if(mode!=='field') return;
  queuedDomain={...presets.full};
  input('field-domain-preset').value='full';
});
input('bookmark-select').addEventListener('change',syncBookmarkButtons);
element('bookmark-load').addEventListener('click',()=>{
  const bm=bookmarkStore.find(input('bookmark-select').value);
  if(!bm) return;
  input('field-run').value='map';
  input('map-metric').value=bm.metric;
  input('map-steps').value=String(bm.steps);
  input('map-dt').value=String(bm.dtDenom);
  writeFieldDomain(bm.domain);
  for(const [id,val] of [['length1',bm.p.l1],['length2',bm.p.l2],['mass1',bm.p.m1],['mass2',bm.p.m2]]) input(id).value=String(val);
  updateDurationReadout();
  requestedMode='field';
  element('bookmark-status').textContent=bm.note||`Opened “${bm.name}”.`;
  restart();
});
element('bookmark-save').addEventListener('click',()=>{
  const domain=mode==='field'?ensemble.domain:readFieldDomain();
  const snapshot={
    domain:{...domain},
    steps:readMapSteps(),
    dtDenom:readMapDtDenom(),
    metric:readMapMetric(),
    p:{...p}
  };
  try {
    const res=bookmarkStore.save(input('bookmark-name').value,snapshot);
    input('bookmark-name').value='';
    renderBookmarks(res.bookmark.id);
    element('bookmark-status').textContent=res.persisted?`Saved “${res.bookmark.name}” in this browser.`:res.error;
  } catch(error) {
    element('bookmark-status').textContent=error instanceof Error?error.message:String(error);
  }
});
element('bookmark-delete').addEventListener('click',()=>{
  const id=input('bookmark-select').value;
  const res=bookmarkStore.remove(id);
  renderBookmarks();
  element('bookmark-status').textContent=res.removed?'Removed saved bookmark.':'Built-in regions cannot be deleted.';
});
element('bookmark-clear').addEventListener('click',()=>{
  bookmarkStore.clearSaved();
  renderBookmarks();
  element('bookmark-status').textContent='Cleared saved bookmarks in this browser.';
});
element('copy-share-link').addEventListener('click',async()=>{
  const activeDomain=mode==='field'||mode==='grid'?ensemble.domain:{center1:singleInitial[0]/DEG,center2:singleInitial[1]/DEG,span1:360,span2:360};
  const hash=encodeShareHash({
    mode:mode==='story'?'grid':/** @type {'single'|'grid'|'field'} */(mode),
    fieldRun:fieldRun==='map'?'map':'animate',
    metric:mapMetric,
    steps:mapSteps,
    dtDenom:mapDtDenom,
    domain:activeDomain,
    p
  });
  const loc=globalThis.location;
  const url=loc&&loc.origin&&loc.origin!=='null'?`${loc.origin}${loc.pathname}${loc.search}${hash}`:hash;
  try {
    if(navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      element('share-status').textContent='Share link copied to clipboard.';
    } else {
      element('share-status').textContent=`Share hash: ${hash}`;
    }
  } catch {
    element('share-status').textContent=`Share hash: ${hash}`;
  }
});
const pointInspector=new MapInspector({panel:element('map-inspector'),
  canvas:/** @type {HTMLCanvasElement} */(element('map-point-view')),
  angles:element('map-point-angles'),clock:element('map-point-time'),onError:fail});
element('map-point-close').addEventListener('click',()=>{pointInspector.close();canvas.focus();});
element('map-point-restart').addEventListener('click',()=>pointInspector.restart());
element('map-point-single').addEventListener('click',()=>{
  if(pointInspector.initial)replayAnglesInSingle(pointInspector.initial[0],pointInspector.initial[1]);
});
function choosePoint(x,y) {
  const hit=fieldView.hit(x,y);if(!hit||!backend)return;
  const [theta1,theta2]=pixelInitial(ensemble.width,ensemble.height,hit.row,hit.col,ensemble.domain);
  fieldProbe={theta1,theta2,u:hit.u,v:hit.v};updateProbeUI();
  if(!matchMedia('(min-width: 768px)').matches) {
    element('settings').classList.add('hidden');element('nav-scrim').classList.add('hidden');
    element('settings-toggle').setAttribute('aria-pressed','false');document.body.classList.toggle('panel-open',false);
  }
  pointInspector.open(backend,theta1,theta2,p);setPaused(reducedMotion);
}
let queuedDomain=null,poseVersion=0,poseReset=false;
const mapGestures=setupMapGestures(canvas,{
  enabled:()=>mode==='field'&&!resetPending,domain:()=>ensemble.domain,
  preview:(domain,transform)=>{
    panMoved=true;mapRunner.cancel();mapGeneration++;
    fieldView.draw(fieldRun==='map'?null:fieldColours,ensemble.width,ensemble.height,domain,'Release to resample',
      {isPreview:true,previewBadge:'PREVIEW',transform});
  },commit:domain=>{panMoved=false;queuedDomain=domain;},tap:choosePoint
});
const singleDrag=setupSingleDrag(canvas,{
  enabled:()=>mode==='single'&&!grow&&!resetPending&&!failed,pose:()=>({states,p}),
  edit:(a,b)=>{
    setPaused(true);poseVersion++;stepPending=false;
    states=new Float32Array([a,b,0,0,a+.0001,b,0,0]);singleInitial=[a,b];
    time=0;steps=0;accumulator=0;view.clear();poseReset=true;
    input('angle1').value=String(wrap180(a/DEG));input('angle2').value=String(wrap180(b/DEG));
    view.draw(states,p,input('trails').checked,input('compare').checked,false);
  }
});
function cancelInteractions(){mapGestures.cancel();singleDrag.cancel();panMoved=false;queuedDomain=null;}
globalThis.addEventListener?.('resize',()=>{cancelInteractions();if(mode==='field')queuedDomain={...ensemble.domain};});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){pointInspector.close();const interrupted=panMoved;cancelInteractions();if(interrupted&&mode==='field')queuedDomain={...ensemble.domain};}});
function updateMapProgress() {
  const T=physicalDuration(mapRunner.target,mapRunner.dtDenom);
  const dtLabel=formatDt(mapRunner.dtDenom);
  renderStatus.classList.toggle('is-preview',mapRunner.isPreview);
  if(mapRunner.complete) {
    renderFill.style.width='100%';
    renderLabel.textContent=`Complete · N=${mapRunner.target} · Δt=${dtLabel} · T=${T.toFixed(3)} s`;
  } else if(mapRunner.phase==='preview') {
    const pct=Math.round(mapRunner.previewProgress*100);
    renderFill.style.width=`${pct}%`;
    renderLabel.textContent=`Preview (¼×) · ${mapRunner.previewTile?.done??0} / ${mapRunner.target} steps`;
  } else {
    const pct=Math.round(mapRunner.progress*100);
    renderFill.style.width=`${pct}%`;
    renderLabel.textContent=`Preview · full map ${pct}% · N=${mapRunner.target} · T=${T.toFixed(3)} s`;
  }
}
function paintField() {
  if(fieldRun==='map') {
    const T=physicalDuration(mapRunner.target,mapRunner.dtDenom);
    const metricLabel=MAP_METRICS[mapMetric].shortLabel;
    const detail=`${metricLabel} · N=${mapRunner.target} · Δt=${formatDt(mapRunner.dtDenom)} · T=${T.toFixed(3)} s`;
    let caption, previewBadge='PREVIEW';
    if(mapRunner.complete) {
      caption=`${ensemble.width}×${ensemble.height} fixed-duration map`;
    } else if(mapRunner.phase==='preview') {
      caption=`Computing coarse ¼× preview…`;
      previewBadge='PREVIEW · ¼×';
    } else {
      caption=`Full ${ensemble.width}×${ensemble.height} map · ${Math.round(mapRunner.progress*100)}%`;
      previewBadge=mapRunner.previewReady?'PREVIEW · ¼×':'PREVIEW';
    }
    fieldView.draw(null,ensemble.width,ensemble.height,ensemble.domain,caption,
      {isPreview:mapRunner.isPreview,previewBadge,detailLine:detail,probe:fieldProbe});
    return;
  }
  fieldView.draw(fieldColours,ensemble.width,ensemble.height,ensemble.domain,`${ensemble.width}×${ensemble.height} live field`,{probe:fieldProbe});
}
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
globalThis.addEventListener?.('hashchange',()=>{ if(globalThis.location?.hash) loadShareHash(globalThis.location.hash); });
function fail(error) {
  failed=true; setPaused(true); status.classList.add('error'); status.textContent=error instanceof Error?error.message:String(error);
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=true;
}

async function frame(now) {
  if(failed) return;
  requestAnimationFrame(frame);
  const elapsed=last?(now-last)/1000:0;last=now;
  if(!paused && !document.hidden) accumulator+=elapsed*number('speed');
  pointInspector.tick(elapsed,paused||document.hidden,number('speed'));
  if(mode==='story') {
    if(!paused&&!document.hidden)story.elapsed=Math.min(STORY_DURATION,story.elapsed+Math.min(.1,elapsed));
    if(storyFrame(story.elapsed,reducedMotion).stage===story.stage)try {paintStory();}catch(error){fail(error);return;}
  }
  if(!busy && backend) {
    busy=true;
    try {
      if(queuedDomain&&!resetPending){const domain=queuedDomain;queuedDomain=null;resampleField(domain);}
      if(poseReset){backend.reset(states[0],states[1]);poseReset=false;}
      if(resetPending) {
        if(!pendingConfig)restart();
        const config=pendingConfig;
        p=config.p;grow=config.grow;mode=config.mode;ensemble=config.ensemble;fieldRun=config.fieldRun;
        mapMetric=config.metric;mapSteps=config.mapSteps;mapDtDenom=config.mapDtDenom;mapPreview=config.mapPreview;
        singleInitial=[config.a,config.b];
        if(mode==='grid'||(mode==='field'&&fieldRun==='animate')){backend.resetStates(ensemble.initial);states=ensemble.initial.slice();fieldColours=null;}
        else if(mode==='field'&&fieldRun==='map'){fieldColours=null;}
        else {backend.reset(config.a,config.b);states=new Float32Array([config.a,config.b,0,0,config.a+.0001,config.b,0,0]);}
        if(mode==='field'&&fieldRun==='map') startMapJob();
        else mapRunner.cancel();
        select(0);syncMode();
        resetPending=false;time=0;steps=0;accumulator=0;view.clear();
      }
      if(storyRequested&&mode==='single'&&(!grow||time>=(p.l2===0?INTRO_DURATION:OPENING_DURATION)))beginStory();
      if(mode==='story'){await advanceStory();return;}
      if(mode==='field') {
        if(fieldRun==='map') {
          if(!mapRunner.complete&&!document.hidden&&!panMoved) {
            const gen=mapGeneration;
            const dt=1/mapRunner.dtDenom;
            const colourMode=MAP_METRICS[mapMetric].mode;
            await mapRunner.pumpTile({
              loadTile:tile=>{
                const tileStates=tile.isPreview
                  ?sampleField(tile.width,tile.height,ensemble.domain)
                  :sampleTile(ensemble.width,ensemble.height,tile.rowStart,tile.rowEnd,ensemble.domain);
                backend.resetMetricStates(tileStates,mapMetric);
              },
              advance:async(batch,stepOffset)=>{
                await backend.advanceMetricInPlace(batch,p,mapMetric,dt,stepOffset);
              },
              readColours:async()=>backend.readColours(colourMode,mapRunner.target),
              commitTile:(tile,colours)=>{
                if(tile.isPreview) fieldView.setPreview(colours,tile.width,tile.height);
                else fieldView.putTile(colours,ensemble.width,ensemble.height,tile.rowStart,tile.rowEnd);
              }
            },gen);
            if(gen!==mapGeneration) return;
          }
          updateMapProgress();
          if(resetPending)return;
          if(!panMoved) paintField();
          const T=physicalDuration(mapRunner.target,mapRunner.dtDenom);
          const stateTag=mapRunner.complete?'complete':mapRunner.phase==='preview'?'preview ¼×':`preview ${Math.round(mapRunner.progress*100)}%`;
          status.textContent=`WebGPU · ${ensemble.width}×${ensemble.height} pixels · ${MAP_METRICS[mapMetric].shortLabel} · N = ${mapRunner.target} · Δt = ${formatDt(mapRunner.dtDenom)} · T = ${T.toFixed(3)} s · ${stateTag}`;
          return;
        }
        const count=stepPending?1:paused?0:Math.min(32,Math.floor(accumulator/DT));
        if(stepPending) stepPending=false;else if(!paused) accumulator-=count*DT;
        if(count>0){await backend.advanceInPlace(count,p);steps+=count;time=steps*DT;}
        if(count>0||!fieldColours) fieldColours=await backend.readColours(0,1000);
        if(resetPending)return;
        if(!panMoved) paintField();
        status.textContent=`WebGPU · ${ensemble.width}×${ensemble.height} pixels · live · t = ${time.toFixed(2)} s · ${steps} steps · Δt = 1/480 s${paused?' · paused':''}${accumulator>.25?' · catching up':''}`;
        return;
      }
      const count=stepPending?1:paused?0:Math.min(32,Math.floor(accumulator/DT));
      if(stepPending) stepPending=false;else if(!paused) accumulator-=count*DT;
      if(count>0) {
        const version=poseVersion;let nextStates;
        if(mode==='single' && grow && time<OPENING_DURATION && p.l2>0) {
          const start=time;
          if(start+count*DT<=INTRO_DURATION)nextStates=await backend.advance(count,{...p,l2:0});
          else nextStates=await backend.advanceVarying(count,i=>({...p,l2:openingLength(start+i*DT,p.l2)}));
        } else { nextStates=await backend.advance(count,p); }
        if(version!==poseVersion||resetPending)return;
        states=nextStates;
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
renderBookmarks();
updateDurationReadout();
if(globalThis.location?.hash) loadShareHash(globalThis.location.hash);
GPUBackend.create().then(gpu=>{
  backend=gpu;
  gpu.device.lost.then(info=>fail(new Error(`GPU device lost: ${info.message}. Reload to reconnect.`)));
  gpu.device.addEventListener('uncapturederror',e=>fail(new Error(e.error.message)));
  for(const id of ['pause','step']) /** @type {HTMLButtonElement} */(element(id)).disabled=false;
  /** @type {HTMLButtonElement} */(element('play-story')).disabled=false;
  requestAnimationFrame(frame);
}).catch(fail);
view.draw(states,p,false,false,false);
