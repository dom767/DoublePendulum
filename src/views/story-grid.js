import { SingleView } from './single.js';
import { ease } from '../story/grid-story.js';
import { angleColour, writeAnglePixels } from '../render/angle-colour.js';

export class StoryGridView {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');
    /** @type {HTMLCanvasElement|null} */ this.field=null;
    /** @type {CanvasRenderingContext2D|null} */ this.fieldCtx=null;
    /** @type {ImageData|null} */ this.image=null;
  }
  ensureField() {
    if(this.field&&this.fieldCtx)return true;
    this.field=document.createElement('canvas');this.fieldCtx=this.field.getContext('2d');
    return !!this.fieldCtx;
  }
  /** @param {Float32Array} states @param {{l1:number,l2:number,m1:number,m2:number}} p
   * @param {ReturnType<typeof import('../story/grid-story.js').storyFrame>} scene
   * @param {number} seconds @param {number[][]} trail */
  draw(states,p,scene,seconds,trail=[]) {
    const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(!ctx)return;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const side=Math.max(1,Math.min(w-48,h-310)),x=(w-side)/2,y=145+(h-310-side)/2;
    const original=SingleView.geometry(w,h,p),cell0=original.scale*(p.l1+p.l2)/.37;
    const u=Math.min(1,Math.max(0,scene.cells-1));
    const cell=scene.cells<2?Math.exp(Math.log(cell0)*(1-u)+Math.log(side/2)*u):side/scene.cells;
    const ox=scene.cells<2?(original.cx-cell0/2)*(1-u)+x*u:x;
    const oy=scene.cells<2?(original.cy-cell0/2)*(1-u)+y*u:y;
    const scale=cell*.37/(p.l1+p.l2),reveal=ease((seconds-5)/5),rodAlpha=1-ease((9-cell)/7);
    const clipTop=120*u,clipBottom=h-145*u;
    ctx.save();ctx.beginPath();ctx.rect(0,clipTop,w,clipBottom-clipTop);ctx.clip();
    // Dense colour fields use one scaled blit; sparse zooms keep per-cell fills with culling.
    if(scene.colour>0&&cell<=5&&this.ensureField()) {
      const field=/** @type {HTMLCanvasElement} */(this.field),fieldCtx=/** @type {CanvasRenderingContext2D} */(this.fieldCtx);
      if(field.width!==160||field.height!==160){field.width=160;field.height=160;this.image=null;}
      if(!this.image)this.image=fieldCtx.createImageData(160,160);
      writeAnglePixels(this.image.data,states,25600,i=>{
        const row=Math.floor(i/160),col=i%160;
        return (row===0&&col===0?1:reveal)*scene.resetFade*scene.colour;
      });
      fieldCtx.putImageData(this.image,0,0);
      ctx.imageSmoothingEnabled=false;ctx.globalAlpha=1;ctx.drawImage(field,ox,oy,cell*160,cell*160);ctx.imageSmoothingEnabled=true;
    }
    const minCol=Math.max(0,Math.floor(-ox/cell)),maxCol=Math.min(160,Math.ceil((w-ox)/cell));
    const minRow=Math.max(0,Math.floor((clipTop-oy)/cell)),maxRow=Math.min(160,Math.ceil((clipBottom-oy)/cell));
    for(let row=minRow;row<maxRow;row++)for(let col=minCol;col<maxCol;col++) {
      const i=(row*160+col)*4,px=ox+col*cell,py=oy+row*cell,cx=px+cell/2,cy=py+cell/2;
      const alpha=(row===0&&col===0?1:reveal)*scene.resetFade;
      if(scene.colour>0&&cell>5){ctx.globalAlpha=alpha*scene.colour;ctx.fillStyle=angleColour(states[i],states[i+1]);ctx.fillRect(px,py,cell+.3,cell+.3);}
      if(cell>5){ctx.globalAlpha=alpha*reveal*(1-scene.colour*.75)*ease((cell-4)/8);ctx.strokeStyle='#524634';ctx.lineWidth=1;ctx.strokeRect(px,py,cell,cell);}
      // Below ~4px the arms are invisible; skip the stroke storm that made 160×160 crawl.
      if(rodAlpha<=.02||cell<4)continue;
      const ax=cx+Math.sin(states[i])*p.l1*scale,ay=cy+Math.cos(states[i])*p.l1*scale;
      const bx=ax+Math.sin(states[i+1])*p.l2*scale,by=ay+Math.cos(states[i+1])*p.l2*scale;
      if(row===0&&col===0&&seconds<13) {
        ctx.globalAlpha=alpha*(1-u)*.28;ctx.strokeStyle='#f2a544';ctx.lineWidth=1.5;ctx.beginPath();
        trail.forEach(([tx,ty],j)=>{if(j===0)ctx.moveTo(cx+tx*scale,cy+ty*scale);else ctx.lineTo(cx+tx*scale,cy+ty*scale);});ctx.stroke();
        ctx.globalAlpha=alpha*(1-u);ctx.strokeStyle='#393329';ctx.lineWidth=1;
        for(let r=1;r<=3;r++){ctx.beginPath();ctx.arc(cx,cy,r*scale*.65,0,Math.PI*2);ctx.stroke();}
      }
      ctx.globalAlpha=alpha*rodAlpha;ctx.strokeStyle=scene.colour>.5?'#1c1812':'#f2a544';ctx.lineWidth=Math.max(.7,Math.min(3,cell/65));
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
      // Fade smoothly from the original amber rods to dark silhouettes over colour.
      if(scene.colour>0&&scene.colour<=.5){ctx.globalAlpha=alpha*rodAlpha*scene.colour*2;ctx.strokeStyle='#1c1812';ctx.stroke();}
      ctx.globalAlpha=alpha*rodAlpha;ctx.fillStyle='#f2a544';
      for(const [px,py,m] of [[ax,ay,p.m1],[bx,by,p.m2]]){ctx.beginPath();ctx.arc(px,py,Math.min(4+Math.sqrt(m)*3,Math.max(1,cell/24)),0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#f6efe2';ctx.beginPath();ctx.arc(cx,cy,Math.min(4,Math.max(.7,cell/60)),0,Math.PI*2);ctx.fill();
    }
    ctx.restore();ctx.globalAlpha=1;
  }
}
