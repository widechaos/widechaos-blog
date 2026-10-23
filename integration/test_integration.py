import copy,json,tempfile,unittest
from pathlib import Path
from fastapi import FastAPI,Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient
from integration.content_service import ContentService
from integration.site_catalog import apply_update,digest
from integration.production_adapter import install
ROOT=Path(__file__).resolve().parent.parent
class IntegrationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.dir=Path(self.tmp.name);self.blog=self.dir/'blog';self.blog.mkdir();self.cat=self.dir/'catalog.json';self.catalog=json.loads((ROOT/'examples/site-catalog.json').read_text());self.cat.write_text(json.dumps(self.catalog));self.s=ContentService(self.cat,self.blog)
 def tearDown(self):self.tmp.cleanup()
 def write(self,slug='fixture-en',status='published',body='Original body',date='2026-10-13'):
  (self.blog/(slug+'.md')).write_text(f'---\ntitle: Fixture\ndate: {date}\nstatus: {status}\n---\n{body}')
 def test_dynamic_lifecycle_translation_and_date(self):
  self.write(status='draft');self.assertEqual(self.s.bundle()['articles'],[])
  self.write();self.assertEqual(self.s.bundle()['articles'][0]['publishedAt'],'2026-10-13')
  self.write('fixture-zh',body='中文正文');d=self.s.bundle();self.assertEqual(len(d['articles']),2);self.assertEqual({a['translationKey'] for a in d['articles']},{'fixture'})
  self.write(body='Updated article');self.assertIn('Updated article',next(a for a in self.s.bundle()['articles'] if a['lang']=='en')['body'])
  self.write(status='draft');self.assertEqual(len(self.s.bundle()['articles']),1)
  (self.blog/'fixture-zh.md').unlink();self.assertEqual(self.s.bundle()['articles'],[])
 def test_withdrawn_related_link_and_private_metadata(self):
  self.write('2026-10-15-lora-routing-json-reliability-en',date='2026-10-15');self.catalog['projects'][0]['privateNote']='secret';self.cat.write_text(json.dumps(self.catalog));d=self.s.bundle();self.assertNotIn('privateNote',json.dumps(d));self.assertEqual(d['articles'][0]['summary'],self.catalog['articleMetadata'][d['articles'][0]['id']]['summary']);self.write('2026-10-15-lora-routing-json-reliability-en',status='draft',date='2026-10-15');self.assertNotIn('article',next(p for p in self.s.bundle()['projects'] if p['id']=='router'))
 def test_fail_closed_and_sanitize(self):
  (self.blog/'bad.md').write_text('---\nstatus: published\ntitle: [bad\n---\nprivate')
  self.write(body='<img src="https://example.org/a.png" onerror="alert(1)"><script>alert(1)</script>')
  body=self.s.bundle()['articles'][0]['body'];self.assertNotIn('onerror',body);self.assertNotIn('<script',body)
  self.write(date='not-a-date')
  with self.assertRaises(ValueError):self.s.bundle()
 def test_revision_updates_preserve_catalog_and_dry_run(self):
  patch={'projects':[{'id':'router','status':'published','tag':'Reviewed'}]};before=self.cat.read_bytes();r=apply_update(self.cat,patch,digest(self.catalog),'Existing approval record','https://widechaos.cn/projects',True);self.assertEqual(self.cat.read_bytes(),before)
  apply_update(self.cat,patch,digest(self.catalog),'Existing approval record','https://widechaos.cn/projects');new=json.loads(self.cat.read_text());self.assertEqual(len(new['projects']),7);self.assertEqual(next(p for p in new['projects'] if p['id']=='router')['demo'],'router')
  with self.assertRaises(ValueError):apply_update(self.cat,patch,digest(self.catalog),'Approval','https://widechaos.cn/projects')
  before=self.cat.read_bytes()
  with self.assertRaises(ValueError):apply_update(self.cat,{'projects':[{'id':'router','status':'published','url':'https://127.0.0.1/'}]},digest(new),'Approval','https://widechaos.cn/projects')
  self.assertEqual(self.cat.read_bytes(),before)
 def test_new_published_work_requires_real_bilingual_descriptions(self):
  from integration.site_catalog import merge_catalog
  for value in ('',None,'  '):
   with self.assertRaises(ValueError):merge_catalog(self.catalog,{'projects':[{'id':'router','status':'published','en':value}]})

 def test_radar_published_archive_translation_and_direct_routes(self):
  self.write('oss-radar-2026-10-21-zh',body='Radar 中文')
  self.write('oss-radar-2026-10-21-en',body='Radar English')
  self.write('oss-radar-2026-10-22-zh',status='draft',body='Unapproved')
  self.write('ordinary-zh',body='An ordinary essay')
  app=FastAPI();install(app,root=ROOT,catalog_path=self.cat,blog_dir=self.blog)
  c=TestClient(app)
  def main(response):return response.text.split('<main id="main" tabindex="-1">')[1].split('</main>')[0]
  response=c.get('/radar');self.assertEqual(response.status_code,200)
  archive=main(response)
  self.assertIn('/blog/oss-radar-2026-10-21-zh',archive)
  self.assertNotIn('oss-radar-2026-10-21-en',archive)
  self.assertNotIn('oss-radar-2026-10-22-zh',response.text)
  self.assertNotIn('ordinary-zh',archive)
  self.assertIn('/blog/oss-radar-2026-10-21-en',main(c.get('/radar?lang=en')))
  self.assertNotIn('oss-radar-',main(c.get('/blog')))
  self.assertIn('/blog/ordinary-zh',main(c.get('/blog')))
  self.assertIn('href="/radar"',main(c.get('/blog/oss-radar-2026-10-21-zh')))
  self.write('oss-radar-2026-10-22-zh',body='New published issue')
  self.assertIn('/blog/oss-radar-2026-10-22-zh',main(c.get('/radar')))

 def test_radar_registration_preserves_private_scopes(self):
  import sys,types
  from unittest.mock import patch
  from fastapi.responses import RedirectResponse
  host_auth=types.ModuleType('app.services.auth')
  host_auth.SITE_SCOPES={'www':['/blog','/about'],'task':['/lifehub'],'quant':['/api/quant']}
  original=copy.deepcopy(host_auth.SITE_SCOPES)
  app=FastAPI()
  @app.middleware('http')
  async def scope(request,call_next):
   path=request.url.path
   if path!='/' and not any(path==prefix or path.startswith(prefix+'/') for prefix in host_auth.SITE_SCOPES['www']):return RedirectResponse('/')
   return await call_next(request)
  with patch.dict(sys.modules,{'app.services.auth':host_auth}):
   install(app,root=ROOT,catalog_path=self.cat,blog_dir=self.blog)
   install(app,root=ROOT,catalog_path=self.cat,blog_dir=self.blog)
  c=TestClient(app,follow_redirects=False)
  response=c.get('/radar');self.assertEqual(response.status_code,200)
  self.assertNotIn('location',response.headers)
  self.assertEqual(host_auth.SITE_SCOPES['www'],original['www']+['/radar'])
  self.assertEqual(host_auth.SITE_SCOPES['task'],original['task'])
  self.assertEqual(host_auth.SITE_SCOPES['quant'],original['quant'])
  self.assertEqual(c.get('/lifehub').status_code,307)
  self.assertEqual(c.get('/api/quant').status_code,307)

 def test_ssr_route_order_auth_and_legacy(self):
  self.write();self.write('fixture-zh',body='中文正文')
  app=FastAPI()
  @app.middleware('http')
  async def auth(request:Request,call_next):
   if request.url.path.startswith('/api/private'):return Response(status_code=401)
   if request.headers.get('host')=='private.example':return Response(status_code=403)
   return await call_next(request)
  app.mount('/static',StaticFiles(directory=ROOT/'static'))
  @app.get('/blog/rss.xml')
  def rss():return Response('<rss>legacy</rss>',media_type='application/xml')
  @app.get('/blog/c/{category}')
  def category(category:str):return {'legacy':category}
  install(app,root=ROOT,catalog_path=self.cat,blog_dir=self.blog)
  c=TestClient(app);r=c.get('/static/content.json');self.assertEqual(r.status_code,200);self.assertEqual(len(r.json()['articles']),2);self.assertEqual(c.get('/static/content.json',headers={'If-None-Match':r.headers['etag']}).status_code,304)
  r=c.get('/blog/fixture-en');self.assertIn('Original body',r.text);self.assertIn('hreflang="zh"',r.text);self.assertIn('https://widechaos.cn/blog/fixture-en',r.text)
  self.assertEqual(c.get('/blog/nonexistent').status_code,404);self.assertIn('legacy',c.get('/blog/rss.xml').text);self.assertEqual(c.get('/blog/c/test').json()['legacy'],'test');self.assertEqual(c.get('/api/private/tasks').status_code,401);self.assertEqual(c.get('/static/content.json',headers={'host':'private.example'}).status_code,403);self.assertEqual(c.post('/static/content.json').status_code,405)
  self.write(status='draft');r=c.get('/blog/fixture-zh');self.assertNotIn('hreflang="en"',r.text);self.assertEqual(c.get('/blog/fixture-en').status_code,404)
if __name__=='__main__':unittest.main()
