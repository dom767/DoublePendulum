import { GPUBackend } from '../src/compute/gpu-backend.js';
import { step } from '../src/physics/integrator.js';
import { DT, defaults, energy } from '../src/physics/pendulum.js';

const output=document.getElementById('result');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
try {
  const gpu=await GPUBackend.create();
  gpu.device.addEventListener('uncapturederror',event=>{throw new Error(event.error.message);});
  const initial=[1.9,1.7,0,0];gpu.reset(initial[0],initial[1]);
  const run=await gpu.advance(480,defaults);
  let reference=initial;
  for(let i=0;i<480;i++)reference=step(reference,defaults,DT);
  const error=Math.max(...reference.map((x,i)=>Math.abs(x-run[i])));
  assert(error<.002,`1 s CPU/GPU error ${error}`);
  gpu.reset(1.9,1.7);const replay=await gpu.advance(480,defaults);
  assert(replay.every((x,i)=>x===run[i]),'Restart is reproducible');
  gpu.reset(0,0);const equilibrium=await gpu.advance(1000,defaults);
  assert(equilibrium.slice(0,4).every(x=>x===0),'GPU equilibrium');
  gpu.reset(1,1);const single=await gpu.advance(1000,{...defaults,l2:0});
  assert(single.every(Number.isFinite),'Zero-length GPU branch');
  gpu.reset(1.9,1.7);let max=0;
  const start=energy(initial,defaults);
  for(let i=0;i<120;i++) {
    const s=await gpu.advance(480,defaults);max=Math.max(max,Math.abs(energy(Array.from(s.slice(0,4)),defaults)-start));
  }
  assert(max<.02,`GPU 120 s energy drift ${max} J`);
  gpu.reset(1.9,1.7);
  for(let i=0;i<3840;i++)await gpu.advance(1,{...defaults,l2:i===0?0:Math.max(.05,i/3840)});
  const grown=await gpu.advance(0,defaults);
  assert(grown.every(Number.isFinite),'Growth remains finite');
  output.textContent=`PASS: GPU agreement ${error.toExponential(3)} rad or rad/s; 120 s max energy drift ${max.toExponential(3)} J; equilibrium, restart, zero length, growth.`;
  gpu.device.destroy();
} catch(error) {output.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;}
