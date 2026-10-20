export const ROUTER_ARTICLE_KEY = '2026-10-15-lora-routing-json-reliability';

const groupKey = article => article.translationKey || article.id;
const published = item => item?.status === 'published';
const dateValue = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';

export function articlePublishedAt(article) {
  return dateValue(article?.publishedAt) || dateValue(article?.id?.slice(0, 10));
}

export function sortProjects(projects) {
  return projects.filter(published).map((project, position) => ({ project, position }))
    .sort((a, b) => {
      const aDate = dateValue(a.project.updatedAt) || dateValue(a.project.publishedAt);
      const bDate = dateValue(b.project.updatedAt) || dateValue(b.project.publishedAt);
      return bDate.localeCompare(aDate) || a.position - b.position;
    }).map(item => item.project);
}

export function filterPublishedContent(data) {
  return {
    ...data,
    articles: (data.articles || []).filter(published)
      .sort((a, b) => articlePublishedAt(b).localeCompare(articlePublishedAt(a)) || a.id.localeCompare(b.id)),
    projects: sortProjects(data.projects || []),
    tools: (data.tools || []).filter(published),
    collection: (data.collection || []).filter(published),
  };
}

export function findArticleTranslation(articles, article, language) {
  const source = typeof article === 'string' ? articles.find(item => item.id === article) : article;
  if (!source || !published(source)) return null;
  return articles.find(item => published(item) && groupKey(item) === groupKey(source) && item.lang === language) || null;
}

export function selectArticlesForLanguage(articles, language) {
  const groups = new Map();
  for (const article of articles.filter(published)) {
    const key = groupKey(article);
    const group = groups.get(key) || [];
    group.push(article);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    article: group.find(article => article.lang === language) || group.find(article => article.lang === 'zh') || group[0],
    firstPublished: group.map(articlePublishedAt).filter(Boolean).sort()[0] || '',
  })).sort((a, b) => b.firstPublished.localeCompare(a.firstPublished) || a.key.localeCompare(b.key))
    .map(group => group.article);
}

export function articleForProject(articles, project, language) {
  if (!project?.article) return null;
  const source = articles.find(article => published(article) && (article.id === project.article || groupKey(article) === project.article));
  return findArticleTranslation(articles, source, language) || source || null;
}

export function selectFeaturedProjects(projects, limit = 3) {
  return projects.filter(project => published(project) && Number.isFinite(project.featuredRank))
    .sort((a, b) => a.featuredRank - b.featuredRank || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

export function availableTools(data) {
  const standalone = (data.tools || []).filter(tool => published(tool) && ['web', 'install'].includes(tool.availability));
  const fromProjects = sortProjects(data.projects || []).filter(project => ['web', 'install'].includes(project.tool?.availability))
    .map(project => ({
      id: project.id, title: project.title, zh: project.zh, en: project.en,
      url: project.tool.url || project.url, tag: project.tag,
      availability: project.tool.availability, projectId: project.id,
    }));
  return [...new Map([...standalone, ...fromProjects].map(tool => [tool.id, tool])).values()];
}

export function articleTopics(articles) {
  return [...new Set(articles.filter(published).flatMap(article => article.topics || []))];
}

export function topicLabel(topic, language, catalog = {}) {
  return catalog[topic]?.[language] || catalog[topic]?.zh || topic;
}

export function isRouterArticle(article) {
  return !!article && (groupKey(article) === ROUTER_ARTICLE_KEY ||
    article.id === `${ROUTER_ARTICLE_KEY}-zh` || article.id === `${ROUTER_ARTICLE_KEY}-en`);
}

export function projectMonogram(project) {
  return Array.from(String(project?.title || '').trim())[0]?.toLocaleUpperCase() || '?';
}

// A failed lazy image may remain in the browser's image cache across renders.
// Retry only this site's collection artwork, once; leave a second failure visible.
export function retryCollectionImage(image) {
  const source = image.getAttribute('src') || '';
  if (image.dataset.retried || !/^\/static\/assets\/collection\/[a-f0-9]{20}-light\.svg$/.test(source)) return false;
  image.dataset.retried = 'true';
  image.src = source + '?retry=1';
  return true;
}
