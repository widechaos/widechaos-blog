"""Prepared adapter; installing is a separate, approved production action.
Mount only behind the existing authentication middleware. No auth changes.
"""
import importlib.util,sys
from pathlib import Path
from fastapi import Request
from fastapi.responses import JSONResponse,HTMLResponse,Response
from fastapi.routing import APIRoute
from .content_service import ContentService
from .ssr import render

def engine_tag_labels(path):
 try:
  spec=importlib.util.spec_from_file_location('content_cli_vocabulary',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  return dict(getattr(module,'TAG_EN',{}))
 except Exception:return None

def install(app, *, root, catalog_path, blog_dir, native_renderer=None):
 # The host blog module owns the section labels; reuse them instead of copying.
 host=sys.modules.get(getattr(native_renderer,'__module__',''),None)
 # English tag names live with the tag vocabulary in the content engine.
 service=ContentService(catalog_path,blog_dir=blog_dir,render=native_renderer,categories=getattr(host,'CATEGORIES',None),tag_labels=engine_tag_labels(Path(catalog_path).parent.parent/'bin'/'content_cli.py'))
 async def content(request:Request):
  try:data,etag=service.response()
  except Exception:return JSONResponse({'error':'Public content temporarily unavailable'},503,headers={'Cache-Control':'no-store'})
  headers={'ETag':etag,'Cache-Control':'no-cache'}
  if request.headers.get('if-none-match')==etag:return Response(status_code=304,headers=headers)
  return JSONResponse(data,headers=headers)
 def page_endpoint(path):
  async def endpoint(request:Request):
   actual=path.format(**request.path_params)
   try:page,status=render(root,actual,service.bundle(),request.query_params.get('lang','zh'))
   except Exception:return HTMLResponse('Public content temporarily unavailable',503,headers={'Cache-Control':'no-store'})
   return HTMLResponse(page,status,headers={'Cache-Control':'no-cache'})
  return endpoint
 # Exact JSON path must precede the existing /static mount. It is already public
 # in the existing www scope; do not add a broad /api authentication exception.
 app.router.routes.insert(0,APIRoute('/static/content.json',content,methods=['GET','HEAD']))
 replacements={'/','/blog','/radar','/blog/{slug}','/projects','/projects/{slug}','/tools','/about','/now'}
 app.router.routes[:]=[r for r in app.router.routes if getattr(r,'path',None) not in replacements]
 # Keep legacy RSS/category/tag routes and their handlers in their original order.
 # These precede the generic article route, and authentication remains untouched.
 for path in sorted(replacements,key=lambda x:('{' in x,len(x))):
  app.router.routes.append(APIRoute(path,page_endpoint(path),methods=['GET','HEAD']))
 return service
