import { TIANSHU_MANUAL } from './tianshu-manual.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const manualPages = lang => TIANSHU_MANUAL.pages.map(p => ({...p, ...(lang === 'en' ? p.en : {})}));
export const manualHref = (slug = '', lang = 'zh') => `/docs/tianshu${slug ? '/' + slug : ''}?lang=${lang === 'en' ? 'en' : 'zh'}`;
export function manualPage(path, lang = 'zh') {
  const english = lang === 'en', t = (zh, en) => english ? en : zh;
  const href = slug => manualHref(slug, lang);
  const slug = path.split('/')[3] || '';
  const pages = manualPages(lang), page = pages.find(p => p.slug === slug);
  const homeTitle = t('天枢使用文档', 'Shuvia user guide');
  const back = t('返回文档首页', 'Back to guide home');
  const title = page?.title || (slug ? t('没有这篇使用文档', 'Guide page not found') : homeTitle);
  const nav = pages.map((p, i) => `<a href="${href(p.slug)}" ${p === page ? 'aria-current="page"' : ''}><small>${String(i + 1).padStart(2,'0')}</small>${esc(p.title)}</a>`).join('');
  const sectionIds = page ? [...page.html.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]) : [];
  const content = page?.html.replace(/href="\/docs\/tianshu\/([a-z-]+)"/g, (_, target) => `href="${href(target)}"`);
  let body = page ? `<article class="manual-article" lang="${english ? 'en' : 'zh-CN'}"><header><p class="eyebrow">${t('天枢 / 使用文档', 'SHUVIA / USER GUIDE')}</p><h1>${esc(page.title)}</h1><p class="manual-lead">${esc(page.summary)}</p><small>${t('界面核对：','Interface checked: ')}${TIANSHU_MANUAL.updated} · ${t('桌面版','Desktop app')}</small></header><nav class="manual-contents" aria-label="${t('本页目录','On this page')}">${page.headings.map((h,i) => `<a href="#${sectionIds[i]}">${esc(h)}</a>`).join('')}</nav>${content}</article>` : slug ? `<h1>${title}</h1><a href="${href()}">${back}</a>` : `<header><p class="eyebrow">${t('天枢 / 使用文档', 'SHUVIA / USER GUIDE')}</p><h1>${homeTitle}</h1><p class="manual-lead">${t('从第一次打开，到项目协作、阅读批注和知识整理。','From your first launch to project collaboration, reading annotations and knowledge organization.')}</p><p>${t('按页面、功能与实际操作组织。先从快速开始完成一个小任务，再按需查阅。','Organized by page, feature and practical steps. Complete one small task with Quick start, then look up what you need.')}</p><small>${t('界面核对：','Interface checked: ')}${TIANSHU_MANUAL.updated} · ${t('真实界面截图，隔离示例数据','Actual app screenshots with isolated sample data')}</small></header><form class="manual-search" role="search"><label for="manual-query">${t('查找功能或操作','Find a feature or action')}</label><input id="manual-query" name="q" type="search" placeholder="${t('如：批注、模型、归档、回退','Try: annotations, models, archive, revert')}" autocomplete="off"><button type="submit">${t('搜索','Search')}</button></form><p id="manual-count" role="status"></p><div class="manual-cards">${pages.map((p,i) => `<a data-manual-page="${p.slug}" href="${href(p.slug)}"><small>${String(i+1).padStart(2,'0')}</small><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p><span>${t('阅读','Read')} →</span></a>`).join('')}</div>`;
  if (page) {
    const index=pages.indexOf(page), prev=pages[index-1], next=pages[index+1];
    body += `<nav class="manual-paging" aria-label="${t('文档翻页','Guide pages')}">${prev ? `<a href="${href(prev.slug)}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${href(next.slug)}">${esc(next.title)} →</a>` : `<a href="${href()}">${back}</a>`}</nav>`;
  }
  return `<div class="page-wrap manual-page" data-manual-lang="${english ? 'en' : 'zh'}"><a class="back-link" href="${href()}">← ${homeTitle}</a>${english ? '<p class="manual-language" lang="en">Screenshots show Shuvia’s English interface with isolated sample data.</p>' : ''}<div class="manual-layout"><aside><details open><summary>${t('全部章节','All chapters')}</summary><nav aria-label="${t('天枢文档章节','Shuvia guide chapters')}"><a href="${href()}" ${!slug ? 'aria-current="page"' : ''}>${t('文档首页','Guide home')}</a>${nav}</nav></details></aside><div class="manual-main" aria-label="${esc(title)}">${body}</div></div></div>`;
}
export function mountManual(root) {
  if (matchMedia('(max-width: 700px)').matches) root.querySelector('.manual-layout > aside details')?.removeAttribute('open');
  const form = root.querySelector('.manual-search');
  if (!form) return () => {};
  const lang = root.querySelector('[data-manual-lang]').dataset.manualLang;
  const pages = manualPages(lang);
  const field = form.querySelector('input'), count = root.querySelector('#manual-count');
  const search = event => {
    event?.preventDefault();
    const q=field.value.trim().toLocaleLowerCase();
    let found=0;
    for (const node of root.querySelectorAll('[data-manual-page]')) {
      const p=pages.find(p => p.slug === node.dataset.manualPage);
      const text=(p.title+' '+p.summary+' '+p.html.replace(/<[^>]*>/g,' ')).toLocaleLowerCase();
      node.hidden=!!q && !text.includes(q);
      if (!node.hidden) found++;
    }
    count.textContent=lang === 'en' ? (found ? `${found} ${found === 1 ? 'guide' : 'guides'}` : 'No matching guides. Try a shorter keyword.') : (found ? `${found} 篇文档` : '没有匹配的文档，试试更短的关键词。');
  };
  field.value=new URLSearchParams(location.search).get('q') || '';
  search();
  form.addEventListener('submit',search);
  field.addEventListener('input',search);
  return () => { form.removeEventListener('submit',search); field.removeEventListener('input',search); };
}
