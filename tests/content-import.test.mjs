import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPublicSnapshot, mergeContentBundle, validateContent } from '../scripts/content-schema.mjs';

const source = JSON.parse(await readFile(new URL('../examples/public-content.json', import.meta.url), 'utf8'));
const importer = new URL('../scripts/import-content.mjs', import.meta.url).pathname;

test('the checked-in public content is valid', () => assert.deepEqual(validateContent(source), []));

test('public export omits unpublished body and internal metadata', () => {
  const bundle = structuredClone(source);
  bundle.articles.push({ id: 'secret-draft', status: 'draft', title: 'PRIVATE-DRAFT', body: 'SECRET-BODY' });
  bundle.projects.push({ id: 'secret-project', status: 'draft', internalNotes: 'SECRET-NOTES' });
  bundle.articles[0].internalNotes = 'EDITORIAL-NOTES';
  bundle.internalConfig = 'SECRET-CONFIG';
  bundle.topics['draft-topic'] = { zh: 'SECRET-TOPIC', en: 'SECRET-TOPIC' };
  bundle.projectKinds['draft-kind'] = { zh: 'SECRET-KIND', en: 'SECRET-KIND' };
  const exported = buildPublicSnapshot(bundle);
  assert.deepEqual(validateContent(exported), []);
  assert.doesNotMatch(JSON.stringify(exported), /PRIVATE-DRAFT|SECRET-|EDITORIAL-NOTES|internalNotes|internalConfig/);
  assert.deepEqual(exported.articles.map(item => item.body).sort(), source.articles.map(item => item.body).sort());
});

test('schema catches invalid dates, duplicate translations and broken project associations', () => {
  const broken = structuredClone(source);
  broken.articles[0].publishedAt = '2026-02-30';
  broken.articles.push({ ...broken.articles[0], id: 'duplicate-translation' });
  broken.projects[0].article = 'missing-article';
  const errors = validateContent(broken).join('\n');
  assert.match(errors, /real YYYY-MM-DD/);
  assert.match(errors, /more than one en/);
  assert.match(errors, /published article/);
});

test('an invalid import leaves the existing preview file untouched', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'widechaos-content-'));
  try {
    const input = join(temp, 'source.json'), output = join(temp, 'public.json');
    const invalid = structuredClone(source);
    invalid.articles[0].publishedAt = 'not-a-date';
    await writeFile(input, JSON.stringify(invalid));
    await writeFile(output, 'KEEP EXISTING CONTENT');
    assert.throws(() => execFileSync(process.execPath, [importer, '--source', input, '--output', output], { stdio: 'pipe' }));
    assert.equal(await readFile(output, 'utf8'), 'KEEP EXISTING CONTENT');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('CLI dry-run writes nothing; import creates a public snapshot without draft bytes', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'widechaos-content-'));
  try {
    const input = join(temp, 'source.json'), output = join(temp, 'public.json');
    const bundle = structuredClone(source);
    bundle.articles.push({ status: 'draft', body: 'UNPUBLISHED-BODY' });
    await writeFile(input, JSON.stringify(bundle));
    execFileSync(process.execPath, [importer, '--source', input, '--output', output, '--dry-run']);
    await assert.rejects(readFile(output));
    execFileSync(process.execPath, [importer, '--source', input, '--output', output]);
    const publicText = await readFile(output, 'utf8');
    assert.doesNotMatch(publicText, /UNPUBLISHED-BODY/);
    assert.deepEqual(validateContent(JSON.parse(publicText)), []);
    assert.match(await readFile(input, 'utf8'), /UNPUBLISHED-BODY/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});


test('missing publication states are rejected instead of silently erasing content', () => {
  const bundle = structuredClone(source);
  delete bundle.articles[0].status;
  assert.throws(() => buildPublicSnapshot(bundle), /explicit published, draft or archived/);
});


