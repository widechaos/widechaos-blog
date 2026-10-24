import test from 'node:test';
import assert from 'node:assert/strict';
import {placeArticlePeek} from '../static/article-peek.js';

test('preview switches sides before viewport clamping could put it under the pointer', () => {
  for (const viewportWidth of [821, 1024, 1280, 1920]) {
    let side = 1;
    for (const x of [...Array.from({length:viewportWidth}, (_,x)=>x), ...Array.from({length:viewportWidth}, (_,x)=>viewportWidth-1-x)]) {
      const p = placeArticlePeek({x,y:400,width:360,height:470,viewportWidth,viewportHeight:800,top:100,side});
      side = p.side;
      assert.ok(p.x >= 12 && p.x+360 <= viewportWidth-12);
      assert.ok(p.x >= x+24 || p.x+360 <= x-24, `pointer ${x} covered at width ${viewportWidth}`);
    }
  }
});

import {mountArticlePeek} from '../static/article-peek.js';

test('late mounting recovers a stationary hover and missed pointer entry', () => {
  const names = ['document','window','location','matchMedia','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'];
  const saved = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis,name)]));
  let hovered = true, id = 0;
  const frames = new Map(), timers = new Map(), events = new Map(), rootEvents = new Map(), delays = new Map();
  const anchor = {href:'https://example.test/blog/published', matches:()=>hovered,
    getBoundingClientRect:()=>({left:100,top:150,width:600,height:180}), closest:()=>anchor, contains:node=>node===anchor};
  const root = {contains:node=>node===anchor, querySelectorAll:()=>[anchor], addEventListener:(name,fn)=>rootEvents.set(name,fn)};
  const panel = {classList:{remove(){},toggle(){}},setAttribute(){},contains:()=>false,remove(){},addEventListener(){}};
  const values = {
    document:{createElement:()=>panel,body:{append(){}},addEventListener:(name,fn)=>events.set(name,fn)},
    window:{addEventListener(){}},location:{origin:'https://example.test'},
    matchMedia:()=>({matches:true,addEventListener(){}}),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,delay)=>{timers.set(++id,fn);delays.set(id,delay);return id;},clearTimeout:key=>timers.delete(key),
  };
  try {
    for (const name of names) Object.defineProperty(globalThis,name,{value:values[name],configurable:true,writable:true});
    const cleanup = mountArticlePeek(root,{articles:[{id:'published',status:'published'}],language:'zh',motionEnabled:()=>true});
    const flush = () => {const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());};
    flush();flush();
    assert.equal(timers.size,1,'an existing hover arms a preview without a pointerover event');
    const opening = [...timers.keys()][0];
    assert.equal(delays.get(opening),150,'a brief pass does not immediately open the preview');
    rootEvents.get('pointerout')({target:anchor,relatedTarget:null});
    assert.equal(timers.has(opening),false,'leaving before the dwell cancels the opening');
    cleanup();assert.equal(timers.size,0);
    hovered=false;
    const cleanupAgain = mountArticlePeek(root,{articles:[{id:'published',status:'published'}],language:'zh',motionEnabled:()=>true});
    flush();flush();assert.equal(timers.size,0);
    events.get('pointermove')({target:anchor,pointerType:'mouse',buttons:0,clientX:180,clientY:200});
    assert.equal(timers.size,1,'movement within a link recovers a missed pointerover');
    cleanupAgain();assert.equal(timers.size,0);assert.equal(frames.size,0);
  } finally {
    for (const name of names) {if(saved[name])Object.defineProperty(globalThis,name,saved[name]);else delete globalThis[name];}
  }
});
