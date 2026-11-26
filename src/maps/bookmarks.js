import { DEFAULT_MAP_STEPS, MIN_MAP_STEPS, MAX_MAP_STEPS, isValidMetric, isValidDtDenom } from './metrics.js';
import { wrap180 } from '../physics/domain-view.js';

export const BOOKMARK_STORAGE_KEY = 'double-pendulum:bookmarks:v1';

/** @typedef {{
 *   id: string,
 *   name: string,
 *   note?: string,
 *   builtin: boolean,
 *   domain: import('../physics/ensemble.js').AngleDomain,
 *   steps: number,
 *   dtDenom: number,
 *   metric: import('./metrics.js').MapMetricId,
 *   p: {l1:number,l2:number,m1:number,m2:number}
 * }} MapBookmark */

const EQUAL_P = Object.freeze({ l1: 1, l2: 1, m1: 1, m2: 1 });

/** Curated regions highlighting finite-time patterns and candidate regular regions without overclaiming long-term stability.
 * @type {readonly MapBookmark[]} */
export const BUILTIN_BOOKMARKS = Object.freeze([
  Object.freeze({
    id: 'builtin:full',
    name: 'Full angle domain · final angles',
    note: 'Full −180°…+180° torus after N = 1000 steps at Δt = 1/480 s.',
    builtin: true,
    domain: { center1: 0, center2: 0, span1: 360, span2: 360 },
    steps: DEFAULT_MAP_STEPS,
    dtDenom: 480,
    metric: 'final-angle',
    p: EQUAL_P
  }),
  Object.freeze({
    id: 'builtin:low-energy',
    name: 'Low-energy basin (candidate regular)',
    note: 'Near downward equilibrium where energy stays below the flip threshold; check at smaller Δt at the fixed 1,000 steps.',
    builtin: true,
    domain: { center1: 0, center2: 0, span1: 120, span2: 120 },
    steps: DEFAULT_MAP_STEPS,
    dtDenom: 480,
    metric: 'first-flip',
    p: EQUAL_P
  }),
  Object.freeze({
    id: 'builtin:flip-boundary',
    name: 'Flip boundary · 80°',
    note: 'Finite-time transition between non-flipping candidate regions and early-flipping bands.',
    builtin: true,
    domain: { center1: 110, center2: 0, span1: 80, span2: 80 },
    steps: DEFAULT_MAP_STEPS,
    dtDenom: 480,
    metric: 'first-flip',
    p: EQUAL_P
  }),
  Object.freeze({
    id: 'builtin:filaments',
    name: 'High-angle filaments · 20°',
    note: 'Fine-scale finite-time angle patterns around (110°, 100°).',
    builtin: true,
    domain: { center1: 110, center2: 100, span1: 20, span2: 20 },
    steps: DEFAULT_MAP_STEPS,
    dtDenom: 480,
    metric: 'final-angle',
    p: EQUAL_P
  }),
  Object.freeze({
    id: 'builtin:divergence',
    name: 'Fine-scale divergence · 2°',
    note: 'Finite-time separation δθ(T) from a +0.0001 rad shift around (110°, 100°).',
    builtin: true,
    domain: { center1: 110, center2: 100, span1: 2, span2: 2 },
    steps: DEFAULT_MAP_STEPS,
    dtDenom: 480,
    metric: 'sensitivity',
    p: EQUAL_P
  }),
  Object.freeze({
    id: 'builtin:refinement',
    name: 'Refinement check at half timestep',
    note: 'Low-energy candidate region at 1/960 s for 1000 steps (T = 1.042 s).',
    builtin: true,
    domain: { center1: 0, center2: 0, span1: 120, span2: 120 },
    steps: DEFAULT_MAP_STEPS,
    dtDenom: 960,
    metric: 'first-flip',
    p: EQUAL_P
  })
]);

