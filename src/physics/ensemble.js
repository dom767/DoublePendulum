export const DEG = Math.PI/180;
/** @typedef {{center1:number,center2:number,span1:number,span2:number}} AngleDomain */
export const presets = Object.freeze({
  full: {center1:0,center2:0,span1:360,span2:360},
  neighbourhood: {center1:110,center2:100,span1:20,span2:20},
  nearby: {center1:110,center2:100,span1:.02,span2:.02}
});
/** Cell-centre sampling. Row zero is the top: secondary angle increases upward.
 * @param {number} size @param {AngleDomain} domain */
export function createEnsemble(size,domain) {
  if(!Number.isInteger(size)||size<2||size>160) throw new Error('Grid size must be between 2 and 160.');
  const {center1,center2,span1,span2}=domain;
  if(![center1,center2,span1,span2].every(Number.isFinite)||span1<=0||span2<=0||span1>360||span2>360) throw new Error('Invalid angle domain.');
  const initial=new Float32Array(size*size*4);
  for(let row=0;row<size;row++) for(let col=0;col<size;col++) {
    const i=(row*size+col)*4;
    initial[i]=(center1+((col+.5)/size-.5)*span1)*DEG;
    initial[i+1]=(center2+(.5-(row+.5)/size)*span2)*DEG;
  }
  return {size,domain:{...domain},initial};
}
/** @param {ReturnType<typeof createEnsemble>} ensemble @param {number} index */
export function cellInitial(ensemble,index) {
  if(!Number.isInteger(index)||index<0||index>=ensemble.size**2) throw new Error('Invalid cell.');
  return ensemble.initial.slice(index*4,index*4+4);
}
