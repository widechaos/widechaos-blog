import importlib.util,io,json,sys,tarfile,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from deploy_remote import allowed,unpack,restore
from check_source import findings
class ReleaseSafety(unittest.TestCase):
 def test_private_paths_never_enter_payload(self):
  for name in ('content/blog/post.md','content/site-catalog.json','.env','app/main.py','app/routes/tasks.py','app/services/auth.py','app/static/private.html','app/static/lifehub.js','app/static/quant.js','../static/app.js','ssl/private.key'):
   self.assertFalse(allowed(name),name)
  self.assertTrue(allowed('app/static/app.js'));self.assertTrue(allowed('app/site_content/ssr.py'))
 def test_malicious_archive_is_rejected(self):
  data=io.BytesIO()
  with tarfile.open(fileobj=data,mode='w') as archive:
   item=tarfile.TarInfo('content/blog/secret.md');item.size=3;archive.addfile(item,io.BytesIO(b'bad'))
  with self.assertRaisesRegex(ValueError,'Non-site'):unpack(data.getvalue())
 def test_rollback_restores_only_managed_files(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);backup=root/'backup';(root/'app/static').mkdir(parents=True);(backup/'app/static').mkdir(parents=True);(root/'content/blog').mkdir(parents=True)
   (root/'app/static/app.js').write_text('changed');(backup/'app/static/app.js').write_text('original');(root/'app/static/mark.svg').write_text('new');(root/'content/blog/post.md').write_text('live')
   restore(root,backup,['app/static/app.js','app/static/mark.svg'])
   self.assertEqual((root/'app/static/app.js').read_text(),'original');self.assertFalse((root/'app/static/mark.svg').exists());self.assertEqual((root/'content/blog/post.md').read_text(),'live')
 def test_scanner_detects_keys_without_reporting_values(self):
  value=b'-----BEGIN '+b'PRIVATE KEY-----\nprivate'
  result=findings({'static/app.js':value,'operations/database.db':b'data'})
  self.assertEqual({x['rule'] for x in result},{'private-key','non-website-path'});self.assertNotIn('private\"',json.dumps(result))
if __name__=='__main__':unittest.main()
