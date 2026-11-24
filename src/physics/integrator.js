import { derivative } from './pendulum.js';
/** @param {number[]} s @param {import('./pendulum.js').defaults} p @param {number} dt */
export function step(s, p, dt) {
  const add = (k, scale) => s.map((x,i) => x+k[i]*scale);
  const a=derivative(s,p), b=derivative(add(a,dt/2),p), c=derivative(add(b,dt/2),p), d=derivative(add(c,dt),p);
  return s.map((x,i)=>x+dt/6*(a[i]+2*b[i]+2*c[i]+d[i]));
}
