/** Smooth periodic mapping on the two-angle torus; no hue seam at ±π.
 * RGB is not a unique encoding of angles, nor a measure of stability.
 * @param {number} a @param {number} b @returns {number[]} */
export function angleRGB(a,b) {
  return [
    .5+.25*(Math.cos(a)+Math.cos(b)),
    .5+.25*(Math.sin(a)+Math.cos(b+Math.PI/3)),
    .5+.25*(Math.cos(a+Math.PI/3)+Math.sin(b))
  ].map(x=>Math.round(255*x));
}
/** @param {number} a @param {number} b */
export function angleColour(a,b) { return `rgb(${angleRGB(a,b).join(',')})`; }
/** Full periodic domain, primary angle left to right; secondary bottom to top.
 * @param {HTMLCanvasElement} canvas */
export function drawLegend(canvas) {
  const ctx=canvas.getContext('2d'); if(!ctx) return;
  const w=canvas.width,h=canvas.height;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    ctx.fillStyle=angleColour((x/(w-1)*2-1)*Math.PI,(1-y/(h-1)*2)*Math.PI);
    ctx.fillRect(x,y,1,1);
  }
}
