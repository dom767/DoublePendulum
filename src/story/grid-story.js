import { createEnsemble, DEG } from '../physics/ensemble.js';

import { defaultTimeline, chapters } from './default-timeline.js';
import { compileTimeline } from './timeline.js';
export const STORY_DURATION=165;
const defaultCompiled=compileTimeline(defaultTimeline);
export const stages=defaultCompiled.stages;
/** Quintic easing has zero velocity and acceleration at both ends. */
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const progress=(t,a,b)=>b===a?Number(t>=a):(t-a)/(b-a);
const mix=(a,b,t)=>a+(b-a)*ease(t);
export { chapters };

/** Pure, seekable camera/caption timeline. @param {number} time @param {boolean} [reduced] */
export function storyFrame(time,reduced=false,timeline=defaultCompiled,originalLimit=Infinity) {
  const {stages,duration,gridOffset}=timeline;
  const authored=chapters.map(c=>({...c,at:timeline.mapTime(c.at)}));
  const t=Math.max(0,Math.min(duration-gridOffset,time));
  const stageIndex=stages.filter((s,i)=>t>=s.at&&[0,46,90,127][i]<=originalLimit).length-1,stage=stages[stageIndex],nextStage=stages[stageIndex+1];
  const from=stageIndex===0?1:stages[stageIndex-1].size;
  const zoomProgress=originalLimit<stage.originalZoom?0:progress(t,stage.zoomAt,stage.zoomEnd);
  const zoom=ease(zoomProgress);
  const cells=reduced?(t<stage.zoomAt||originalLimit<stage.originalZoom?from:stage.size):mix(from,stage.size,zoomProgress);
  const chapter=authored.filter((c,i)=>t>=c.at&&chapters[i].at<=originalLimit).at(-1)??authored[0],next=authored[authored.indexOf(chapter)+1];
  const opacity=Math.min(ease((t-chapter.at)/.9),next?ease((next.at-t)/.9):1);
  return {cells,size:stage.size,stage:stageIndex,previousSize:from,opening:reduced?Number(t>=stages[0].zoomAt&&originalLimit>=stages[0].originalZoom):stageIndex===0?zoom:1,
    newOpacity:reduced?Number(t>=stage.revealEnd):originalLimit<stage.originalReveal?0:ease(progress(t,stage.revealAt,stage.revealEnd)),
    resetBlend:reduced?1:originalLimit<stage.originalReset?0:ease(progress(t,stage.resetAt,stage.resetEnd)),
    colour:stageIndex===0?0:stageIndex===1?originalLimit<66?0:ease(progress(t,timeline.mapTime(66),timeline.mapTime(72))):1,
    chapter,opacity:reduced?1:opacity,
    running:(stageIndex===0&&t<stages[0].revealAt)||(t>=stage.runAt&&(!nextStage||t<nextStage.at)),
    reset:t>=stage.resetAt,done:t>=duration-gridOffset};
}

/** Existing cells never fade; only newly added rows/columns do.
 * @param {ReturnType<typeof storyFrame>} scene @param {number} row @param {number} col */
export function storyCellOpacity(scene,row,col) {
  return row<scene.previousSize&&col<scene.previousSize?1:scene.newOpacity;
}

/** Keep reset poses visible by easing along the shortest angular path to the fresh initial state.
 * This is a visual reset, with physics held until the subsequent run.
 * @param {Float32Array} states @param {Float32Array|null} from @param {number} blend */
export function resetPoses(states,from,blend) {
  if(!from||from.length!==states.length||blend>=1)return states;
  if(blend<=0)return from;
  const result=states.slice();
  for(let i=0;i<states.length;i+=4)for(let j=0;j<2;j++) {
    const delta=states[i+j]-from[i+j];
    result[i+j]=from[i+j]+Math.atan2(Math.sin(delta),Math.cos(delta))*blend;
  }
  return result;
}

/** Four nearly identical starts; larger stages include both endpoints of each angle axis.
 * Periodic endpoints deliberately repeat equivalent orientations on opposite edges.
 * @param {number} size @param {number} a @param {number} b */
export function storyEnsemble(size,a,b) {
  if(size===2)return createEnsemble(2,{center1:a/DEG,center2:b/DEG,span1:.02,span2:.02});
  const field=createEnsemble(size,{center1:0,center2:0,span1:360,span2:360});
  for(let row=0;row<size;row++)for(let col=0;col<size;col++) {
    const i=(row*size+col)*4;
    field.initial[i]=(-1+2*col/(size-1))*Math.PI;
    field.initial[i+1]=(1-2*row/(size-1))*Math.PI;
  }
  return field;
}
