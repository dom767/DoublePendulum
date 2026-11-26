import { element } from './controls.js';
import { exportTimings, importTimings, MAX_DURATION } from '../story/timeline.js';

/** Native editor controls; all timings live in this tab. @param {any} callbacks */
export function setupStoryTimeline(callbacks) {
  const list=element('timeline-points');
  let rows=[],selected=0;
  function render(timeline) {
    list.textContent='';rows=[];
    for(const [index,point] of timeline.entries.entries()) {
      const row=document.createElement('li'),button=document.createElement('button');
      button.type='button';button.textContent=point.label;button.addEventListener('click',()=>{selected=index;callbacks.seek(index);});
      const stamp=document.createElement('span');stamp.className='mono-note';
      const label=document.createElement('label');label.textContent='Duration (seconds)';
      const range=document.createElement('input');range.type='range';range.min='0';range.max=String(MAX_DURATION);range.step='.1';range.value=String(point.duration);range.setAttribute('aria-label',point.label+' duration slider');
      const exact=document.createElement('input');exact.type='number';exact.min='0';exact.max=String(MAX_DURATION);exact.step='.01';exact.value=String(point.duration);exact.setAttribute('aria-label',point.label+' duration in seconds');
      const edit=(control,commit)=>{
        const value=Number(control.value);
        if(control.value===''||!Number.isFinite(value)||value<0||value>MAX_DURATION){element('timeline-message').textContent='Enter a duration from 0 to 600 seconds.';return;}
        selected=index;range.value=exact.value=String(value);callbacks.edit(index,value,commit);element('timeline-message').textContent='';
      };
      for(const control of [range,exact]){control.addEventListener('input',()=>edit(control,false));control.addEventListener('change',()=>edit(control,true));}
      label.appendChild(range);label.appendChild(exact);row.appendChild(button);row.appendChild(stamp);row.appendChild(label);list.appendChild(row);rows.push({row,button,stamp});
    }
    update(timeline,0);
  }
  function update(timeline,elapsed,current=-1,preparing=false) {
    element('timeline-clock').textContent=`${elapsed.toFixed(2)} / ${timeline.duration.toFixed(2)} s authored${elapsed>=timeline.duration?' · field continues':''}`;
    rows.forEach(({row,button,stamp},i)=>{stamp.textContent=`Start ${timeline.entries[i].start.toFixed(2)} s · ${timeline.entries[i].duration.toFixed(2)} s`;row.classList.toggle('selected',i===selected);button.setAttribute('aria-current',String(i===current));});
    element('timeline-preparing').textContent=preparing?'Preparing preview…':'';
  }
  element('timeline-play').addEventListener('click',()=>callbacks.play());
  element('timeline-replay').addEventListener('click',()=>{selected=0;callbacks.replay();});
  element('timeline-defaults').addEventListener('click',()=>callbacks.defaults());
  element('timeline-export').addEventListener('click',()=>{
    const blob=new Blob([exportTimings(callbacks.points())],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='double-pendulum-story.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  element('timeline-import').addEventListener('change',async event=>{
    const target=/** @type {HTMLInputElement} */(event.target);
    const file=target.files?.[0];if(!file)return;
    try {if(file.size>100000)throw new Error('Timing file is too large.');const points=importTimings(JSON.parse(await file.text()));callbacks.import(points);element('timeline-message').textContent='Timings imported into this tab.';}
    catch(error){element('timeline-message').textContent=error.message;}
    target.value='';
  });
  for(const type of ['pointerdown','wheel'])element('story-timeline').addEventListener(type,e=>e.stopPropagation());
  return {render,update};
}

