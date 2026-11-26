import { SingleView } from '../views/single.js';

/** @param {number} x @param {number} y @param {number} ox @param {number} oy */
export function draggedAngle(x,y,ox,oy) { return Math.atan2(x-ox,y-oy); }

/** @param {HTMLCanvasElement} canvas @param {{enabled:()=>boolean,pose:()=>any,edit:(a:number,b:number)=>void}} hooks */
export function setupSingleDrag(canvas,hooks) {
  let pointer=null,node=0;
  function geometry() {
    const {states,p}=hooks.pose(),rect=canvas.getBoundingClientRect();
    const {cx,cy,scale}=SingleView.geometry(canvas.clientWidth,canvas.clientHeight,p);
    const x=rect.left+cx,y=rect.top+cy;
    const x1=x+p.l1*Math.sin(states[0])*scale,y1=y+p.l1*Math.cos(states[0])*scale;
    return {states,p,x,y,x1,y1,x2:x1+p.l2*Math.sin(states[1])*scale,y2:y1+p.l2*Math.cos(states[1])*scale};
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!hooks.enabled()||e.button!==0||pointer!==null)return;
    const g=geometry();
    node=g.p.l2>0&&Math.hypot(e.clientX-g.x2,e.clientY-g.y2)<24?2:Math.hypot(e.clientX-g.x1,e.clientY-g.y1)<24?1:0;
    if(!node)return;
    pointer=e.pointerId;canvas.setPointerCapture(pointer);hooks.edit(g.states[0],g.states[1]);
  });
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointer)return;
    const g=geometry();
    hooks.edit(node===1?draggedAngle(e.clientX,e.clientY,g.x,g.y):g.states[0],
      node===2?draggedAngle(e.clientX,e.clientY,g.x1,g.y1):g.states[1]);
  });
  function cancel(){const id=pointer;pointer=null;if(id!==null&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(/** @type {PointerEvent} */(e).pointerId===pointer)cancel();});
  return {cancel};
}
