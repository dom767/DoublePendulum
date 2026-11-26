import { MAP_STEPS } from '../physics/ensemble.js';

export const DEFAULT_TILE_PIXELS = 131_072;
export const PREVIEW_THRESHOLD_PIXELS = 40_000;
export const PREVIEW_SCALE = 4;

/** @typedef {'top-to-bottom'|'bottom-to-top'|'centre-out'} TileOrder */
/** @typedef {{rowStart:number,rowEnd:number,width:number,height:number,offset:number,count:number,done:number,isPreview:boolean}} MapTile */

/** Compute coarse preview dimensions for large fields; returns null when already small.
 * @param {number} width @param {number} height @param {number} [scale] */
export function previewSize(width, height, scale = PREVIEW_SCALE) {
  if (width * height <= PREVIEW_THRESHOLD_PIXELS || width < 8 || height < 8) return null;
  return {
    width: Math.max(2, Math.ceil(width / scale)),
    height: Math.max(2, Math.ceil(height / scale))
  };
}

/** Partition a width×height map into row-aligned tiles covering every pixel exactly once.
 * Tile order never affects the sampled initial conditions or final integrated state of any pixel.
 * @param {number} width @param {number} height
 * @param {{maxTilePixels?:number,order?:TileOrder}} [options]
 * @returns {MapTile[]} */
export function planTiles(width, height, options = {}) {
  const maxTilePixels = Math.max(width, options.maxTilePixels ?? DEFAULT_TILE_PIXELS);
  const order = options.order ?? 'centre-out';
  const rowsPerTile = Math.max(1, Math.min(height, Math.floor(maxTilePixels / width)));
  /** @type {MapTile[]} */
  const tiles = [];
  for (let rowStart = 0; rowStart < height; rowStart += rowsPerTile) {
    const rowEnd = Math.min(height, rowStart + rowsPerTile);
    const tileHeight = rowEnd - rowStart;
    tiles.push({
      rowStart,
      rowEnd,
      width,
      height: tileHeight,
      offset: rowStart * width,
      count: width * tileHeight,
      done: 0,
      isPreview: false
    });
  }
  if (order === 'bottom-to-top') tiles.reverse();
  else if (order === 'centre-out') {
    const mid = height / 2;
    tiles.sort((a, b) => Math.abs((a.rowStart + a.rowEnd) / 2 - mid) - Math.abs((b.rowStart + b.rowEnd) / 2 - mid));
  }
  return tiles;
}

/** Choose a responsive RK4 batch size for a tile so each GPU submission stays interactive.
 * @param {number} pixelCount @param {number} remaining */
export function tileBatchSize(pixelCount, remaining) {
  const target = Math.max(16, Math.min(256, Math.floor(16_000_000 / Math.max(1, pixelCount))));
  return Math.min(target, remaining);
}

/** Cancellable progressive fixed-duration map runner.
 * Supports optional coarse preview followed by tiled full-resolution computation where every
 * completed full-resolution pixel receives all N requested steps and stale jobs cannot overwrite new views. */
export class MapRunner {
  constructor() {
    this.generation = 0;
    this.target = MAP_STEPS;
    this.dtDenom = 480;
    /** @type {import('./metrics.js').MapMetricId} */
    this.metric = 'final-angle';
    this.width = 0;
    this.height = 0;
    this.done = 0;
    this.busy = false;
    this.complete = false;
    /** @type {'idle'|'preview'|'full'|'complete'} */
    this.phase = 'idle';
    /** @type {MapTile|null} */
    this.previewTile = null;
    /** @type {MapTile[]} */
    this.tiles = [];
    this.tileIndex = 0;
    this.completedPixels = 0;
    this.totalPixels = 0;
    this.previewReady = false;
  }

  /** Start or restart a map run. Accepts either a numeric step target (simple mode) or a tiled map spec.
   * @param {number|{width:number,height:number,target?:number,dtDenom?:number,metric?:import('./metrics.js').MapMetricId,preview?:boolean,tileOrder?:TileOrder,maxTilePixels?:number}} [spec] */
  begin(spec = MAP_STEPS) {
    this.generation++;
    this.done = 0;
    this.complete = false;
    this.previewReady = false;
    this.tileIndex = 0;
    this.completedPixels = 0;
    if (typeof spec === 'number') {
      this.target = spec;
      this.width = 0;
      this.height = 0;
      this.totalPixels = 0;
      this.previewTile = null;
      this.tiles = [];
      this.phase = 'full';
      return this.generation;
    }
    this.width = spec.width;
    this.height = spec.height;
    this.totalPixels = spec.width * spec.height;
    this.target = spec.target ?? MAP_STEPS;
    this.dtDenom = spec.dtDenom ?? 480;
    this.metric = spec.metric ?? 'final-angle';
    const coarse = spec.preview !== false ? previewSize(spec.width, spec.height) : null;
    this.previewTile = coarse
      ? { rowStart: 0, rowEnd: coarse.height, width: coarse.width, height: coarse.height, offset: 0, count: coarse.width * coarse.height, done: 0, isPreview: true }
      : null;
    this.tiles = planTiles(spec.width, spec.height, { maxTilePixels: spec.maxTilePixels, order: spec.tileOrder });
    this.phase = this.previewTile ? 'preview' : 'full';
    return this.generation;
  }

