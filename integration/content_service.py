"""Public view of the existing Markdown engine plus its shared site catalog."""
from __future__ import annotations
import copy, hashlib, html, importlib.util, ipaddress, json, os, re, subprocess, threading, time
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import bleach
import markdown
import yaml

try:
 from .site_catalog import ORIGIN,SLUG,FIELDS,FM,EXTENSIONS,digest,public_url,valid_date,validate_catalog
except ImportError:
 from site_catalog import ORIGIN,SLUG,FIELDS,FM,EXTENSIONS,digest,public_url,valid_date,validate_catalog

def clean_body(value):
 tags=set(bleach.sanitizer.ALLOWED_TAGS)|{'p','h1','h2','h3','h4','h5','h6','pre','div','span','hr','br','img','table','thead','tbody','tr','th','td','figure','figcaption','sup','sub','details','summary'}
 attrs={'*':['id','class','lang','title'],'a':['href','title'],'img':['src','alt','width','height','loading'],'th':['colspan','rowspan'],'td':['colspan','rowspan']}
 return bleach.clean(value or '', tags=tags, attributes=attrs, protocols={'https','http','mailto'}, strip=True)

class TextOnly(HTMLParser):
 def __init__(self): super().__init__();self.parts=[]
 def handle_data(self,value): self.parts.append(value)
 def text(self): return re.sub(r'\s+',' ',' '.join(self.parts)).strip()

def plain(value):
 p=TextOnly();p.feed(value or '');return p.text()

def native_posts(blog_dir, render=None):
 result=[]
 for path in sorted(Path(blog_dir).glob('*.md')):
  if not SLUG.fullmatch(path.stem): continue
  raw=path.read_text(encoding='utf-8');match=FM.match(raw)
  if not match: continue
  try: meta=yaml.safe_load(match.group(1))
  except yaml.YAMLError: continue
  if not isinstance(meta,dict) or str(meta.get('status',''))!='published': continue
  body=raw[match.end():]
  rendered=render(path)['html'] if render else markdown.markdown(body,extensions=EXTENSIONS,extension_configs={'codehilite':{'guess_lang':False}})
  result.append({'slug':path.stem,'meta':meta,'html':rendered})
 return result

def bridge_posts():
 raise RuntimeError('Choose --public-web or a local --blog-dir for preview')

