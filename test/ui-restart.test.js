import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Boot complete browser modules with the declared HTML controls, without a DOM framework.
async function boot(supported=false,desktop=false,options={}) {
  const html=readFileSync('index.html','utf8'), nodes=new Map();
  for(const match of html.matchAll(/\bid="([^"]+)"[^>]*>/g)) {
    const listeners={};
    const classes=new Set();
    const children=[];
    const node={value:match[0].match(/\bvalue="([^"]*)"/)?.[1]??'',checked:match[0].includes('checked'),disabled:false,
      textContent:'',style:{},width:0,height:0,clientWidth:1000,clientHeight:800,children,
      appendChild(child){children.push(child);return child;},
      classList:{toggle:(x,force)=>{if(force??!classes.has(x))classes.add(x);else classes.delete(x);},contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},
      addEventListener:(type,fn)=>{const previous=listeners[type];listeners[type]=e=>{previous?.(e);return fn(e);};},setAttribute(){},focus(){},reportValidity:()=>true,reset(){},
      open:false,showModal(){this.open=true;},close(){this.open=false;listeners.close?.();},
      setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>false,
      getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800}),
      listeners,getContext:()=>new Proxy({},{get:()=>()=>{}})};
    nodes.set(match[1],node);
  }
  nodes.get('speed').value='1';nodes.get('opening').value='fixed';
  nodes.get('grid-size').value='10';nodes.get('colour-source').value='current';
  nodes.get('field-run').value='animate';
  nodes.get('map-metric').value='final-angle';nodes.get('map-dt').value='480';
  nodes.get('domain-preset').value='full';nodes.get('field-domain-preset').value='full';
  const frames=[],calls=[],copied=[];
  const storageMap=new Map();
  let state=new Float32Array(8);
  const gpu={fork(){return {...this,destroy(){}};},device:{lost:new Promise(()=>{}),addEventListener(){}},
    reset(a,b){state=new Float32Array([a,b,0,0,a+.0001,b,0,0]);calls.push({kind:'reset',state:state.slice()});},
    resetStates(initial){state=initial.slice();calls.push({kind:'grid',state:state.slice()});},
    resetMetricStates(initial,metric){state=initial.slice();calls.push({kind:'grid',state:state.slice(),metric});},
    async advance(count,p){calls.push({kind:'advance',count,p});return state.slice();},
    async advanceInPlace(count,p,dt){calls.push({kind:'inplace',count,p,dt});},
    async advanceMetricInPlace(count,p,metric,dt,offset){calls.push({kind:'inplace',count,p,metric,dt,offset});},
    async readColours(mode=0,target=1000){calls.push({kind:'colours',mode,target});return new Uint8ClampedArray(state.length);},
    async advanceVarying(count,paramsAt){return this.advance(count,paramsAt(0));}};
  const location={origin:'http://127.0.0.1:7100',pathname:'/',search:'',hash:options.hash||''};
  const context=vm.createContext({console,Float32Array,Uint8ClampedArray,Uint32Array,Math,Number,Error,String,Array,Object,JSON,Date,URLSearchParams,setTimeout,clearTimeout,devicePixelRatio:1,
    location,history:{replaceState(_s,_t,url){const i=String(url).indexOf('#');location.hash=i>=0?String(url).slice(i):'';}},
    localStorage:{getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>{storageMap.set(k,String(v));}},
    navigator:{clipboard:{async writeText(text){copied.push(text);}}},
    ImageData:class ImageData{constructor(data,width,height){if(typeof data==='number'){this.width=data;this.height=width;this.data=new Uint8ClampedArray(data*width*4);}else{this.data=data;this.width=width;this.height=height??data.length/width/4;}}},
    document:{getElementById:id=>{assert.ok(nodes.has(id),`HTML declares #${id}`);return nodes.get(id);},
      createElement:tag=>tag==='option'?{value:'',textContent:''}:({width:0,height:0,getContext:()=>new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData(){},drawImage(){},setTransform(){},clearRect(){},fillRect(){},fillText(){},measureText:()=>({width:40}),setLineDash(){},strokeRect(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},translate(){},rotate(){}},{get:(t,prop)=>prop in t?t[prop]:()=>{}})}),
      body:{classList:{toggle(){}}},addEventListener(){}},
    getComputedStyle:()=>({getPropertyValue:()=> 'monospace'}),
    matchMedia:query=>({matches:query==='(min-width: 768px)'&&desktop,addEventListener(){}}),requestAnimationFrame:fn=>frames.push(fn)});
  const cache=new Map();
  async function load(url) {
    if(cache.has(url.href))return cache.get(url.href);
    if(supported&&url.pathname.endsWith('/gpu-backend.js')) {
      const mod=new vm.SyntheticModule(['GPUBackend'],function(){this.setExport('GPUBackend',{create:async()=>gpu});},{context,identifier:url.href});
      cache.set(url.href,mod);return mod;
    }
    const mod=new vm.SourceTextModule(readFileSync(url,'utf8'),{context,identifier:url.href});cache.set(url.href,mod);
    await mod.link((specifier,parent)=>load(new URL(specifier,parent.identifier)));return mod;
  }
  const main=await load(new URL('../src/main.js',import.meta.url));await main.evaluate();
  await new Promise(resolve=>setImmediate(resolve));
  return {nodes,calls,copied,location,async tick(now){const frame=frames.shift();assert.ok(frame,'Frame is scheduled');await frame(now);}};
}
test('UI boots, handles unsupported GPU, and binds restart to valid form settings',async()=>{
  const {nodes}=await boot();
  assert.match(nodes.get('view-status').textContent,/WebGPU is required/);
  assert.equal(nodes.get('pause').disabled,true);
  assert.doesNotThrow(()=>nodes.get('restart').listeners.click());
  assert.doesNotThrow(()=>nodes.get('parameters').listeners.submit({preventDefault(){}}));
});

