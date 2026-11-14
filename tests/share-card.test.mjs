import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SHARE_CARD_COUNT, chooseShareCard, nextShareLink} from '../static/share-card.js';
import {SHARE_CARD_POOL as pool} from '../static/share-card-pool.js';

test('approved pool contains all thirty artworks and seventy-three distinct texts', () => {
  assert.equal(pool.artworks.length, 30);
  assert.equal(pool.quotes.length, 73);
  assert.equal(new Set(pool.quotes.map(x => x.text)).size, 73);
  assert.equal(pool.quotes.filter(x => x.id.startsWith('m')).length, 19);
  assert.equal(pool.quotes.filter(x => x.id.startsWith('c')).length, 40);
  assert.equal(SHARE_CARD_COUNT, 2190);
  assert.equal(chooseShareCard([], () => 0), 'v1-0000');
  assert.equal(chooseShareCard([], () => 1 - Number.EPSILON), 'v1-2189');
});
test('random link excludes the recent 128 combinations even with a constant random source', () => {
  const memory = new Map();
  const storage = {getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value)};
  const recent = [];
  for (let i = 0; i < 350; i++) {
    const url = nextShareLink(storage, () => 0);
    assert(!recent.slice(-128).includes(url));
    recent.push(url);
  }
  assert.equal(JSON.parse([...memory.values()][0]).length, 128);
});
test('storage refusal and malformed history still produce valid share links', () => {
  for (const storage of [{getItem() {throw Error();}, setItem() {throw Error();}}, {getItem: () => '{}', setItem() {}}]) {
    assert.equal(nextShareLink(storage, () => .5), 'https://widechaos.cn/?card=v1-1095');
  }
});
