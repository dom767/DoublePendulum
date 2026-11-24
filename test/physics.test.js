import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, derivative, energy, DT, GROW_DURATION, GROW_FLOOR, growthLength } from '../src/physics/pendulum.js';
import { step } from '../src/physics/integrator.js';

function evolve(s, seconds, dt=DT, p=defaults) {
  for(let i=0;i<Math.round(seconds/dt);i++) s=step(s,p,dt);
  return s;
}
const distance=(a,b)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])));
test('downward equilibrium remains stationary',()=>assert.deepEqual(evolve([0,0,0,0],10),[0,0,0,0]));
test('reflection symmetry and reproducible restarts',()=>{
  const initial=[1.2,.7,0,0], a=evolve(initial,2),b=evolve(initial.map(x=>-x),2);
  assert.ok(distance(a,b.map(x=>-x))<1e-12);
  assert.deepEqual(a,evolve(initial,2));
});
test('zero-length branch is a simple pendulum without singular acceleration',()=>{
  const p={...defaults,l2:0};
  assert.deepEqual(derivative([Math.PI/2,Math.PI/2,0,0],p),[0,0,-9.81,-9.81]);
  assert.ok(evolve([1,1,0,0],120,DT,p).every(Number.isFinite));
});
test('energy stays bounded over 120 seconds at recording timestep',()=>{
  let s=[1.9,1.7,0,0],initial=energy(s,defaults),max=0;
  for(let i=0;i<120/DT;i++){s=step(s,defaults,DT);max=Math.max(max,Math.abs(energy(s,defaults)-initial));}
  assert.ok(max<0.0001,`maximum absolute drift ${max} J`);
});
test('short-time RK4 refinement converges',()=>{
  const initial=[1.9,1.7,0,0];
  const coarse=evolve(initial,1,1/60), fine=evolve(initial,1,1/120),reference=evolve(initial,1,1/960);
  assert.ok(distance(fine,reference)<distance(coarse,reference)/8);
});
test('growth length is zero at t=0 then floored until the ramp clears',()=>{
  assert.equal(growthLength(0,1),0);
  assert.equal(growthLength(DT,1),GROW_FLOOR);
  assert.equal(growthLength(GROW_DURATION/2,1),0.5);
  assert.equal(growthLength(GROW_DURATION,1),1);
  assert.equal(growthLength(1,0),0);
});
