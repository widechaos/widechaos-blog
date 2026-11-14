import hashlib,io,tarfile,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from deploy_remote import MODULES,pull_source,validate_source_manifest,atomic

class VerifiedSourcePull(unittest.TestCase):
 def fixture(self):
  files={'app/personal_site/index.html':b'<html>public</html>','bin/site_catalog.py':b'# catalog'}
  files.update({'app/site_content/'+name:b'# module '+name.encode() for name in MODULES})
  files['app/static/assets/share-cards/v1-0000.jpg']=b'\xff\xd8public-image'
  manifest={'repository':'https://github.com/widechaos/widechaos-blog','revision':'a'*40,'files':{k:hashlib.sha256(v).hexdigest() for k,v in files.items()}}
  return files,manifest
 def archive(self,files):
  stream=io.BytesIO()
  with tarfile.open(fileobj=stream,mode='w:gz') as archive:
   for name,body in files.items():
    source='index.html' if name=='app/personal_site/index.html' else name.removeprefix('app/') if name.startswith('app/static/') else 'integration/'+Path(name).name
    item=tarfile.TarInfo('widechaos-blog-'+('a'*40)+'/'+source);item.size=len(body);archive.addfile(item,io.BytesIO(body))
  return stream.getvalue()
 def test_staged_download_checks_hashes_and_reuses_existing_files(self):
  files,manifest=self.fixture()
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)/'live';root.mkdir();stage=Path(directory)/'stage';stage.mkdir()
   existing=root/'app/personal_site/index.html';existing.parent.mkdir(parents=True);existing.write_bytes(files['app/personal_site/index.html'])
   with patch('deploy_remote.urlopen',return_value=io.BytesIO(self.archive(files))) as request:
    staged=pull_source(manifest,root,stage)
   self.assertEqual(staged['app/personal_site/index.html'],existing)
   self.assertEqual(request.call_args[0][0].full_url,'https://codeload.github.com/widechaos/widechaos-blog/tar.gz/'+'a'*40)
   for name,value in staged.items():self.assertEqual(value.read_bytes(),files[name])
   self.assertFalse((root/'app/static').exists())
   atomic(root/'copied.jpg',staged['app/static/assets/share-cards/v1-0000.jpg'])
   self.assertEqual((root/'copied.jpg').read_bytes(),files['app/static/assets/share-cards/v1-0000.jpg'])
 def test_corrupt_or_missing_source_never_writes_live_files(self):
  for failure in ('corrupt','missing'):
   files,manifest=self.fixture()
   if failure=='corrupt':files['app/static/assets/share-cards/v1-0000.jpg']=b'bad'
   else:files.pop('app/static/assets/share-cards/v1-0000.jpg')
   with tempfile.TemporaryDirectory() as directory:
    root=Path(directory)/'live';root.mkdir();stage=Path(directory)/'stage';stage.mkdir()
    with patch('deploy_remote.urlopen',return_value=io.BytesIO(self.archive(files))):
     with self.assertRaises(ValueError):pull_source(manifest,root,stage)
    self.assertEqual(list(root.iterdir()),[])
 def test_manifest_identity_and_private_paths_are_rejected(self):
  _,manifest=self.fixture()
  for value in ('content/blog/private.md','app/static/assets/share-cards/v1-2190.jpg','../secret'):
   bad={**manifest,'files':{**manifest['files'],value:'b'*64}}
   with self.assertRaises(ValueError):validate_source_manifest(bad)
  for key,value in [('revision','../secret'),('repository','https://example.com')]:
   with self.assertRaises(ValueError):validate_source_manifest({**manifest,key:value})
