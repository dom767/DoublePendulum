import { drawLegend } from '../render/angle-colour.js';

/** Default fixed-duration map step count. Physical duration T = N·Δt. */
export const DEFAULT_MAP_STEPS = 1000;
export const MIN_MAP_STEPS = 10;
export const MAX_MAP_STEPS = 100_000;
/** Supported map timestep denominators (Δt = 1 / denom s). */
export const DT_DENOMS = Object.freeze([480, 960, 1920]);
/** Perturbation (rad) used by the finite-time divergence metric (matches Single view's nearby trajectory). */
export const SENSITIVITY_EPSILON = 0.0001;
const MAX_ANGLE_SEP = Math.PI * Math.SQRT2;
const TAU = 2 * Math.PI;

/** @typedef {'final-angle'|'first-flip'|'sensitivity'} MapMetricId */

/** @type {Readonly<Record<MapMetricId, {id:MapMetricId,mode:number,label:string,shortLabel:string,legendKind:'2d'|'1d',title:string,description:string}>>} */
export const MAP_METRICS = Object.freeze({
  'final-angle': Object.freeze({
    id: 'final-angle',
    mode: 0,
    label: 'Final angles (θ₁, θ₂)',
    shortLabel: 'Final angles',
    legendKind: '2d',
    title: 'Angle colour key',
    description: 'Smooth periodic RGB map of final angles (θ₁, θ₂) after N steps. Colours encode angles, not stability.'
  }),
  'first-flip': Object.freeze({
    id: 'first-flip',
    mode: 1,
    label: 'First flip time',
    shortLabel: 'First flip',
    legendKind: '1d',
    title: 'First flip time key',
    description: 'First step at which either arm crosses the upward vertical (±180° mod 360°) within T. Dark slate shows pixels with no flip within T — candidate regular regions, not proof of long-term stability.'
  }),
  sensitivity: Object.freeze({
    id: 'sensitivity',
    mode: 2,
    label: 'Nearby divergence (δθ)',
    shortLabel: 'Divergence',
    legendKind: '1d',
    title: 'Nearby divergence key',
    description: 'Wrapped angular separation δθ(T) from a twin shifted by Δθ₁ = +0.0001 rad, log-scaled from 10⁻⁴ rad to π√2 rad. Measures finite-time sensitivity only.'
  })
});

/** @param {string} value @returns {value is MapMetricId} */
export function isValidMetric(value) {
  return Object.prototype.hasOwnProperty.call(MAP_METRICS, value);
}

/** @param {number} dtDenom */
export function isValidDtDenom(dtDenom) {
  return DT_DENOMS.includes(dtDenom);
}

/** @param {number} dtDenom */
export function formatDt(dtDenom) {
  return `1/${dtDenom} s`;
}

/** @param {number} steps @param {number} dtDenom */
export function physicalDuration(steps, dtDenom) {
  return steps / dtDenom;
}

/** Periodic winding index whose integer value changes whenever θ crosses an odd multiple of π (upward vertical).
 * @param {number} theta */
export function flipWinding(theta) {
  return Math.floor((theta + Math.PI) / TAU);
}

/** Shortest signed angular difference in (−π, π].
 * @param {number} a @param {number} b */
export function wrappedAngleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

/** Euclidean norm of wrapped angle differences between two pendulums.
 * @param {number} a1 @param {number} b1 @param {number} a2 @param {number} b2 */
export function wrappedSeparation(a1, b1, a2, b2) {
  return Math.hypot(wrappedAngleDiff(a1, a2), wrappedAngleDiff(b1, b2));
}

