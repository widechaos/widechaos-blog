import test from 'node:test';
import assert from 'node:assert/strict';
import { readingMedalTarget } from '../static/collection.js';

const id = '0123456789abcdef0123';
const card = (kind, key = id) => ({dataset:{kind, image:`/static/assets/collection/${key}-light.svg`}});

test('reading permalink selects the exact medal, independent of gallery order', () => {
  const medal = card('reading');
  assert.equal(readingMedalTarget([card('reading', 'f'.repeat(20)), medal], `?lang=en&medal=${id}`), medal);
});

test('unknown, malformed and non-reading targets leave the collection closed', () => {
  for (const search of ['', '?medal=unknown', '?medal=https://other.example/image', `?medal=${'f'.repeat(20)}`]) {
    assert.equal(readingMedalTarget([card('reading')], search), null);
  }
  assert.equal(readingMedalTarget([card('learning'), card('community'), card('memento')], `?medal=${id}`), null);
});
