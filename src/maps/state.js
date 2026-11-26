import { DEFAULT_MAP_STEPS, MIN_MAP_STEPS, MAX_MAP_STEPS, isValidMetric, isValidDtDenom } from './metrics.js';
import { wrap180 } from '../physics/domain-view.js';

/** @typedef {{
 *   mode: 'single'|'grid'|'field',
 *   fieldRun: 'animate'|'map',
 *   metric: import('./metrics.js').MapMetricId,
 *   steps: number,
 *   dtDenom: number,
 *   domain: import('../physics/ensemble.js').AngleDomain,
 *   p: {l1:number,l2:number,m1:number,m2:number}
 * }} ShareState */

/** @param {number} n */
function cleanNum(n) {
  return String(Number(n.toFixed(6)));
}

/** Encode a view/map state into a URL hash starting with `#`.
 * @param {ShareState} state */
export function encodeShareHash(state) {
  const params = new URLSearchParams();
  params.set('v', '1');
  params.set('mode', state.mode);
  if (state.mode === 'field') {
    params.set('run', state.fieldRun);
    if (state.fieldRun === 'map') {
      params.set('metric', state.metric);
      params.set('n', String(DEFAULT_MAP_STEPS));
      params.set('dt', String(state.dtDenom));
    }
  }
  params.set('c1', cleanNum(wrap180(state.domain.center1)));
  params.set('c2', cleanNum(wrap180(state.domain.center2)));
  params.set('s1', cleanNum(state.domain.span1));
  params.set('s2', cleanNum(state.domain.span2));
  params.set('l1', cleanNum(state.p.l1));
  params.set('l2', cleanNum(state.p.l2));
  params.set('m1', cleanNum(state.p.m1));
  params.set('m2', cleanNum(state.p.m2));
  return `#${params.toString()}`;
}

/** @param {string|null} raw @param {number} min @param {number} max @param {number} fallback */
function readRange(raw, min, max, fallback) {
  if (raw === null || raw === '') return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < min || v > max) return NaN;
  return v;
}

/** Parse and validate a URL hash produced by `encodeShareHash`.
 * Returns `null` when no hash is present.
 * @param {string} hash
 * @returns {null | {ok:true,state:ShareState,notice?:string} | {ok:false,error:string}} */
export function decodeShareHash(hash) {
  const trimmed = (hash || '').replace(/^#/, '').trim();
  if (!trimmed) return null;
  const params = new URLSearchParams(trimmed);
  if (!params.has('mode') && !params.has('v')) return null;
  const modeRaw = params.get('mode') || 'field';
  if (modeRaw !== 'single' && modeRaw !== 'grid' && modeRaw !== 'field') {
    return { ok: false, error: 'Unsupported shared view mode.' };
  }
  const runRaw = params.get('run') || 'map';
  if (runRaw !== 'animate' && runRaw !== 'map') {
    return { ok: false, error: 'Unsupported shared field run mode.' };
  }
  const metricRaw = params.get('metric') || 'final-angle';
  if (!isValidMetric(metricRaw)) {
    return { ok: false, error: 'Unsupported shared map metric.' };
  }
  const stepsRaw = params.get('n');
  const steps = stepsRaw === null || stepsRaw === '' ? DEFAULT_MAP_STEPS : Number(stepsRaw);
  if (!Number.isInteger(steps) || steps < MIN_MAP_STEPS || steps > MAX_MAP_STEPS) {
    return { ok: false, error: `Shared step count must be an integer between ${MIN_MAP_STEPS} and ${MAX_MAP_STEPS}.` };
  }
  const dtRaw = params.get('dt');
  const dtDenom = dtRaw === null || dtRaw === '' ? 480 : Number(dtRaw);
  if (!isValidDtDenom(dtDenom)) {
    return { ok: false, error: 'Unsupported shared timestep Δt.' };
  }
  const center1 = readRange(params.get('c1'), -360, 360, 0);
  const center2 = readRange(params.get('c2'), -360, 360, 0);
  const span1 = readRange(params.get('s1'), 1e-4, 360, 360);
  const span2 = readRange(params.get('s2'), 1e-4, 360, 360);
  const l1 = readRange(params.get('l1'), 0.2, 3, 1);
  const l2 = readRange(params.get('l2'), 0, 3, 1);
  const m1 = readRange(params.get('m1'), 0.2, 5, 1);
  const m2 = readRange(params.get('m2'), 0.2, 5, 1);
  if (![center1, center2, span1, span2, l1, l2, m1, m2].every(Number.isFinite)) {
    return { ok: false, error: 'Shared link contains out-of-range domain or physical parameters.' };
  }
  return {
    ok: true,
    notice:steps!==DEFAULT_MAP_STEPS?'Legacy map normalized to 1,000 steps.':'',
    state: {
      mode: modeRaw,
      fieldRun: runRaw,
      metric: metricRaw,
      steps:DEFAULT_MAP_STEPS,
      dtDenom,
      domain: { center1: wrap180(center1), center2: wrap180(center2), span1, span2 },
      p: { l1, l2, m1, m2 }
    }
  };
}
