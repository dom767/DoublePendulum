/** RK4 integration with first-flip step recording.
 * Records the 1-based step index at which either arm first crosses the upward vertical (±π mod 2π). */
export const flipShader = /* wgsl */ `
struct Params { lengths: vec4f, values: vec4f }
@group(0) @binding(0) var<storage, read_write> states: array<vec4f>;
@group(0) @binding(1) var<uniform> p: Params;
@group(0) @binding(2) var<storage, read_write> flipSteps: array<u32>;
const PI: f32 = 3.141592653589793;
const TAU: f32 = 6.283185307179586;
fn derivative(s: vec4f) -> vec4f {
 let l1=p.lengths.x; let l2=p.lengths.y; let m1=p.lengths.z; let m2=p.lengths.w; let g=9.81;
 if (l2 == 0.0) { let acc=-g/l1*sin(s.x); return vec4f(s.z,s.z,acc,acc); }
 let d=s.x-s.y; let c=cos(d); let sn=sin(d); let den=m1+m2*sn*sn;
 let a=(-g*(m1+m2)*sin(s.x)+m2*g*sin(s.y)*c-m2*sn*(l2*s.w*s.w+l1*s.z*s.z*c))/(l1*den);
 let b=sn*((m1+m2)*(l1*s.z*s.z+g*cos(s.x))+m2*l2*s.w*s.w*c)/(l2*den);
 return vec4f(s.z,s.w,a,b);
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
 if (id.x >= arrayLength(&states)) { return; }
 var s=states[id.x];
 var flip=flipSteps[id.x];
 let h=p.values.x;
 let steps=u32(p.values.y);
 let offset=u32(p.values.z);
 for(var i=0u; i<steps; i++) {
  let w1=floor((s.x+PI)/TAU); let w2=floor((s.y+PI)/TAU);
  let a=derivative(s); let b=derivative(s+h*0.5*a); let c=derivative(s+h*0.5*b); let d=derivative(s+h*c);
  s+=h/6.0*(a+2.0*b+2.0*c+d);
  if (flip == 0u) {
   let nw1=floor((s.x+PI)/TAU); let nw2=floor((s.y+PI)/TAU);
   if (nw1 != w1 || nw2 != w2) { flip = offset + i + 1u; }
  }
 }
 states[id.x]=s;
 flipSteps[id.x]=flip;
}`;
