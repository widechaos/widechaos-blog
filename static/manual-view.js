import { TIANSHU_MANUAL } from './tianshu-manual.js';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function manualPage(path, lang = 'zh') {
  const slug = path.split('/')[3] || '';
  const pages = TIANSHU_MANUAL.pages;
  const page = pages.find(p => p.slug === slug);
  const english = lang === 'en';
  const nav = pages.map((p, i) => `<a href="/docs/tianshu/${p.slug}" ${p === page ? 'aria-current="page"' : ''}><small>${String(i + 1).padStart(2,'0')}</small>${esc(p.title)}</a>`).join('');
  const title = page?.title || (slug ? '没有这篇使用文档' : '天枢使用文档');
  let body = page ? `<article class="manual-article" lang="zh-CN"><header><p class="eyebrow">TIANSHU / USER GUIDE</p><h1>${esc(page.title)}</h1><p class="manual-lead">${esc(page.summary)}</p><small>界面核对：${TIANSHU_MANUAL.updated} · 桌面版</small></header><nav class="manual-contents" aria-label="本页目录">${page.headings.map((h,i) => `<a href="#part-${i+1}">${esc(h)}</a>`).join('')}</nav>${page.html}</article>` : slug ? '<h1>没有这篇使用文档</h1><a href="/docs/tianshu">返回文档首页</a>' : `<header><p class="eyebrow">TIANSHU / USER GUIDE</p><h1>天枢使用文档</h1><p class="manual-lead">从第一次打开，到项目协作、阅读批注和知识整理。</p><p>按页面、功能与实际操作组织。先从快速开始完成一个小任务，再按需查阅。</p><small>界面核对：${TIANSHU_MANUAL.updated} · 真实界面截图，隔离示例数据</small></header><form class="manual-search" role="search"><label for="manual-query">查找功能或操作</label><input id="manual-query" name="q" type="search" placeholder="如：批注、模型、归档、回退" autocomplete="off"><button type="submit">搜索</button></form><p id="manual-count" role="status"></p><div class="manual-cards">${pages.map((p,i) => `<a data-manual-page="${p.slug}" href="/docs/tianshu/${p.slug}"><small>${String(i+1).padStart(2,'0')}</small><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p><span>阅读 →</span></a>`).join('')}</div>`;
  if (page) {
    const index=pages.indexOf(page), prev=pages[index-1], next=pages[index+1];
    body += `<nav class="manual-paging" aria-label="文档翻页">${prev ? `<a href="/docs/tianshu/${prev.slug}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="/docs/tianshu/${next.slug}">${esc(next.title)} →</a>` : '<a href="/docs/tianshu">返回文档首页</a>'}</nav>`;
  }
  return `<div class="page-wrap manual-page"><a class="back-link" href="/docs/tianshu">← 天枢使用文档</a>${english ? '<p class="manual-language" lang="en">This detailed guide is currently available in Chinese. Screenshots show the desktop app with sample data.</p>' : ''}<div class="manual-layout"><aside><details open><summary>全部章节</summary><nav aria-label="天枢文档章节"><a href="/docs/tianshu" ${!slug ? 'aria-current="page"' : ''}>文档首页</a>${nav}</nav></details></aside><div class="manual-main" aria-label="${esc(title)}">${body}</div></div></div>`;
}
export function mountManual(root) {
  if (matchMedia('(max-width: 700px)').matches) root.querySelector('.manual-layout > aside details')?.removeAttribute('open');
  const form = root.querySelector('.manual-search');
  if (!form) return () => {};
  const field = form.querySelector('input');
  const count = root.querySelector('#manual-count');
  const search = event => {
    event?.preventDefault();
    const q=field.value.trim().toLocaleLowerCase();
    let found=0;
    for (const node of root.querySelectorAll('[data-manual-page]')) {
      const p=TIANSHU_MANUAL.pages.find(p => p.slug === node.dataset.manualPage);
      const text=(p.title+' '+p.summary+' '+p.html.replace(/<[^>]*>/g,' ')).toLocaleLowerCase();
      node.hidden=!!q && !text.includes(q);
      if (!node.hidden) found++;
    }
    count.textContent=found ? `${found} 篇文档` : '没有匹配的文档，试试更短的关键词。';
  };
  field.value=new URLSearchParams(location.search).get('q') || '';
  search();
  form.addEventListener('submit',search);
  field.addEventListener('input',search);
  return () => { form.removeEventListener('submit',search); field.removeEventListener('input',search); };
}
