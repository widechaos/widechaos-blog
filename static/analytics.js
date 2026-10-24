const PUBLIC_HOSTS = new Set(['widechaos.cn', 'www.widechaos.cn']);
const PAGE_PATH = /^\/(?:$|about\/?$|projects(?:\/[A-Za-z0-9_-]+)?\/?$|tools\/?$|now\/?$|radar\/?$|blog(?:\/[A-Za-z0-9_-]+)?\/?$)/;
export function publicPath(value) {
  try { const path = new URL(value, 'https://widechaos.cn').pathname; return PAGE_PATH.test(path) ? path : null; }
  catch { return null; }
}
export function contentContext(path, articles = [], language = 'zh') {
  const id = path?.startsWith('/blog/') ? path.slice(6) : '';
  const article = articles.find(a => a.id === id && a.status === 'published');
  return {kind: article ? (id.startsWith('oss-radar-') ? 'radar' : 'article') : path?.startsWith('/projects/') ? 'project' : 'page', content:article?.translationKey || article?.id || path, lang:article?.lang || language};
}
export function createAnalytics() {
  let current = null, signature = '', clock = performance.now(), active = 0, lastInput = clock;
  const sent = new Set();
  let impressions = null, observerTimers = [];
  const enabled = () => PUBLIC_HOSTS.has(location.hostname) && navigator.doNotTrack !== '1' && localStorage.getItem('wc-analytics-disabled') !== '1';
  function emit(event, properties = {}, context = current) {
    if (!context || !enabled()) return;
    let referrer=''; try {const ref=new URL(document.referrer); if(!PUBLIC_HOSTS.has(ref.hostname)) referrer=ref.hostname;} catch {}
    const body = {event, ...context, referrer, properties};
    fetch('/site-events', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',keepalive:true}).catch(() => {});
  }
  function once(event, properties) { if (sent.has(event)) return; sent.add(event); emit(event,properties); }
  function tick() {
    const now = performance.now();
    if (current && !document.hidden && now - lastInput < 60000) active += Math.min(now - clock, 5000);
    clock = now;
    if (active >= 30000 && ['article','radar'].includes(current?.kind)) once('engaged_read', {seconds:30});
    const article = document.querySelector('.article-body');
    if (!article || active < 15000) return;
    const box = article.getBoundingClientRect();
    const progress = Math.min(1,Math.max(0,(innerHeight - box.top) / Math.max(1,box.height)));
    if (progress >= .5) once('read_half', {depth:50});
    if (progress >= .9) once('read_deep', {depth:90});
  }
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', () => { clock = performance.now(); });
  for (const name of ['pointerdown','keydown','scroll']) document.addEventListener(name, () => {lastInput=performance.now();}, {passive:true});
  document.addEventListener('click', event => {
    const anchor=event.target.closest('a[href]'); if (!anchor || !current) return;
    let url; try {url=new URL(anchor.href);} catch {return;}
    let action='';
    if (url.protocol === 'mailto:') action='response_click';
    else if (url.pathname === '/blog/rss.xml' && PUBLIC_HOSTS.has(url.hostname)) action='rss_click';
    else if (url.origin === location.origin && url.pathname.startsWith('/blog/') && publicPath(url.pathname)) action='article_open';
    else if (url.origin === location.origin && url.pathname.startsWith('/projects/')) action='project_open';
    else if (url.protocol === 'https:' && url.origin !== location.origin && (anchor.closest('.project-detail,.project-card,.project-visual,.article-body,.radar-project,.project-links') || ['article','radar','project'].includes(current.kind))) action='source_click';
    if (action) emit(action,{destination: url.protocol === 'mailto:' ? 'email' : url.hostname, target: url.origin === location.origin ? publicPath(url.pathname) || '' : ''});
  }, {capture:true});
  return {
    page(articles, language) {
      const path=publicPath(location.pathname);
      if (!path) {current=null; return;}
      const next={path,...contentContext(path,articles,language)};
      const key=path+'|'+next.lang;
      if (key!==signature) {
        signature=key; current=next; active=0; clock=lastInput=performance.now(); sent.clear();
        emit('pageview');
      if (document.referrer) {
        try {const ref=new URL(document.referrer); if(!PUBLIC_HOSTS.has(ref.hostname)) emit('arrival',{source:ref.hostname});} catch {}
      }
      }
      impressions?.disconnect(); observerTimers.forEach(clearTimeout); observerTimers=[];
      if (!enabled() || typeof IntersectionObserver === 'undefined') return;
      const seen=new Set();
      impressions=new IntersectionObserver(entries=>entries.forEach(entry=>{
        if(!entry.isIntersecting || seen.has(entry.target))return;
        const anchor=entry.target; const captured=key;
        observerTimers.push(setTimeout(()=>{
          const rect=anchor.getBoundingClientRect();
          if(signature!==captured || document.hidden || rect.bottom<0 || rect.top>innerHeight || seen.has(anchor)) return;
          seen.add(anchor); impressions.unobserve(anchor);
          const target=publicPath(anchor.href); if(target) emit('article_impression',{target});
        },800));
      }),{threshold:.5});
      document.querySelectorAll('a.article-row,a.latest-story,.latest-side>a,a.radar-archive-row').forEach(a=>impressions.observe(a));
    }
  };
}
