import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleField, sampleTile, pixelInitial, DEG, presets } from '../src/physics/ensemble.js';
import { zoomDomain, panDomain } from '../src/physics/domain-view.js';
import { step } from '../src/physics/integrator.js';
import { defaults, DT } from '../src/physics/pendulum.js';
import { MapRunner, planTiles, previewSize } from '../src/maps/runner.js';
import { MAP_METRICS, flipWinding, flipColourRGB, sensitivityColourRGB, wrappedSeparation, SENSITIVITY_EPSILON, formatDt, physicalDuration } from '../src/maps/metrics.js';
import { encodeShareHash, decodeShareHash } from '../src/maps/state.js';
import { BookmarkStore, BUILTIN_BOOKMARKS } from '../src/maps/bookmarks.js';
import { GPUBackend } from '../src/compute/gpu-backend.js';
import { angleRGB } from '../src/render/angle-colour.js';

/** Reference CPU evaluation of a map tile for deterministic acceptance tests (not used in live rendering). */
function referenceMapColours(width, height, domain, steps, dt, metric, order, maxTilePixels) {
  const out = new Uint8ClampedArray(width * height * 4);
  const tiles = planTiles(width, height, { order, maxTilePixels });
  for (const tile of tiles) {
    const init = sampleTile(width, height, tile.rowStart, tile.rowEnd, domain);
    for (let i = 0; i < tile.count; i++) {
      let s = [init[i * 4], init[i * 4 + 1], 0, 0];
      let twin = [init[i * 4] + SENSITIVITY_EPSILON, init[i * 4 + 1], 0, 0];
      let flipStep = 0;
      for (let k = 1; k <= steps; k++) {
        const w1 = flipWinding(s[0]), w2 = flipWinding(s[1]);
        s = step(s, defaults, dt);
        if (metric === 'first-flip' && flipStep === 0) {
          if (flipWinding(s[0]) !== w1 || flipWinding(s[1]) !== w2) flipStep = k;
        }
        if (metric === 'sensitivity') twin = step(twin, defaults, dt);
      }
      const rgb = metric === 'first-flip'
        ? flipColourRGB(flipStep, steps)
        : metric === 'sensitivity'
          ? sensitivityColourRGB(wrappedSeparation(s[0], s[1], twin[0], twin[1]))
          : angleRGB(s[0], s[1]);
      const dest = (tile.offset + i) * 4;
      out[dest] = rgb[0]; out[dest + 1] = rgb[1]; out[dest + 2] = rgb[2]; out[dest + 3] = 255;
    }
  }
  return out;
}

test('sampleTile matches sampleField bit-for-bit across any row partition', () => {
  const full = sampleField(13, 11, presets.neighbourhood);
  for (const order of /** @type {const} */(['top-to-bottom', 'bottom-to-top', 'centre-out'])) {
    const tiles = planTiles(13, 11, { maxTilePixels: 30, order });
    const reassembled = new Float32Array(13 * 11 * 4);
    for (const t of tiles) {
      reassembled.set(sampleTile(13, 11, t.rowStart, t.rowEnd, presets.neighbourhood), t.offset * 4);
    }
    assert.deepEqual(reassembled, full, `Order ${order} matches full sampling`);
  }
  const [a, b] = pixelInitial(13, 11, 5, 7, presets.neighbourhood);
  const idx = (5 * 13 + 7) * 4;
  assert.ok(Math.abs(a - full[idx]) < 1e-6);
  assert.ok(Math.abs(b - full[idx + 1]) < 1e-6);
});

