"""Readable HTML and metadata from the same public bundle as the browser."""
import html,json,re
from pathlib import Path
from urllib.parse import quote
E=lambda x:html.escape(str(x),quote=True)

def render(root,path,data,lang='zh'):
 page=Path(root,'index.html').read_text();title='十方空烬 · Ember';summary='Build. Break. Rebuild.';canonical='https://widechaos.cn'+path;alternates='';status=200
 nav='<nav aria-label="主导航">'+''.join(f'<a href="{u}">{t}</a> ' for u,t in [('/','十方空烬'),('/projects','项目'),('/blog','十方志'),('/radar','开源雷达'),('/tools','工具'),('/about','关于')])+'</nav>'
 def listing(items,kind):
  return ''.join(f'<section><h2><a href="{E("/blog/"+i["id"] if kind=="article" else "/projects/"+i["id"])}">{E(i["title"])}</a></h2><p>{E(i.get("summary") or i.get(lang) or "")}</p></section>' for i in items)
 if path.startswith('/blog/'):
  article=next((a for a in data['articles'] if path=='/blog/'+a['id']),None)
  if article:
   lang=article['lang'];title=article['title'];summary=article['summary'];canonical=article['url']
   paired=[a for a in data['articles'] if a['translationKey']==article['translationKey']]
   alternates=''.join(f'<link rel="alternate" hreflang="{a["lang"]}" href="{E(a["url"])}">' for a in paired)
   back='/radar' if article['id'].startswith('oss-radar-') else '/blog'
   back_title='开源雷达' if back=='/radar' else '十方志'
   main=f'<div class="article-page"><div class="article-top"><a href="{back}">{back_title}</a> · <time datetime="{article["publishedAt"]}">{article["publishedAt"]}</time></div><header class="article-heading"><h1>{E(title)}</h1></header><div class="article-layout"><article class="article-body" lang="{lang}">{article["body"]}</article></div></div>'
  else:status=404;main='<h1>文章不存在或已撤下</h1>'
 elif path=='/radar':
  title='开源雷达 · 十方空烬' if lang=='zh' else 'Open-source radar · Ember';summary='每日开源项目精选与往期归档。' if lang=='zh' else 'Daily open-source project picks and past issues.'
  groups={}
  for a in data['articles']:
   if a['id'].startswith('oss-radar-'):
    key=a.get('translationKey') or a['id'];current=groups.get(key)
    if current is None or (current['lang']!=lang and a['lang']==lang):groups[key]=a
  issues=sorted(groups.values(),key=lambda a:a['publishedAt'],reverse=True)
  main='<h1>'+('开源雷达' if lang=='zh' else 'Open-source radar')+'</h1><p>'+summary+'</p>'+listing(issues,'article')
 elif path in ('/','/blog'):
  if path=='/blog':title='十方志 · 十方空烬';summary='一个人的公开笔记。谋、谈、形、动、生活、造物，如九畦花木，各生其姿。'
  else:summary='十方空烬 · Ember 的个人站：项目、文字与持续的探索。Build. Break. Rebuild.'
  main=('<h1>十方空烬 · Ember</h1><p>Build. Break. Rebuild.</p>' if path=='/' else '<h1>十方志</h1>')+listing([a for a in data['articles'] if not a['id'].startswith('oss-radar-')],'article')
  if path=='/':
   radar=sorted([a for a in data['articles'] if a['id'].startswith('oss-radar-')],key=lambda a:a['publishedAt'],reverse=True)
   if radar:
    key=radar[0].get('translationKey') or radar[0]['id']
    latest=next((a for a in radar if (a.get('translationKey') or a['id'])==key and a['lang']==lang),radar[0])
    main+='<aside aria-label="开源雷达"><h2><a href="/radar">开源雷达</a></h2><p>'+E(latest['title'])+'</p></aside>'
   main+='<h2>项目</h2>'+listing(data['projects'],'project')
 elif path=='/projects':title='项目 · 十方空烬';summary='实验、工具与设计中的项目：模型实验、桌面工具和个人系统。';main='<h1>项目</h1>'+listing(data['projects'],'project')
 elif path.startswith('/projects/'):
  p=next((p for p in data['projects'] if path=='/projects/'+p['id']),None)
  if p:
   title=p['title']+' · 十方空烬';summary=p.get(lang) or summary;main=f'<h1>{E(title)}</h1><p>{E(p.get(lang,""))}</p><a href="{E(p["url"])}">源码与资料</a>'
  else:status=404;main='<h1>项目不存在</h1>'
 elif path=='/tools':title='工具 · 十方空烬';summary='可以直接打开或安装使用的小工具。';main='<h1>工具</h1>'+''.join(f'<section><h2><a href="{E(p.get("tool",{}).get("url") or p["url"])}">{E(p["title"])}</a></h2><p>{E(p.get(lang,""))}</p></section>' for p in data['projects'] if p.get('tool'))
 elif path in ('/about','/collection'):
  title='关于我 · 十方空烬' if lang=='zh' else 'About · Ember'
  copy_path=Path(root)/'static'/'about-copy.js'
  if not copy_path.exists():copy_path=Path(root).parent/'static'/'about-copy.js'
  about_copy=json.loads(copy_path.read_text().removeprefix('export const ABOUT_COPY = ').strip().removesuffix(';'))
  prose=about_copy['en' if lang=='en' else 'zh']
  labels=['科学家','文豪','艺术家','战术大师','侠','光'] if lang=='zh' else ['Scientist','Wordsmith','Artist','Master Tactician','Knight-errant','Light']
  badges=''.join(f'<a href="{E(i["url"] if not i["url"].startswith("assets/") else "/"+i["url"])}"><img src="{E(i["image"])}" alt="{E(i["title"])}" loading="lazy"><span>{E(i["title"])}</span></a>' for i in sorted(data['collection'],key=lambda item: {'learning':0,'community':1,'reading':2}.get(item['kind'],3)))
  main='<div class="page-wrap about-page"><h1 class="sr-only">'+E(title)+'</h1><p>Build. Break. Rebuild.</p><div class="about-identity"><div class="portrait-wrap"><img src="/static/avatar.png" alt="十方空烬 · Ember" width="480" height="480"><span>RENCHAO WU / EMBER</span></div><div class="identity-block"><div class="large-tags">'+''.join('<span>'+E(x)+'</span>' for x in labels)+'</div><p class="identity-signature">Per aspera ad astra.</p></div></div><div class="about-intro-copy">'+prose+'</div><a href="/now">'+('现在关注什么' if lang=='zh' else 'What I’m exploring now')+'</a><section class="collection" id="collection"><h2>'+('收藏与学习' if lang=='zh' else 'Collection')+'</h2><div class="badge-grid">'+badges+'</div></section></div>'
 elif path=='/now':
  title='现在 · 十方空烬' if lang=='zh' else 'Now · Ember'
  main='<div class="page-wrap now-page"><h1>'+E(title)+'</h1><p class="now-statement">AI scientist,<br>full stack<span>.</span></p><div class="now-direction"><span>From research to product, end to end.</span><span>Build intelligence. Test everything.</span></div>'+listing([p for p in data['projects'] if p['id'] in ('router','heartiger')],'project')+'</div>'
 else:status=404;main='<h1>页面不存在</h1>'
 page=re.sub(r'<title>.*?</title>',f'<title>{E(title)}</title>',page,flags=re.S)
 page=re.sub(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>',f'<meta name="description" content="{E(summary)}">',page)
 kind='article' if path.startswith('/blog/') and status==200 else 'website'
 card=''.join(f'<meta property="{k}" content="{E(v)}">' for k,v in [('og:site_name','十方空烬 · Ember'),('og:type',kind),('og:title',title),('og:description',summary),('og:url',canonical),('og:image','https://widechaos.cn/static/og-card.jpg'),('og:image:width','1200'),('og:image:height','630'),('og:locale','en_US' if lang=='en' else 'zh_CN')])+f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://widechaos.cn/static/og-card.jpg">'
 # The browser renders from this copy instead of waiting for a second request.
 inline='<script id="site-data" type="application/json">'+json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')+'</script>'
 page=page.replace('</head>',f'<link rel="canonical" href="{E(canonical)}">{alternates}{card}{inline}</head>')
 page=page.replace('lang="zh-CN"',f'lang="{lang}"',1).replace('<header id="header"></header>',f'<header id="header">{nav}</header>').replace('<main id="main" tabindex="-1"></main>',f'<main id="main" tabindex="-1">{main}</main>').replace('<footer id="footer"></footer>','<footer id="footer">© 十方空烬 · Ember <a href="/blog/rss.xml">RSS</a></footer>')
 page=re.sub(r'<noscript\b.*?</noscript\s*>','',page,flags=re.S)
 return page,status
