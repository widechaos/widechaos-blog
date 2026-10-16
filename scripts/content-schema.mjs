import { filterPublishedContent } from '../static/content-model.js';

const fields = {
  articles: ['id', 'title', 'url', 'lang', 'translationKey', 'body', 'summary', 'publishedAt', 'updatedAt', 'topics', 'status', 'discussionUrl'],
  projects: ['id', 'title', 'tag', 'zh', 'en', 'url', 'kind', 'article', 'status', 'publishedAt', 'updatedAt', 'featuredRank', 'demo', 'topics', 'tool'],
  tools: ['id', 'title', 'titleZh', 'titleEn', 'zh', 'en', 'url', 'availability', 'tag', 'status'],
  collection: ['title', 'url', 'image', 'kind', 'status'],
};
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const absoluteUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
};
const text = value => typeof value === 'string' && value.trim().length > 0;
const records = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const safeLocalPath = value => typeof value === 'string' && /^(?:\/static\/|assets\/)[a-zA-Z0-9_./%-]+$/.test(value) && !value.includes('..');

export function mergeContentBundle(base, patch) {
  if (!patch || Array.isArray(patch) || typeof patch !== 'object') throw new Error('Merge source must be a content object.');
  const merged = { ...base };
  for (const section of Object.keys(fields)) {
    if (patch[section] === undefined) continue;
    if (!Array.isArray(patch[section])) throw new Error(`${section} must be an array.`);
    const keyFor = item => section === 'collection' ? `${item.url}|${item.image}` : item.id;
    const entries = new Map((base[section] || []).map(item => [keyFor(item), item]));
    const touched = new Set();
    for (const item of patch[section]) {
      if (!item || !['published', 'draft', 'archived'].includes(item.status)) throw new Error(`${section}: every merged entry requires an explicit published, draft or archived status.`);
      if (section === 'collection' ? !text(item.url) || !text(item.image) : !text(item.id)) throw new Error(`${section}: a merge requires ${section === 'collection' ? 'url and image' : 'id'}.`);
      const key = keyFor(item);
      if (touched.has(key)) throw new Error(`${section}: duplicate merge key ${key}.`);
      touched.add(key);
      entries.set(key, { ...entries.get(key), ...item });
    }
    merged[section] = [...entries.values()];
  }
  for (const section of ['topics', 'projectKinds']) {
    if (patch[section] === undefined) continue;
    if (!patch[section] || Array.isArray(patch[section]) || typeof patch[section] !== 'object') throw new Error(`${section} must be a label dictionary.`);
    merged[section] = { ...base[section] };
    for (const [id, labels] of Object.entries(patch[section])) merged[section][id] = { ...base[section]?.[id], ...labels };
  }
  if (patch.contact !== undefined) merged.contact = { ...base.contact, ...patch.contact };
  return merged;
}

export function buildPublicSnapshot(source) {
  if (!source || Array.isArray(source) || typeof source !== 'object') throw new Error('Source must be a content object.');
  if (!Array.isArray(source.articles) || !Array.isArray(source.projects)) throw new Error('Source must include the complete articles and projects arrays.');
  const result = {};
  for (const [section, keys] of Object.entries(fields)) {
    if (source[section] !== undefined && !Array.isArray(source[section])) throw new Error(`${section} must be an array.`);
    if ((source[section] || []).some(item => !item || !['published', 'draft', 'archived'].includes(item.status))) throw new Error(`${section}: every entry requires an explicit published, draft or archived status.`);
    result[section] = (source[section] || []).filter(item => item?.status === 'published').map(item => {
      const value = pick(item, keys);
      if (value.tool) value.tool = pick(value.tool, ['availability', 'url']);
      return value;
    });
  }
  for (const name of ['topics', 'projectKinds']) {
    const used = new Set(name === 'topics' ? [...result.articles, ...result.projects].flatMap(item => item.topics || []) : result.projects.map(item => item.kind));
    result[name] = Object.fromEntries(Object.entries(source[name] || {}).filter(([id]) => used.has(id)).map(([id, labels]) => [id, pick(labels, ['zh', 'en'])]));
  }
  if (source.contact?.email) result.contact = { email: source.contact.email };
  return filterPublishedContent(result);
}

