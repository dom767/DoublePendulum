import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnsemble, cellInitial, presets, DEG } from '../src/physics/ensemble.js';
import { angleRGB } from '../src/render/angle-colour.js';
import { GridView } from '../src/views/grid.js';

test('grid uses cell centres with primary rightward and secondary upward',()=>{
  const e=createEnsemble(6,presets.full), a=cellInitial(e,0),b=cellInitial(e,35);
  assert.ok(Math.abs(a[0]/DEG+150)<.00001);assert.ok(Math.abs(a[1]/DEG-150)<.00001);
  assert.ok(Math.abs(b[0]/DEG-150)<.00001);assert.ok(Math.abs(b[1]/DEG+150)<.00001);
  assert.equal(e.initial.length,6*6*4);
  for(let i=0;i<36;i++){assert.equal(e.initial[i*4+2],0);assert.equal(e.initial[i*4+3],0);}
  assert.ok(cellInitial(e,1)[0]>a[0]);assert.ok(cellInitial(e,6)[1]<a[1]);
});
test('presets and immutable initial conditions remain reproducible',()=>{
  for(const preset of Object.values(presets)) {
    const a=createEnsemble(10,preset),b=createEnsemble(10,preset);
    assert.deepEqual(a.initial,b.initial);
    const cell=cellInitial(a,34);cell[0]=42;
    assert.notEqual(a.initial[34*4],42);
  }
  assert.throws(()=>createEnsemble(0,presets.full));
  assert.throws(()=>createEnsemble(10,{...presets.full,span2:0}));
  assert.throws(()=>cellInitial(createEnsemble(6,presets.full),36));
});
test('colour map is periodic on both angles and continuous across wrapping',()=>{
  for(const a of [-2.8,-1,0,.9,2.7])for(const b of [-2.6,-.4,0,1.3]) {
    assert.deepEqual(angleRGB(a,b),angleRGB(a+Math.PI*2,b));
    assert.deepEqual(angleRGB(a,b),angleRGB(a,b-Math.PI*2));
    for(const channel of angleRGB(a,b))assert.ok(channel>=0&&channel<=255);
  }
  for(const b of [-2,-.5,.5,2]) {
    const left=angleRGB(-Math.PI+1e-7,b),right=angleRGB(Math.PI-1e-7,b);
    assert.ok(left.every((v,i)=>Math.abs(v-right[i])<=1));
    const bottom=angleRGB(b,-Math.PI+1e-7),top=angleRGB(b,Math.PI-1e-7);
    assert.ok(bottom.every((v,i)=>Math.abs(v-top[i])<=1));
  }
});
test('grid hit testing selects row-major cells and rejects axes and outer boundary',()=>{
  const grid=new GridView(/** @type {HTMLCanvasElement} */(/** @type {unknown} */({getContext:()=>null})));
  grid.bounds={x:40,y:50,side:300};
  assert.equal(grid.hit(41,51,10),0);assert.equal(grid.hit(339,349,10),99);
  assert.equal(grid.hit(39,51,10),-1);assert.equal(grid.hit(340,51,10),-1);
});
