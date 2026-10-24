import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPath,contentContext} from '../static/analytics.js';
test('only public routes are eligible and queries never enter payload paths',()=>{
  for(const path of ['/hub','/hub/site','/login?token=secret','/api/lifehub','/lifehub','/blog/private/nested','/static/logs/app.log']) assert.equal(publicPath(path),null);
  assert.equal(publicPath('/blog/story?q=private#secret'),'/blog/story');
  assert.equal(publicPath('/radar?month=2026-10'),'/radar');
});
test('translations share one group while preserving language and radar separation',()=>{
 const articles=[{id:'a-zh',translationKey:'a',lang:'zh',status:'published'},{id:'a-en',translationKey:'a',lang:'en',status:'published'},{id:'oss-radar-1',lang:'zh',status:'published'}];
 assert.deepEqual(contentContext('/blog/a-en',articles,'zh'),{content:'a',kind:'article',lang:'en'});
 assert.equal(contentContext('/blog/oss-radar-1',articles).kind,'radar');
 assert.equal(contentContext('/blog/draft',[{id:'draft',translationKey:'private',status:'draft'}]).kind,'page');
});

test('route tracking deduplicates renders, strips private URL values, and honors exclusions', async()=>{
 const {createAnalytics}=await import('../static/analytics.js');
 const requests=[];const storage=new Map();
 const originals={};
 const replace=(key,value)=>{originals[key]=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 replace('location',{hostname:'widechaos.cn',pathname:'/blog/a-en',origin:'https://widechaos.cn'});
 replace('navigator',{doNotTrack:'0'});
 replace('document',{hidden:false,referrer:'https://example.com/search?q=private',addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];}});
 replace('localStorage',{getItem:k=>storage.get(k)});
 replace('fetch',(path,options)=>{requests.push({path,...JSON.parse(options.body)});return Promise.resolve({ok:true});});
 replace('setInterval',()=>0);replace('IntersectionObserver',undefined);
 try {
  const analytics=createAnalytics();
  analytics.page([{id:'a-en',translationKey:'a',lang:'en',status:'published'}],'zh');
  analytics.page([{id:'a-en',translationKey:'a',lang:'en',status:'published'}],'zh');
  assert.equal(requests.filter(r=>r.event==='pageview').length,1);
  assert.equal(requests[0].content,'a');assert.equal(requests[0].referrer,'example.com');
  assert.ok(!JSON.stringify(requests).includes('private'));
  location.pathname='/hub/site';analytics.page([],'zh');assert.equal(requests.length,2);
  storage.set('wc-analytics-disabled','1');location.pathname='/tools';analytics.page([],'zh');assert.equal(requests.length,2);
  storage.clear();navigator.doNotTrack='1';location.pathname='/about';analytics.page([],'zh');assert.equal(requests.length,2);
 } finally {for(const [key,value] of Object.entries(originals)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}}
});
