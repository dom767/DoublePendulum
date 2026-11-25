import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Boot complete browser modules with the declared HTML controls, without a DOM framework.
async function boot(supported=false) {
  const html=readFileSync('index.html','utf8'), nodes=new Map();
  for(const match of html.matchAll(/\bid="([^"]+)"[^>]*>/g)) {
    const listeners={};
    const classes=new Set();
    const node={value:match[0].match(/\bvalue="([^"]*)"/)?.[1]??'',checked:match[0].includes('checked'),disabled:false,
      textContent:'',style:{},width:0,height:0,clientWidth:1000,clientHeight:800,
      classList:{toggle:(x,force)=>{if(force??!classes.has(x))classes.add(x);else classes.delete(x);},contains:x=>classes.has(x),add:x=>classes.add(x)},
      addEventListener:(type,fn)=>{listeners[type]=fn;},setAttribute(){},focus(){},reportValidity:()=>true,reset(){},
      open:false,showModal(){this.open=true;},close(){this.open=false;listeners.close?.();},
      listeners,getContext:()=>new Proxy({},{get:()=>()=>{}})};
    nodes.set(match[1],node);
  }
  nodes.get('speed').value='1';nodes.get('opening').value='grow';
  nodes.get('grid-size').value='10';nodes.get('colour-source').value='current';
  nodes.get('grid-transition').value='instant';
  const frames=[],calls=[];
  let state=new Float32Array(8);
  const gpu={device:{lost:new Promise(()=>{}),addEventListener(){}},
    reset(a,b){state=new Float32Array([a,b,0,0,a+.0001,b,0,0]);calls.push({kind:'reset',state:state.slice()});},
    resetStates(initial){state=initial.slice();calls.push({kind:'grid',state:state.slice()});},
    async advance(count,p){calls.push({kind:'advance',count,p});return state.slice();},
    async advanceVarying(count,paramsAt){return this.advance(count,paramsAt(0));}};
  const context=vm.createContext({console,Float32Array,Uint8ClampedArray,Math,Number,Error,String,devicePixelRatio:1,navigator:{},
    ImageData:class ImageData{constructor(data,width,height){this.data=data;this.width=width;this.height=height??data.length/width/4;}},
    document:{getElementById:id=>{assert.ok(nodes.has(id),`HTML declares #${id}`);return nodes.get(id);},
      createElement:()=>({width:0,height:0,getContext:()=>new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})},{get:(t,prop)=>prop in t?t[prop]:()=>{}})}),
      body:{classList:{toggle(){}}},addEventListener(){}},
    getComputedStyle:()=>({getPropertyValue:()=> 'monospace'}),
    matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:fn=>frames.push(fn)});
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
  return {nodes,calls,async tick(now){const frame=frames.shift();assert.ok(frame,'Frame is scheduled');await frame(now);}};
}
test('UI boots, handles unsupported GPU, and binds restart to valid form settings',async()=>{
  const {nodes}=await boot();
  assert.match(nodes.get('view-status').textContent,/WebGPU is required/);
  assert.equal(nodes.get('pause').disabled,true);
  assert.doesNotThrow(()=>nodes.get('restart').listeners.click());
  assert.doesNotThrow(()=>nodes.get('parameters').listeners.submit({preventDefault(){}}));
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

test('guided story preserves the source, pauses, resets once before colours, restarts and exits',async()=>{
  const {nodes,calls,tick}=await boot(true);
  nodes.get('opening').value='fixed';await tick(100);
  nodes.get('grid-transition').value='story';nodes.get('grid-toggle').listeners.click();await tick(200);
  const seed=calls.find(c=>c.kind==='grid').state,source=calls.find(c=>c.kind==='reset').state;
  assert.equal(seed.length,25600*4);assert.deepEqual(seed.slice(0,4),source.slice(0,4));
  let clock=200;
  for(let i=0;i<140;i++)await tick(clock+=100);
  nodes.get('pause').listeners.click();await tick(clock+=100);
  const caption=nodes.get('story-progress').textContent;
  await tick(clock+=100);assert.equal(nodes.get('story-progress').textContent,caption);
  nodes.get('pause').listeners.click();
  for(let i=0;i<230;i++)await tick(clock+=100);
  assert.equal(calls.filter(c=>c.kind==='grid').length,2,'Exactly one reset before colour reveal');
  const frozenCalls=calls.length;
  for(let i=0;i<70;i++)await tick(clock+=100);
  assert.equal(calls.length,frozenCalls,'No simulation advances while reset colours are revealed');
  for(let i=0;i<50;i++)await tick(clock+=100);
  assert.ok(calls.length>frozenCalls,'Physics resumes after the colour hold');
  nodes.get('replay-story').listeners.click();await tick(clock+=100);await tick(clock+=100);
  assert.match(nodes.get('story-progress').textContent,/^0 \/ 100/);
  nodes.get('leave-story').listeners.click();await tick(clock+=100);await tick(clock+=100);
  assert.match(nodes.get('view-status').textContent,/25600 cells/);assert.equal(nodes.get('grid-size').value,'160');
});
