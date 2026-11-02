import json,re,sys,unittest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from integration.production_adapter import install
from integration.ssr import render
ROOT=Path(__file__).resolve().parents[1]
class ManualTests(unittest.TestCase):
 def test_direct_chapters_and_links_have_real_content_without_javascript(self):
  data={'articles':[],'projects':[],'collection':[]}
  manual=json.loads((ROOT/'static/tianshu-manual.js').read_text().removeprefix('export const TIANSHU_MANUAL = ').strip().removesuffix(';'))
  for p in manual['pages']:
   body,status=render(ROOT,'/docs/tianshu/'+p['slug'],data)
   self.assertEqual(status,200)
   self.assertIn(p['title'],body)
   self.assertIn(p['html'],body)
   self.assertIn('https://widechaos.cn/docs/tianshu/'+p['slug'],body)
  self.assertEqual(render(ROOT,'/docs/tianshu/not-real',data)[1],404)
 def test_all_screenshots_exist_and_stay_inside_public_guide_assets(self):
  source=(ROOT/'static/tianshu-manual.js').read_text()
  images=set(re.findall(r'/static/assets/tianshu/([a-z0-9-]+\.png)',source))
  self.assertGreaterEqual(len(images),8)
  for name in images:self.assertTrue((ROOT/'static/assets/tianshu'/name).is_file(),name)
 def test_adapter_registers_specific_routes_and_keeps_private_scopes(self):
  import tempfile,types
  with tempfile.TemporaryDirectory() as tmp:
   cat=Path(tmp)/'catalog.json';cat.write_text((ROOT/'examples/site-catalog.json').read_text())
   blog=Path(tmp)/'blog';blog.mkdir()
   host=types.SimpleNamespace(SITE_SCOPES={'www':['/projects'],'private':['/hub']})
   prior=sys.modules.get('app.services.auth');sys.modules['app.services.auth']=host
   try:
    app=FastAPI();install(app,root=ROOT,catalog_path=cat,blog_dir=blog)
    with TestClient(app) as client:
     self.assertEqual(client.get('/docs/tianshu').status_code,200)
     self.assertIn('接入会话与阅读模型',client.get('/docs/tianshu/models').text)
     self.assertEqual(client.get('/docs/tianshu/not-real').status_code,404)
     self.assertEqual(client.get('/docs/private').status_code,404)
    self.assertIn('/docs/tianshu',host.SITE_SCOPES['www'])
    self.assertEqual(host.SITE_SCOPES['private'],['/hub'])
   finally:
    if prior is None:sys.modules.pop('app.services.auth',None)
    else:sys.modules['app.services.auth']=prior
