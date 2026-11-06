import unittest
from pathlib import Path
from integration.ssr import render
ROOT=Path(__file__).resolve().parents[1]
class ProjectToolTests(unittest.TestCase):
 def test_existing_web_tool_is_clickable_in_both_languages_without_javascript(self):
  project={'id':'audit','title':'Audit','tag':'Audit','zh':'审计工具','en':'Audit tool','url':'https://example.com/source','tool':{'availability':'web','url':'https://example.com/app'},'updatedAt':'2026-11-06'}
  data={'projects':[project],'articles':[],'collection':[]}
  for lang,label in [('zh','打开浏览器工具'),('en','Open browser tool')]:
   html,status=render(ROOT,'/projects/audit',data,lang)
   main=html.split('<main id="main" tabindex="-1">')[1].split('</main>')[0]
   self.assertEqual(status,200)
   self.assertIn('href="https://example.com/app">'+label,main)
   self.assertIn('href="https://example.com/source"',main)
   self.assertIn('2026-11-06',main)
  project['tool']['availability']='install'
  html,_=render(ROOT,'/projects/audit',data,'en')
  self.assertNotIn('Open browser tool',html)
  self.assertNotIn('href="https://example.com/app"',html)
