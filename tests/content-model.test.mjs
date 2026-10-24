import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  selectHomeContent, filterPublishedContent, selectArticlesForLanguage, findArticleTranslation,
  selectFeaturedProjects, availableTools, articleForProject, articlePublishedAt,
  articleTopics, topicLabel, retryCollectionImage,
} from '../static/content-model.js';

const source = JSON.parse(await readFile(new URL('../examples/public-content.json', import.meta.url), 'utf8'));
const article = (id, lang, publishedAt, extra = {}) => ({ id, lang, publishedAt, translationKey: 'new-essay', status: 'published', ...extra });

test('a new bilingual article is one directory entry in the requested language', () => {
  const entries = [...source.articles,
    article('2026-10-16-new-essay-en', 'en', '2026-10-16'),
    article('2026-10-16-new-essay-zh', 'zh', '2026-10-16')];
  const zh = selectArticlesForLanguage(entries, 'zh');
  const en = selectArticlesForLanguage(entries, 'en');
  assert.equal(zh.length, 4);
  assert.equal(zh[0].lang, 'zh');
  assert.equal(en[0].lang, 'en');
  assert.equal(findArticleTranslation(entries, zh[0], 'en').id, en[0].id);
});

test('draft versions never appear as translations, related content or in the public data', () => {
  const entries = [article('2026-10-16-new-essay-zh', 'zh', '2026-10-16'), article('private-draft-en', 'en', '2026-10-16', { status: 'draft' })];
  assert.equal(findArticleTranslation(entries, entries[0], 'en'), null);
  assert.equal(selectArticlesForLanguage(entries, 'en')[0].lang, 'zh');
  assert.equal(articleForProject(entries, { article: 'private-draft-en' }, 'en'), null);
  const filtered = filterPublishedContent({ articles: entries, projects: [{ id: 'secret', status: 'draft' }], tools: [{ status: 'draft' }], collection: [{ status: 'draft' }] });
  assert.equal(filtered.articles.length, 1);
  assert.equal(filtered.projects.length + filtered.tools.length + filtered.collection.length, 0);
});

test('adding a translation does not turn an old article into a newly published one', () => {
  const entries = [
    article('older-zh', 'zh', '2026-01-01', { translationKey: 'older' }),
    article('older-en', 'en', '2026-10-16', { translationKey: 'older' }),
    article('recent-zh', 'zh', '2026-10-15', { translationKey: 'recent' }),
  ];
  assert.deepEqual(selectArticlesForLanguage(entries, 'zh').map(item => item.translationKey), ['recent', 'older']);
  assert.deepEqual(selectArticlesForLanguage(entries, 'en').map(item => item.translationKey), ['recent', 'older']);
  assert.equal(articlePublishedAt(entries[0]), '2026-01-01');
  assert.equal(articlePublishedAt({ id: '2026-09-12-old-slug' }), '2026-09-12');
  assert.equal(articlePublishedAt({ id: 'undated' }), '');
});

test('new published projects enter the catalog without changing curated features', () => {
  const next = { id: 'new-work', title: 'New work', status: 'published', publishedAt: '2026-10-16' };
  const projects = filterPublishedContent({ projects: [...source.projects, next] }).projects;
  assert.equal(projects[0].id, 'new-work');
  assert.deepEqual(selectFeaturedProjects(projects).map(item => item.id), ['router', 'bulletin', 'obsidian']);
  assert.ok(projects.some(item => item.id === 'heartiger'));
  assert.equal(source.projects.find(item => item.id === 'heartiger').publishedAt, undefined);
});

test('tools are derived from public project data and distinguish immediate use from installation', () => {
  const tools = availableTools(source);
  assert.equal(tools.length, 4);
  assert.equal(tools.find(item => item.id === 'markdown-converter').availability, 'web');
  assert.equal(tools.find(item => item.id === 'navigator').availability, 'install');
  assert.equal(tools.find(item => item.id === 'navigator').projectId, 'navigator');
  assert.ok(!tools.some(item => item.id === 'heartiger'));
});

test('topics come from actual articles and labels come from content metadata', () => {
  assert.deepEqual(articleTopics(source.articles), ['model-evaluation', 'systems', 'retrieval']);
  assert.equal(topicLabel('systems', 'en', source.topics), 'Systems');
  assert.equal(topicLabel('new-topic', 'en', source.topics), 'new-topic');
});


test('failed collection artwork retries once without changing its original image or looping', () => {
  const original = '/static/assets/collection/eae71bb2386bd05ca28e-light.svg';
  const image = { dataset: {}, src: original, getAttribute() { return this.src; } };
  assert.equal(retryCollectionImage(image), true);
  assert.equal(image.src, original + '?retry=1');
  assert.equal(retryCollectionImage(image), false);
  assert.equal(image.src, original + '?retry=1');
  for (const source of ['https://other.example/a.svg', '/static/avatar.png', '/static/assets/collection/../private.svg']) {
    const other = { dataset: {}, src: source, getAttribute() { return this.src; } };
    assert.equal(retryCollectionImage(other), false);
    assert.equal(other.src, source);
  }
});

test('daily radar never crowds essays out of the homepage, in either language', () => {
  const essays = [1,2,3,4].flatMap(day => ['zh','en'].map(lang => article(`essay-${day}-${lang}`,lang,`2026-10-0${day}`,{translationKey:`essay-${day}`})));
  const radar = [11,12,13,14,15].flatMap(day => ['zh','en'].map(lang => article(`oss-radar-${day}-${lang}`,lang,`2026-10-${day}`,{translationKey:`oss-radar-${day}`})));
  const draft = article('oss-radar-draft-zh','zh','2026-10-20',{status:'draft'});
  for (const language of ['zh','en']) {
    const home = selectHomeContent([...radar,...essays,draft],language);
    assert.deepEqual(home.writing.map(a => a.id),[4,3,2].map(n => `essay-${n}-${language}`));
    assert.equal(home.radar.id,`oss-radar-15-${language}`);
  }
  assert.deepEqual(selectHomeContent(radar,'zh').writing,[]);
  assert.equal(selectHomeContent(essays,'zh').radar,null);
});
