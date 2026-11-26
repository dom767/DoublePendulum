import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelField, sampleField, MAP_STEPS, DEG, presets } from '../src/physics/ensemble.js';
import { zoomDomain, panDomain, wrap180 } from '../src/physics/domain-view.js';
import { MapRunner } from '../src/maps/runner.js';
import { FieldView } from '../src/views/field.js';
import { GPUBackend } from '../src/compute/gpu-backend.js';

test('pixel field samples one cell centre per CSS pixel with upward secondary',()=>{
  const field=createPixelField(4,3,presets.full);
  assert.equal(field.width,4);assert.equal(field.height,3);assert.equal(field.initial.length,4*3*4);
  assert.ok(Math.abs(field.initial[0]/DEG+135)<1e-4);
  assert.ok(Math.abs(field.initial[1]/DEG-120)<1e-4);
  assert.ok(field.initial[4]>field.initial[0]);
  assert.ok(field.initial[4*4+1]<field.initial[1]);
  assert.throws(()=>createPixelField(1,10,presets.full));
});

test('domain zoom keeps the cursor angle fixed and pan shifts centres',()=>{
  const start={center1:0,center2:0,span1:360,span2:360};
  const zoomed=zoomDomain(start,.5,.25,.25);
  assert.ok(Math.abs(zoomed.span1-180)<1e-9);
  assert.ok(Math.abs(zoomed.center1-(-45))<1e-9);
  assert.ok(Math.abs(zoomed.center2-45)<1e-9);
  const focus1=start.center1+(.25-.5)*start.span1;
  assert.ok(Math.abs(focus1-(zoomed.center1+(.25-.5)*zoomed.span1))<1e-9);
  const panned=panDomain(start,.1,-.2);
  assert.equal(wrap180(panned.center1),-36);
  assert.equal(wrap180(panned.center2),-72);
});

test('map runner reaches exactly N steps and cancels stale generations',async()=>{
  const runner=new MapRunner();
  const gen=runner.begin(MAP_STEPS);
  let total=0;
  while(!runner.complete) await runner.pump(async n=>{total+=n;},gen,100);
  assert.equal(total,MAP_STEPS);assert.equal(runner.done,MAP_STEPS);
  const stale=runner.begin(50);
  runner.cancel();
  let advanced=false;
  await runner.pump(async()=>{advanced=true;},stale,10);
  assert.equal(advanced,false);
});

test('field hit testing maps the full canvas and rejects outside clicks',()=>{
  const view=new FieldView(/** @type {HTMLCanvasElement} */(/** @type {unknown} */({
    getContext:()=>null,clientWidth:200,clientHeight:100,getBoundingClientRect:()=>({left:10,top:20})
  })));
  view.width=20;view.height=10;
  assert.deepEqual(view.hit(10,20),{col:0,row:0,index:0,u:0,v:0});
  assert.equal(view.hit(209,20).col,19);
  assert.equal(view.hit(9,20),null);
});

test('GPU colour path resizes with rectangular fields and advances in place',async()=>{
  const originals={GPUBufferUsage:globalThis.GPUBufferUsage,GPUMapMode:globalThis.GPUMapMode};
  globalThis.GPUBufferUsage=/** @type {any} */({STORAGE:1,COPY_DST:2,COPY_SRC:4,UNIFORM:8,MAP_READ:16});
  globalThis.GPUMapMode=/** @type {any} */({READ:1});
  const dispatches=[];
  const device={
    limits:{maxStorageBufferBindingSize:1<<30},
    createBuffer:({size})=>({data:new Uint8Array(size),destroyed:false,destroy(){this.destroyed=true;},async mapAsync(){},unmap(){},getMappedRange(){return this.data.buffer;}}),
    createBindGroup:()=>({}),
    queue:{writeBuffer:(buffer,offset,data)=>{if(data instanceof Float32Array){const view=new Float32Array(buffer.data.buffer,offset,data.length);view.set(data);}},submit(){}},
    createCommandEncoder:()=>({
      beginComputePass:()=>({setPipeline(){},setBindGroup(){},dispatchWorkgroups:n=>dispatches.push(n),end(){}}),
      copyBufferToBuffer:(source,offset,target,targetOffset,size)=>{target.data.set(source.data.subarray(offset,offset+size),targetOffset);},finish:()=>({})
    })
  };
  try {
    const layout={getBindGroupLayout:()=>({})};
    const gpu=new GPUBackend(/** @type {any} */(device),/** @type {any} */(layout),/** @type {any} */(layout));
    const field=createPixelField(8,5,presets.neighbourhood);
    gpu.resetStates(field.initial);
    await gpu.advanceInPlace(7,{l1:1,l2:1,m1:1,m2:1});
    const colours=await gpu.readColours();
    assert.equal(colours.length,40*4);
    assert.deepEqual(dispatches,[1,1]);
    assert.equal(sampleField(8,5,presets.neighbourhood).length,field.initial.length);
  } finally {
    globalThis.GPUBufferUsage=originals.GPUBufferUsage;globalThis.GPUMapMode=originals.GPUMapMode;
  }
});
