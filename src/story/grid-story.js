import { createEnsemble, DEG } from '../physics/ensemble.js';

export const STORY_DURATION=165;
/** Each stage has its own bounded ensemble and a fresh reset-and-run experiment. */
export const stages=[
  {size:2,at:0,revealAt:4,revealEnd:8,resetAt:9,zoomAt:12,zoomEnd:20,runAt:25},
  {size:10,at:46,revealAt:46,revealEnd:50,resetAt:51,zoomAt:54,zoomEnd:64,runAt:74},
  {size:40,at:90,revealAt:90,revealEnd:94,resetAt:95,zoomAt:98,zoomEnd:108,runAt:112},
  {size:160,at:127,revealAt:127,revealEnd:131,resetAt:132,zoomAt:135,zoomEnd:147,runAt:151}
];
/** Quintic easing has zero velocity and acceleration at both ends. */
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*ease(t);
export const chapters=[
  {at:0,number:'01',title:'One experiment',text:'Follow this pendulum into the top-left corner of four experiments.'},
  {at:4,number:'02',title:'Keep one. Add three.',text:'Hold the original pendulum in place while three new neighbours fade in.'},
  {at:9,number:'02',title:'Almost the same beginning',text:'Reset all four at rest, with only 0.01° between neighbouring starting angles.'},
  {at:12,number:'02',title:'Make room for four',text:'Pull straight back to frame the 2 × 2 grid. The original stays in the top-left corner.'},
  {at:25,number:'02',title:'Small differences can grow',text:'Let time run. Nearby starting conditions can lead to different trajectories: sensitivity to initial conditions.'},
  {at:35,number:'02',title:'Sensitivity to initial conditions',text:'The rules are deterministic. In a chaotic regime, tiny differences can grow and limit prediction. Some initial conditions remain regular.'},
  {at:46,number:'03',title:'Keep four. Add more beginnings.',text:'The existing pendulums stay visible. New cells fade in around them before we pull back.'},
  {at:51,number:'03',title:'Reset across the full angle range',text:'Set the primary angle from −180° to +180° across columns, and the secondary angle from +180° to −180° down rows.'},
  {at:54,number:'03',title:'A hundred experiments',text:'One smooth pullback frames exactly 10 × 10 pendulums, with no return zoom.'},
  {at:66,number:'03',title:'Give each angle pair a colour',text:'The pendulums are still at rest. Fade in a colour for each pair of angles before restarting time.'},
  {at:74,number:'03',title:'Run the hundred together',text:'Every cell starts together. Its position records the starting angles; its colour follows the current angles.'},
  {at:90,number:'04',title:'Keep the grid. Add new neighbours.',text:'The hundred existing experiments stay in view while new cells fade in.'},
  {at:95,number:'04',title:'Reset the larger grid',text:'Return all 1,600 pendulums to rest across −180° to +180° on both axes.'},
  {at:98,number:'04',title:'1,600 experiments',text:'Pull straight back to the final 40 × 40 framing, then hold.'},
  {at:112,number:'04',title:'Run again. See more detail.',text:'The same physics, a fresh start, and many more initial conditions. Watch the angle colours evolve.'},
  {at:127,number:'05',title:'The field keeps growing',text:'Keep every existing cell visible as the new experiments fade in around the grid.'},
  {at:132,number:'05',title:'One more full-domain reset',text:'All 25,600 pendulums return to their starting angles with zero angular velocity.'},
  {at:135,number:'05',title:'25,600 experiments',text:'One final smooth pullback reveals 160 × 160 cells. The camera stops at this scale.'},
  {at:151,number:'05',title:'The same rules, across a field',text:'Run the entire field together. Every colour represents current angles, not a proof of chaos or stability.'}
];

/** Pure, seekable camera/caption timeline. @param {number} time @param {boolean} [reduced] */
export function storyFrame(time,reduced=false) {
  const t=Math.max(0,Math.min(STORY_DURATION,time));
  const stageIndex=stages.filter(s=>t>=s.at).length-1,stage=stages[stageIndex],nextStage=stages[stageIndex+1];
  const from=stageIndex===0?1:stages[stageIndex-1].size;
  const zoom=ease((t-stage.zoomAt)/(stage.zoomEnd-stage.zoomAt));
  const cells=reduced?(t<stage.zoomAt?from:stage.size):mix(from,stage.size,(t-stage.zoomAt)/(stage.zoomEnd-stage.zoomAt));
  const chapter=chapters.filter(c=>t>=c.at).at(-1)??chapters[0],next=chapters[chapters.indexOf(chapter)+1];
  const opacity=Math.min(ease((t-chapter.at)/.9),next?ease((next.at-t)/.9):1);
  return {cells,size:stage.size,stage:stageIndex,previousSize:from,opening:reduced?Number(t>=12):stageIndex===0?zoom:1,
    newOpacity:reduced?Number(t>=stage.revealEnd):ease((t-stage.revealAt)/(stage.revealEnd-stage.revealAt)),
    resetBlend:reduced?1:ease((t-stage.resetAt)/2),
    colour:stageIndex===0?0:stageIndex===1?ease((t-66)/6):1,
    chapter,opacity:reduced?1:opacity,
    running:(stageIndex===0&&t<4)||(t>=stage.runAt&&(!nextStage||t<nextStage.at)),
    reset:t>=stage.resetAt,done:t>=STORY_DURATION};
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