test('settings start hidden on desktop and phone, and remain discoverable through Settings',async()=>{
  for(const desktop of [false,true]) {
    const {nodes}=await boot(false,desktop);
    assert.equal(nodes.get('settings').classList.contains('hidden'),true);
    nodes.get('settings-toggle').listeners.click();
    assert.equal(nodes.get('settings').classList.contains('hidden'),false);
  }
});

test('optional introduction runs only the GPU single-arm branch for the first ten seconds',async()=>{
  const {nodes,calls,tick}=await boot(true,true);
  nodes.get('opening').value='grow';
  await tick(100);
  assert.match(nodes.get('phase').textContent,/predictable rhythm/);
  nodes.get('play-story').listeners.click();
  for(let i=1;i<=150;i++)await tick(100+i*100);
  const intro=calls.filter(c=>c.kind==='advance');
  assert.equal(intro.reduce((total,c)=>total+c.count,0),4800);
  assert.ok(intro.every(c=>c.p.l2===0));
  assert.equal(calls.some(c=>c.kind==='grid'),false,'A queued story does not skip the introduction');
  assert.match(nodes.get('phase').textContent,/one arm to two/);
  await tick(15200);await tick(15300);
  assert.ok(calls.filter(c=>c.kind==='advance').at(-1).p.l2>0);
});

test('grid mode resets the GPU ensemble, steps it, inspects a cell and replays in single mode',async()=>{
  const {nodes,calls,tick}=await boot(true);
  nodes.get('pause').listeners.click();await tick(100);
  assert.equal(nodes.get('pause-label').textContent,'Play');
  nodes.get('grid-size').value='6';nodes.get('grid-toggle').listeners.click();await tick(116);
  assert.equal(calls.find(c=>c.kind==='grid').state.length,36*4);
  assert.match(nodes.get('view-status').textContent,/36 cells/);
  assert.equal(nodes.get('opening-controls').classList.contains('hidden'),true);
  nodes.get('step').listeners.click();await tick(132);
  assert.equal(calls.at(-1).count,1);assert.match(nodes.get('view-status').textContent,/1 steps/);
  nodes.get('cell-row').value='2';nodes.get('cell-col').value='3';nodes.get('inspect').listeners.click();
  assert.equal(nodes.get('inspector').open,true);
  assert.match(nodes.get('cell-details').textContent,/Row 2, column 3/);
  const initial=calls.find(c=>c.kind==='grid').state.slice((1*6+2)*4,(1*6+2)*4+4);
  nodes.get('length1').value='2'; // Unapplied draft must not change the replayed cell's physical parameters.
  nodes.get('replay-cell').listeners.click();await tick(148);
  assert.equal(nodes.get('inspector').open,false);assert.equal(nodes.get('opening').value,'fixed');
  const resets=calls.filter(c=>c.kind==='reset'),replay=resets.at(-1).state;
  assert.equal(replay[0],initial[0]);assert.equal(replay[1],initial[1]);
  nodes.get('step').listeners.click();await tick(164);
  assert.equal(calls.filter(c=>c.kind==='advance').at(-1).p.l1,1);
  assert.equal(nodes.get('single-controls').classList.contains('hidden'),false);
  assert.match(nodes.get('view-status').textContent,/1 steps/);
});

