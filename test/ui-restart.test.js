import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Boot complete browser modules with the declared HTML controls, without a DOM framework.
test('UI boots, handles unsupported GPU, and binds restart to valid form settings',async()=>{
  const html=readFileSync('index.html','utf8'), nodes=new Map();
  for(const match of html.matchAll(/\bid="([^"]+)"[^>]*>/g)) {
    const listeners={};
    const classes=new Set();
    const node={value:match[0].match(/\bvalue="([^"]*)"/)?.[1]??'',checked:match[0].includes('checked'),disabled:false,
      textContent:'',width:0,height:0,clientWidth:1000,clientHeight:800,
      classList:{toggle:(x,force)=>{if(force??!classes.has(x))classes.add(x);else classes.delete(x);},contains:x=>classes.has(x),add:x=>classes.add(x)},
      addEventListener:(type,fn)=>{listeners[type]=fn;},setAttribute(){},focus(){},reportValidity:()=>true,reset(){},
      listeners,getContext:()=>new Proxy({},{get:()=>()=>{}})};
    nodes.set(match[1],node);
  }
  nodes.get('speed').value='1';nodes.get('opening').value='grow';
  const context=vm.createContext({console,Float32Array,Math,Number,Error,String,devicePixelRatio:1,navigator:{},
    document:{getElementById:id=>{assert.ok(nodes.has(id),`HTML declares #${id}`);return nodes.get(id);},body:{classList:{toggle(){}}},addEventListener(){}},
    matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame(){}});
  const cache=new Map();
  async function load(url) {
    if(cache.has(url.href))return cache.get(url.href);
    const mod=new vm.SourceTextModule(readFileSync(url,'utf8'),{context,identifier:url.href});cache.set(url.href,mod);
    await mod.link((specifier,parent)=>load(new URL(specifier,parent.identifier)));return mod;
  }
  const main=await load(new URL('../src/main.js',import.meta.url));await main.evaluate();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(nodes.get('view-status').textContent,/WebGPU is required/);
  assert.equal(nodes.get('pause').disabled,true);
  assert.doesNotThrow(()=>nodes.get('restart').listeners.click());
  assert.doesNotThrow(()=>nodes.get('parameters').listeners.submit({preventDefault(){}}));
});
