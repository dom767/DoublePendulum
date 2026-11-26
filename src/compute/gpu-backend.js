import { shader } from './shader.js';
import { flipShader } from './flip-shader.js';
import { colourShader } from './colour-shader.js';
import { DT } from '../physics/pendulum.js';
import { SENSITIVITY_EPSILON } from '../maps/metrics.js';

export class GPUBackend {
  /** @param {GPUDevice} device @param {GPUComputePipeline} pipeline @param {GPUComputePipeline} colourPipeline @param {GPUComputePipeline|null} [flipPipeline] */
  constructor(device, pipeline, colourPipeline, flipPipeline = null) {
    this.device=device; this.pipeline=pipeline; this.colourPipeline=colourPipeline; this.flipPipeline=flipPipeline;
    this.params=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.colourParams=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.dummyFlip=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    this.dummyTwin=device.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
    this.maxCount=Math.min(8_294_400,Math.floor((device.limits.maxStorageBufferBindingSize||134217728)/16));
    this.flip=null; this.flipCount=0; this.flipBind=null;
    this.twin=null; this.twinCount=0; this.twinBind=null;
    this.resize(2);
  }
  /** Rebuild colour bind group with whichever metric buffers are currently allocated. */
  rebuildColourBind() {
    this.colourBind=this.device.createBindGroup({
      layout:this.colourPipeline.getBindGroupLayout(0),
      entries:[
        {binding:0,resource:{buffer:this.state}},
        {binding:1,resource:{buffer:this.colour}},
        {binding:2,resource:{buffer:this.colourParams}},
        {binding:3,resource:{buffer:this.flip||this.dummyFlip}},
        {binding:4,resource:{buffer:this.twin||this.dummyTwin}}
      ]
    });
  }
  /** Call only between completed readbacks. @param {number} count */
  resize(count) {
    if(!Number.isInteger(count)||count<1||count>this.maxCount) throw new Error(`Invalid ensemble size (1…${this.maxCount}).`);
    this.state?.destroy(); this.read?.destroy(); this.colour?.destroy(); this.colourRead?.destroy();
    this.flip?.destroy(); this.twin?.destroy();
    this.flip=null; this.flipCount=0; this.flipBind=null;
    this.twin=null; this.twinCount=0; this.twinBind=null;
    this.count=count;
    this.state=this.device.createBuffer({size:count*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});
    this.read=this.device.createBuffer({size:count*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    this.colour=this.device.createBuffer({size:count*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    this.colourRead=this.device.createBuffer({size:count*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    this.bind=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.state}},{binding:1,resource:{buffer:this.params}}]});
    this.rebuildColourBind();
  }
  /** Lazily allocate auxiliary storage buffers only for the active map metric.
   * @param {import('../maps/metrics.js').MapMetricId} metric */
  ensureMetricBuffers(metric) {
    if(metric==='first-flip' && this.flipCount!==this.count) {
      if(!this.flipPipeline) throw new Error('First-flip GPU pipeline is unavailable.');
      this.flip?.destroy();
      this.flip=this.device.createBuffer({size:this.count*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});
      this.flipCount=this.count;
      this.flipBind=this.device.createBindGroup({
        layout:this.flipPipeline.getBindGroupLayout(0),
        entries:[
          {binding:0,resource:{buffer:this.state}},
          {binding:1,resource:{buffer:this.params}},
          {binding:2,resource:{buffer:this.flip}}
        ]
      });
      this.rebuildColourBind();
    } else if(metric==='sensitivity' && this.twinCount!==this.count) {
      this.twin?.destroy();
      this.twin=this.device.createBuffer({size:this.count*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});
      this.twinCount=this.count;
      this.twinBind=this.device.createBindGroup({
        layout:this.pipeline.getBindGroupLayout(0),
        entries:[{binding:0,resource:{buffer:this.twin}},{binding:1,resource:{buffer:this.params}}]
      });
      this.rebuildColourBind();
    }
  }
  static async create() {
    if (!navigator.gpu) throw new Error('WebGPU is required. Open localhost in a recent Chrome or Edge with hardware acceleration enabled.');
    const adapter=await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter is available. Check browser and GPU support.');
    const device=await adapter.requestDevice({
      requiredLimits:{
        maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize:adapter.limits.maxBufferSize
      }
    });
    const module=device.createShaderModule({code:shader});
    const flipModule=device.createShaderModule({code:flipShader});
    const colourModule=device.createShaderModule({code:colourShader});
    for(const mod of [module,flipModule,colourModule]) {
      const info=await mod.getCompilationInfo();
      const errors=info.messages.filter(m=>m.type==='error');
      if(errors.length) throw new Error(errors.map(m=>m.message).join('\n'));
    }
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    const flipPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:flipModule,entryPoint:'main'}});
    const colourPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:colourModule,entryPoint:'main'}});
    return new GPUBackend(device,pipeline,colourPipeline,flipPipeline);
  }
  /** @param {number} a @param {number} b */
  reset(a,b) { this.resetStates(new Float32Array([a,b,0,0,a+0.0001,b,0,0])); }
  /** @param {Float32Array} states */
  resetStates(states) {
    if(states.length%4 || !states.every(Number.isFinite)) throw new Error('Invalid ensemble states.');
    if(states.length/4!==this.count) this.resize(states.length/4);
    this.device.queue.writeBuffer(this.state,0,states);
  }
  /** Reset states plus auxiliary GPU buffers for the requested fixed-duration map metric.
   * @param {Float32Array} states @param {import('../maps/metrics.js').MapMetricId} metric */
  resetMetricStates(states, metric) {
    this.resetStates(states);
    if(metric==='first-flip') {
      this.ensureMetricBuffers('first-flip');
      if(this.flip) this.device.queue.writeBuffer(this.flip,0,new Uint32Array(this.count));
    } else if(metric==='sensitivity') {
      this.ensureMetricBuffers('sensitivity');
      const twin=states.slice();
      for(let i=0;i<twin.length;i+=4) twin[i]+=SENSITIVITY_EPSILON;
      if(this.twin) this.device.queue.writeBuffer(this.twin,0,twin);
    }
  }
  /** @param {{l1:number,l2:number,m1:number,m2:number}} p @param {number} count @param {number} [dt] @param {number} [stepOffset] */
  writeParams(p, count, dt = DT, stepOffset = 0) {
    this.device.queue.writeBuffer(this.params,0,new Float32Array([p.l1,p.l2,p.m1,p.m2,dt,count,stepOffset,0]));
  }
  /** @param {boolean} copy */
  submitSteps(copy) {
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginComputePass(); pass.setPipeline(this.pipeline); pass.setBindGroup(0,this.bind); pass.dispatchWorkgroups(Math.ceil(this.count/64)); pass.end();
    if(copy) encoder.copyBufferToBuffer(this.state,0,this.read,0,this.count*16);
    this.device.queue.submit([encoder.finish()]);
  }
  /** Integrate without mapping state — used by dense pixel fields that colour on the GPU. */
  submitStepsOnly() { this.submitSteps(false); }
  async readState() {
    await this.read.mapAsync(GPUMapMode.READ);
    const mapped=new Float32Array(this.read.getMappedRange());
    this.outFlip=!this.outFlip;
    let out=this.outFlip?this.outA:this.outB;
    if(!out||out.length!==mapped.length){
      out=new Float32Array(mapped.length);
      if(this.outFlip)this.outA=out;else this.outB=out;
    }
    out.set(mapped); this.read.unmap();
    for(let i=0;i<out.length;i++) if(!Number.isFinite(out[i])) throw new Error('Numerical overflow. Restart with shorter steps or less extreme parameters.');
    return out;
  }
  /** Colourize current GPU states/metrics into an RGBA8 buffer (no state readback).
   * @param {number} [mode] 0 = final-angle, 1 = first-flip, 2 = sensitivity
   * @param {number} [targetSteps] */
  async readColours(mode = 0, targetSteps = 1000) {
    this.device.queue.writeBuffer(this.colourParams,0,new Uint32Array([mode,targetSteps,0,0]));
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginComputePass();
    pass.setPipeline(this.colourPipeline); pass.setBindGroup(0,this.colourBind);
    pass.dispatchWorkgroups(Math.ceil(this.count/64)); pass.end();
    encoder.copyBufferToBuffer(this.colour,0,this.colourRead,0,this.count*4);
    this.device.queue.submit([encoder.finish()]);
    await this.colourRead.mapAsync(GPUMapMode.READ);
    const mapped=new Uint8Array(this.colourRead.getMappedRange());
    this.colourFlip=!this.colourFlip;
    let out=this.colourFlip?this.colourA:this.colourB;
    if(!out||out.length!==mapped.length){
      out=new Uint8ClampedArray(mapped.length);
      if(this.colourFlip)this.colourA=out;else this.colourB=out;
    }
    out.set(mapped); this.colourRead.unmap();
    return out;
  }
  /** @param {number} count @param {{l1:number,l2:number,m1:number,m2:number}} p @param {number} [dt] */
  async advance(count,p,dt = DT) {
    this.writeParams(p,count,dt);
    this.submitSteps(true);
    return this.readState();
  }
  /** Advance on the GPU only; caller paints via readColours().
   * @param {number} count @param {{l1:number,l2:number,m1:number,m2:number}} p @param {number} [dt] */
  async advanceInPlace(count,p,dt = DT) {
    if(count<=0) return;
    this.writeParams(p,count,dt);
    this.submitStepsOnly();
  }
  /** Advance in place according to the active map metric (final-angle, first-flip, or sensitivity twin).
   * @param {number} count @param {{l1:number,l2:number,m1:number,m2:number}} p
   * @param {import('../maps/metrics.js').MapMetricId} metric @param {number} [dt] @param {number} [stepOffset] */
  async advanceMetricInPlace(count,p,metric,dt = DT,stepOffset = 0) {
    if(count<=0) return;
    if(metric==='first-flip') {
      this.ensureMetricBuffers('first-flip');
      if(!this.flipPipeline || !this.flipBind) throw new Error('First-flip GPU pipeline is unavailable.');
      this.writeParams(p,count,dt,stepOffset);
      const encoder=this.device.createCommandEncoder();
      const pass=encoder.beginComputePass();
      pass.setPipeline(this.flipPipeline); pass.setBindGroup(0,this.flipBind);
      pass.dispatchWorkgroups(Math.ceil(this.count/64)); pass.end();
      this.device.queue.submit([encoder.finish()]);
      return;
    }
    if(metric==='sensitivity') {
      this.ensureMetricBuffers('sensitivity');
      if(!this.twinBind) throw new Error('Sensitivity twin buffer is unavailable.');
      this.writeParams(p,count,dt,0);
      const groups=Math.ceil(this.count/64);
      const encoder=this.device.createCommandEncoder();
      const pass=encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0,this.bind); pass.dispatchWorkgroups(groups);
      pass.setBindGroup(0,this.twinBind); pass.dispatchWorkgroups(groups);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
      return;
    }
    await this.advanceInPlace(count,p,dt);
  }
  /** One GPU readback after many one-step dispatches with per-step parameters (used while the second arm grows).
   * @param {number} count @param {(i:number)=>{l1:number,l2:number,m1:number,m2:number}} paramsAt */
  async advanceVarying(count, paramsAt) {
    if(count<=0) return this.advance(0,paramsAt(0));
    for(let i=0;i<count;i++) {
      this.writeParams(paramsAt(i),1);
      this.submitSteps(i===count-1);
    }
    return this.readState();
  }
}
