"""Apply an allowlisted site release on the existing content host."""
import base64,fcntl,hashlib,io,json,os,re,shutil,subprocess,sys,tarfile,tempfile,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

MODULES={'__init__.py','content_service.py','site_catalog.py','ssr.py','production_adapter.py'}

PUBLIC_ROOT={'app.js','content-model.js','style.css','content-layout.css','hero-art.js','project-demos.js','project-demos.css','avatar.png','city-art.png','og-card.jpg','mark.svg','x-sword.svg'}

def allowed(name):
 p=Path(name)
 if p.is_absolute() or '..' in p.parts:return False
 if name in {'app/personal_site/index.html','bin/site_catalog.py'}:return True
 if p.parent==Path('app/site_content'):return p.name in MODULES
 if p.parent==Path('app/static'):return p.name in PUBLIC_ROOT
 if p.parent==Path('app/static/vendor'):return p.name in {'three.module.js','three.core.js','LICENSE.three.txt'}
 if p.parent==Path('app/static/fonts'):return bool(re.fullmatch(r'[a-z0-9-]+\.woff2',p.name))
 return p.parent==Path('app/static/assets/collection') and bool(re.fullmatch(r'[a-f0-9]{20}-light\.svg',p.name))

def unpack(body,root=None):
 files={}
 with tarfile.open(fileobj=io.BytesIO(body),mode='r:*') as archive:
  for item in archive.getmembers():
   if not item.isfile() or item.name in files:raise ValueError('Unexpected release member')
   if item.name!='release.json' and not allowed(item.name):raise ValueError('Non-site file in release')
   files[item.name]=archive.extractfile(item).read()
 manifest=json.loads(files.pop('release.json'))
 if manifest['repository']!='https://github.com/widechaos/widechaos-blog' or not re.fullmatch('[a-f0-9]{40}',manifest['revision']):raise ValueError('Invalid source identity')
 # A delta release omits files the host already holds byte for byte; read those back and hash them like the rest.
 for name,sha in manifest['files'].items():
  if name in files:continue
  if root is None or not allowed(name) or digest(root/name)!=sha:raise ValueError('Release omits a file the host does not hold: '+name)
  files[name]=(root/name).read_bytes()
 if {k:hashlib.sha256(v).hexdigest() for k,v in files.items()}!=manifest['files']:raise ValueError('Release hash mismatch')
 required={'app/personal_site/index.html','bin/site_catalog.py'}|{'app/site_content/'+name for name in MODULES}
 if not required.issubset(files):raise ValueError('Incomplete release')
 return files,manifest

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def atomic(path,body):
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,name=tempfile.mkstemp(prefix='.site-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as stream:stream.write(body);stream.flush();os.fsync(stream.fileno())
  os.chmod(name,0o644);os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)

def restore(root,backup,files):
 for name in files:
  if not allowed(name):raise ValueError('Invalid rollback path')
  old=backup/name;target=root/name
  if old.is_file():atomic(target,old.read_bytes())
  else:target.unlink(missing_ok=True)

def command(*args):
 r=subprocess.run(args,capture_output=True,text=True,timeout=90)
 if r.returncode:raise RuntimeError('Command failed: '+args[0]+' '+r.stderr[-600:])
 return r.stdout

def require_capacity(proc=Path('/proc')):
 memory={line.split(':',1)[0]:int(line.split()[1]) for line in (proc/'meminfo').read_text().splitlines() if line.split()[1].isdigit()}
 if memory.get('MemAvailable',0)<384*1024:
  raise RuntimeError('Deployment deferred: less than 384 MiB available memory; no site files changed')
 for name,limit in (('memory',5),('io',10)):
  path=proc/'pressure'/name
  if path.exists():
   for line in path.read_text().splitlines():
    if line.startswith('full '):
     values=dict(item.split('=') for item in line.split()[1:])
     # An idle host shows large 10-second IO spikes from a single small read; gate IO on the minute average.
     if float(values['avg60' if name=='io' else 'avg10'])>=limit:
      raise RuntimeError('Deployment deferred: host '+name+' pressure is high; no site files changed')

def preflight(container,source,seconds=45):
 # Enforce the deadline inside the container; killing the Docker client alone leaves its child running.
 return command('docker','exec',container,'timeout','--signal=TERM','--kill-after=5',str(seconds),'python','-c',source)

