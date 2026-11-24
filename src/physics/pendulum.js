/** Angles in radians from downward vertical; velocities in rad/s. */
export const DT = 1 / 480;
/** Opening scene duration in simulation seconds. */
export const GROW_DURATION = 8;
/** Numerical floor (m) while the second arm is growing; exact zero uses the simple-pendulum branch. */
export const GROW_FLOOR = 0.05;
/** @type {{l1:number,l2:number,m1:number,m2:number,g:number}} */
export const defaults = Object.freeze({ l1: 1, l2: 1, m1: 1, m2: 1, g: 9.81 });

/** Instantaneous second-arm length for the growing opening at simulation time `time`.
 * @param {number} time @param {number} target @param {number} [duration] */
export function growthLength(time, target, duration = GROW_DURATION) {
  if (time === 0 || target === 0) return 0;
  return Math.max(GROW_FLOOR, target * Math.min(1, time / duration));
}

/** Independent double-precision reference, used by tests only.
 * @param {number[]} s @param {typeof defaults} p */
export function derivative(s, p) {
  const [a, b, u, v] = s;
  if (p.l2 === 0) return [u, u, -p.g / p.l1 * Math.sin(a), -p.g / p.l1 * Math.sin(a)];
  const d = a - b, c = Math.cos(d), sn = Math.sin(d);
  const den = p.m1 + p.m2 * sn * sn;
  return [u, v,
    (-p.g * (p.m1 + p.m2) * Math.sin(a) + p.m2 * p.g * Math.sin(b) * c - p.m2 * sn * (p.l2 * v * v + p.l1 * u * u * c)) / (p.l1 * den),
    (sn * ((p.m1 + p.m2) * (p.l1 * u * u + p.g * Math.cos(a)) + p.m2 * p.l2 * v * v * c)) / (p.l2 * den)];
}

/** @param {number[]} s @param {typeof defaults} p */
export function energy(s, p) {
  const [a,b,u,v] = s;
  return 0.5 * (p.m1+p.m2)*p.l1**2*u*u + 0.5*p.m2*p.l2**2*v*v
    + p.m2*p.l1*p.l2*u*v*Math.cos(a-b)
    - (p.m1+p.m2)*p.g*p.l1*Math.cos(a)-p.m2*p.g*p.l2*Math.cos(b);
}
