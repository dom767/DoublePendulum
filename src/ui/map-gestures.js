import { panDomain, zoomDomain } from '../physics/domain-view.js';

/** @param {HTMLCanvasElement} canvas @param {{enabled:()=>boolean,domain:()=>any,preview:(domain:any,transform:any)=>void,commit:(domain:any)=>void,tap:(x:number,y:number)=>void}} hooks */
export function setupMapGestures(canvas,hooks) {
  const pointers=new Map();
  let draft=null,moved=false,timer=null,transform={x:0,y:0,sx:1,sy:1};
  function begin(){if(!draft){draft={...hooks.domain()};transform={x:0,y:0,sx:1,sy:1};}}
  function show(old,next,anchorX,anchorY,dx=0,dy=0){
    const sx=old.span1/next.span1,sy=old.span2/next.span2;
    transform={x:anchorX+(transform.x-anchorX)*sx+dx,y:anchorY+(transform.y-anchorY)*sy+dy,sx:transform.sx*sx,sy:transform.sy*sy};
    draft=next;hooks.preview(draft,transform);
  }
  function finish(){if(timer!==null)clearTimeout(timer);timer=null;const d=draft;draft=null;if(d&&moved)hooks.commit(d);moved=false;}
  canvas.addEventListener('pointerdown',e=>{
    if(!hooks.enabled()||e.button!==0)return;
    if(timer!==null){clearTimeout(timer);timer=null;}
    begin();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>1)moved=true;
    canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-panning');
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId)||!draft)return;
    const before=[...pointers.values()],old=pointers.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;
    if(!moved&&Math.hypot(dx,dy)<4)return;
    moved=true;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const after=[...pointers.values()],rect=canvas.getBoundingClientRect();
    if(before.length===2){
      const mid=a=>({x:(a[0].x+a[1].x)/2-rect.left,y:(a[0].y+a[1].y)/2-rect.top});
      const distance=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      const a=mid(before),b=mid(after),factor=Math.max(1,distance(before))/Math.max(1,distance(after));
      const zoomed=zoomDomain(draft,factor,a.x/rect.width,a.y/rect.height);
      show(draft,panDomain(zoomed,(b.x-a.x)/rect.width,(b.y-a.y)/rect.height),a.x,a.y,b.x-a.x,b.y-a.y);
    } else if(before.length===1)show(draft,panDomain(draft,dx/rect.width,dy/rect.height),0,0,dx,dy);
  });
  function end(e){
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);
    if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(pointers.size)return;
    const tap=!moved&&e.type==='pointerup';finish();canvas.classList.remove('is-panning');
    if(tap)hooks.tap(e.clientX,e.clientY);
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,end);
  canvas.addEventListener('wheel',e=>{
    if(!hooks.enabled()||pointers.size)return;e.preventDefault();begin();moved=true;
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    show(draft,zoomDomain(draft,e.deltaY>0?1.25:.8,x/rect.width,y/rect.height),x,y);
    if(timer!==null)clearTimeout(timer);timer=setTimeout(finish,150);
  },{passive:false});
  return {cancel(){if(timer!==null)clearTimeout(timer);timer=null;draft=null;moved=false;
    const ids=[...pointers.keys()];pointers.clear();for(const id of ids)if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
    canvas.classList.remove('is-panning');}};
}
