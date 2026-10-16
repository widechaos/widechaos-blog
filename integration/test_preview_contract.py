"""Exercise the running preview HTTP contract against isolated authoring files."""
import json,tempfile,threading,unittest,urllib.request,urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
from integration.content_service import ContentService
from integration.preview_server import handler
from integration.site_catalog import apply_update,digest
ROOT=Path(__file__).resolve().parent.parent
class PreviewContract(unittest.TestCase):
 def test_update_without_restart_and_private_paths(self):
  with tempfile.TemporaryDirectory() as directory:
   temp=Path(directory);blog=temp/'blog';blog.mkdir();catalog=temp/'catalog.json'
   base=json.loads((ROOT/'examples/site-catalog.json').read_text());catalog.write_text(json.dumps(base))
   service=ContentService(catalog,blog)
   server=ThreadingHTTPServer(('127.0.0.1',0),handler(ROOT,service));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
   origin='http://127.0.0.1:'+str(server.server_port)
   def get(path):
    with urllib.request.urlopen(origin+path) as response:return response.read(),response.headers
   try:
    initial,headers=get('/static/content.json');self.assertEqual(json.loads(initial)['articles'],[])
    for language in ('zh','en'):
     (blog/f'contract-{language}.md').write_text(f'---\ntitle: Contract {language}\ndate: 2026-10-15\nstatus: published\n---\nPublished {language} body')
    current=json.loads(get('/static/content.json')[0]);self.assertEqual(len(current['articles']),2)
    self.assertIn(b'Published en body',get('/blog/contract-en')[0])
    project={'id':'contract-work','title':'Contract Work','zh':'隔离测试作品','en':'Isolated test work','tag':'Test','url':'https://example.org/work','kind':base['projects'][0]['kind'],'status':'published'}
    apply_update(catalog,{'projects':[project]},digest(base),'Isolated test authorization','https://example.org/work')
    updated,updated_headers=get('/static/content.json');self.assertEqual(len(json.loads(updated)['projects']),len(base['projects'])+1);self.assertNotEqual(headers['ETag'],updated_headers['ETag'])
    self.assertIn(b'Contract Work',get('/projects/contract-work')[0])
    (blog/'contract-en.md').write_text('---\ntitle: Private\ndate: 2026-10-15\nstatus: draft\n---\nPRIVATE_BODY')
    self.assertNotIn(b'PRIVATE_BODY',get('/static/content.json')[0])
    for path in ('/blog/contract-en','/examples/site-catalog.json','/integration/evidence/content_cli.py','/CLAUDE.md'):
     with self.assertRaises(urllib.error.HTTPError) as error:get(path)
     self.assertEqual(error.exception.code,404);error.exception.close()
    self.assertIn(b'export',get('/static/vendor/three.module.js')[0])
   finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
