export const shader = /* wgsl */ `
struct Params { lengths: vec4f, values: vec4f }
@group(0) @binding(0) var<storage, read_write> states: array<vec4f>;
@group(0) @binding(1) var<uniform> p: Params;
fn derivative(s: vec4f) -> vec4f {
 let l1=p.lengths.x; let l2=p.lengths.y; let m1=p.lengths.z; let m2=p.lengths.w; let g=9.81;
 if (l2 == 0.0) { let acc=-g/l1*sin(s.x); return vec4f(s.z,s.z,acc,acc); }
 let d=s.x-s.y; let c=cos(d); let sn=sin(d); let den=m1+m2*sn*sn;
 let a=(-g*(m1+m2)*sin(s.x)+m2*g*sin(s.y)*c-m2*sn*(l2*s.w*s.w+l1*s.z*s.z*c))/(l1*den);
 let b=sn*((m1+m2)*(l1*s.z*s.z+g*cos(s.x))+m2*l2*s.w*s.w*c)/(l2*den);
 return vec4f(s.z,s.w,a,b);
}
@compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3u) {
 var s=states[id.x]; let h=p.values.x;
 for(var i=0u; i<u32(p.values.y); i++) {
  let a=derivative(s); let b=derivative(s+h*0.5*a); let c=derivative(s+h*0.5*b); let d=derivative(s+h*c);
  s+=h/6.0*(a+2.0*b+2.0*c+d);
 }
 states[id.x]=s;
}`;
