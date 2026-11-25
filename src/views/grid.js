import { writeAnglePixels } from '../render/angle-colour.js';

export class GridView {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.bounds={x:0,y:0,side:0};
    /** @type {HTMLCanvasElement|null} */ this.field=null;
    /** @type {CanvasRenderingContext2D|null} */ this.fieldCtx=null;
    /** @type {ImageData|null} */ this.image=null;
  }
  ensureField() {
    if(this.field&&this.fieldCtx)return true;
    this.field=document.createElement('canvas');this.fieldCtx=this.field.getContext('2d');
    return !!this.fieldCtx;
  }
  /** @param {number} x @param {number} y @param {number} size */
  hit(x,y,size) {
    const b=this.bounds;
    if(b.side<=0||x<b.x||y<b.y||x>=b.x+b.side||y>=b.y+b.side)return -1;
    return Math.floor((y-b.y)/b.side*size)*size+Math.floor((x-b.x)/b.side*size);
  }
  /** @param {Float32Array} states @param {ReturnType<typeof import('../physics/ensemble.js').createEnsemble>} ensemble
   * @param {{l1:number,l2:number}} p @param {number} selected @param {boolean} initialColours @param {boolean} panelOpen */
  draw(states,ensemble,p,selected,initialColours,panelOpen) {
    const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(!ctx||!this.ensureField())return;
    const field=/** @type {HTMLCanvasElement} */(this.field),fieldCtx=/** @type {CanvasRenderingContext2D} */(this.fieldCtx);
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const left=w>=768&&panelOpen?340:48, right=24, top=72, bottom=205;
    const side=Math.max(1,Math.min(w-left-right,h-top-bottom));
    const x=left+(w-left-right-side)/2,y=top+(h-top-bottom-side)/2;
    this.bounds={x,y,side};
    const n=ensemble.size,cell=side/n,colours=initialColours?ensemble.initial:states,count=n*n;
    if(field.width!==n||field.height!==n){field.width=n;field.height=n;this.image=null;}
    // One ImageData blit replaces n² fillStyle changes (the 160×160 bottleneck).
    if(!this.image||this.image.width!==n)this.image=fieldCtx.createImageData(n,n);
    writeAnglePixels(this.image.data,colours,count);
    fieldCtx.putImageData(this.image,0,0);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(field,x,y,side,side);ctx.imageSmoothingEnabled=true;
    // Rods stay Canvas2D; drop them once the field is dense enough that colour carries the story.
    if(cell>=8&&n<40) for(let row=0;row<n;row++)for(let col=0;col<n;col++) {
      const index=row*n+col, i=index*4, px=x+col*cell,py=y+row*cell;
      const scale=cell*.37/(p.l1+p.l2),cx=px+cell/2,cy=py+cell/2;
      const ax=cx+Math.sin(states[i])*p.l1*scale,ay=cy+Math.cos(states[i])*p.l1*scale;
      const bx=ax+Math.sin(states[i+1])*p.l2*scale,by=ay+Math.cos(states[i+1])*p.l2*scale;
      ctx.strokeStyle='#141414';ctx.lineWidth=Math.max(1,cell/45);ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx,by,Math.max(1.5,cell/30),0,Math.PI*2);ctx.fill();
    }
    if(selected>=0&&selected<count) {
      const row=Math.floor(selected/n),col=selected%n;
      ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x+col*cell+2,y+row*cell+2,cell-4,cell-4);
    }
    const style=getComputedStyle(c);
    ctx.fillStyle=style.getPropertyValue('--text-muted');ctx.font='12px '+style.getPropertyValue('--font-mono');ctx.textAlign='center';
    const d=ensemble.domain,format=v=>Number(v.toFixed(3))+'°';
    ctx.fillText('Initial primary angle θ₁ →',x+side/2,y+side+38);
    ctx.textAlign='left';ctx.fillText(format(d.center1-d.span1/2),x,y+side+18);
    ctx.textAlign='right';ctx.fillText(format(d.center1+d.span1/2),x+side,y+side+18);
    ctx.save();ctx.translate(x-32,y+side/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('Initial secondary angle θ₂ →',0,0);ctx.restore();
    ctx.textAlign='left';ctx.fillText(format(d.center2+d.span2/2),x,y-10);ctx.fillText(format(d.center2-d.span2/2),x,y+side+56);
    ctx.textAlign='center';ctx.fillText(`${n} × ${n} experiments · ${initialColours?'initial':'current'} angle colours`,x+side/2,top-30);
  }
}
