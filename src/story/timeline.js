import { defaultTimeline } from './default-timeline.js';

export const MAX_DURATION=600;
/** Validate the entire file before returning a replacement. @param {unknown} value */
export function importTimings(value) {
  const data=/** @type {any} */(value);
  if(data?.version!==1||!Array.isArray(data.points))throw new Error('Unsupported story timing format or version.');
  if(data.points.length!==defaultTimeline.length)throw new Error('Include every storypoint exactly once.');
  const timings=new Map();
  for(const point of data.points) {
    if(!defaultTimeline.some(p=>p.id===point.id)||timings.has(point.id))throw new Error('Unknown or duplicate storypoint ID.');
    if(typeof point.duration!=='number'||!Number.isFinite(point.duration)||point.duration<0||point.duration>MAX_DURATION)throw new Error('Durations must be finite numbers from 0 to 600 seconds.');
    timings.set(point.id,point.duration);
  }
  return defaultTimeline.map(p=>({...p,duration:timings.get(p.id)}));
}
/** @param {typeof defaultTimeline} points */
export function exportTimings(points) {
  return JSON.stringify({version:1,points:points.map(({id,duration})=>({id,duration}))},null,2)+'\n';
}
/** Cumulative timing and original-event mapping. @param {typeof defaultTimeline} points */
export function compileTimeline(points) {
  let duration=0;
  const entries=points.map(point=>{const start=duration;duration+=point.duration;return {...point,start,end:duration};});
  const gridOffset=entries[2].start;
  const mapTime=t=>{
    const point=entries.filter(p=>p.original<=t).at(-1);
    if(!point)return 0;
    const index=entries.indexOf(point),next=entries[index+1]?.original??165;
    return point.start-gridOffset+(next===point.original?0:(t-point.original)/(next-point.original)*point.duration);
  };
  const stages=[
    {size:2,at:0,revealAt:4,revealEnd:8,resetAt:9,resetEnd:11,zoomAt:12,zoomEnd:20,runAt:25},
    {size:10,at:46,revealAt:46,revealEnd:50,resetAt:51,resetEnd:53,zoomAt:54,zoomEnd:64,runAt:74},
    {size:40,at:90,revealAt:90,revealEnd:94,resetAt:95,resetEnd:97,zoomAt:98,zoomEnd:108,runAt:112},
    {size:160,at:127,revealAt:127,revealEnd:131,resetAt:132,resetEnd:134,zoomAt:135,zoomEnd:147,runAt:151}
  ].map(s=>({...s,originalZoom:s.zoomAt,originalReveal:s.revealAt,originalReset:s.resetAt,originalRun:s.runAt,at:mapTime(s.at),revealAt:mapTime(s.revealAt),revealEnd:mapTime(s.revealEnd),resetAt:mapTime(s.resetAt),resetEnd:mapTime(s.resetEnd),zoomAt:mapTime(s.zoomAt),zoomEnd:mapTime(s.zoomEnd),runAt:mapTime(s.runAt)}));
  return {entries,duration,gridOffset,mapTime,stages};
}
