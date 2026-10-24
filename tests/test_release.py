import importlib.util,io,json,os,shutil,sys,tarfile,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from deploy_remote import allowed,unpack,restore,require_capacity,preflight
from unittest.mock import patch
from check_source import findings
from deploy import inventory_files
from subprocess import CompletedProcess
class ReleaseSafety(unittest.TestCase):
 def test_unavailable_inventory_stops_before_delta_release(self):
  for code,output in [(255,''),(0,''),(0,'not json'),(0,'{}'),(0,'{"files":[]}')]:
   with self.subTest(code=code,output=output):
    with self.assertRaisesRegex(SystemExit,'no release was sent'):
     inventory_files(CompletedProcess([],code,stdout=output,stderr=''))
  self.assertEqual(inventory_files(CompletedProcess([],0,stdout='{"files":{}}')), {})
  self.assertEqual(inventory_files(CompletedProcess([],0,stdout='{"files":{"app/static/app.js":"abc"}}')), {'app/static/app.js':'abc'})
  self.assertEqual(inventory_files(CompletedProcess([],0,stdout='{"files":{"app/static/new.svg":null}}')), {'app/static/new.svg':None})
 def test_capacity_gate_rejects_low_memory_and_stalled_host(self):
  with tempfile.TemporaryDirectory() as directory:
   proc=Path(directory);(proc/'pressure').mkdir()
   (proc/'meminfo').write_text('MemTotal: 1717408 kB\nMemAvailable: 100000 kB\n')
   with self.assertRaisesRegex(RuntimeError,'memory'):require_capacity(proc)
   (proc/'meminfo').write_text('MemAvailable: 700000 kB\n')
   (proc/'pressure/io').write_text('full avg10=40 avg60=0 avg300=0 total=1\n')
   require_capacity(proc)
   (proc/'pressure/io').write_text('some avg10=40 avg60=0 avg300=0 total=1\nfull avg10=11 avg60=11 avg300=0 total=1\n')
   with self.assertRaisesRegex(RuntimeError,'io pressure'):require_capacity(proc)
   (proc/'pressure/io').write_text('full avg10=0 avg60=0 avg300=0 total=1\n')
   require_capacity(proc)
 @unittest.skipUnless(shutil.which('timeout'),'GNU timeout is required')
 def test_preflight_deadline_is_inside_container(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);docker=root/'docker';pidfile=root/'child.pid'
   docker.write_text('#!/bin/sh\nshift 2\nexec "$@"\n');docker.chmod(0o700)
   with patch.dict(os.environ,{'PATH':str(root)+os.pathsep+os.environ['PATH']}):
    with self.assertRaisesRegex(RuntimeError,'Command failed'):
     preflight('web','import os,time; from pathlib import Path; Path('+repr(str(pidfile))+').write_text(str(os.getpid())); time.sleep(30)',seconds=1)
   with self.assertRaises(ProcessLookupError):os.kill(int(pidfile.read_text()),0)
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
 def test_new_public_assets_are_allowed(self):
  for name in ('app/static/about-copy.js','app/static/og-card.jpg','app/static/fonts/poem-mashanzheng.woff2','app/static/collection.js','app/static/collection.css','app/static/pointer.js','app/static/pointer.css','app/static/pointer-sword.svg','app/static/pointer-sword-active.svg','app/static/radar.css','app/static/article-peek.js','app/static/article-peek.css','app/static/scroll-scenes.js'):self.assertTrue(allowed(name),name)
  for name in ('app/static/fonts/../main.py','app/static/fonts/private.js'):self.assertFalse(allowed(name),name)
 def test_delta_release_reads_unchanged_files_from_host(self):
  sys.path.insert(0,str(ROOT/'scripts'));from build_release import release_bytes
  import gzip
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);full,manifest=release_bytes('HEAD')
   members=tarfile.open(fileobj=io.BytesIO(gzip.decompress(full)))
   for item in members.getmembers():
    if item.name=='release.json':continue
    target=root/item.name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(members.extractfile(item).read())
   changed='app/static/app.js';(root/changed).write_bytes(b'stale')
   delta,_=release_bytes('HEAD',only={changed})
   self.assertLess(len(delta),len(full)//10)
   files,_=unpack(gzip.decompress(delta),root)
   self.assertEqual(set(files),set(manifest['files']))
   (root/'app/static/style.css').write_bytes(b'drifted')
   with self.assertRaisesRegex(ValueError,'does not hold'):unpack(gzip.decompress(delta),root)
 def test_scanner_detects_keys_without_reporting_values(self):
  value=b'-----BEGIN '+b'PRIVATE KEY-----\nprivate'
  result=findings({'static/app.js':value,'operations/database.db':b'data'})
  self.assertEqual({x['rule'] for x in result},{'private-key','non-website-path'});self.assertNotIn('private\"',json.dumps(result))
if __name__=='__main__':unittest.main()
