import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTimeline } from '../src/story/default-timeline.js';
import { compileTimeline, exportTimings, importTimings } from '../src/story/timeline.js';
import { storyFrame } from '../src/story/grid-story.js';
import { StoryPlayer } from '../src/story/player.js';

const copy=()=>defaultTimeline.map(p=>({...p}));
test('default timeline preserves all original event times and 183-second total',()=>{
  const t=compileTimeline(defaultTimeline);
  assert.equal(t.duration,183);assert.equal(t.gridOffset,18);
  for(const p of defaultTimeline.slice(2))assert.equal(t.mapTime(p.original),p.original);
  assert.equal(t.entries.find(p=>p.id==='sensitivity').start,53);
  const edited=copy();edited[0].duration=3;edited[3].duration=0;
  const next=compileTimeline(edited);assert.equal(next.duration,172);
  assert.equal(next.entries[4].start,next.entries[3].start);
});
test('JSON round trips and invalid files never produce replacement timings',()=>{
  const points=copy();points[3].duration=.01;points[4].duration=0;
  assert.deepEqual(importTimings(JSON.parse(exportTimings(points))),points);
  const data=()=>JSON.parse(exportTimings(points));
  for(const mutate of [d=>d.version=2,d=>d.points.pop(),d=>d.points[0].id='unknown',d=>d.points[0].id=d.points[1].id,d=>d.points[0].duration=-1,d=>d.points[0].duration=Infinity,d=>d.points[0].duration='1',d=>d.points[0].duration=601]) {
    const invalid=data();mutate(invalid);assert.throws(()=>importTimings(invalid));
  }
});
test('instantaneous and short transitions yield finite frames at every selected point',()=>{
  const points=copy();for(const p of points)p.duration=p.action==='run'?.001:0;
  const timeline=compileTimeline(points);
  for(const point of timeline.entries.slice(2)) {
    const frame=storyFrame(point.start-timeline.gridOffset,false,timeline,point.original);
    for(const key of ['cells','opening','newOpacity','resetBlend','colour','opacity'])assert.ok(Number.isFinite(frame[key]),key);
  }
  const allZero=copy().map(p=>({...p,duration:0})),zero=compileTimeline(allZero);
  assert.equal(storyFrame(0,false,zero,4).cells,1,'A future zero-length zoom waits for its event');
  assert.equal(storyFrame(0,false,zero,12).cells,2);
  assert.equal(storyFrame(0,false,zero,54).colour,0);
  assert.equal(storyFrame(0,false,zero,66).colour,1);
});
function gpu() {
  return {state:new Float32Array(),counts:[],destroyed:false,resetStates(s){this.state=s.slice();},destroy(){this.destroyed=true;},
    async advance(n){this.counts.push(n);this.state[0]+=n;return this.state.slice();},async advanceVarying(n,p){p(0);return this.advance(n);}};
}
async function finish(player) {for(let i=0;i<10000;i++){const result=await player.pump();if(result)return result;}throw new Error('Preview did not complete');}
test('GPU preview reconstructs all events in order, caches points and supports backward seeks',async()=>{
  const points=copy();for(const p of points)p.duration=.002;
  const timeline=compileTimeline(points),player=new StoryPlayer(),first=gpu();
  player.seek(first,timeline,[1,2],{l1:1,l2:1,m1:1,m2:1},33,1);
  const final=await finish(player);assert.equal(final.field.size,160);assert.equal(final.state.length,160*160*4);
  assert.ok(first.counts.every(n=>n<=32));
  const back=gpu();player.seek(back,timeline,[1,2],{},3,1);const restored=await finish(player);assert.equal(restored.field.size,2);
  assert.equal(back.counts.length,0,'Cached point does not integrate again');
  player.clear();assert.equal(player.checkpoints.size,0);
});
test('rapid selections retire pending GPU work without stale preview commits',async()=>{
  const player=new StoryPlayer(),timeline=compileTimeline(defaultTimeline),old=gpu();let release=(_state)=>{};
  old.advanceVarying=()=>new Promise(resolve=>{release=resolve;});
  player.seek(old,timeline,[1,2],{l2:1},2,1);const pending=player.pump();
  const latest=gpu();player.seek(latest,timeline,[1,2],{l2:1},0,1);
  release(new Float32Array(8));assert.equal(await pending,null);assert.equal(old.destroyed,true);
  assert.equal((await finish(player)).target,0);
});
