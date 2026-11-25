export class SingleView {
  /** Shared with the story camera so its first frame has exactly the same geometry.
   * @param {number} w @param {number} h @param {{l1:number,l2:number}} p */
  static geometry(w,h,p) {
    return {cx:w/2,cy:h/2,scale:Math.min(w>=768?w*.28:w*.43,h*.27)/(p.l1+Math.max(p.l2,1))};
  }
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    if(!this.ctx) throw new Error('Canvas 2D is unavailable.');
    /** @type {number[][][]} */
    this.paths=[[],[]];
  }
  clear() { this.paths=[[],[]]; }
  /** @param {Float32Array} states @param {{l1:number,l2:number,m1:number,m2:number}} p @param {boolean} trails @param {boolean} compare @param {boolean} sample */
  draw(states,p,trails,compare,sample) {
    const c=this.canvas, ctx=this.ctx, w=c.clientWidth,h=c.clientHeight, dpr=Math.min(devicePixelRatio,2);
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)) {c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    const {cx,cy,scale}=SingleView.geometry(w,h,p);
    ctx.strokeStyle='#393329';ctx.lineWidth=1;
    for(let r=1;r<=3;r++){ctx.beginPath();ctx.arc(cx,cy,r*scale*.65,0,Math.PI*2);ctx.stroke();}
    for(let i=compare?1:0;i>=0;i--) {
      const a=states[i*4],b=states[i*4+1];
      const x=p.l1*Math.sin(a), y=p.l1*Math.cos(a), x2=x+p.l2*Math.sin(b),y2=y+p.l2*Math.cos(b);
      if(sample) {this.paths[i].push([x2,y2]);if(this.paths[i].length>1800)this.paths[i].shift();}
      const colour=i?'#6fb8ff':'#f2a544';
      if(trails){ctx.beginPath();this.paths[i].forEach(([px,py],j)=>{if(j===0)ctx.moveTo(cx+px*scale,cy+py*scale);else ctx.lineTo(cx+px*scale,cy+py*scale);});ctx.strokeStyle=colour;ctx.globalAlpha=.28;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;}
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+x*scale,cy+y*scale);ctx.lineTo(cx+x2*scale,cy+y2*scale);ctx.strokeStyle=colour;ctx.lineWidth=i?2:3;ctx.stroke();
      const bobs=p.l2===0?[[x,y,p.m1]]:[[x,y,p.m1],[x2,y2,p.m2]];
      for(const [px,py,m] of bobs){ctx.beginPath();ctx.arc(cx+px*scale,cy+py*scale,4+Math.sqrt(m)*3,0,Math.PI*2);ctx.fillStyle=colour;ctx.fill();}
    }
    ctx.beginPath();ctx.arc(cx,cy,4,0,Math.PI*2);ctx.fillStyle='#f6efe2';ctx.fill();
  }
}
