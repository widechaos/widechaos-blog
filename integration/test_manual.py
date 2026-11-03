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
   self.assertIn('天枢 / 使用文档',body)
   self.assertNotIn('SHUVIA / USER GUIDE',body)
   self.assertIn(re.sub(r'href="/docs/tianshu/([a-z-]+)"',r'href="/docs/tianshu/\1?lang=zh"',p['html']),body)
   self.assertIn(p['headings'][0],body)
   self.assertIn('https://widechaos.cn/docs/tianshu/'+p['slug'],body)
  self.assertEqual(render(ROOT,'/docs/tianshu/not-real',data)[1],404)
 def test_english_direct_pages_are_translated_without_javascript(self):
  data={'articles':[],'projects':[],'collection':[]}
  manual=json.loads((ROOT/'static/tianshu-manual.js').read_text().removeprefix('export const TIANSHU_MANUAL = ').strip().removesuffix(';'))
  for slug in ['']+[p['slug'] for p in manual['pages']]:
   path='/docs/tianshu'+('/'+slug if slug else '')
   body,status=render(ROOT,path,data,'en')
   self.assertEqual(status,200)
   self.assertIn('All chapters',body)
   self.assertIn('SHUVIA / USER GUIDE',body)
   self.assertNotIn('currently available in Chinese',body)
   self.assertNotIn('Tianshu',body)
   main=body.split('<main id="main" tabindex="-1">')[1].split('</main>')[0]
   self.assertIsNone(re.search(r'[\u3400-\u9fff]',main),slug)
   self.assertIn('https://widechaos.cn'+path+'?lang=en',body)
   for url in re.findall(r'href="(/docs/tianshu[^"]*)"',main):self.assertIn('?lang=en',url)
   if slug:
    page=next(p['en'] for p in manual['pages'] if p['slug']==slug)
    self.assertIn(page['title'],body)
    self.assertIn(re.sub(r'href="/docs/tianshu/([a-z-]+)"',r'href="/docs/tianshu/\1?lang=en"',page['html']),body)
    for target in re.findall(r'href="#([^"]+)"',main):self.assertIn('id="'+target+'"',main)
  body,status=render(ROOT,'/docs/tianshu/missing',data,'en')
  self.assertEqual(status,404);self.assertIn('Guide page not found',body)
 def test_all_screenshots_exist_and_stay_inside_public_guide_assets(self):
  source=(ROOT/'static/tianshu-manual.js').read_text()
  images=set(re.findall(r'/static/assets/tianshu/((?:en/)?[a-z0-9-]+\.png)',source))
  self.assertEqual(len(images),20)
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
     self.assertIn('Connect conversation and reading models',client.get('/docs/tianshu/models?lang=en').text)
     self.assertEqual(client.get('/docs/tianshu/not-real').status_code,404)
     self.assertEqual(client.get('/docs/private').status_code,404)
    self.assertIn('/docs/tianshu',host.SITE_SCOPES['www'])
    self.assertEqual(host.SITE_SCOPES['private'],['/hub'])
   finally:
    if prior is None:sys.modules.pop('app.services.auth',None)
    else:sys.modules['app.services.auth']=prior
