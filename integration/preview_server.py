"""Isolated local preview: public assets only, dynamic content and SSR."""
import argparse,json,mimetypes,sys,urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,unquote,parse_qs
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from integration.content_service import ContentService
from integration.ssr import render

def handler(root,service):
 class Handler(BaseHTTPRequestHandler):
  def do_HEAD(self):self.do_GET()
  def do_GET(self):
   parsed=urlsplit(self.path);path=unquote(parsed.path)
   try:
    if path in ('/static/content.json','/api/site-content'):
     data,etag=service.response()
     if self.headers.get('If-None-Match')==etag:self.send_response(304);self.send_header('ETag',etag);self.send_header('Cache-Control','no-cache');self.end_headers();return
     return self.reply(json.dumps(data,ensure_ascii=False).encode(),'application/json; charset=utf-8',headers={'ETag':etag,'Cache-Control':'no-cache'})
    if path=='/blog/rss.xml' or path.startswith(('/blog/c/','/blog/t/')):
     with urllib.request.urlopen('https://widechaos.cn'+parsed.path,timeout=20) as r:return self.reply(r.read(),r.headers.get('Content-Type','text/html'))
    if path.startswith(('/static/','/assets/','/vendor/')):
     target=(root/path.lstrip('/')).resolve();base=(root/path.split('/')[1]).resolve()
     if not target.is_relative_to(base) or not target.is_file() or target.name.startswith('.') or target.suffix not in {'.js','.css','.svg','.png','.jpg','.jpeg','.webp','.gif','.woff','.woff2','.ico','.json'}:return self.reply(b'Not found','text/plain',404)
     return self.reply(target.read_bytes(),mimetypes.guess_type(target)[0] or 'application/octet-stream')
    if path=='/' or path in ('/blog','/projects','/tools','/about','/now') or path.startswith(('/blog/','/projects/')):
     page,status=render(root,path,service.bundle(),parse_qs(parsed.query).get('lang',['zh'])[0]);return self.reply(page.encode(),'text/html; charset=utf-8',status,{'Cache-Control':'no-cache'})
    return self.reply(b'Not found','text/plain',404)
   except Exception as e:
    print(type(e).__name__+': '+str(e),file=sys.stderr);return self.reply(b'Public content temporarily unavailable','text/plain',503,{'Cache-Control':'no-store'})
  def reply(self,body,kind,status=200,headers=None):
   self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)));self.send_header('X-Content-Type-Options','nosniff')
   for k,v in (headers or {}).items():self.send_header(k,v)
   self.end_headers()
   if self.command!='HEAD':self.wfile.write(body)
 return Handler

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=9568);p.add_argument('--catalog',default=str(Path(__file__).resolve().parent.parent/'examples/site-catalog.json'));p.add_argument('--blog-dir');p.add_argument('--public-web',action='store_true');p.add_argument('--categories',help='JSON copy of the host section labels');p.add_argument('--tag-labels',help='JSON copy of the engine tag names');a=p.parse_args()
 s=ContentService(a.catalog,blog_dir=a.blog_dir,bridge=not a.blog_dir,bridge_ttl=15,categories=json.loads(Path(a.categories).read_text()) if a.categories else None,tag_labels=json.loads(Path(a.tag_labels).read_text()) if a.tag_labels else None)
 if a.public_web:
  from integration.public_source import public_posts
  import integration.content_service as module
  module.bridge_posts=public_posts
 print(f'Preview http://127.0.0.1:{a.port}',flush=True)
 ThreadingHTTPServer(('127.0.0.1',a.port),handler(Path(__file__).resolve().parent.parent,s)).serve_forever()
