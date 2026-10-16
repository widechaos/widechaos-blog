"""Build a reproducible, source-only release from one Git commit."""
import argparse,hashlib,io,json,re,subprocess,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
REPOSITORY='https://github.com/widechaos/widechaos-blog'
MODULES=('__init__.py','content_service.py','site_catalog.py','ssr.py','production_adapter.py')

def git(*args):
 return subprocess.check_output(['git','-C',str(ROOT),*args])

def release_bytes(ref='HEAD'):
 revision=git('rev-parse',ref+'^{commit}').decode().strip()
 if not re.fullmatch('[a-f0-9]{40}',revision):raise ValueError('Invalid commit')
 files={'app/personal_site/index.html':git('show',revision+':index.html')}
 for name in git('ls-tree','-r','--name-only',revision,'static').decode().splitlines():
  if not re.fullmatch(r'static/[A-Za-z0-9_./%-]+',name) or '..' in Path(name).parts:raise ValueError('Invalid static path')
  if name!='static/vendor/LICENSE.three.txt' and Path(name).suffix not in {'.js','.css','.svg','.png','.jpg','.jpeg','.webp','.gif','.woff','.woff2','.ico'}:raise ValueError('Unexpected public asset: '+name)
  files['app/'+name]=git('show',revision+':'+name)
 for name in MODULES:files['app/site_content/'+name]=git('show',revision+':integration/'+name)
 files['bin/site_catalog.py']=git('show',revision+':integration/site_catalog.py')
 manifest={'repository':REPOSITORY,'revision':revision,'files':{name:hashlib.sha256(body).hexdigest() for name,body in sorted(files.items())}}
 output=io.BytesIO()
 with tarfile.open(fileobj=output,mode='w') as archive:
  for name,body in sorted({**files,'release.json':(json.dumps(manifest,indent=2)+'\n').encode()}.items()):
   info=tarfile.TarInfo(name);info.size=len(body);info.mode=0o644;info.mtime=0;archive.addfile(info,io.BytesIO(body))
 return output.getvalue(),manifest

def main():
 p=argparse.ArgumentParser();p.add_argument('--ref',default='HEAD');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 body,manifest=release_bytes(a.ref);a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(body)
 print(json.dumps({'revision':manifest['revision'],'files':len(manifest['files']),'sha256':hashlib.sha256(body).hexdigest()}))
if __name__=='__main__':main()