test('guided story bounds each grid, resets every stage, runs, replays and exits at the active size',async()=>{
  const {nodes,calls,tick}=await boot(true);
  nodes.get('opening').value='fixed';await tick(100);
  nodes.get('play-story').listeners.click();await tick(200);
  const seed=calls.find(c=>c.kind==='grid').state,source=calls.find(c=>c.kind==='reset').state;
  assert.equal(seed.length,4*4);assert.deepEqual(seed.slice(0,4),source.slice(0,4));
  let clock=200;
  async function to(seconds) {while(Number.parseInt(nodes.get('story-progress').textContent||'0')<seconds)await tick(clock+=100);}
  for(let i=0;i<140;i++)await tick(clock+=100);
  nodes.get('pause').listeners.click();await tick(clock+=100);
  const caption=nodes.get('story-progress').textContent;
  await tick(clock+=100);assert.equal(nodes.get('story-progress').textContent,caption);
  nodes.get('pause').listeners.click();
  await to(22);
  assert.deepEqual(calls.filter(c=>c.kind==='grid').map(c=>c.state.length/4),[4,4]);
  const nearby=calls.filter(c=>c.kind==='grid').at(-1).state;
  for(let i=0;i<4;i++)assert.ok(Math.abs(nearby[i*4]-nearby[0])<.001);
  const held=calls.length;await to(24);assert.equal(calls.length,held);
  await to(27);assert.ok(calls.length>held);
  await to(65);
  assert.deepEqual(calls.filter(c=>c.kind==='grid').map(c=>c.state.length/4),[4,4,100,100]);
  const expanded=calls.filter(c=>c.kind==='grid')[2].state;
  for(let row=0;row<2;row++)for(let col=0;col<2;col++) {
    assert.deepEqual(expanded.slice((row*10+col)*4,(row*10+col)*4+4),nearby.slice((row*2+col)*4,(row*2+col)*4+4),'Existing poses and angular velocities survive expansion');
  }
  const full=calls.filter(c=>c.kind==='grid').at(-1).state;
  assert.equal(full[0],Math.fround(-Math.PI));assert.equal(full[1],Math.fround(Math.PI));
  assert.equal(full[396],Math.fround(Math.PI));assert.equal(full[397],Math.fround(-Math.PI));
  const frozenCalls=calls.length;await to(73);assert.equal(calls.length,frozenCalls,'Colour reveal holds time');
  await to(76);assert.ok(calls.length>frozenCalls);
  await to(109);assert.deepEqual(calls.filter(c=>c.kind==='grid').map(c=>c.state.length/4),[4,4,100,100,1600,1600]);
  const hold40=calls.length;await to(111);assert.equal(calls.length,hold40);
  await to(114);assert.ok(calls.length>hold40);
  await to(148);assert.deepEqual(calls.filter(c=>c.kind==='grid').map(c=>c.state.length/4),[4,4,100,100,1600,1600,25600,25600]);
  const hold160=calls.length;await to(150);assert.equal(calls.length,hold160);
  await to(153);assert.ok(calls.length>hold160);
  nodes.get('replay-story').listeners.click();await tick(clock+=100);await tick(clock+=100);
  assert.match(nodes.get('story-progress').textContent,/^0 \/ 165/);
  assert.equal(calls.filter(c=>c.kind==='grid').at(-1).state.length,16);
  nodes.get('leave-story').listeners.click();await tick(clock+=100);await tick(clock+=100);
  assert.match(nodes.get('view-status').textContent,/4 cells/);assert.equal(nodes.get('grid-size').value,'2');
});

test('pixel field matches the canvas, animates in place, then maps exactly 1000 steps',async()=>{
  const {nodes,calls,tick}=await boot(true);
  nodes.get('field-run').value='animate';
  nodes.get('field-toggle').listeners.click();await tick(100);await tick(116);
  const field=calls.find(c=>c.kind==='grid');
  assert.equal(field.state.length,1000*800*4);
  assert.ok(calls.some(c=>c.kind==='colours'));
  assert.match(nodes.get('view-status').textContent,/1000×800 pixels/);
  assert.equal(nodes.get('app').classList.contains('field-mode'),true);
  nodes.get('field-run').value='map';
  nodes.get('field-run').listeners.change();
  let clock=132;
  for(let i=0;i<80;i++)await tick(clock+=16);
  const inplace=calls.filter(c=>c.kind==='inplace');
  assert.ok(inplace.reduce((n,c)=>n+c.count,0)>=1000);
  assert.match(nodes.get('render-label').textContent,/1000/);
  nodes.get('view').listeners.wheel({preventDefault(){},deltaY:-1,clientX:250,clientY:200});
  const beforeZoom=calls.filter(c=>c.kind==='grid').length;
  await new Promise(resolve=>setTimeout(resolve,170));
  await tick(clock+=16);await tick(clock+=16);
  assert.ok(calls.filter(c=>c.kind==='grid').length>beforeZoom,'Zoom resamples a new field');
});

