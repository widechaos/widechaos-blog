import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIANSHU_MANUAL } from '../static/tianshu-manual.js';
import { manualPage, manualPages } from '../static/manual-view.js';
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b`, 'g'))].length;
test('every chapter has complete English instructions and preserves its structure and sources', () => {
  const pages=TIANSHU_MANUAL.pages;
  assert.equal(pages.length,15);
  assert.equal(new Set(pages.map(p=>p.slug)).size,pages.length);
  for (const p of pages) {
    assert.match(p.slug,/^[a-z-]+$/);
    assert.ok(p.headings.length>=3);
    assert.equal(p.en.headings.length,p.headings.length,p.slug);
    assert.doesNotMatch(p.en.title+p.en.summary+p.en.html,/[\u3400-\u9fff]/,p.slug);
    for (const tag of ['section','p','li','tr','td','figure','img','a']) assert.equal(tags(p.en.html,tag),tags(p.html,tag),`${p.slug}: ${tag}`);
    assert.deepEqual([...p.en.html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]),[...p.html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]));
    for (const lang of ['zh','en']) {
      const content=lang==='en' ? p.en : p;
      const rendered=manualPage('/docs/tianshu/'+p.slug,lang);
      assert.ok(rendered.includes(content.title));
      assert.ok(rendered.includes('aria-current="page"'));
      for (const heading of content.headings) assert.ok(rendered.includes(heading));
      for (const m of rendered.matchAll(/href="#([^"]+)"/g)) assert.ok(rendered.includes(`id="${m[1]}"`),`${p.slug}: ${m[1]}`);
      for (const m of rendered.matchAll(/href="(\/docs\/tianshu[^\"]*)"/g)) {
        const u=new URL(m[1],'https://widechaos.cn');
        assert.equal(u.searchParams.get('lang'),lang);
        assert.ok(u.pathname==='/docs/tianshu'||pages.some(p=>u.pathname==='/docs/tianshu/'+p.slug));
      }
    }
  }
});
test('English guide home, search and missing pages are English',()=>{
  const home=manualPage('/docs/tianshu','en');
  for(const text of ['Tianshu user guide','All chapters','Guide home','Find a feature or action','Search','Read →','Chinese interface']) assert.ok(home.includes(text));
  assert.doesNotMatch(home,/currently available in Chinese|[\u3400-\u9fff]/);
  assert.ok(manualPage('/docs/tianshu/missing','en').includes('Guide page not found'));
  assert.ok(manualPage('/docs/tianshu/missing').includes('没有这篇使用文档'));
  assert.ok(manualPages('en').filter(p=>(p.title+p.summary+p.html).toLowerCase().includes('archive')).some(p=>p.slug==='projects'));
  assert.match(manualPages('en').find(p=>p.slug==='models').html,/provider.*charges|charges.*provider/i);
  assert.match(manualPages('en').find(p=>p.slug==='tutorial').html,/model provider may process/);
});
