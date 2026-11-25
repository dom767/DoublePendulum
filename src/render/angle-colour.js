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
/** Pack angle-pair colours into an RGBA buffer for one putImageData / drawImage blit.
 * Avoids tens of thousands of Canvas fillStyle changes on dense grids.
 * @param {Uint8ClampedArray} pixels @param {Float32Array} angles stride-4 θ₁,θ₂,…
 * @param {number} count @param {(index:number)=>number} [alphaAt] 0–1 per cell */
export function writeAnglePixels(pixels,angles,count,alphaAt=()=>1) {
  if(pixels.length<count*4||angles.length<count*4) throw new Error('Angle pixel buffer too small.');
  for(let i=0;i<count;i++) {
    const s=i*4,[r,g,b]=angleRGB(angles[s],angles[s+1]),a=Math.round(255*Math.max(0,Math.min(1,alphaAt(i))));
    pixels[s]=r;pixels[s+1]=g;pixels[s+2]=b;pixels[s+3]=a;
  }
  return pixels;
}
/** Full periodic domain, primary angle left to right; secondary bottom to top.
 * @param {HTMLCanvasElement} canvas */
export function drawLegend(canvas) {
  const ctx=canvas.getContext('2d'); if(!ctx) return;
  const w=canvas.width,h=canvas.height;
  if(typeof ImageData==='function'&&ctx.createImageData) {
    const image=ctx.createImageData(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
      const [r,g,b]=angleRGB((x/(w-1)*2-1)*Math.PI,(1-y/(h-1)*2)*Math.PI),i=(y*w+x)*4;
      image.data[i]=r;image.data[i+1]=g;image.data[i+2]=b;image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    return;
  }
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    ctx.fillStyle=angleColour((x/(w-1)*2-1)*Math.PI,(1-y/(h-1)*2)*Math.PI);
    ctx.fillRect(x,y,1,1);
  }
}
