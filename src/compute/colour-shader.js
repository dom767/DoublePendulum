/** Pack current angles into little-endian RGBA8 for a single ImageData blit. */
export const colourShader = /* wgsl */ `
@group(0) @binding(0) var<storage, read> states: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> colours: array<u32>;
fn pack(rgb: vec3f) -> u32 {
  let r=u32(clamp(rgb.x,0.0,1.0)*255.0+0.5);
  let g=u32(clamp(rgb.y,0.0,1.0)*255.0+0.5);
  let b=u32(clamp(rgb.z,0.0,1.0)*255.0+0.5);
  return r | (g<<8u) | (b<<16u) | (255u<<24u);
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&states)) { return; }
  let s=states[id.x];
  let a=s.x; let b=s.y;
  let rgb=vec3f(
    .5+.25*(cos(a)+cos(b)),
    .5+.25*(sin(a)+cos(b+1.0471975512)),
    .5+.25*(cos(a+1.0471975512)+sin(b))
  );
  colours[id.x]=pack(rgb);
}`;