test('tile order and zoom history do not affect fixed-duration map results', () => {
  const domain = { center1: 60, center2: 40, span1: 80, span2: 80 };
  for (const metric of /** @type {const} */(['final-angle', 'first-flip', 'sensitivity'])) {
    const single = referenceMapColours(6, 6, domain, 25, DT, metric, 'top-to-bottom', 100);
    const topDown = referenceMapColours(6, 6, domain, 25, DT, metric, 'top-to-bottom', 12);
    const bottomUp = referenceMapColours(6, 6, domain, 25, DT, metric, 'bottom-to-top', 12);
    const centreOut = referenceMapColours(6, 6, domain, 25, DT, metric, 'centre-out', 12);
    assert.deepEqual(topDown, single, `${metric}: top-to-bottom matches single tile`);
    assert.deepEqual(bottomUp, single, `${metric}: bottom-to-top matches single tile`);
    assert.deepEqual(centreOut, single, `${metric}: centre-out matches single tile`);
  }
  // Zoom in then back out (and pan right then left) to the same domain must match fresh sampling.
  const zIn = zoomDomain(domain, 0.5, 0.25, 0.75);
  const zOut = zoomDomain(zIn, 2, 0.25, 0.75);
  const panned = panDomain(panDomain(zOut, 0.2, -0.1), -0.2, 0.1);
  const fresh = referenceMapColours(5, 5, domain, 20, DT, 'final-angle', 'centre-out', 25);
  const roundTripped = referenceMapColours(5, 5, panned, 20, DT, 'final-angle', 'centre-out', 25);
  assert.deepEqual(roundTripped, fresh);
});

test('progressive tiled MapRunner marks previews distinctly, delivers all N steps, and blocks stale overwrites', async () => {
  const runner = new MapRunner();
  assert.deepEqual(previewSize(400, 200), { width: 100, height: 50 });
  assert.equal(previewSize(100, 100), null);

  const gen1 = runner.begin({ width: 400, height: 200, target: 300, dtDenom: 480, metric: 'first-flip', preview: true, maxTilePixels: 40_000 });
  assert.equal(runner.phase, 'preview');
  assert.equal(runner.isPreview, true);

  /** @type {Array<{isPreview:boolean,rowStart:number,rowEnd:number,steps:number}>} */
  const commits = [];
  const stepSums = new Map();
  while (!runner.complete) {
    await runner.pumpTile({
      loadTile(tile) { stepSums.set(tile, 0); },
      async advance(batch, offset, tile) {
        assert.equal(offset, stepSums.get(tile));
        stepSums.set(tile, offset + batch);
      },
      async readColours(tile) { return new Uint8ClampedArray(tile.count * 4); },
      commitTile(tile) { commits.push({ isPreview: tile.isPreview, rowStart: tile.rowStart, rowEnd: tile.rowEnd, steps: stepSums.get(tile) }); }
    }, gen1);
  }
  assert.equal(runner.complete, true);
  assert.equal(runner.isPreview, false);
  assert.equal(runner.completedPixels, 400 * 200);
  assert.equal(commits[0].isPreview, true);
  assert.equal(commits[0].steps, 300);
  const fullCommits = commits.filter(c => !c.isPreview);
  assert.ok(fullCommits.length >= 2);
  assert.ok(fullCommits.every(c => c.steps === 300), 'Every completed full-resolution tile received all N steps');

  // Stale job cancellation mid-flight must never commit to the new view.
  const genStale = runner.begin({ width: 20, height: 20, target: 20, preview: false });
  let staleCommitted = false;
  /** @type {(() => void)|undefined} */ let releaseAdvance;
  const inflight = runner.pumpTile({
    loadTile() {},
    advance() { return new Promise(resolve => { releaseAdvance = () => resolve(); }); },
    async readColours(tile) { return new Uint8ClampedArray(tile.count * 4); },
    commitTile() { staleCommitted = true; }
  }, genStale);
  await Promise.resolve();
  const genNew = runner.begin({ width: 20, height: 20, target: 20, preview: false });
  assert.notEqual(genNew, genStale);
  assert.ok(releaseAdvance);
  releaseAdvance();
  const res = await inflight;
  assert.equal(res, false);
  assert.equal(staleCommitted, false, 'Stale job cannot overwrite new view');
});