def build_bundle(posts,catalog,origin=ORIGIN,categories=None,tag_labels=None):
 validate_catalog(catalog)
 data={section:[] for section in FIELDS}
 for section,fields in FIELDS.items():
  for value in catalog.get(section,[]):
   if value.get('status')!='published': continue
   item={k:copy.deepcopy(value[k]) for k in fields if k in value}
   if 'tool' in item: item['tool']={k:v for k,v in item['tool'].items() if k in ('availability','url')}
   data[section].append(item)
 data['topics']={k:{l:v[l] for l in ('zh','en')} for k,v in catalog.get('topics',{}).items()}
 data['projectKinds']={k:{l:v[l] for l in ('zh','en')} for k,v in catalog.get('projectKinds',{}).items()}
 data['contact']={'email':catalog.get('contact',{}).get('email','ai@widechaos.cn')}
 data['articles']=[];groups=set()
 for post in posts:
  slug=post.get('slug','');meta=post.get('meta',{})
  if not SLUG.fullmatch(slug): raise ValueError('Invalid published article slug')
  # Sources filter before rendering; fixture sources must also be explicit.
  if str(meta.get('status',''))!='published': continue
  metadata=catalog.get('articleMetadata',{}).get(slug,{})
  match=re.fullmatch(r'(.+)-(en|zh)',slug)
  language=str(meta.get('language') or meta.get('lang') or (match.group(2) if match else 'zh'))
  key=str(meta.get('translationKey') or meta.get('translation_key') or metadata.get('translationKey') or (match.group(1) if match else slug))
  if language not in ('zh','en') or not SLUG.fullmatch(key): raise ValueError('Invalid translation identity')
  published=str(meta.get('date',''))
  if not valid_date(published): raise ValueError('Published article requires its original date')
  if (key,language) in groups: raise ValueError('Duplicate article translation')
  groups.add((key,language));body=clean_body(post.get('html',''))
  if not body.strip(): raise ValueError('Empty published article body')
  article={'id':slug,'title':str(meta.get('title') or slug),'url':origin+'/blog/'+slug,'lang':language,'translationKey':key,'body':body,'summary':str(metadata.get('summary') or meta.get('summary') or plain(body)[:160]),'publishedAt':published,'status':'published','topics':list(metadata.get('topics',[]))}
  updated=str(meta.get('updated') or metadata.get('updatedAt') or '')
  if updated:
   if not valid_date(updated) or updated<published: raise ValueError('Invalid article update date')
   article['updatedAt']=updated
  if metadata.get('discussionUrl') and public_url(metadata['discussionUrl']): article['discussionUrl']=metadata['discussionUrl']
  if meta.get('category'): article['category']=str(meta['category'])
  if isinstance(meta.get('tags'),list): article['tags']=[str(t) for t in meta['tags'] if str(t).strip()][:8]
  if meta.get('series'): article['series']=str(meta['series'])
  if any(t not in data['topics'] for t in article['topics']): raise ValueError('Unknown article topic')
  data['articles'].append(article)
 data['articles'].sort(key=lambda a:(a['publishedAt'],a['id']),reverse=True)
 # A removed article must vanish immediately; a catalog link must not keep it alive.
 keys={a['id'] for a in data['articles']}|{a['translationKey'] for a in data['articles']}
 for p in data['projects']:
  if p.get('article') and p['article'] not in keys: p.pop('article')
 # Engine sections keep their own order; labels come from the host blog when available.
 order=list(categories or {})+sorted({a['category'] for a in data['articles'] if a.get('category')}-set(categories or {}))
 labels=categories or {};fallback=catalog.get('categoryLabels',{})
 data['categories']=[{'id':c,'zh':c,'en':str(labels.get(c,{}).get('en') or fallback.get(c,c)),'desc':str(labels.get(c,{}).get('desc','')),'motto':str(labels.get(c,{}).get('motto',''))} for c in order if any(a.get('category')==c for a in data['articles'])]
 data['tagLabels']={t:str(tag_labels[t]) for a in data['articles'] for t in a.get('tags',[]) if t in (tag_labels or {})}
 used={t for item in data['articles']+data['projects'] for t in item.get('topics',[])}
 data['topics']={k:v for k,v in data['topics'].items() if k in used}
 used_kinds={p['kind'] for p in data['projects']};data['projectKinds']={k:v for k,v in data['projectKinds'].items() if k in used_kinds}
 return data

class ContentService:
 def __init__(self,catalog_path,blog_dir=None,bridge=False,render=None,bridge_ttl=1.0,categories=None,tag_labels=None):
  self.categories=categories;self.tag_labels=tag_labels;self.catalog_path=Path(catalog_path);self.blog_dir=Path(blog_dir) if blog_dir else None;self.bridge=bridge;self.render=render;self.bridge_ttl=bridge_ttl;self._lock=threading.Lock();self._cache=None;self._fingerprint=None;self._at=0
 def bundle(self):
  with self._lock:
   stat=self.catalog_path.stat();signature=[stat.st_mtime_ns,stat.st_size]
   if self.blog_dir:
    signature.extend((p.name,p.stat().st_mtime_ns,p.stat().st_size) for p in sorted(self.blog_dir.glob('*.md')))
   valid=self._cache is not None and signature==self._fingerprint and (not self.bridge or time.monotonic()-self._at<self.bridge_ttl)
   if valid:return copy.deepcopy(self._cache)
   catalog=json.loads(self.catalog_path.read_text())
   posts=bridge_posts() if self.bridge else native_posts(self.blog_dir,self.render)
   data=build_bundle(posts,catalog,categories=self.categories,tag_labels=self.tag_labels)
   self._cache=data;self._fingerprint=signature;self._at=time.monotonic();return copy.deepcopy(data)
 def response(self):
  data=self.bundle();return data,'"'+digest(data)+'"'
