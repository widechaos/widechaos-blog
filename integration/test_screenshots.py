import copy,importlib.util,json,unittest
from pathlib import Path
from integration.site_catalog import merge_catalog
from integration.content_service import build_bundle
from integration.ssr import render
ROOT=Path(__file__).resolve().parents[1]
def shot():return {'src':'/static/assets/projects/example-abcdef123456.jpg','width':1280,'height':720,'alt':{'zh':'实际界面截图','en':'Actual interface screenshot'},'caption':{'zh':'真实来源界面。','en':'Actual source interface.'},'sourceUrl':'https://huggingface.co/spaces/example/demo'}
class ScreenshotTests(unittest.TestCase):
 def setUp(self):self.base=json.loads((ROOT/'examples/site-catalog.json').read_text())
 def patch(self,image):return merge_catalog(self.base,{'projects':[{'id':'router','status':'published','screenshot':image}]})
 def test_screenshot_is_public_and_bilingual_in_listing_and_detail(self):
  updated=self.patch(shot());data=build_bundle([],updated)
  project=next(p for p in data['projects'] if p['id']=='router');self.assertEqual(project['screenshot'],shot())
  for lang in ['zh','en']:
   for path in ['/projects','/projects/router']:
    html,status=render(ROOT,path,data,lang);self.assertEqual(status,200)
    self.assertIn('src="'+shot()['src']+'"',html);self.assertIn('alt="'+shot()['alt'][lang]+'"',html)
    self.assertIn(shot()['caption'][lang],html);self.assertIn('href="'+shot()['sourceUrl']+'"',html)
    self.assertIn('width="1280" height="720"',html)
  other={p['id']:p for p in updated['projects'] if p['id']!='router'}
  self.assertEqual(other,{p['id']:p for p in self.base['projects'] if p['id']!='router'})
 def test_nonstandard_language_keeps_existing_chinese_fallback(self):
  data=build_bundle([],self.patch(shot()))
  for lang in ['en-US','xx','']:
   for path in ['/projects','/projects/router']:
    html,status=render(ROOT,path,data,lang);self.assertEqual(status,200)
    self.assertIn('alt="'+shot()['alt']['zh']+'"',html);self.assertIn(shot()['caption']['zh'],html)
 def test_invalid_rasters_dimensions_languages_and_private_sources_are_rejected(self):
  for key,value in [('src','/static/../secret.jpg'),('src','https://example.org/screenshot.jpg'),('src','/static/assets/projects/example-abcdef123456.svg'),('width',True),('height',0),('height',9000),('sourceUrl','javascript:alert(1)'),('sourceUrl','https://127.0.0.1/private'),('sourceUrl','https://u:p@example.org/image'),('alt',{'zh':'中文'}),('caption',{'zh':'中文','en':''}),('privateNote','not public')]:
   image=shot();image[key]=value
   with self.subTest(key=key,value=value),self.assertRaises(ValueError):self.patch(image)
 def test_release_allowlist_only_admits_hash_named_project_rasters(self):
  spec=importlib.util.spec_from_file_location('remote_deploy',ROOT/'scripts/deploy_remote.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertTrue(m.allowed('app/static/assets/projects/example-abcdef123456.jpg'))
  for p in ['app/static/assets/projects/example.jpg','app/static/assets/projects/example-abcdef123456.py','app/static/assets/projects/example-abcdef123456.svg','app/static/assets/projects/../../secret.png','app/static/private/example-abcdef123456.jpg']:
   self.assertFalse(m.allowed(p),p)
