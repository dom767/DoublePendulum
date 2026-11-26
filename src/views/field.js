/** Full-canvas pixel field and fixed-duration map renderer: one simulation colour per CSS pixel, edge to edge.
 * Supports progressive tiled blits over a distinctly marked coarse preview, plus drag-pan preview offset. */
export class FieldView {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');
    this.width=0;this.height=0;
    /** @type {HTMLCanvasElement|null} */ this.previewCanvas=null;
    /** @type {CanvasRenderingContext2D|null} */ this.previewCtx=null;
    this.previewWidth=0;this.previewHeight=0;
    /** @type {HTMLCanvasElement|null} */ this.field=null;
    /** @type {CanvasRenderingContext2D|null} */ this.fieldCtx=null;
    /** @type {ImageData|null} */ this.image=null;
    /** @type {Array<{rowStart:number,rowEnd:number}>} */ this.completedBands=[];
    this.hasFullFrame=false;
    this.hasPreview=false;
  }
  /** Clear buffered preview and full-resolution tile images when starting a fresh view. */
  clear() {
    this.completedBands=[];
    this.hasFullFrame=false;
    this.hasPreview=false;
  }
  /** Store a completed coarse preview bitmap (always distinctly marked as a preview when drawn).
   * @param {Uint8ClampedArray} colours @param {number} width @param {number} height */
  setPreview(colours,width,height) {
    if(width<1||height<1||colours.length<width*height*4) return;
    if(!this.previewCanvas){this.previewCanvas=document.createElement('canvas');this.previewCtx=this.previewCanvas.getContext('2d');}
    if(!this.previewCtx) return;
    if(this.previewCanvas.width!==width||this.previewCanvas.height!==height){this.previewCanvas.width=width;this.previewCanvas.height=height;}
    const img=new ImageData(width,height);
    img.data.set(colours.subarray(0,width*height*4));
    this.previewCtx.putImageData(img,0,0);
    this.previewWidth=width;this.previewHeight=height;this.hasPreview=true;
  }
  /** Write one completed full-resolution row tile into the offscreen buffer.
   * @param {Uint8ClampedArray} colours @param {number} width @param {number} height @param {number} rowStart @param {number} rowEnd */
  putTile(colours,width,height,rowStart,rowEnd) {
    const rows=rowEnd-rowStart;
    if(width<1||height<1||rows<1||colours.length<width*rows*4) return;
    if(!this.field){this.field=document.createElement('canvas');this.fieldCtx=this.field.getContext('2d');}
    if(!this.fieldCtx) return;
    if(this.field.width!==width||this.field.height!==height){
      this.field.width=width;this.field.height=height;
      this.completedBands=[];
    }
    const img=new ImageData(width,rows);
    img.data.set(colours.subarray(0,width*rows*4));
    this.fieldCtx.putImageData(img,0,rowStart);
    this.completedBands.push({rowStart,rowEnd});
    this.width=width;this.height=height;
    this.hasFullFrame=this.completedBands.reduce((sum,b)=>sum+(b.rowEnd-b.rowStart),0)>=height;
  }
  /** Map client coordinates to field pixel / normalised domain coords.
   * @param {number} clientX @param {number} clientY */
  hit(clientX,clientY) {
    const rect=this.canvas.getBoundingClientRect();
    const x=clientX-rect.left,y=clientY-rect.top;
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    if(w<=0||h<=0||x<0||y<0||x>=w||y>=h) return null;
    const col=Math.min(Math.max(0,this.width-1),Math.floor(x/w*this.width));
    const row=Math.min(Math.max(0,this.height-1),Math.floor(y/h*this.height));
    return {col,row,index:row*this.width+col,u:x/w,v:y/h};
  }
  /** @param {Uint8ClampedArray|null} colours packed RGBA for full-frame live blit (null when using tiled buffers)
   * @param {number} width @param {number} height
   * @param {import('../physics/ensemble.js').AngleDomain} domain
   * @param {string} caption
   * @param {{isPreview?:boolean,previewBadge?:string,detailLine?:string,transform?:{x:number,y:number,sx:number,sy:number},panDelta?:{dx:number,dy:number}|null,probe?:{u:number,v:number}|null}} [options] */
  draw(colours,width,height,domain,caption,options={}) {
    const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(!ctx||width<1||height<1) return;
    this.width=width;this.height=height;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const dx=options.panDelta?.dx??0, dy=options.panDelta?.dy??0;
    ctx.save();
    if(dx||dy) ctx.translate(dx,dy);
    if(options.transform){const t=options.transform;ctx.translate(t.x,t.y);ctx.scale(t.sx,t.sy);}
    if(colours&&colours.length>=width*height*4) {
      if(!this.image||this.image.width!==width||this.image.height!==height) this.image=new ImageData(width,height);
      this.image.data.set(colours.subarray(0,width*height*4));
      if(!this.field){this.field=document.createElement('canvas');this.fieldCtx=this.field.getContext('2d');}
      const field=this.field,fieldCtx=this.fieldCtx;
      if(fieldCtx) {
        if(field.width!==width||field.height!==height){field.width=width;field.height=height;}
        fieldCtx.putImageData(this.image,0,0);
        ctx.imageSmoothingEnabled=false;ctx.drawImage(field,0,0,w,h);ctx.imageSmoothingEnabled=true;
      }
    } else {
      if(this.hasPreview&&this.previewCanvas&&!this.hasFullFrame) {
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(this.previewCanvas,0,0,w,h);
        ctx.imageSmoothingEnabled=true;
      }
      if(this.field&&this.completedBands.length) {
        ctx.imageSmoothingEnabled=false;
        if(this.hasFullFrame) {
          ctx.drawImage(this.field,0,0,w,h);
        } else {
          for(const band of this.completedBands) {
            const sy=band.rowStart,sh=band.rowEnd-band.rowStart;
            ctx.drawImage(this.field,0,sy,width,sh,0,sy/height*h,w,sh/height*h);
          }
        }
        ctx.imageSmoothingEnabled=true;
      }
    }
    ctx.restore();
    const style=getComputedStyle(c);
    const amber=style.getPropertyValue('--accent-amber')||'#f2a544';
    const text=style.getPropertyValue('--text')||'#f6efe2';
    const muted=style.getPropertyValue('--text-muted')||'#b3a68e';
    const raised=style.getPropertyValue('--bg-raised')||'#262019';
    const bg=style.getPropertyValue('--bg')||'#1c1812';
    const displayFont=style.getPropertyValue('--font-display')||'sans-serif';
    const monoFont=style.getPropertyValue('--font-mono')||'monospace';
    if(options.probe&&!dx&&!dy) {
      const px=options.probe.u*w, py=options.probe.v*h;
      ctx.save();
      ctx.strokeStyle=bg;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=amber;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);
      ctx.moveTo(px-12,py);ctx.lineTo(px-4,py);ctx.moveTo(px+4,py);ctx.lineTo(px+12,py);
      ctx.moveTo(px,py-12);ctx.lineTo(px,py-4);ctx.moveTo(px,py+4);ctx.lineTo(px,py+12);
      ctx.stroke();ctx.restore();
    }
    if(options.isPreview) {
      ctx.save();
      ctx.strokeStyle=amber;ctx.lineWidth=2;ctx.setLineDash([8,6]);
      ctx.strokeRect(2,2,Math.max(0,w-4),Math.max(0,h-4));
      ctx.restore();
    }
    const cardW=Math.min(460,w-24), cardH=options.detailLine?82:64;
    ctx.fillStyle=raised;ctx.globalAlpha=.88;
    ctx.fillRect(12,12,cardW,cardH);ctx.globalAlpha=1;
    if(options.isPreview) {
      ctx.strokeStyle=amber;ctx.lineWidth=1;
      ctx.strokeRect(12.5,12.5,cardW-1,cardH-1);
    }
    let titleX=20;
    if(options.isPreview) {
      const badge=options.previewBadge||'PREVIEW';
      ctx.font='600 10px '+monoFont;
      const bw=Math.min(130,(ctx.measureText?.(badge)?.width??badge.length*7)+12);
      ctx.fillStyle=amber;ctx.fillRect(20,21,bw,17);
      ctx.fillStyle=bg;ctx.textAlign='left';ctx.fillText(badge,26,33);
      titleX=20+bw+8;
    }
    ctx.fillStyle=text;ctx.font='600 13px '+displayFont;
    ctx.textAlign='left';ctx.fillText(caption,titleX,34);
    ctx.fillStyle=muted;ctx.font='11px '+monoFont;
    const format=v=>`${Number(v.toFixed(4))}°`;
    ctx.fillText(`θ₁ ${format(domain.center1-domain.span1/2)} … ${format(domain.center1+domain.span1/2)}`,20,52);
    ctx.fillText(`θ₂ ${format(domain.center2-domain.span2/2)} … ${format(domain.center2+domain.span2/2)}`,20,66);
    if(options.detailLine) ctx.fillText(options.detailLine,20,82);
  }
}
