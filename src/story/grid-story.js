import { createEnsemble, DEG } from '../physics/ensemble.js';

export const STORY_DURATION=100;
export const STORY_RESET=36;
export const STORY_RUN=48;
/** Quintic easing has zero velocity and acceleration at both ends. */
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*ease(t);
export const chapters=[
  {at:0,number:'01',title:'One experiment',text:'Follow this pendulum. The same experiment will stay in the top-left corner as we pull back.'},
  {at:5,number:'02',title:'Make room for more beginnings',text:'One becomes four. Each neighbour begins at slightly different angles.'},
  {at:17,number:'02',title:'A hundred experiments',text:'Keep pulling back. Columns change the first starting angle; rows change the second.'},
  {at:34,number:'03',title:'Reset. Give every beginning a colour.',text:'Return every pendulum to its starting angles, with zero angular velocity.'},
  {at:38,number:'03',title:'Two angles, one colour',text:'The background colour encodes both angles. Let the colours come into view before we let time run.'},
  {at:48,number:'04',title:'Let the same rules run',text:'All experiments restart together. Position remembers the starting angles; colour follows the current angles.'},
  {at:60,number:'05',title:'1,600 experiments',text:'Pull back to 40 × 40. These pendulums have been evolving together, including those outside the frame.'},
  {at:77,number:'06',title:'25,600 experiments',text:'Pull back again to 160 × 160. Individual arms give way to a field of evolving colour.'},
  {at:92,number:'06',title:'Small differences. Rich structure.',text:'Every cell follows the same deterministic rules. Colour shows angles, not a proof of chaos or stability.'}
];

/** Pure, seekable camera/caption timeline. @param {number} time @param {boolean} [reduced] */
export function storyFrame(time,reduced=false) {
  const t=Math.max(0,Math.min(STORY_DURATION,time));
  let cells=1;
  if(t>=5&&t<13)cells=mix(1,2,(t-5)/8);
  else if(t>=13&&t<17)cells=2;
  else if(t>=17&&t<29)cells=mix(2,10,(t-17)/12);
  else if(t>=29&&t<60)cells=10;
  else if(t>=60&&t<72)cells=mix(10,40,(t-60)/12);
  else if(t>=72&&t<77)cells=40;
  else if(t>=77)cells=mix(40,160,(t-77)/15);
  const chapter=chapters.filter(c=>t>=c.at).at(-1)??chapters[0];
  const next=chapters[chapters.indexOf(chapter)+1];
  const opacity=Math.min(ease((t-chapter.at)/.9),next?ease((next.at-t)/.9):1);
  // Fade the moving experiment out before resetting; fade the reset poses back in.
  const resetFade=t<34?1:t<36?1-ease((t-34)/2):t<38?ease((t-36)/2):1;
  return {cells:reduced?([1,2,10,40,160].find(n=>n>=cells)??160):cells,
    colour:ease((t-38)/6),resetFade:reduced?1:resetFade,chapter,opacity:reduced?1:opacity,
    running:t<34||t>=STORY_RUN,reset:t>=STORY_RESET,done:t>=STORY_DURATION};
}

/** A nested field: every zoom retains the same cells, with no resampling.
 * Cell (0,0) has the original single pendulum's initial angles.
 * @param {number} a @param {number} b */
export function storyEnsemble(a,b) {
  const spacing=360/160;
  const ensemble=createEnsemble(160,{center1:a/DEG+159*spacing/2,center2:b/DEG-159*spacing/2,span1:360,span2:360});
  return ensemble;
}
