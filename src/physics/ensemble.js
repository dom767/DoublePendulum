export const DEG = Math.PI/180;
/** Default fixed-duration map length (milestone 3/4). Physical T = N·Δt. */
export const MAP_STEPS = 1000;
/** @typedef {{center1:number,center2:number,span1:number,span2:number}} AngleDomain */
export const presets = Object.freeze({
  full: {center1:0,center2:0,span1:360,span2:360},
  neighbourhood: {center1:110,center2:100,span1:20,span2:20},
  nearby: {center1:110,center2:100,span1:.02,span2:.02}
});
/** @param {AngleDomain} domain */
function assertDomain(domain) {
  const {center1,center2,span1,span2}=domain;
  if(![center1,center2,span1,span2].every(Number.isFinite)||span1<=0||span2<=0||span1>360||span2>360) throw new Error('Invalid angle domain.');
}
/** Cell-centre samples into a width×height field. Row zero is the top: secondary angle increases upward.
 * @param {number} width @param {number} height @param {AngleDomain} domain */
export function sampleField(width,height,domain) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1) throw new Error('Invalid field size.');
  assertDomain(domain);
  const {center1,center2,span1,span2}=domain;
  const initial=new Float32Array(width*height*4);
  for(let row=0;row<height;row++) for(let col=0;col<width;col++) {
    const i=(row*width+col)*4;
    initial[i]=(center1+((col+.5)/width-.5)*span1)*DEG;
    initial[i+1]=(center2+(.5-(row+.5)/height)*span2)*DEG;
  }
  return initial;
}
/** Visible pendulum grid (square). @param {number} size @param {AngleDomain} domain */
export function createEnsemble(size,domain) {
  if(!Number.isInteger(size)||size<2||size>160) throw new Error('Grid size must be between 2 and 160.');
  return {size,width:size,height:size,domain:{...domain},initial:sampleField(size,size,domain)};
}
/** One simulation per canvas CSS pixel; full-bleed rectangular field.
 * @param {number} width @param {number} height @param {AngleDomain} domain */
export function createPixelField(width,height,domain) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2) throw new Error('Pixel field must be at least 2×2.');
  if(width*height>8_294_400) throw new Error('Pixel field exceeds the 8.3M simulation cap.');
  return {size:Math.max(width,height),width,height,domain:{...domain},initial:sampleField(width,height,domain)};
}
/** @param {{width:number,height:number,initial:Float32Array}} field @param {number} index */
export function cellInitial(field,index) {
  if(!Number.isInteger(index)||index<0||index>=field.width*field.height) throw new Error('Invalid cell.');
  return field.initial.slice(index*4,index*4+4);
}
