import json,re,unittest
from pathlib import Path
from integration.ssr import render

ROOT=Path(__file__).resolve().parents[1]

class ArticleFirstBodyTests(unittest.TestCase):
 def bundle(self):
  articles=[{'id':'fixture-'+lang,'lang':lang,'title':'Fixture '+lang,
    'summary':'Summary','url':'https://widechaos.cn/blog/fixture-'+lang,
    'publishedAt':'2026-01-01','translationKey':'fixture',
    'body':'<p>Complete readable body '+lang+'</p><pre>literal code</pre>'}
    for lang in ['en','zh']]
  articles.append({**articles[0],'id':'other','translationKey':'other',
    'body':'<p>'+('unrelated text '*150000)+'</p>'})
  return {'articles':articles,'projects':[],'collection':[]}

 def test_entire_article_arrives_before_large_hydration_payload(self):
  for lang in ['en','zh']:
   page,status=render(ROOT,'/blog/fixture-'+lang,self.bundle(),lang)
   self.assertEqual(status,200)
   payload_at=page.index('<script id="site-data"')
   self.assertLess(page.index('</article>'),payload_at)
   self.assertIn('Complete readable body '+lang,page[:32768])
   self.assertIn('literal code',page[:32768])
   self.assertNotIn('class="booting"',page)
   self.assertGreater(len(page),2000000)

 def test_hydration_and_escaping_are_preserved(self):
  data=self.bundle();data['articles'][0]['body']+='<p></script><script>sentinel()</script></p>'
  page,_=render(ROOT,'/blog/fixture-en',data,'en')
  encoded=re.search(r'<script id="site-data" type="application/json">(.*?)</script>',page,re.S)[1]
  self.assertEqual(json.loads(encoded),data)
  self.assertNotIn('<script>',encoded)
  self.assertEqual(page.count('id="site-data"'),1)

 def test_other_routes_keep_existing_boot_and_payload_order(self):
  for path in ['/blog','/projects','/blog/not-published']:
   page,_=render(ROOT,path,self.bundle())
   self.assertIn('class="booting"',page)
   self.assertLess(page.index('id="site-data"'),page.index('<main'))
