import { DT, openingLength } from '../physics/pendulum.js';
import { storyEnsemble } from './grid-story.js';

/** Sequential GPU reconstruction, bounded to one batch per pump. Checkpoints are point starts. */
export class StoryPlayer {
  constructor() { this.generation=0;this.checkpoints=new Map();this.job=null; }
  clear() { this.generation++;this.checkpoints.clear();if(this.job&&!this.job.inFlight)this.job.gpu.destroy();this.job=null; }
  /** @param {any} gpu @param {any} timeline @param {number[]} initial @param {any} p @param {number} target @param {number} speed */
  seek(gpu,timeline,initial,p,target,speed) {
    this.generation++;if(this.job&&!this.job.inFlight)this.job.gpu.destroy();
    let state=new Float32Array([initial[0],initial[1],0,0,initial[0]+.0001,initial[1],0,0]);
    let index=0,field=null;
    const cachedIndex=Math.max(-1,...Array.from(this.checkpoints.keys()).filter(i=>i<=target));
    const checkpoint=this.checkpoints.get(cachedIndex);
    if(checkpoint){state=checkpoint.state.slice();index=cachedIndex;field=checkpoint.field;}
    gpu.resetStates(state);
    this.job={gpu,timeline,initial,p,target,speed,index,state,field,remaining:null,resetFrom:null};
  }
  /** Returns a completed preview, or null after a bounded GPU batch. */
  async pump() {
    const job=this.job;if(!job)return null;
    const generation=this.generation;
    const {timeline,gpu,p}=job;
    while(job.index<=job.target) {
      const point=timeline.entries[job.index];
      if(job.remaining===null) {
        this.checkpoints.set(job.index,{state:job.state.slice(),field:job.field});
        if(point.id==='original'||point.id.startsWith('reveal-')&&point.id!=='reveal-four') {
          const stage=timeline.stages.find(s=>s.at===point.start-timeline.gridOffset);
          const size=point.id==='original'?2:point.id==='reveal-hundred'?10:point.id==='reveal-large'?40:point.id==='reveal-field'?160:stage?.size;
          if(size) {
            const previous=job.field,old=job.state;
            job.field=storyEnsemble(size,job.initial[0],job.initial[1]);job.state=job.field.initial.slice();
            if(previous)for(let r=0;r<previous.size;r++)for(let c=0;c<previous.size;c++)job.state.set(old.subarray((r*previous.size+c)*4,(r*previous.size+c)*4+4),(r*size+c)*4);
            else job.state.set(old.subarray(0,4));
            gpu.resetStates(job.state);
          }
        }
        job.resetFrom=null;
        if(point.action==='reset') {job.resetFrom=job.state.slice();job.state=job.field.initial.slice();gpu.resetStates(job.state);}
        // Selecting a reset point shows its beginning pose, before the visual blend.
        if(job.index===job.target){this.job=null;return {...job,resetFrom:job.resetFrom};}
        job.remaining=['run','opening','growth'].includes(point.action)?Math.round(point.duration*(job.index<2?1:job.speed)/DT):0;
        job.integrated=0;
      }
      if(job.remaining>0) {
        const count=Math.min(32,job.remaining);
        job.inFlight=true;
        let state;
        try {state=job.index<2?await gpu.advanceVarying(count,i=>({...p,l2:openingLength((timeline.entries[job.index].start+(job.integrated+i)*DT),p.l2,timeline.entries[0].duration,timeline.entries[1].duration)})):await gpu.advance(count,p);}
        catch(error){if(generation===this.generation)throw error;}
        finally {job.inFlight=false;if(generation!==this.generation)gpu.destroy();}
        if(generation!==this.generation)return null;
        job.state=state;job.integrated+=count;job.remaining-=count;return null;
      }
      job.index++;job.remaining=null;
    }
    return null;
  }
}
