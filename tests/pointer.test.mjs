import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPointer} from '../static/pointer.js';

function classes() {
  const values=new Set();
  return {add(...names){names.forEach(x=>values.add(x));},remove(...names){names.forEach(x=>values.delete(x));},contains(x){return values.has(x);},toggle(x,on){on ??= !values.has(x);on?values.add(x):values.delete(x);return on;}};
}
function node() {
  return Object.assign(new EventTarget(),{classList:classes(),dataset:{},style:{},setAttribute(){},remove(){this.removed=true;},closest(){return null;}});
}
function target(kind) {
  return {closest(selector){
    if (selector.startsWith('textarea,')) return kind==='input'?this:null;
    if (selector.startsWith('a[href]')) return kind==='action'?this:null;
    if (selector.startsWith('p,')) return kind==='text'?this:null;
    return null;
  }};
}

test('sword moves immediately, reticle eases separately, native editing and failure fallbacks survive',()=>{
  const keys=['document','window','matchMedia','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const root=node();root.dataset.motion='on';
  const follower=node(),tip=node(),reticle=node();
  const idle=Object.assign(node(),{complete:true,naturalWidth:32});
  const active=Object.assign(node(),{complete:true,naturalWidth:32});
  const pulse=Object.assign(node(),{animate(){return {cancel(){}};}});
  const children={'.sword-tip':tip,'.sword-reticle-position':reticle,'.sword-tip-idle':idle,'.sword-tip-action':active,'.sword-reticle-pulse':pulse};
  follower.querySelector=s=>children[s];
  follower.showPopover=()=>{follower.open=true;};follower.hidePopover=()=>{follower.open=false;};follower.matches=()=>!!follower.open;
  const doc=Object.assign(new EventTarget(),{documentElement:root,body:{append(){}},hidden:false,createElement:()=>follower,elementFromPoint:()=>current,querySelectorAll:()=>[]});
  const win=Object.assign(new EventTarget(),{getSelection:()=>({isCollapsed:true})});
  const media=new Map();
  const frames=new Map();let sequence=0,current=target('idle'),cleanup;
  const emit=(type,x,y,t=current)=>{current=t;const event=new Event(type);Object.assign(event,{pointerType:'mouse',clientX:x,clientY:y,button:0,relatedTarget:type==='pointerout'?null:t});Object.defineProperty(event,'target',{value:t});doc.dispatchEvent(event);};
  try {
    Object.assign(globalThis,{document:doc,window:win,matchMedia(q){if(!media.has(q))media.set(q,Object.assign(new EventTarget(),{matches:q.includes('pointer: fine')}));return media.get(q);},MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame(cb){frames.set(++sequence,cb);return sequence;},cancelAnimationFrame(id){frames.delete(id);}});
    cleanup=mountPointer();
    assert.equal(root.classList.contains('sword-pointer'),false,'native cursor remains until the first usable event');
    emit('pointermove',100,200);
    assert.equal(tip.style.transform,'translate3d(97px,197px,0)');
    emit('pointermove',200,250);
    assert.equal(tip.style.transform,'translate3d(197px,247px,0)','sword position is updated without waiting for RAF');
    assert.equal(reticle.style.transform,'translate3d(100px,200px,0)');
    const [id,frame]=frames.entries().next().value;frames.delete(id);frame();
    assert.equal(reticle.style.transform,'translate3d(130px,215px,0)','only the outer reticle interpolates');
    emit('pointerover',205,250,target('text'));
    assert.equal(follower.dataset.state,'idle','plain text and labels keep the sword until selecting');
    assert.equal(follower.classList.contains('is-visible'),true);
    emit('pointerover',210,250,target('input'));
    assert.equal(follower.dataset.state,'text');assert.equal(follower.classList.contains('is-visible'),false);
    emit('pointermove',240,260,target('action'));
    assert.equal(follower.dataset.state,'action');assert.equal(follower.classList.contains('is-visible'),true);
    const reduced=media.get('(prefers-reduced-motion: reduce)');reduced.matches=true;reduced.dispatchEvent(new Event('change'));
    assert.equal(follower.classList.contains('is-visible'),true,'direct pointer still works without decorative motion');
    assert.equal(follower.classList.contains('has-reticle'),false);
    const forced=media.get('(forced-colors: active)');forced.matches=true;forced.dispatchEvent(new Event('change'));
    assert.equal(root.classList.contains('sword-pointer'),false);
    forced.matches=false;forced.dispatchEvent(new Event('change'));
    idle.naturalWidth=0;idle.dispatchEvent(new Event('error'));
    assert.equal(root.classList.contains('sword-pointer'),false,'failed sword asset restores the native cursor');
    idle.naturalWidth=32;idle.dispatchEvent(new Event('load'));
    emit('pointermove',300,300,target('idle'));
    emit('pointerout',300,300);
    assert.equal(root.classList.contains('sword-pointer'),false);
    cleanup();cleanup=null;
    assert.equal(follower.removed,true);assert.equal(frames.size,0);
  } finally {
    cleanup?.();
    for (const key of keys) saved[key]?Object.defineProperty(globalThis,key,saved[key]):delete globalThis[key];
  }
});
