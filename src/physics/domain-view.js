/** Angle-domain pan/zoom. Spans stay in (0, 360]; centres wrap to (−180, 180].
 * Zooming resamples later; it never magnifies a finished bitmap. */

/** @param {number} degrees */
export function wrap180(degrees) {
  return ((degrees+180)%360+360)%360-180;
}

/** @param {import('./ensemble.js').AngleDomain} domain @param {number} factor
 * @param {number} u horizontal 0…1 (left→right) @param {number} v vertical 0…1 (top→bottom) */
export function zoomDomain(domain,factor,u,v) {
  if(!(factor>0)||![u,v].every(Number.isFinite)) throw new Error('Invalid zoom.');
  const focus1=domain.center1+(u-.5)*domain.span1;
  const focus2=domain.center2+(.5-v)*domain.span2;
  const span1=Math.min(360,Math.max(1e-4,domain.span1*factor));
  const span2=Math.min(360,Math.max(1e-4,domain.span2*factor));
  const t1=span1/domain.span1,t2=span2/domain.span2;
  return {center1:wrap180(focus1+(domain.center1-focus1)*t1),center2:wrap180(focus2+(domain.center2-focus2)*t2),span1,span2};
}

/** @param {import('./ensemble.js').AngleDomain} domain
 * @param {number} du fraction of span₁ (drag right → negative centre shift)
 * @param {number} dv fraction of span₂ (drag down → positive centre shift for upward θ₂) */
export function panDomain(domain,du,dv) {
  if(![du,dv].every(Number.isFinite)) throw new Error('Invalid pan.');
  return {...domain,center1:wrap180(domain.center1-du*domain.span1),center2:wrap180(domain.center2+dv*domain.span2)};
}
