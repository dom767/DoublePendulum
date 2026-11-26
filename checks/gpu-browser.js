import { GPUBackend } from '../src/compute/gpu-backend.js';
import { step } from '../src/physics/integrator.js';
import { DT, defaults, energy, openingLength, INTRO_DURATION, GROW_DURATION } from '../src/physics/pendulum.js';
import { createEnsemble, cellInitial, presets } from '../src/physics/ensemble.js';

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
  await gpu.advance(INTRO_DURATION/DT,{...defaults,l2:0});
  const grown=await gpu.advanceVarying(GROW_DURATION/DT,i=>({...defaults,l2:openingLength(INTRO_DURATION+i*DT,defaults.l2)}));
  assert(grown.every(Number.isFinite),'Growth remains finite');
  const ensemble=createEnsemble(6,presets.full),saved=ensemble.initial.slice();
  gpu.resetStates(ensemble.initial);
  const grid=await gpu.advance(480,defaults);
  assert(grid.length===36*4,'Ensemble readback size');
  for(let index=0;index<36;index++) {
    const initial=cellInitial(ensemble,index);gpu.reset(initial[0],initial[1]);
    const isolated=await gpu.advance(480,defaults);
    assert(isolated.slice(0,4).every((x,i)=>x===grid[index*4+i]),`Cell ${index} matches single view after 480 steps`);
  }
  gpu.resetStates(ensemble.initial);await gpu.advance(173,defaults);
  const chunked=await gpu.advance(307,defaults);
  assert(chunked.every((x,i)=>x===grid[i]),'All cells receive the same steps regardless of frame grouping');
  assert(saved.every((x,i)=>x===ensemble.initial[i]),'Initial conditions are retained');
  const dense=createEnsemble(160,presets.full);gpu.resetStates(dense.initial);
  const denseStart=performance.now(),denseRun=await gpu.advance(32,defaults),denseMs=performance.now()-denseStart;
  assert(denseRun.length===25600*4&&denseRun.every(Number.isFinite),'160×160 GPU field');
  for(const index of [0,159,25599]) {
    const initial=cellInitial(dense,index);gpu.reset(initial[0],initial[1]);const isolated=await gpu.advance(32,defaults);
    assert(isolated.slice(0,4).every((x,i)=>x===denseRun[index*4+i]),`Dense cell ${index} matches isolated run`);
  }
  const {createPixelField, sampleTile, MAP_STEPS}=await import('../src/physics/ensemble.js');
  const {MAP_METRICS}=await import('../src/maps/metrics.js');
  const rect=createPixelField(64,48,presets.full);gpu.resetStates(rect.initial);
  await gpu.advanceInPlace(MAP_STEPS,defaults);
  const colours=await gpu.readColours(0,MAP_STEPS);
  assert(colours.length===64*48*4,'Rectangular colour readback');
  assert(colours[3]===255&&colours.every((_,i)=>i%4!==3||colours[i]===255),'Opaque GPU colours');
  // Milestone 4: verify tile-order independence, first-flip, sensitivity, and smaller Δt refinement on GPU.
  const tileTop=sampleTile(64,48,0,24,presets.full), tileBot=sampleTile(64,48,24,48,presets.full);
  gpu.resetMetricStates(tileBot,'final-angle');await gpu.advanceMetricInPlace(MAP_STEPS,defaults,'final-angle',DT,0);
  const botCols=await gpu.readColours(MAP_METRICS['final-angle'].mode,MAP_STEPS);
  const botOffset=24*64*4;
  assert(botCols.every((v,i)=>v===colours[botOffset+i]),'Tiled GPU map matches full-field map regardless of tile order');
  gpu.resetMetricStates(tileTop,'first-flip');await gpu.advanceMetricInPlace(500,defaults,'first-flip',DT,0);await gpu.advanceMetricInPlace(500,defaults,'first-flip',DT,500);
  const flipCols=await gpu.readColours(MAP_METRICS['first-flip'].mode,MAP_STEPS);
  assert(flipCols.length===64*24*4,'First-flip GPU colour readback');
  // Candidate regular check near (0°, 0°) at refined Δt = 1/960 s and longer duration N = 2000.
  const calmDomain={center1:0,center2:0,span1:20,span2:20};
  const calm=createPixelField(8,8,calmDomain);
  gpu.resetMetricStates(calm.initial,'first-flip');
  await gpu.advanceMetricInPlace(2000,defaults,'first-flip',1/960,0);
  const calmFlip=await gpu.readColours(MAP_METRICS['first-flip'].mode,2000);
  assert(calmFlip[0]===20&&calmFlip[1]===24&&calmFlip[2]===36,'Low-energy candidate regular region shows no flip at refined Δt = 1/960 s');
  gpu.resetMetricStates(calm.initial,'sensitivity');
  await gpu.advanceMetricInPlace(MAP_STEPS,defaults,'sensitivity',DT,0);
  const sensCols=await gpu.readColours(MAP_METRICS.sensitivity.mode,MAP_STEPS);
  assert(sensCols.length===8*8*4,'Sensitivity GPU colour readback');
  // A point preview shares pipelines/device, but never map state or readback buffers.
  const point=gpu.fork();point.reset(1.1,1.2);
  const beforePreview=(await gpu.readColours(MAP_METRICS.sensitivity.mode,MAP_STEPS)).slice();
  await point.advance(480,defaults);
  const afterPreview=await gpu.readColours(MAP_METRICS.sensitivity.mode,MAP_STEPS);
  assert(afterPreview.every((value,i)=>value===beforePreview[i]),'Point preview leaves static map buffers unchanged');
  point.destroy();
  const pixelStart=performance.now();
  gpu.resetStates(rect.initial);
  await gpu.advanceInPlace(32,defaults);
  await gpu.readColours(0,MAP_STEPS);
  const pixelMs=performance.now()-pixelStart;
  output.textContent=`PASS: GPU agreement ${error.toExponential(3)} rad or rad/s; 120 s max energy drift ${max.toExponential(3)} J; equilibrium, restart, zero length, growth; all 36 grid cells match isolated runs; frame grouping and retained initial conditions; 160×160 field (32 steps plus readback: ${denseMs.toFixed(1)} ms); 64×48 map ${MAP_STEPS} steps, tile-order match, isolated point preview, first-flip, sensitivity, and 1/960 s candidate-region check (32-step colour sample: ${pixelMs.toFixed(1)} ms). Timings exclude full-canvas drawing and are not a recording frame-rate benchmark.`;
  gpu.device.destroy();
} catch(error) {output.textContent=`FAIL: ${error instanceof Error?error.message:String(error)}`;}