  cancel() {
    this.generation++;
    this.complete = false;
    this.done = 0;
    this.phase = 'idle';
    this.previewTile = null;
    this.tiles = [];
    this.tileIndex = 0;
    this.completedPixels = 0;
    this.previewReady = false;
  }

  /** True whenever the displayed image is not yet a 100% completed full-resolution map. */
  get isPreview() {
    return this.phase === 'preview' || (this.phase === 'full' && !this.complete);
  }

  /** Fractional completion of the full-resolution map in [0, 1]. */
  get progress() {
    if (!this.target) return 0;
    if (!this.tiles.length) return this.done / this.target;
    if (this.complete) return 1;
    if (this.phase === 'preview') return 0;
    const current = this.tiles[this.tileIndex];
    const inFlight = current ? current.count * (current.done / this.target) : 0;
    return Math.min(1, (this.completedPixels + inFlight) / Math.max(1, this.totalPixels));
  }

  /** Fractional completion of the coarse preview pass in [0, 1]. */
  get previewProgress() {
    if (!this.previewTile || !this.target) return 1;
    return Math.min(1, this.previewTile.done / this.target);
  }

  /** Simple step-batched pump (used by single-tile callers and legacy tests).
   * @param {(batch:number)=>Promise<void>} advance @param {number} generation @param {number} [batch] */
  async pump(advance, generation, batch = 32) {
    if (this.complete || generation !== this.generation || this.busy) return false;
    this.busy = true;
    try {
      const count = Math.min(batch, this.target - this.done);
      if (count > 0) {
        await advance(count);
        if (generation !== this.generation) return false;
        this.done += count;
      }
      if (this.done >= this.target) {
        this.complete = true;
        this.phase = 'complete';
      }
      return this.complete;
    } finally {
      this.busy = false;
    }
  }

  /** Tiled progressive pump: advances one batch of either the coarse preview or the active full-res tile.
   * Rejects stale generations before and after every async step so cancelled jobs never overwrite new views.
   * @param {{
   *   loadTile: (tile:MapTile)=>void|Promise<void>,
   *   advance: (batch:number, stepOffset:number, tile:MapTile)=>Promise<void>,
   *   readColours: (tile:MapTile)=>Promise<Uint8ClampedArray>,
   *   commitTile: (tile:MapTile, colours:Uint8ClampedArray)=>void
   * }} handlers
   * @param {number} generation */
  async pumpTile(handlers, generation) {
    if (this.complete || generation !== this.generation || this.busy) return false;
    const tile = this.phase === 'preview' ? this.previewTile : this.tiles[this.tileIndex];
    if (!tile) {
      this.complete = true;
      this.phase = 'complete';
      return true;
    }
    this.busy = true;
    try {
      if (tile.done === 0) {
        await handlers.loadTile(tile);
        if (generation !== this.generation) return false;
      }
      const batch = tileBatchSize(tile.count, this.target - tile.done);
      if (batch > 0) {
        await handlers.advance(batch, tile.done, tile);
        if (generation !== this.generation) return false;
        tile.done += batch;
      }
      if (tile.done >= this.target) {
        const colours = await handlers.readColours(tile);
        if (generation !== this.generation) return false;
        handlers.commitTile(tile, colours);
        if (tile.isPreview) {
          this.previewReady = true;
          this.phase = 'full';
        } else {
          this.completedPixels += tile.count;
          this.tileIndex++;
          if (this.tileIndex >= this.tiles.length) {
            this.done = this.target;
            this.complete = true;
            this.phase = 'complete';
          }
        }
      }
      if (!this.complete && this.phase === 'full') {
        this.done = Math.floor(this.progress * this.target);
      }
      return this.complete;
    } finally {
      this.busy = false;
    }
  }
}