/** @param {number[]} a @param {number[]} b @param {number} t */
function mix3(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

const FLIP_NONE = [20, 24, 36];
const FLIP_STOPS = [[245, 184, 65], [214, 88, 92], [112, 74, 152], [56, 156, 154]];
const SENS_STOPS = [[18, 34, 48], [45, 134, 138], [242, 165, 68], [252, 238, 204]];

/** Matches the GPU colour shader's first-flip palette.
 * @param {number} flipStep 0 means no flip within totalSteps; 1..totalSteps is the first flip step
 * @param {number} totalSteps */
export function flipColourRGB(flipStep, totalSteps) {
  if (flipStep <= 0) return FLIP_NONE.slice();
  const u = Math.max(0, Math.min(1, (flipStep - 1) / Math.max(1, totalSteps - 1)));
  if (u < 0.33) return mix3(FLIP_STOPS[0], FLIP_STOPS[1], u / 0.33);
  if (u < 0.67) return mix3(FLIP_STOPS[1], FLIP_STOPS[2], (u - 0.33) / 0.34);
  return mix3(FLIP_STOPS[2], FLIP_STOPS[3], (u - 0.67) / 0.33);
}

/** Matches the GPU colour shader's nearby-divergence palette.
 * @param {number} sepRad wrapped angular separation in radians */
export function sensitivityColourRGB(sepRad) {
  const clamped = Math.max(SENSITIVITY_EPSILON, sepRad);
  const t = Math.max(0, Math.min(1, Math.log(clamped / SENSITIVITY_EPSILON) / Math.log(MAX_ANGLE_SEP / SENSITIVITY_EPSILON)));
  if (t < 0.35) return mix3(SENS_STOPS[0], SENS_STOPS[1], t / 0.35);
  if (t < 0.70) return mix3(SENS_STOPS[1], SENS_STOPS[2], (t - 0.35) / 0.35);
  return mix3(SENS_STOPS[2], SENS_STOPS[3], (t - 0.70) / 0.30);
}

/** Draw the 2D torus key (final-angle) or 1D labelled scale bar (first-flip / sensitivity).
 * @param {HTMLCanvasElement} canvas @param {MapMetricId} metricId @param {number} steps @param {number} dtDenom */
export function drawMetricLegend(canvas, metricId, steps = DEFAULT_MAP_STEPS, dtDenom = 480) {
  if (metricId === 'final-angle') {
    drawLegend(canvas);
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const style = getComputedStyle(canvas);
  const bg = style.getPropertyValue('--bg') || '#1c1812';
  const text = style.getPropertyValue('--text-muted') || '#b3a68e';
  const mono = style.getPropertyValue('--font-mono') || 'monospace';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const barX = 8, barW = w - 16, barY = 18, barH = 26;
  const T = physicalDuration(steps, dtDenom);
  for (let x = 0; x < barW; x++) {
    const u = x / Math.max(1, barW - 1);
    const rgb = metricId === 'first-flip'
      ? flipColourRGB(Math.max(1, Math.round(1 + u * (steps - 1))), steps)
      : sensitivityColourRGB(SENSITIVITY_EPSILON * Math.pow(MAX_ANGLE_SEP / SENSITIVITY_EPSILON, u));
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(barX + x, barY, 1, barH);
  }
  ctx.fillStyle = text;
  ctx.font = `10px ${mono}`;
  ctx.textAlign = 'left';
  ctx.fillText(metricId === 'first-flip' ? '0 s' : '10⁻⁴ rad', barX, barY + barH + 16);
  ctx.textAlign = 'right';
  ctx.fillText(metricId === 'first-flip' ? `${T.toFixed(2)} s` : 'π√2 rad', barX + barW, barY + barH + 16);
  if (metricId === 'first-flip') {
    const swY = barY + barH + 30;
    ctx.fillStyle = `rgb(${FLIP_NONE[0]},${FLIP_NONE[1]},${FLIP_NONE[2]})`;
    ctx.fillRect(barX, swY, 18, 14);
    ctx.strokeStyle = text;
    ctx.strokeRect(barX + 0.5, swY + 0.5, 17, 13);
    ctx.fillStyle = text;
    ctx.textAlign = 'left';
    ctx.fillText('No flip within T', barX + 24, swY + 11);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText('Low → high separation', barX, barY + barH + 38);
  }
}
