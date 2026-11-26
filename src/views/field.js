/** Full-canvas pixel field: one simulation colour per CSS pixel, edge to edge. */
export class FieldView {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');
    this.width=0;this.height=0;
  }
  /** Map client coordinates to field pixel / normalised domain coords.
   * @param {number} clientX @param {number} clientY */
  hit(clientX,clientY) {
    const rect=this.canvas.getBoundingClientRect();
    const x=clientX-rect.left,y=clientY-rect.top;
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    if(w<=0||h<=0||x<0||y<0||x>=w||y>=h) return null;
    const col=Math.min(this.width-1,Math.floor(x/w*this.width));
    const row=Math.min(this.height-1,Math.floor(y/h*this.height));
    return {col,row,index:row*this.width+col,u:x/w,v:y/h};
  }
  /** @param {Uint8ClampedArray|null} colours packed RGBA for width×height
   * @param {number} width @param {number} height
   * @param {import('../physics/ensemble.js').AngleDomain} domain
   * @param {string} caption */
  draw(colours,width,height,domain,caption) {
    const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(!ctx||width<1||height<1) return;
    this.width=width;this.height=height;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    if(colours&&colours.length>=width*height*4) {
      if(!this.image||this.image.width!==width||this.image.height!==height) this.image=new ImageData(width,height);
      this.image.data.set(colours.subarray(0,width*height*4));
      if(!this.field){this.field=document.createElement('canvas');this.fieldCtx=this.field.getContext('2d');}
      const field=this.field,fieldCtx=this.fieldCtx;
      if(!fieldCtx) return;
      if(field.width!==width||field.height!==height){field.width=width;field.height=height;}
      fieldCtx.putImageData(this.image,0,0);
      ctx.imageSmoothingEnabled=false;ctx.drawImage(field,0,0,w,h);ctx.imageSmoothingEnabled=true;
    }
    const style=getComputedStyle(c);
    ctx.fillStyle=style.getPropertyValue('--bg-raised');ctx.globalAlpha=.82;
    ctx.fillRect(12,12,Math.min(420,w-24),64);ctx.globalAlpha=1;
    ctx.fillStyle=style.getPropertyValue('--text');ctx.font='600 13px '+style.getPropertyValue('--font-display');
    ctx.textAlign='left';ctx.fillText(caption,20,34);
    ctx.fillStyle=style.getPropertyValue('--text-muted');ctx.font='11px '+style.getPropertyValue('--font-mono');
    const format=v=>`${Number(v.toFixed(4))}°`;
    ctx.fillText(`θ₁ ${format(domain.center1-domain.span1/2)} … ${format(domain.center1+domain.span1/2)}`,20,52);
    ctx.fillText(`θ₂ ${format(domain.center2-domain.span2/2)} … ${format(domain.center2+domain.span2/2)}`,20,66);
  }
}
