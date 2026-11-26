import test from 'node:test';
import assert from 'node:assert/strict';
import { setupMapGestures } from '../src/ui/map-gestures.js';
import { setupSingleDrag } from '../src/ui/single-drag.js';
import { MapInspector } from '../src/ui/map-inspector.js';
import { SingleView } from '../src/views/single.js';

function surface(){
  const handlers={},captures=new Set();
  const canvas={clientWidth:800,clientHeight:600,getBoundingClientRect:()=>({left:0,top:0,width:800,height:600}),
    addEventListener(type,fn){(handlers[type]??=[]).push(fn);},classList:{add(){},remove(){}},
    setPointerCapture(id){captures.add(id);},hasPointerCapture:id=>captures.has(id),releasePointerCapture(id){captures.delete(id);}};
  return {canvas:/** @type {HTMLCanvasElement} */(/** @type {unknown} */(canvas)),
    fire(type,id,x,y){for(const fn of handlers[type]??[])fn({type,pointerId:id,clientX:x,clientY:y,button:0});}};
}

test('single dragging constrains both rods and carries the second absolute angle',()=>{
  const {canvas,fire}=surface(),p={l1:1,l2:1};let states=new Float32Array([0,1,2,3]),edits=0;
  const {cx,cy,scale}=SingleView.geometry(800,600,p);
  setupSingleDrag(canvas,{enabled:()=>true,pose:()=>({states,p}),edit:(a,b)=>{states=new Float32Array([a,b,0,0]);edits++;}});
  fire('pointerdown',1,cx,cy+scale);fire('pointermove',1,cx+300,cy);
  assert.ok(Math.abs(states[0]-Math.PI/2)<1e-6);assert.equal(states[1],1);assert.equal(states[2],0);
  fire('pointerup',1,cx+300,cy);const count=edits;fire('pointermove',1,0,0);assert.equal(edits,count);
  const x1=cx+scale*Math.sin(states[0]),y1=cy+scale*Math.cos(states[0]);
  fire('pointerdown',2,x1+scale*Math.sin(1),y1+scale*Math.cos(1));fire('pointermove',2,x1,y1-250);
  assert.ok(Math.abs(states[1]-Math.PI)<1e-6);assert.ok(Math.abs(states[0]-Math.PI/2)<1e-6);
  fire('pointercancel',2,0,0);fire('pointermove',2,0,0);assert.equal(states[3],0);
});

test('map pinch pans its midpoint, commits once and suppresses a tap after returning to one finger',()=>{
  const {canvas,fire}=surface();let domain={center1:0,center2:0,span1:360,span2:360};let commits=0,taps=0,previews=0;
  const gestures=setupMapGestures(canvas,{enabled:()=>true,domain:()=>domain,preview:()=>previews++,commit:d=>{domain=d;commits++;},tap:()=>taps++});
  fire('pointerdown',1,200,300);fire('pointerdown',2,600,300);fire('pointermove',2,700,350);
  fire('pointerup',2,700,350);fire('pointermove',1,220,300);fire('pointerup',1,220,300);
  assert.equal(commits,1);assert.equal(taps,0);assert.ok(previews>=2);assert.ok(domain.span1<360);assert.notEqual(domain.center1,0);
  fire('pointerdown',3,400,300);fire('pointerup',3,400,300);assert.equal(taps,1);
  fire('pointerdown',4,400,300);gestures.cancel();fire('pointerup',4,400,300);assert.equal(taps,1);
  fire('pointerdown',5,400,300);fire('pointercancel',5,400,300);assert.equal(taps,1);
});


test('replacing a point during readback discards stale state and releases retired buffers',async()=>{
  const previous=globalThis.devicePixelRatio;globalThis.devicePixelRatio=1;
  const ctx=new Proxy({},{get:()=>()=>{}}),canvas={clientWidth:300,clientHeight:200,getContext:()=>ctx};
  const node={textContent:'',classList:{add(){},remove(){}},addEventListener(){}};
  const backends=[];
  /** @type {(value:Float32Array)=>void} */
  let resolveRead=(_value)=>{};
  const source={fork(){const gpu={destroyed:false,resetStates(){},advance(){return new Promise(resolve=>{resolveRead=resolve;});},destroy(){this.destroyed=true;}};backends.push(gpu);return gpu;}};
  const inspector=new MapInspector({panel:/** @type {any} */(node),canvas:/** @type {any} */(canvas),angles:/** @type {any} */({...node}),clock:/** @type {any} */({...node}),onError:error=>{throw error;}});
  try {
    inspector.open(source,1,2,{l1:1,l2:1,m1:1,m2:1});const work=inspector.tick(.1,false,1);
    inspector.open(source,3,4,{l1:1,l2:1,m1:1,m2:1});
    assert.ok(resolveRead);resolveRead(new Float32Array([9,9,9,9]));await work;
    assert.equal(inspector.states[0],3);assert.equal(inspector.steps,0);assert.equal(backends[0].destroyed,true);
    await inspector.tick(0,true,1);assert.equal(inspector.states[1],4);inspector.close();assert.equal(backends[1].destroyed,true);
  } finally {globalThis.devicePixelRatio=previous;}
});
