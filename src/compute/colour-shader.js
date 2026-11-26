/** Pack active map metric into little-endian RGBA8 for a single ImageData blit.
 * cp.x = mode (0 = final angles, 1 = first flip time, 2 = nearby divergence δθ), cp.y = target steps N. */
export const colourShader = /* wgsl */ `
@group(0) @binding(0) var<storage, read> states: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> colours: array<u32>;
@group(0) @binding(2) var<uniform> cp: vec4u;
@group(0) @binding(3) var<storage, read> flipSteps: array<u32>;
@group(0) @binding(4) var<storage, read> twinStates: array<vec4f>;
fn pack(rgb: vec3f) -> u32 {
  let r=u32(clamp(rgb.x,0.0,1.0)*255.0+0.5);
  let g=u32(clamp(rgb.y,0.0,1.0)*255.0+0.5);
  let b=u32(clamp(rgb.z,0.0,1.0)*255.0+0.5);
  return r | (g<<8u) | (b<<16u) | (255u<<24u);
}
fn flipColour(step: u32, total: u32) -> vec3f {
  if (step == 0u) { return vec3f(20.0, 24.0, 36.0) / 255.0; }
  let u=clamp(f32(step - 1u) / f32(max(total - 1u, 1u)), 0.0, 1.0);
  let c0=vec3f(245.0, 184.0, 65.0) / 255.0;
  let c1=vec3f(214.0, 88.0, 92.0) / 255.0;
  let c2=vec3f(112.0, 74.0, 152.0) / 255.0;
  let c3=vec3f(56.0, 156.0, 154.0) / 255.0;
  if (u < 0.33) { return mix(c0, c1, u / 0.33); }
  if (u < 0.67) { return mix(c1, c2, (u - 0.33) / 0.34); }
  return mix(c2, c3, (u - 0.67) / 0.33);
}
fn sensitivityColour(s: vec4f, t: vec4f) -> vec3f {
  let d1=atan2(sin(t.x - s.x), cos(t.x - s.x));
  let d2=atan2(sin(t.y - s.y), cos(t.y - s.y));
  let sep=sqrt(d1*d1 + d2*d2);
  let eps=0.0001;
  let maxSep=4.442882938158366;
  let norm=clamp(log(max(sep, eps) / eps) / log(maxSep / eps), 0.0, 1.0);
  let c0=vec3f(18.0, 34.0, 48.0) / 255.0;
  let c1=vec3f(45.0, 134.0, 138.0) / 255.0;
  let c2=vec3f(242.0, 165.0, 68.0) / 255.0;
  let c3=vec3f(252.0, 238.0, 204.0) / 255.0;
  if (norm < 0.35) { return mix(c0, c1, norm / 0.35); }
  if (norm < 0.70) { return mix(c1, c2, (norm - 0.35) / 0.35); }
  return mix(c2, c3, (norm - 0.70) / 0.30);
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&states)) { return; }
  let s=states[id.x];
  var rgb: vec3f;
  if (cp.x == 1u) {
    rgb=flipColour(flipSteps[id.x], cp.y);
  } else if (cp.x == 2u) {
    rgb=sensitivityColour(s, twinStates[id.x]);
  } else {
    let a=s.x; let b=s.y;
    rgb=vec3f(
      .5+.25*(cos(a)+cos(b)),
      .5+.25*(sin(a)+cos(b+1.0471975512)),
      .5+.25*(cos(a+1.0471975512)+sin(b))
    );
  }
  colours[id.x]=pack(rgb);
}`;