test('candidate regular region stays non-flipping at refined Δt and longer duration while high-angle flips and diverges', () => {
  // Low-energy candidate regular start (20°, 20°): total mechanical energy is far below flip threshold.
  for (const [steps, dtDenom] of [[1000, 480], [4000, 960]]) {
    let s = [20 * DEG, 20 * DEG, 0, 0];
    let twin = [20 * DEG + SENSITIVITY_EPSILON, 20 * DEG, 0, 0];
    let flipped = 0;
    const dt = 1 / dtDenom;
    for (let k = 1; k <= steps; k++) {
      const w1 = flipWinding(s[0]), w2 = flipWinding(s[1]);
      s = step(s, defaults, dt);
      twin = step(twin, defaults, dt);
      if (!flipped && (flipWinding(s[0]) !== w1 || flipWinding(s[1]) !== w2)) flipped = k;
    }
    assert.equal(flipped, 0, `Calm region does not flip for N=${steps} at Δt=${formatDt(dtDenom)}`);
    const sep = wrappedSeparation(s[0], s[1], twin[0], twin[1]);
    assert.ok(sep < 0.01, `Calm region keeps small nearby separation (${sep})`);
  }
  assert.ok(Math.abs(physicalDuration(4000, 960) - 4000 / 960) < 1e-12);

  // High-angle start (160°, 160°): flips within N=1000 and diverges strongly over N=2000.
  let s = [160 * DEG, 160 * DEG, 0, 0];
  let twin = [160 * DEG + SENSITIVITY_EPSILON, 160 * DEG, 0, 0];
  let flipped = 0;
  for (let k = 1; k <= 2000; k++) {
    const w1 = flipWinding(s[0]), w2 = flipWinding(s[1]);
    s = step(s, defaults, DT);
    twin = step(twin, defaults, DT);
    if (!flipped && (flipWinding(s[0]) !== w1 || flipWinding(s[1]) !== w2)) flipped = k;
  }
  assert.ok(flipped > 0 && flipped <= 1000, `High-angle trajectory flips at step ${flipped}`);
  assert.ok(wrappedSeparation(s[0], s[1], twin[0], twin[1]) > 0.05);
});

test('shareable URL hash encodes, decodes, validates, and rejects malformed inputs safely', () => {
  const sample = {
    mode: /** @type {const} */('field'),
    fieldRun: /** @type {const} */('map'),
    metric: /** @type {const} */('first-flip'),
    steps: 4000,
    dtDenom: 960,
    domain: { center1: 110, center2: -45.5, span1: 80, span2: 60 },
    p: { l1: 1.2, l2: 0.8, m1: 1.5, m2: 0.9 }
  };
  const hash = encodeShareHash(sample);
  assert.ok(hash.startsWith('#'));
  const decoded = decodeShareHash(hash);
  assert.ok(decoded && decoded.ok);
  assert.deepEqual(decoded.state, sample);
  assert.equal(decodeShareHash(''), null);
  assert.equal(decodeShareHash('#unrelated'), null);
  const badMetric = decodeShareHash('#v=1&mode=field&run=map&metric=bogus');
  assert.ok(badMetric && !badMetric.ok);
  const badDt = decodeShareHash('#v=1&mode=field&run=map&dt=123');
  assert.ok(badDt && !badDt.ok);
  const badSteps = decodeShareHash('#v=1&mode=field&run=map&n=5');
  assert.ok(badSteps && !badSteps.ok);
});

test('BookmarkStore exposes curated regions, persists user bookmarks, and survives storage errors', () => {
  const backing = new Map();
  const storage = { getItem: k => backing.get(k) ?? null, setItem: (k, v) => { backing.set(k, v); } };
  const store = new BookmarkStore(storage);
  assert.equal(store.list().builtin.length, BUILTIN_BOOKMARKS.length);
  assert.equal(store.list().saved.length, 0);

  const saved = store.save('My island', {
    domain: { center1: 10, center2: -10, span1: 30, span2: 30 },
    steps: 2000,
    dtDenom: 960,
    metric: 'sensitivity',
    p: { l1: 1, l2: 1, m1: 1, m2: 1 }
  });
  assert.equal(saved.persisted, true);
  assert.equal(saved.bookmark.name, 'My island');

  const reloaded = new BookmarkStore(storage);
  assert.equal(reloaded.list().saved.length, 1);
  assert.equal(reloaded.find(saved.bookmark.id)?.steps, 2000);
  assert.equal(reloaded.remove('builtin:full').removed, false);
  assert.equal(reloaded.remove(saved.bookmark.id).removed, true);
  assert.equal(reloaded.list().saved.length, 0);

  const broken = new BookmarkStore({ getItem() { return '{corrupt'; }, setItem() { throw new Error('quota'); } });
  const fallback = broken.save('', {
    domain: { center1: 0, center2: 0, span1: 360, span2: 360 },
    steps: 1000,
    dtDenom: 480,
    metric: 'final-angle',
    p: { l1: 1, l2: 1, m1: 1, m2: 1 }
  });
  assert.equal(fallback.persisted, false);
  assert.match(fallback.error, /storage/i);
  assert.equal(broken.list().saved.length, 1);
});

