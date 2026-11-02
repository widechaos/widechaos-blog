import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIANSHU_MANUAL } from '../static/tianshu-manual.js';
import { manualPage } from '../static/manual-view.js';
test('guide has stable chapters, real contents and navigation for every documented function', () => {
  const pages=TIANSHU_MANUAL.pages;
  assert.equal(new Set(pages.map(p=>p.slug)).size,pages.length);
  for (const p of pages) {
    assert.match(p.slug,/^[a-z-]+$/);
    assert.ok(p.headings.length>=3);
    const rendered=manualPage('/docs/tianshu/'+p.slug);
    assert.ok(rendered.includes(p.html));
    assert.ok(rendered.includes('aria-current="page"'));
    for (const link of [...p.html.matchAll(/href="\/docs\/tianshu\/([a-z-]+)"/g)]) assert.ok(pages.some(p=>p.slug===link[1]));
  }
  assert.ok(manualPage('/docs/tianshu','en').includes('currently available in Chinese'));
  assert.ok(manualPage('/docs/tianshu/missing').includes('没有这篇使用文档'));
});