test('milestone 4 map controls: metrics, fixed N/Δt, preview badge, bookmarks, reset view, and share link',async()=>{
  const {nodes,calls,copied,tick}=await boot(true,true);
  let clock=100;
  await tick(clock+=16);
  // Open curated low-energy candidate regular bookmark (first-flip, 120° span).
  nodes.get('bookmark-select').value='builtin:low-energy';
  nodes.get('bookmark-load').listeners.click();
  await tick(clock+=16);
  assert.equal(nodes.get('app').classList.contains('field-mode'),true);
  assert.equal(nodes.get('render-status').classList.contains('is-preview'),true,'Preview is distinctly marked before full map completes');
  assert.match(nodes.get('render-label').textContent,/Preview/);
  for(let i=0;i<90;i++) await tick(clock+=16);
  assert.equal(nodes.get('render-status').classList.contains('is-preview'),false,'Preview flag clears once all full-res tiles complete');
  assert.match(nodes.get('render-label').textContent,/Complete · N=1000 · Δt=1\/480 s/);
  assert.ok(calls.some(c=>c.kind==='inplace'&&c.metric==='first-flip'));

  // Change N and Δt and switch to sensitivity metric.
  nodes.get('map-steps').value='400';
  nodes.get('map-dt').value='960';
  nodes.get('map-metric').value='sensitivity';
  nodes.get('parameters').listeners.submit({preventDefault(){}});
  await tick(clock+=16);await tick(clock+=16);
  assert.ok(calls.some(c=>c.kind==='inplace'&&c.metric==='sensitivity'&&Math.abs(c.dt-1/960)<1e-9));

  // Save a custom bookmark, copy share link, then reset view.
  nodes.get('bookmark-name').value='Candidate island';
  nodes.get('bookmark-save').listeners.click();
  assert.match(nodes.get('bookmark-status').textContent,/Candidate island/);
  await nodes.get('copy-share-link').listeners.click();
  assert.equal(copied.length,1);
  assert.match(copied[0],/#.*metric=sensitivity.*n=1000.*dt=960/);
  nodes.get('field-reset-view').listeners.click();await tick(clock+=16);
  assert.equal(nodes.get('field-span1').value,'360');

  // Boot a fresh instance from the copied share link hash.
  const hash=copied[0].slice(copied[0].indexOf('#'));
  const shared=await boot(true,true,{hash});
  await shared.tick(200);
  assert.equal(shared.nodes.get('app').classList.contains('field-mode'),true);
  assert.equal(shared.nodes.get('map-metric').value,'sensitivity');
  assert.equal(shared.nodes.get('map-steps').value,'1000');
  assert.equal(shared.nodes.get('map-dt').value,'960');
});


test('direct modes stay explicit and static computation completes while paused',async()=>{
  const {nodes,calls,tick}=await boot(true);await tick(100);
  assert.equal(calls.filter(c=>c.kind==='advance').length,0);
  nodes.get('grid-toggle').listeners.click();await tick(116);
  assert.equal(nodes.get('grid-label').textContent,'Grid');assert.match(nodes.get('view-status').textContent,/100 cells/);
  nodes.get('grid-toggle').listeners.click();await tick(132);assert.match(nodes.get('view-status').textContent,/100 cells/);
  nodes.get('pause').listeners.click();nodes.get('field-run').value='map';nodes.get('field-toggle').listeners.click();
  for(let i=0;i<90;i++)await tick(148+i*16);
  assert.match(nodes.get('render-label').textContent,/Complete/);assert.equal(nodes.get('pause-label').textContent,'Play');
  const batches=calls.filter(c=>c.kind==='inplace');assert.ok(batches.length>0);
  const completed=calls.length;await tick(2000);assert.equal(calls.length,completed,'Completed static pixels never advance again');
  nodes.get('single-toggle').listeners.click();await tick(2016);assert.equal(nodes.get('opening').value,'fixed');
});