test('existing discussion links are preserved, and non-HTTPS links are rejected', () => {
  const bundle = structuredClone(source);
  bundle.articles[0].discussionUrl = 'https://github.com/example/project/discussions/1';
  assert.equal(buildPublicSnapshot(bundle).articles.find(item => item.id === bundle.articles[0].id).discussionUrl, bundle.articles[0].discussionUrl);
  bundle.articles[0].discussionUrl = 'javascript:alert(1)';
  assert.match(validateContent(bundle).join('\n'), /discussionUrl.*HTTPS/);
});


test('a merged bilingual pair preserves the existing articles and projects', () => {
  const template = source.articles[0];
  const patch = { articles: ['zh', 'en'].map(lang => ({ ...template, id: `2026-10-16-new-pair-${lang}`, translationKey: 'new-pair', lang, publishedAt: '2026-10-16' })) };
  const result = buildPublicSnapshot(mergeContentBundle(source, patch));
  assert.deepEqual(validateContent(result), []);
  assert.equal(result.articles.length, source.articles.length + 2);
  for (const old of source.articles) assert.deepEqual(result.articles.find(item => item.id === old.id), old);
  assert.deepEqual(result.projects, source.projects);
});

test('a single-version patch preserves its counterpart, metadata and first publication date', () => {
  const edited = source.articles[0];
  const result = buildPublicSnapshot(mergeContentBundle(source, { articles: [{ id: edited.id, status: 'published', summary: 'Updated summary', updatedAt: '2026-10-16' }] }));
  const after = result.articles.find(item => item.id === edited.id);
  assert.equal(after.summary, 'Updated summary');
  assert.equal(after.publishedAt, edited.publishedAt);
  assert.equal(after.body, edited.body);
  assert.deepEqual(result.articles.find(item => item.id === source.articles[1].id), source.articles[1]);
});

test('explicit unpublishing removes only the supplied id; catalogs and collections merge', () => {
  const target = source.articles[0];
  const result = buildPublicSnapshot(mergeContentBundle(source, {
    articles: [{ id: target.id, status: 'draft' }],
    topics: { systems: { en: 'Systems updated' } },
    collection: [{ ...source.collection[0], title: 'Updated title' }],
  }));
  assert.equal(result.articles.length, source.articles.length - 1);
  assert.ok(!result.articles.some(item => item.id === target.id));
  assert.ok(result.articles.some(item => item.id === source.articles[1].id));
  assert.equal(result.topics.systems.zh, source.topics.systems.zh);
  assert.equal(result.topics.systems.en, 'Systems updated');
  assert.equal(result.collection.find(item => item.url === source.collection[0].url && item.image === source.collection[0].image).title, 'Updated title');
  assert.deepEqual(validateContent(result), []);
});

test('merge validation failure leaves the existing snapshot byte-for-byte intact', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'widechaos-content-'));
  try {
    const input = join(temp, 'update.json'), output = join(temp, 'public.json');
    const original = JSON.stringify(source);
    await writeFile(output, original);
    await writeFile(input, JSON.stringify({ articles: [{ id: source.articles[0].id, status: 'published', publishedAt: 'invalid' }] }));
    assert.throws(() => execFileSync(process.execPath, [importer, '--merge', '--source', input, '--output', output], { stdio: 'pipe' }));
    assert.equal(await readFile(output, 'utf8'), original);
    await writeFile(input, JSON.stringify({ articles: [{ id: source.articles[0].id, status: 'published', summary: 'CLI updated summary' }] }));
    execFileSync(process.execPath, [importer, '--merge', '--source', input, '--output', output]);
    const result = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(result.articles.find(item => item.id === source.articles[0].id).summary, 'CLI updated summary');
    assert.deepEqual(result.articles.find(item => item.id === source.articles[1].id), source.articles[1]);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('import sources inside the preview tree, including linked paths, are rejected', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'widechaos-content-'));
  try {
    const localContent = new URL('../examples/public-content.json', import.meta.url).pathname;
    const linked = join(temp, 'linked.json');
    await symlink(localContent, linked);
    for (const input of [localContent, linked]) {
      assert.throws(() => execFileSync(process.execPath, [importer, '--source', input, '--output', join(temp, 'public.json'), '--dry-run'], { stdio: 'pipe' }), /outside the preview code directory/);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
