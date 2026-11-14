import re,unittest
from pathlib import Path
from integration.ssr import render

ROOT=Path(__file__).resolve().parents[1]
DATA={'articles':[],'projects':[],'collection':[]}

class ShareCards(unittest.TestCase):
 def test_explicit_share_key_is_stable_without_javascript(self):
  for key in ('v1-0000','v1-2189'):
   for _ in range(2):
    page,status=render(ROOT,'/',DATA,'zh',key)
    self.assertEqual(status,200)
    self.assertIn('property="og:url" content="https://widechaos.cn/?card='+key+'"',page)
    self.assertIn('property="og:image" content="https://widechaos.cn/static/assets/share-cards/'+key+'.jpg"',page)
    self.assertIn('name="twitter:image" content="https://widechaos.cn/static/assets/share-cards/'+key+'.jpg"',page)
    self.assertIn('rel="canonical" href="https://widechaos.cn/"',page)
 def test_invalid_keys_cannot_inject_metadata_or_paths(self):
  for key in ('v1-2190','v1--001','v1-0000\"><script>','../../secret','v2-0001'):
   page,_=render(ROOT,'/',DATA,'zh',key)
   match=re.search('name="wc-share-card" content="(v1-[0-9]{4})"',page)
   self.assertIsNotNone(match)
   self.assertLess(int(match[1][3:]),2190)
 def test_every_reachable_image_is_present_and_jpeg(self):
  folder=ROOT/'static/assets/share-cards'
  self.assertEqual(len(list(folder.glob('v1-*.jpg'))),2190)
  for i in range(2190):
   image=folder/f'v1-{i:04d}.jpg'
   body=image.read_bytes()
   self.assertEqual(body[:2],b'\xff\xd8')
   self.assertLess(len(body),5*1024*1024)
 def test_other_pages_keep_their_existing_card(self):
  page,_=render(ROOT,'/about',DATA,'en','v1-0001')
  self.assertNotIn('assets/share-cards/',page)
