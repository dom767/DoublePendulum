import test from 'node:test';
import assert from 'node:assert/strict';
import { storyFrame, storyEnsemble, ease, stages, STORY_DURATION } from '../src/story/grid-story.js';
import { DEG } from '../src/physics/ensemble.js';
import { DT, defaults } from '../src/physics/pendulum.js';
import { step } from '../src/physics/integrator.js';
import { StoryGridView } from '../src/views/story-grid.js';

test('each bounded stage reveals, holds, frames closer, resets and runs in that order',()=>{
  for(const s of stages) {
    assert.equal(storyFrame(s.revealEnd).size,s.size);
    assert.equal(storyFrame(s.revealEnd).cells,s.wide);
    assert.equal(storyFrame(s.focusEnd).cells,s.size);
    assert.equal(storyFrame(s.focusAt+1).running,false);
    assert.ok(storyFrame(s.focusAt+1).cells<s.wide);
    assert.equal(storyFrame(s.resetAt).resetFade,0);
    assert.equal(storyFrame(s.resetAt).reset,true);
    assert.equal(storyFrame(s.runAt-.01).running,false);
    assert.equal(storyFrame(s.runAt).running,true);
    for(const t of [s.revealAt,s.revealEnd,s.focusAt,s.focusEnd]) {
      if(t!==s.at)assert.ok(Math.abs(storyFrame(t-1e-4).cells-storyFrame(t+1e-4).cells)<1e-5);
    }
  }
  assert.equal(storyFrame(STORY_DURATION).done,true);
  assert.equal(ease(0),0);assert.equal(ease(1),1);
  assert.ok(ease(.001)<1e-7);assert.ok(1-ease(.999)<1e-7);
});
test('four nearby starts stay nearly identical initially and all velocities reset to zero',()=>{
  const field=storyEnsemble(2,110*DEG,100*DEG);
  assert.equal(field.initial.length,4*4);
  for(let i=0;i<4;i++) {
    assert.ok(Math.abs(field.initial[i*4]/DEG-110)<.006);
    assert.ok(Math.abs(field.initial[i*4+1]/DEG-100)<.006);
    assert.equal(field.initial[i*4+2],0);assert.equal(field.initial[i*4+3],0);
  }
  assert.ok(Math.abs((field.initial[4]-field.initial[0])/DEG-.01)<1e-5);
});
test('larger stages span exact angle endpoints and colour reveal is held before running',()=>{
  for(const n of [10,40,160]) {
    const field=storyEnsemble(n,1,2);
    assert.equal(field.initial.length,n*n*4);
    assert.equal(field.initial[0],Math.fround(-Math.PI));assert.equal(field.initial[1],Math.fround(Math.PI));
    assert.equal(field.initial[(n*n-1)*4],Math.fround(Math.PI));assert.equal(field.initial[(n*n-1)*4+1],Math.fround(-Math.PI));
    for(let i=0;i<n*n;i++){assert.equal(field.initial[i*4+2],0);assert.equal(field.initial[i*4+3],0);}
  }
  assert.equal(storyFrame(66).colour,0);assert.equal(storyFrame(69).colour,.5);assert.equal(storyFrame(72).colour,1);
  assert.equal(storyFrame(73).running,false);assert.equal(storyFrame(74).running,true);
  assert.equal(storyFrame(15,true).cells,2);assert.equal(storyFrame(60,true).cells,10);
});

test('default nearby starts develop visible angular separation within the run hold',()=>{
  const initial=storyEnsemble(2,110*DEG,100*DEG).initial;
  let a=Array.from(initial.slice(0,4)),b=Array.from(initial.slice(4,8));
  const angularDistance=(x,y)=>Math.abs(Math.atan2(Math.sin(x-y),Math.cos(x-y)));
  assert.ok(angularDistance(a[0],b[0])<.001);
  for(let i=0;i<20/DT;i++){a=step(a,defaults,DT);b=step(b,defaults,DT);}
  assert.ok(Math.max(angularDistance(a[0],b[0]),angularDistance(a[1],b[1]))>.5);
});

test('renderer draws only four pendulums and sizes colour images to each active stage',()=>{
  const originalDocument=globalThis.document,originalDpr=globalThis.devicePixelRatio;
  let arcs=0;const images=[];
  const context=new Proxy({arc(){arcs++;},createImageData(w,h){images.push([w,h]);return {data:new Uint8ClampedArray(w*h*4),width:w,height:h};}},
    {get:(object,key)=>key in object?object[key]:()=>{}});
  const canvas={width:0,height:0,clientWidth:1000,clientHeight:800,getContext:()=>context};
  globalThis.devicePixelRatio=1;
  globalThis.document=/** @type {any} */({createElement:()=>({width:0,height:0,getContext:()=>context})});
  try {
    const view=new StoryGridView(/** @type {any} */(canvas));
    view.draw(storyEnsemble(2,1,1).initial,defaults,storyFrame(14),14);
    assert.equal(arcs,12,'Two bobs and a pivot per pendulum; no neighbouring field');
    for(const [size,t] of [[10,72],[40,110],[160,149]])view.draw(storyEnsemble(size,1,1).initial,defaults,storyFrame(t),t);
    assert.deepEqual(images,[[10,10],[40,40],[160,160]]);
  } finally {globalThis.document=originalDocument;globalThis.devicePixelRatio=originalDpr;}
});