/** @param {any} raw @returns {MapBookmark|null} */
function normaliseSaved(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !raw.id.startsWith('user:')) return null;
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (!isValidMetric(raw.metric) || !isValidDtDenom(raw.dtDenom)) return null;
  const steps = Number(raw.steps);
  if (!Number.isInteger(steps) || steps < MIN_MAP_STEPS || steps > MAX_MAP_STEPS) return null;
  const d = raw.domain, p = raw.p;
  if (!d || !p) return null;
  const nums = [d.center1, d.center2, d.span1, d.span2, p.l1, p.l2, p.m1, p.m2];
  if (!nums.every(v => typeof v === 'number' && Number.isFinite(v))) return null;
  if (d.span1 < 1e-4 || d.span1 > 360 || d.span2 < 1e-4 || d.span2 > 360) return null;
  if (p.l1 < 0.2 || p.l1 > 3 || p.l2 < 0 || p.l2 > 3 || p.m1 < 0.2 || p.m1 > 5 || p.m2 < 0.2 || p.m2 > 5) return null;
  return {
    id: raw.id,
    name: raw.name.trim().slice(0, 60),
    builtin: false,
    domain: { center1: wrap180(d.center1), center2: wrap180(d.center2), span1: d.span1, span2: d.span2 },
    steps: DEFAULT_MAP_STEPS,
    note:steps!==DEFAULT_MAP_STEPS?'Legacy bookmark normalized to 1,000 steps.':raw.note,
    dtDenom: raw.dtDenom,
    metric: raw.metric,
    p: { l1: p.l1, l2: p.l2, m1: p.m1, m2: p.m2 }
  };
}

/** Browser-scoped bookmark store (persisted to localStorage when available; degrades cleanly in memory). */
export class BookmarkStore {
  /** @param {{getItem:(k:string)=>string|null,setItem:(k:string,v:string)=>void}|null} [storage] */
  constructor(storage) {
    this.storage = storage === undefined ? BookmarkStore.defaultStorage() : storage;
    /** @type {MapBookmark[]} */
    this.saved = [];
    this.load();
  }
  static defaultStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  }
  load() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(BOOKMARK_STORAGE_KEY);
      if (!raw) { this.saved = []; return; }
      const parsed = JSON.parse(raw);
      this.saved = Array.isArray(parsed) ? /** @type {MapBookmark[]} */(parsed.map(normaliseSaved).filter(Boolean)) : [];
    } catch {
      this.saved = [];
    }
  }
  persist() {
    if (!this.storage) return { persisted: false, error: 'Browser storage is unavailable; bookmark kept for this session only.' };
    try {
      this.storage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(this.saved));
      return { persisted: true, error: '' };
    } catch {
      return { persisted: false, error: 'Could not save to browser storage; bookmark kept for this session only.' };
    }
  }
  list() {
    return { builtin: BUILTIN_BOOKMARKS, saved: this.saved.slice() };
  }
  /** @param {string} id */
  find(id) {
    return BUILTIN_BOOKMARKS.find(b => b.id === id) ?? this.saved.find(b => b.id === id) ?? null;
  }
  /** @param {string} name @param {Omit<MapBookmark,'id'|'name'|'builtin'>} snapshot */
  save(name, snapshot) {
    const cleanName = (name || '').trim().slice(0, 60)
      || `θ₁ ${Number(snapshot.domain.center1.toFixed(1))}°, θ₂ ${Number(snapshot.domain.center2.toFixed(1))}°`;
    const candidate = normaliseSaved({
      ...snapshot,
      id: `user:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName
    });
    if (!candidate) throw new Error('Invalid bookmark parameters.');
    this.saved.push(candidate);
    const { persisted, error } = this.persist();
    return { bookmark: candidate, persisted, error };
  }
  /** @param {string} id */
  remove(id) {
    const before = this.saved.length;
    this.saved = this.saved.filter(b => b.id !== id);
    if (this.saved.length === before) return { removed: false, persisted: true, error: '' };
    return { removed: true, ...this.persist() };
  }
  clearSaved() {
    this.saved = [];
    return this.persist();
  }
}