test('GPUBackend supports first-flip, sensitivity twin perturbation, custom dt, and colour mode uniform', async () => {
  const originals = { GPUBufferUsage: globalThis.GPUBufferUsage, GPUMapMode: globalThis.GPUMapMode };
  globalThis.GPUBufferUsage = /** @type {any} */({ STORAGE: 1, COPY_DST: 2, COPY_SRC: 4, UNIFORM: 8, MAP_READ: 16 });
  globalThis.GPUMapMode = /** @type {any} */({ READ: 1 });
  const writes = [], dispatches = [], pipelinesUsed = [];
  const device = {
    limits: { maxStorageBufferBindingSize: 1 << 30 },
    createBuffer: ({ size }) => ({ data: new Uint8Array(size), destroyed: false, destroy() { this.destroyed = true; }, async mapAsync() {}, unmap() {}, getMappedRange() { return this.data.buffer; } }),
    createBindGroup: () => ({}),
    queue: {
      writeBuffer: (buffer, offset, data) => {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        buffer.data.set(bytes, offset);
        writes.push({ buffer, data: data instanceof Float32Array ? data.slice() : data instanceof Uint32Array ? data.slice() : bytes.slice() });
      },
      submit() {}
    },
    createCommandEncoder: () => ({
      beginComputePass: () => ({
        setPipeline(p) { pipelinesUsed.push(p.name); },
        setBindGroup() {},
        dispatchWorkgroups: n => dispatches.push(n),
        end() {}
      }),
      copyBufferToBuffer: (source, offset, target, targetOffset, size) => { target.data.set(source.data.subarray(offset, offset + size), targetOffset); },
      finish: () => ({})
    })
  };
  try {
    const mkPipe = name => ({ name, getBindGroupLayout: () => ({}) });
    const gpu = new GPUBackend(/** @type {any} */(device), /** @type {any} */(mkPipe('rk4')), /** @type {any} */(mkPipe('colour')), /** @type {any} */(mkPipe('flip')));
    const init = sampleField(8, 4, presets.full);
    gpu.resetMetricStates(init, 'first-flip');
    await gpu.advanceMetricInPlace(50, defaults, 'first-flip', 1 / 960, 100);
    const flipParams = writes.filter(w => w.buffer === gpu.params).at(-1).data;
    assert.ok(Math.abs(flipParams[4] - 1 / 960) < 1e-9);
    assert.equal(flipParams[5], 50);
    assert.equal(flipParams[6], 100);
    assert.equal(pipelinesUsed.at(-1), 'flip');
    await gpu.readColours(MAP_METRICS['first-flip'].mode, 2000);
    const colParams = writes.filter(w => w.buffer === gpu.colourParams).at(-1).data;
    assert.deepEqual(Array.from(colParams), [1, 2000, 0, 0]);

    dispatches.length = 0;
    gpu.resetMetricStates(init, 'sensitivity');
    const twinWrite = writes.filter(w => w.buffer === gpu.twin).at(-1).data;
    assert.ok(Math.abs(twinWrite[0] - (init[0] + SENSITIVITY_EPSILON)) < 1e-6);
    assert.equal(twinWrite[1], init[1]);
    await gpu.advanceMetricInPlace(25, defaults, 'sensitivity', DT, 0);
    assert.deepEqual(dispatches, [1, 1], 'Sensitivity dispatches both reference and twin ensembles');
  } finally {
    globalThis.GPUBufferUsage = originals.GPUBufferUsage;
    globalThis.GPUMapMode = originals.GPUMapMode;
  }
});
