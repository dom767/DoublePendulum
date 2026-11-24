import test from 'node:test';
import assert from 'node:assert/strict';
import { storyFrame, storyEnsemble, ease, STORY_DURATION } from '../src/story/grid-story.js';
import { DEG } from '../src/physics/ensemble.js';

test('story holds each grid and zooms continuously through 1, 2, 10, 40 and 160',()=>{
  for(const [time,cells] of [[0,1],[5,1],[13,2],[17,2],[29,10],[60,10],[72,40],[77,40],[92,160],[100,160]])assert.equal(storyFrame(time).cells,cells);
  for(const t of [5,13,17,29,60,72,77,92])assert.ok(Math.abs(storyFrame(t-1e-4).cells-storyFrame(t+1e-4).cells)<1e-5);
  assert.equal(ease(0),0);assert.equal(ease(1),1);
  assert.ok(ease(.001)<1e-7);assert.ok(1-ease(.999)<1e-7);
  assert.equal(storyFrame(STORY_DURATION).done,true);
});
test('reset is hidden before colour fades in, then physics starts after the colour hold',()=>{
  assert.equal(storyFrame(34).running,false);assert.equal(storyFrame(36).resetFade,0);
  assert.equal(storyFrame(36).reset,true);assert.equal(storyFrame(38).colour,0);
  assert.equal(storyFrame(41).colour,.5);assert.equal(storyFrame(44).colour,1);
  assert.equal(storyFrame(47.99).running,false);assert.equal(storyFrame(48).running,true);
});
test('nested field keeps the original initial conditions in its top-left cell',()=>{
  const field=storyEnsemble(110*DEG,100*DEG);
  assert.equal(field.initial.length,25600*4);
  assert.equal(field.initial[0],Math.fround(110*DEG));assert.equal(field.initial[1],Math.fround(100*DEG));
  assert.ok(Math.abs((field.initial[4]-field.initial[0])/DEG-2.25)<1e-5);
  assert.ok(Math.abs((field.initial[160*4+1]-field.initial[1])/DEG+2.25)<1e-5);
  assert.equal(storyFrame(9,true).cells,2);assert.equal(storyFrame(22,true).cells,10);
});
