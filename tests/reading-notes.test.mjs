import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, locateAnchor } from '../static/reading-notes.js';

test('unmodified paragraphs retain separate occurrences of the same quote', () => {
  const text = '先看原文，之后再看原文。';
  const anchor = {quote:'原文',prefix:'先看原文，之后再看',suffix:'。',block:0,offset:9,fingerprint:fingerprint(text)};
  assert.equal(text.indexOf('原文',5),anchor.offset);
  assert.deepEqual(locateAnchor([text], anchor), {index:0,offset:9});
});

test('revised documents recover unique context and never select an ambiguous repeated quote', () => {
  const anchor = {quote:'一个后端',prefix:'原则：',suffix:'。',block:1,offset:3,fingerprint:fingerprint('原则：一个后端。')};
  assert.deepEqual(locateAnchor(['新开头','原则：一个后端。','一个后端也可以扩容。'],anchor),{index:1,offset:3});
  assert.deepEqual(locateAnchor(['采用一个后端'],anchor),{index:0,offset:2});
  assert.equal(locateAnchor(['一个后端','另一个后端'],anchor),null);
  assert.equal(locateAnchor(['已重新改写'],anchor),null);
});
