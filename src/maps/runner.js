import { MAP_STEPS } from '../physics/ensemble.js';

/** Progressive fixed-duration map: every pixel receives exactly N steps; zoom cancels and resamples. */
export class MapRunner {
  constructor() {
    this.generation=0;
    this.target=MAP_STEPS;
    this.done=0;
    this.busy=false;
    this.complete=false;
  }
  /** Start or restart after a domain resample. */
  begin(target=MAP_STEPS) {
    this.generation++;
    this.target=target;
    this.done=0;
    this.complete=false;
    return this.generation;
  }
  cancel() { this.generation++; this.complete=false; this.done=0; }
  get progress() { return this.target?this.done/this.target:0; }
  /** @param {(batch:number)=>Promise<void>} advance @param {number} generation */
  async pump(advance,generation,batch=32) {
    if(this.complete||generation!==this.generation||this.busy) return false;
    this.busy=true;
    try {
      const count=Math.min(batch,this.target-this.done);
      if(count>0){await advance(count);if(generation!==this.generation)return false;this.done+=count;}
      if(this.done>=this.target)this.complete=true;
      return this.complete;
    } finally { this.busy=false; }
  }
}
