"""Readable HTML and metadata from the same public bundle as the browser."""
import html,json,re
from pathlib import Path
from urllib.parse import quote
E=lambda x:html.escape(str(x),quote=True)

def render(root,path,data,lang='zh'):
 page=Path(root,'index.html').read_text();title='十方空烬 · Ember';summary='Build. Break. Rebuild.';canonical='https://widechaos.cn'+path;alternates='';status=200
 nav='<nav aria-label="主导航">'+''.join(f'<a href="{u}">{t}</a> ' for u,t in [('/','十方空烬'),('/projects','作品'),('/blog','十方志'),('/tools','工具'),('/about','关于')])+'</nav>'
 def listing(items,kind):
  return ''.join(f'<section><h2><a href="{E("/blog/"+i["id"] if kind=="article" else "/projects/"+i["id"])}">{E(i["title"])}</a></h2><p>{E(i.get("summary") or i.get(lang) or "")}</p></section>' for i in items)
 if path.startswith('/blog/'):
  article=next((a for a in data['articles'] if path=='/blog/'+a['id']),None)
  if article:
   lang=article['lang'];title=article['title'];summary=article['summary'];canonical=article['url']
   paired=[a for a in data['articles'] if a['translationKey']==article['translationKey']]
   alternates=''.join(f'<link rel="alternate" hreflang="{a["lang"]}" href="{E(a["url"])}">' for a in paired)
   main=f'<div class="article-page"><div class="article-top"><a href="/blog">十方志</a> · <time datetime="{article["publishedAt"]}">{article["publishedAt"]}</time></div><header class="article-heading"><h1>{E(title)}</h1></header><div class="article-layout"><article class="article-body" lang="{lang}">{article["body"]}</article></div></div>'
  else:status=404;main='<h1>文章不存在或已撤下</h1>'
 elif path in ('/','/blog'):
  if path=='/blog':title='十方志 · 十方空烬';summary='十方空烬的公开写作：模型实验、系统设计、开源观察与随笔。'
  else:summary='十方空烬 · Ember 的个人站：作品、文字与持续的探索。Build. Break. Rebuild.'
  main=('<h1>十方空烬 · Ember</h1><p>Build. Break. Rebuild.</p>' if path=='/' else '<h1>十方志</h1>')+listing(data['articles'],'article')
  if path=='/':main+='<h2>作品</h2>'+listing(data['projects'],'project')
 elif path=='/projects':title='作品 · 十方空烬';summary='实验、工具与设计中的作品：模型实验、桌面工具和个人系统。';main='<h1>作品</h1>'+listing(data['projects'],'project')
 elif path.startswith('/projects/'):
  p=next((p for p in data['projects'] if path=='/projects/'+p['id']),None)
  if p:
   title=p['title']+' · 十方空烬';summary=p.get(lang) or summary;main=f'<h1>{E(title)}</h1><p>{E(p.get(lang,""))}</p><a href="{E(p["url"])}">源码与资料</a>'
  else:status=404;main='<h1>作品不存在</h1>'
 elif path=='/tools':title='工具 · 十方空烬';summary='可以直接打开或安装使用的小工具。';main='<h1>工具</h1>'+''.join(f'<section><h2><a href="{E(p.get("tool",{}).get("url") or p["url"])}">{E(p["title"])}</a></h2><p>{E(p.get(lang,""))}</p></section>' for p in data['projects'] if p.get('tool'))
 elif path in ('/about','/collection'):
  title='关于我 · 十方空烬' if lang=='zh' else 'About · Ember'
  labels=['科学家','文豪','艺术家','战术大师','侠','光'] if lang=='zh' else ['Scientist','Wordsmith','Artist','Master Tactician','Knight-errant','Light']
  badges=''.join(f'<a href="{E(i["url"] if not i["url"].startswith("assets/") else "/"+i["url"])}"><img src="{E(i["image"])}" alt="{E(i["title"])}" loading="lazy"><span>{E(i["title"])}</span></a>' for i in data['collection'])
  main='<div class="page-wrap about-page"><h1>'+E(title)+'</h1><p>Build. Break. Rebuild.</p><div class="about-identity"><div class="portrait-wrap"><img src="/static/avatar.png" alt="十方空烬 · Ember" width="480" height="480"><span>RENCHAO WU / EMBER</span></div><div class="identity-block"><div class="large-tags">'+''.join('<span>'+E(x)+'</span>' for x in labels)+'</div><p class="identity-signature">Per aspera ad astra.</p></div></div><div class="about-poem"><span>智灯已灭余空烬</span><span>犹自光明照十方</span></div><blockquote class="tolkien">“From the ashes a fire shall be woken,<br>a light from the shadows shall spring.”<cite>— J.R.R. Tolkien</cite></blockquote><section class="about-manifesto"><h2>'+('短期促进生产，<br>长期促进革命。' if lang=='zh' else 'Short-term, fueling production.<br>Long-term, fueling the revolution.')+'</h2></section><a href="/now">'+('现在关注什么' if lang=='zh' else 'What I’m exploring now')+'</a><section class="collection" id="collection"><h2>'+('收藏与学习' if lang=='zh' else 'Collection')+'</h2><div class="badge-grid">'+badges+'</div></section></div>'
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
