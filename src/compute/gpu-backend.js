import { shader } from './shader.js';
import { colourShader } from './colour-shader.js';
import { DT } from '../physics/pendulum.js';

export class GPUBackend {
  /** @param {GPUDevice} device @param {GPUComputePipeline} pipeline @param {GPUComputePipeline} colourPipeline */
  constructor(device, pipeline, colourPipeline) {
    this.device=device; this.pipeline=pipeline; this.colourPipeline=colourPipeline;
    this.params=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    this.maxCount=Math.min(8_294_400,Math.floor((device.limits.maxStorageBufferBindingSize||134217728)/16));
    this.resize(2);
  }
  /** Call only between completed readbacks. @param {number} count */
  resize(count) {
    if(!Number.isInteger(count)||count<1||count>this.maxCount) throw new Error(`Invalid ensemble size (1…${this.maxCount}).`);
    this.state?.destroy(); this.read?.destroy(); this.colour?.destroy(); this.colourRead?.destroy();
    this.count=count;
    this.state=this.device.createBuffer({size:count*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});
    this.read=this.device.createBuffer({size:count*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    this.colour=this.device.createBuffer({size:count*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    this.colourRead=this.device.createBuffer({size:count*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
    this.bind=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.state}},{binding:1,resource:{buffer:this.params}}]});
    this.colourBind=this.device.createBindGroup({layout:this.colourPipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.state}},{binding:1,resource:{buffer:this.colour}}]});
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
    const colourModule=device.createShaderModule({code:colourShader});
    for(const mod of [module,colourModule]) {
      const info=await mod.getCompilationInfo();
      const errors=info.messages.filter(m=>m.type==='error');
      if(errors.length) throw new Error(errors.map(m=>m.message).join('\n'));
    }
    const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    const colourPipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module:colourModule,entryPoint:'main'}});
    return new GPUBackend(device,pipeline,colourPipeline);
  }
  /** @param {number} a @param {number} b */
  reset(a,b) { this.resetStates(new Float32Array([a,b,0,0,a+0.0001,b,0,0])); }
  /** @param {Float32Array} states */
  resetStates(states) {
    if(states.length%4 || !states.every(Number.isFinite)) throw new Error('Invalid ensemble states.');
    if(states.length/4!==this.count) this.resize(states.length/4);
    this.device.queue.writeBuffer(this.state,0,states);
  }
  /** @param {{l1:number,l2:number,m1:number,m2:number}} p @param {number} count */
  writeParams(p, count) {
    this.device.queue.writeBuffer(this.params,0,new Float32Array([p.l1,p.l2,p.m1,p.m2,DT,count,0,0]));
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
  /** Colourize current GPU states into an RGBA8 buffer (no state readback). */
  async readColours() {
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
  /** @param {number} count @param {{l1:number,l2:number,m1:number,m2:number}} p */
  async advance(count,p) {
    this.writeParams(p,count);
    this.submitSteps(true);
    return this.readState();
  }
  /** Advance on the GPU only; caller paints via readColours().
   * @param {number} count @param {{l1:number,l2:number,m1:number,m2:number}} p */
  async advanceInPlace(count,p) {
    if(count<=0) return;
    this.writeParams(p,count);
    this.submitStepsOnly();
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
