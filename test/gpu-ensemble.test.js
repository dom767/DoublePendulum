import test from 'node:test';
import assert from 'node:assert/strict';
import { GPUBackend } from '../src/compute/gpu-backend.js';
import { createEnsemble, presets } from '../src/physics/ensemble.js';
import { DT } from '../src/physics/pendulum.js';

test('GPU ensemble dispatch, parameter step count, readback size and resize lifecycle',async()=>{
  const originals={GPUBufferUsage:globalThis.GPUBufferUsage,GPUMapMode:globalThis.GPUMapMode};
  globalThis.GPUBufferUsage=/** @type {any} */({STORAGE:1,COPY_DST:2,COPY_SRC:4,UNIFORM:8,MAP_READ:16});
  globalThis.GPUMapMode=/** @type {any} */({READ:1});
  const dispatches=[], params=[];
  const device={
    createBuffer:({size})=>({data:new Float32Array(size/4),destroyed:false,destroy(){this.destroyed=true;},async mapAsync(){},unmap(){},getMappedRange(){return this.data.buffer;}}),
    createBindGroup:()=>({}),
    queue:{writeBuffer:(buffer,offset,data)=>{buffer.data.set(data);if(data.length===8)params.push(data.slice());},submit(){}},
    createCommandEncoder:()=>({
      beginComputePass:()=>({setPipeline(){},setBindGroup(){},dispatchWorkgroups:n=>dispatches.push(n),end(){}}),
      copyBufferToBuffer:(source,offset,target,targetOffset,size)=>{assert.equal(size,target.data.byteLength);target.data.set(source.data);},finish:()=>({})
    })
  };
  try {
    const gpu=new GPUBackend(/** @type {any} */(device),/** @type {any} */({getBindGroupLayout:()=>({})}));
    const old=gpu.state;
    const e=createEnsemble(16,presets.nearby);gpu.resetStates(e.initial);
    assert.equal(/** @type {any} */(old).destroyed,true);
    const result=await gpu.advance(17,{l1:1,l2:1,m1:1,m2:1});
    assert.equal(result.length,256*4);assert.deepEqual(result,e.initial);
    assert.deepEqual(dispatches,[256]);assert.equal(params.at(-1)[5],17);
    assert.ok(Math.abs(params.at(-1)[4]-DT)<1e-9);
    gpu.reset(1,2);await gpu.advanceVarying(3,()=>({l1:1,l2:1,m1:1,m2:1}));
    assert.equal(gpu.count,2);assert.deepEqual(dispatches,[256,2,2,2]);
    assert.throws(()=>gpu.resetStates(new Float32Array([NaN,0,0,0])));
  } finally {
    globalThis.GPUBufferUsage=originals.GPUBufferUsage;globalThis.GPUMapMode=originals.GPUMapMode;
  }
});