def verify(probes):
 for attempt in range(40):
  try:
   with urlopen(Request('http://127.0.0.1:8000/static/content.json',headers={'Host':'widechaos.cn'}),timeout=3) as response:
    data=json.load(response)
   if not isinstance(data.get('articles'),list) or not isinstance(data.get('projects'),list):raise ValueError('Content contract failed')
   for path in ('/','/blog','/projects','/tools','/about','/now','/blog/rss.xml'):
    with urlopen(Request('http://127.0.0.1:8000'+path,headers={'Host':'widechaos.cn'}),timeout=5) as response:
     if response.status!=200:raise ValueError('Public route failed')
   for probe in probes:
    host,path,status=probe['host'],probe['path'],probe['status']
    try:urlopen(Request('http://127.0.0.1:8000'+path,headers={'Host':host}),timeout=3)
    except HTTPError as e:
     if e.code!=status:raise ValueError('Authentication boundary changed')
    else:raise ValueError('Private endpoint is accessible')
   return {'articles':len(data['articles']),'projects':len(data['projects'])}
  except (OSError,ValueError):
   if attempt==39:raise
   time.sleep(1)

def run(payload):
 root=Path(payload['root']).resolve();container=payload['container']
 if not payload.get('private_probes'):raise ValueError('Local authentication probes are required')
 if not re.fullmatch('[A-Za-z0-9_.-]+',container):raise ValueError('Invalid container name')
 if not (root/'app/main.py').is_file() or 'site_content.production_adapter' not in (root/'app/main.py').read_text():raise ValueError('Host is not bootstrapped; see docs/deployment.md')
 if not (root/'content/site-catalog.json').is_file() or not (root/'content/blog').is_dir():raise ValueError('Live content is missing')
 control=root/'.site-deploy';control.mkdir(mode=0o700,exist_ok=True)
 with (control/'lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  state_path=control/'state.json';state=json.loads(state_path.read_text()) if state_path.exists() else None
  if state:
   for name,sha in state['files'].items():
    if not allowed(name) or digest(root/name)!=sha:raise ValueError('Managed file changed outside repository: '+name)
  if payload['operation']=='rollback':
   if not state or not state.get('backup'):raise ValueError('No rollback snapshot')
   backup=control/state['backup'];record=json.loads((backup/'snapshot.json').read_text())
   restore(root,backup,record['files']);command('docker','restart',container);health=verify(payload['private_probes'])
   previous=record['previous']
   if previous:atomic(state_path,json.dumps(previous,indent=2).encode())
   else:state_path.unlink(missing_ok=True)
   return {'ok':True,'operation':'rollback','revision':previous['revision'] if previous else 'pre-migration',**health}
  if payload['operation']=='inventory':return {'ok':True,'operation':'inventory','files':{name:digest(root/name) for name in payload['names'] if allowed(name)}}
  body=base64.b64decode(payload['archive'],validate=True);files,manifest=unpack(body,root)
  changes=[name for name,value in files.items() if digest(root/name)!=hashlib.sha256(value).hexdigest()]
  if not payload['apply']:return {'operation':'plan','revision':manifest['revision'],'changes':changes,'liveContent':'preserved'}
  require_capacity()
  # The host's existing framework remains intact; only this small dependency is needed.
  preflight(container,'import bleach,markdown,yaml; from app.routes import blog; assert callable(blog._parse)')
  backup=control/('before-'+str(time.time_ns()));backup.mkdir(mode=0o700)
  for name in files:
   target=root/name
   if target.is_symlink() or any(p.is_symlink() for p in target.parents if p!=root.parent):raise ValueError('Symlink destination is forbidden')
   if target.is_file():
    old=backup/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,old)
  atomic(backup/'snapshot.json',json.dumps({'files':list(files),'previous':state},indent=2).encode())
  before_content={str(p.relative_to(root)):digest(p) for p in (root/'content/blog').glob('*.md')}
  before_content['content/site-catalog.json']=digest(root/'content/site-catalog.json')
  try:
   for name,value in files.items():atomic(root/name,value)
   # This runs with production's Python and original Markdown renderer before restart.
   preflight(container,'from app.site_content.content_service import ContentService; from app.site_content.ssr import render; from app.routes import blog; s=ContentService("content/site-catalog.json",blog_dir="content/blog",render=blog._parse); d=s.bundle(); page,status=render("app/personal_site","/",d); assert status==200; assert isinstance(d["articles"],list)')
   if any(digest(root/name)!=sha for name,sha in before_content.items()):raise ValueError('Content changed during deployment; inspect concurrent publishing')
   command('docker','restart',container);health=verify(payload['private_probes'])
   release=control/manifest['revision'];release.mkdir(exist_ok=True,mode=0o700)
   atomic(release/'release.tar.gz',body);atomic(release/'release.json',json.dumps(manifest,indent=2).encode())
   atomic(state_path,json.dumps({**manifest,'backup':backup.name},indent=2).encode())
   return {'ok':True,'operation':'deploy','revision':manifest['revision'],'changedFiles':len(changes),**health}
  except Exception:
   restore(root,backup,files);command('docker','restart',container);verify(payload['private_probes']);raise

if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin)),ensure_ascii=False))
 except Exception as error:print(json.dumps({'ok':False,'error':str(error)}));raise SystemExit(1)
