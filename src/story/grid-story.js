import { createEnsemble, DEG } from '../physics/ensemble.js';

export const STORY_DURATION=165;
/** Each stage has its own bounded ensemble and a fresh reset-and-run experiment. */
export const stages=[
  {size:2,at:0,revealAt:4,revealEnd:12,wide:2.5,focusAt:15,focusEnd:19,resetAt:21,runAt:25},
  {size:10,at:46,revealAt:46,revealEnd:56,wide:12,focusAt:58,focusEnd:62,resetAt:64,runAt:74},
  {size:40,at:90,revealAt:90,revealEnd:100,wide:48,focusAt:102,focusEnd:106,resetAt:108,runAt:112},
  {size:160,at:127,revealAt:127,revealEnd:139,wide:184,focusAt:141,focusEnd:145,resetAt:147,runAt:151}
];
/** Quintic easing has zero velocity and acceleration at both ends. */
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*ease(t);
export const chapters=[
  {at:0,number:'01',title:'One experiment',text:'Follow this pendulum into the top-left corner of four experiments.'},
  {at:4,number:'02',title:'Just four pendulums',text:'Pull back to a 2 × 2 grid. Only these four experiments are on screen.'},
  {at:12,number:'02',title:'Pause. Look a little closer.',text:'Stop time, then bring the four pendulums into a closer frame.'},
  {at:20,number:'02',title:'Almost the same beginning',text:'Reset all four at rest, with only 0.01° between neighbouring starting angles.'},
  {at:25,number:'02',title:'Small differences can grow',text:'Let time run. Nearby starting conditions can lead to different trajectories: sensitivity to initial conditions.'},
  {at:35,number:'02',title:'Sensitivity to initial conditions',text:'The rules are deterministic. In a chaotic regime, tiny differences can grow and limit prediction. Some initial conditions remain regular.'},
  {at:46,number:'03',title:'Now a hundred experiments',text:'Reveal only a 10 × 10 grid. Pause, then frame this grid more closely.'},
  {at:63,number:'03',title:'Reset across the full angle range',text:'Set the primary angle from −180° to +180° across columns, and the secondary angle from +180° to −180° down rows.'},
  {at:66,number:'03',title:'Give each angle pair a colour',text:'The pendulums are still at rest. Fade in a colour for each pair of angles before restarting time.'},
  {at:74,number:'03',title:'Run the hundred together',text:'Every cell starts together. Its position records the starting angles; its colour follows the current angles.'},
  {at:90,number:'04',title:'1,600 experiments',text:'Reveal a 40 × 40 grid, pause, and move in closer. This is a new sampling of the full angle domain.'},
  {at:107,number:'04',title:'Reset the larger grid',text:'Return all 1,600 pendulums to rest across −180° to +180° on both axes.'},
  {at:112,number:'04',title:'Run again. See more detail.',text:'The same physics, a fresh start, and many more initial conditions. Watch the angle colours evolve.'},
  {at:127,number:'05',title:'25,600 experiments',text:'Reveal only a 160 × 160 field. Pause and frame it before resetting this final experiment.'},
  {at:146,number:'05',title:'One more full-domain reset',text:'All 25,600 pendulums return to their starting angles with zero angular velocity.'},
  {at:151,number:'05',title:'The same rules, across a field',text:'Run the entire field together. Every colour represents current angles, not a proof of chaos or stability.'}
];

/** Pure, seekable camera/caption timeline. @param {number} time @param {boolean} [reduced] */
export function storyFrame(time,reduced=false) {
  const t=Math.max(0,Math.min(STORY_DURATION,time));
  const stageIndex=stages.filter(s=>t>=s.at).length-1,stage=stages[stageIndex],nextStage=stages[stageIndex+1];
  const from=stageIndex===0?1:stages[stageIndex-1].size;
  let cells=t<stage.revealEnd?mix(from,stage.wide,(t-stage.revealAt)/(stage.revealEnd-stage.revealAt))
    :t<stage.focusAt?stage.wide:mix(stage.wide,stage.size,(t-stage.focusAt)/(stage.focusEnd-stage.focusAt));
  if(reduced)cells=t<stage.revealAt?from:t<stage.focusAt?stage.wide:stage.size;
  const chapter=chapters.filter(c=>t>=c.at).at(-1)??chapters[0],next=chapters[chapters.indexOf(chapter)+1];
  const opacity=Math.min(ease((t-chapter.at)/.9),next?ease((next.at-t)/.9):1);
  const resetFade=t<stage.resetAt-1?1:t<stage.resetAt?1-ease(t-stage.resetAt+1):ease((t-stage.resetAt)/2);
  const enter=stageIndex===0?1:ease(t-stage.at),exit=nextStage?1-ease(t-nextStage.at+1):1;
  return {cells,size:stage.size,stage:stageIndex,opening:reduced?Number(t>=12):ease((t-4)/8),
    colour:stageIndex===0?0:stageIndex===1?ease((t-66)/6):1,
    resetFade:reduced?1:resetFade*enter*exit,chapter,opacity:reduced?1:opacity,
    running:(stageIndex===0&&t<12)||(t>=stage.runAt&&(!nextStage||t<nextStage.at-1)),
    reset:t>=stage.resetAt,done:t>=STORY_DURATION};
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
