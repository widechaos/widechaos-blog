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