export function validateContent(data) {
  const errors = [];
  if (!data || Array.isArray(data) || typeof data !== 'object') return ['Content must be an object.'];
  for (const name of ['articles', 'projects', 'tools', 'collection']) {
    if (!Array.isArray(data[name])) { errors.push(`${name} must be an array.`); continue; }
    const ids = new Set();
    data[name].forEach((item, index) => {
      const label = `${name}[${item?.id || index}]`;
      if (!item || typeof item !== 'object') { errors.push(`${label} must be an object.`); return; }
      if (item.status !== 'published') errors.push(`${label}: public snapshots may contain only status=published.`);
      if (!text(item.title)) errors.push(`${label}: title is required.`);
      if (name !== 'collection') {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || '')) errors.push(`${label}: id must be a lowercase URL slug.`);
        if (ids.has(item.id)) errors.push(`${label}: duplicate id.`);
        ids.add(item.id);
        if (!absoluteUrl(item.url)) errors.push(`${label}: url must be a public HTTPS URL without credentials.`);
      }
      for (const field of ['publishedAt', 'updatedAt']) if (item[field] !== undefined && !validDate(item[field])) errors.push(`${label}: ${field} must be a real YYYY-MM-DD date.`);
      if (item.updatedAt && item.publishedAt && item.updatedAt < item.publishedAt) errors.push(`${label}: updatedAt precedes publishedAt.`);
      if (item.topics !== undefined && (!Array.isArray(item.topics) || item.topics.some(topic => !text(topic) || !data.topics?.[topic]))) errors.push(`${label}: topics must reference the topic catalog.`);
      if (name === 'articles') {
        if (!['zh', 'en'].includes(item.lang)) errors.push(`${label}: lang must be zh or en.`);
        if (!text(item.summary) || !text(item.body)) errors.push(`${label}: summary and body are required.`);
        if (!validDate(item.publishedAt)) errors.push(`${label}: publishedAt is required; never infer the current date.`);
        if (!text(item.translationKey)) errors.push(`${label}: translationKey is required.`);
        if (item.discussionUrl !== undefined && !absoluteUrl(item.discussionUrl)) errors.push(`${label}: discussionUrl must be an existing public HTTPS discussion URL.`);
        if (/<\s*(?:script|iframe|object|embed|form|base|meta|link)\b|\son\w+\s*=|(?:javascript|vbscript)\s*:/i.test(item.body || '')) errors.push(`${label}: unexpected executable HTML. Use a trusted rendered article body.`);
      }
      if (name === 'projects') {
        if (!text(item.zh) || !text(item.en)) errors.push(`${label}: both project descriptions are required.`);
        if (!text(item.kind) || !data.projectKinds?.[item.kind]) errors.push(`${label}: kind must reference the projectKinds catalog.`);
        if (item.featuredRank !== undefined && (!Number.isInteger(item.featuredRank) || item.featuredRank < 1)) errors.push(`${label}: featuredRank must be a positive integer.`);
        if (item.demo !== undefined && !['router', 'bulletin', 'obsidian'].includes(item.demo)) errors.push(`${label}: demo must name an implemented demonstration; omit it for a normal project.`);
        if (item.tool && !['web', 'install'].includes(item.tool.availability)) errors.push(`${label}: tool availability must be web or install.`);
        if (item.tool?.url && !absoluteUrl(item.tool.url)) errors.push(`${label}: tool URL must use HTTPS.`);
      }
      if (name === 'collection' && ((!absoluteUrl(item.url) && !safeLocalPath(item.url)) || !safeLocalPath(item.image))) errors.push(`${label}: collection links and image paths must be public HTTPS or local asset paths.`);
      if (name === 'tools' && (!['web', 'install'].includes(item.availability) || !text(item.zh) || !text(item.en))) errors.push(`${label}: tools require web/install availability and both descriptions.`);
    });
  }
  const groups = new Set();
  for (const article of records(data.articles)) {
    const key = `${article.translationKey}|${article.lang}`;
    if (groups.has(key)) errors.push(`articles[${article.id}]: a translation group has more than one ${article.lang} version.`);
    groups.add(key);
  }
  for (const project of records(data.projects)) if (project.article && !records(data.articles).some(article => article.id === project.article || article.translationKey === project.article)) errors.push(`projects[${project.id}]: article must refer to a published article or translation group.`);
  for (const name of ['topics', 'projectKinds']) for (const [id, labels] of Object.entries(data[name] || {})) if (!text(labels?.zh) || !text(labels?.en)) errors.push(`${name}[${id}]: both labels are required.`);
  if (data.contact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.email)) errors.push('contact.email is invalid.');
  return errors;
}
