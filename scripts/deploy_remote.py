"""Apply an allowlisted site release on the existing content host."""
import base64,fcntl,hashlib,io,json,os,re,shutil,subprocess,sys,tarfile,tempfile,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlsplit
from urllib.error import HTTPError

MODULES={'__init__.py','content_service.py','site_catalog.py','ssr.py','production_adapter.py'}

PUBLIC_ROOT={'share-card.js','share-card-pool.js','theme-vermilion.css','manual.css','manual-view.js','tianshu-manual.js','about-copy.js','analytics.js','app.js','content-model.js','style.css','content-layout.css','hero-art.js','home-art.js','project-demos.js','project-demos.css','avatar.png','city-art.png','og-card.jpg','mark.svg','x-sword.svg','collection.js','collection.css','pointer.js','pointer.css','pointer-sword.svg','pointer-sword-active.svg','radar.css','article-peek.js','article-peek.css','scroll-scenes.js'}

CHINA2098_ART = {'5B4rng.jpg', 'ELqvdA.jpg', 'oADgZW.jpg', 'd8dY43.jpg', '4XoXE2.jpg', 'Ye35Oq.jpg', 'rAQgvG.jpg', 'Lelzqw.jpg', '3dl9nD.jpg', '9NXdAR.jpg', 'YeLBvP.jpg', '9mAw9a.jpg', 'lRlmEJ.jpg', '0n0PEK.jpg', '8exKRO.jpg', 'rA0xyJ.jpg', 'XnegW3.jpg', '6bZR06.jpg', 'xYoEJ4.jpg', 'QnPvW8.jpg', 'aYKoBk.jpg', 'xYoEZ2.jpg', 'bKXlem.jpg', 'eJ4KYG.jpg', '0nAY04.jpg', '28l9wa.jpg', 'g8qe0x.jpg', 'w61Ao5.jpg', 'J9av10.jpg', '28l9Ra.jpg'}

def allowed(name):
 p=Path(name)
 if p.is_absolute() or '..' in p.parts:return False
 if name in {'app/personal_site/index.html','bin/site_catalog.py'}:return True
 if p.parent==Path('app/site_content'):return p.name in MODULES
 if p.parent==Path('app/static'):return p.name in PUBLIC_ROOT
 if p.parent==Path('app/static/vendor'):return p.name in {'three.module.js','three.core.js','LICENSE.three.txt'}
 if p.parent==Path('app/static/fonts'):return bool(re.fullmatch(r'[a-z0-9-]+\.woff2',p.name))
 if p.parent==Path('app/static/assets/china2098'):return p.name in CHINA2098_ART
 if p.parent==Path('app/static/assets/share-cards'):
  match=re.fullmatch(r'v1-([0-9]{4})\.jpg',p.name)
  return bool(match and int(match[1])<2190)
 if p.parent==Path('app/static/assets/projects'):return bool(re.fullmatch(r'[a-z0-9-]+-[a-f0-9]{12}\.(?:jpg|jpeg|png|webp)',p.name))
 if p.parent in {Path('app/static/assets/tianshu'),Path('app/static/assets/tianshu/en')}:return bool(re.fullmatch(r'[a-z0-9-]+\.png',p.name))
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
  files[name]=root/name
 if {k:body_digest(v) for k,v in files.items()}!=manifest['files']:raise ValueError('Release hash mismatch')
 required={'app/personal_site/index.html','bin/site_catalog.py'}|{'app/site_content/'+name for name in MODULES}
 if not required.issubset(files):raise ValueError('Incomplete release')
 return files,manifest

def body_digest(value):return digest(value) if isinstance(value,Path) else hashlib.sha256(value).hexdigest()

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None

def atomic(path,body):
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,name=tempfile.mkstemp(prefix='.site-',dir=path.parent)
 try:
  with os.fdopen(fd,'wb') as stream:
   if isinstance(body,Path):
    with body.open('rb') as source:shutil.copyfileobj(source,stream)
   else:stream.write(body)
   stream.flush();os.fsync(stream.fileno())
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
   for path in ('/','/blog','/radar','/projects','/tools','/about','/now','/blog/rss.xml'):
    with urlopen(Request('http://127.0.0.1:8000'+path,headers={'Host':'widechaos.cn'}),timeout=5) as response:
     if response.status!=200 or urlsplit(response.geturl()).path!=path:raise ValueError('Public route failed or redirected: '+path)
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

def validate_source_manifest(manifest):
 if manifest.get('repository')!='https://github.com/widechaos/widechaos-blog' or not re.fullmatch('[a-f0-9]{40}',manifest.get('revision','')):raise ValueError('Invalid source identity')
 if not isinstance(manifest.get('files'),dict) or not all(allowed(name) and isinstance(sha,str) and re.fullmatch('[a-f0-9]{64}',sha) for name,sha in manifest['files'].items()):raise ValueError('Invalid source file manifest')
 required={'app/personal_site/index.html','bin/site_catalog.py'}|{'app/site_content/'+name for name in MODULES}
 if not required.issubset(manifest['files']):raise ValueError('Incomplete release')

def pull_source(manifest,root,stage):
 validate_source_manifest(manifest)
 files={};wanted={}
 for name,sha in manifest['files'].items():
  if digest(root/name)==sha:files[name]=root/name;continue
  if name=='app/personal_site/index.html':source='index.html'
  elif name.startswith('app/static/'):source=name.removeprefix('app/')
  elif name.startswith('app/site_content/'):source='integration/'+Path(name).name
  else:source='integration/site_catalog.py'
  wanted.setdefault(source,[]).append(name)
 if not wanted:return files
 # One immutable public source archive; never accept a caller-supplied URL.
 url='https://codeload.github.com/widechaos/widechaos-blog/tar.gz/'+manifest['revision']
 with urlopen(Request(url,headers={'User-Agent':'widechaos-site-deploy'}),timeout=90) as response:
  with tarfile.open(fileobj=response,mode='r|gz') as archive:
   for item in archive:
    source=item.name.partition('/')[2]
    if source not in wanted:continue
    names=wanted.pop(source);name=names[0]
    if not item.isfile() or not 0<item.size<=20*1024*1024:raise ValueError('Unexpected source member')
    target=stage/name;target.parent.mkdir(parents=True,exist_ok=True)
    with archive.extractfile(item) as incoming,target.open('wb') as outgoing:shutil.copyfileobj(incoming,outgoing,1024*1024)
    sha=digest(target)
    for name in names:
     if sha!=manifest['files'][name]:raise ValueError('Source file hash mismatch')
     files[name]=target
 if wanted or set(files)!=set(manifest['files']):raise ValueError('Source archive omits release files')
 return files

def apply_release(root,container,control,state,state_path,payload,files,manifest,body=None):
 changes=[name for name,value in files.items() if digest(root/name)!=body_digest(value)]
 if not payload['apply']:return {'operation':'plan','revision':manifest['revision'],'changes':changes,'liveContent':'preserved'}
 require_capacity()
 # The host's existing framework remains intact; only this small dependency is needed.
 preflight(container,'import bleach,markdown,yaml; from app.routes import blog; assert callable(blog._parse)')
 backup=control/('before-'+str(time.time_ns()));backup.mkdir(mode=0o700)
 for name in changes:
  target=root/name
  if target.is_symlink() or any(p.is_symlink() for p in target.parents if p!=root.parent):raise ValueError('Symlink destination is forbidden')
  if target.is_file():
   old=backup/name;old.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,old)
 atomic(backup/'snapshot.json',json.dumps({'files':changes,'previous':state},indent=2).encode())
 before_content={str(p.relative_to(root)):digest(p) for p in (root/'content/blog').glob('*.md')}
 before_content['content/site-catalog.json']=digest(root/'content/site-catalog.json')
 try:
  for name in changes:atomic(root/name,files[name])
  # This runs with production's Python and original Markdown renderer before restart.
  preflight(container,'from app.site_content.content_service import ContentService; from app.site_content.ssr import render; from app.routes import blog; s=ContentService("content/site-catalog.json",blog_dir="content/blog",render=blog._parse); d=s.bundle(); page,status=render("app/personal_site","/",d); assert status==200; assert isinstance(d["articles"],list)')
  if any(digest(root/name)!=sha for name,sha in before_content.items()):raise ValueError('Content changed during deployment; inspect concurrent publishing')
  command('docker','restart',container);health=verify(payload['private_probes'])
  release=control/manifest['revision'];release.mkdir(exist_ok=True,mode=0o700)
  if body is not None:atomic(release/'release.tar.gz',body)
  atomic(release/'release.json',json.dumps(manifest,indent=2).encode())
  atomic(state_path,json.dumps({**manifest,'backup':backup.name},indent=2).encode())
  return {'ok':True,'operation':'deploy','revision':manifest['revision'],'changedFiles':len(changes),**health}
 except Exception:
  restore(root,backup,changes);command('docker','restart',container);verify(payload['private_probes']);raise

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
  if 'source_manifest' in payload:
   manifest=payload['source_manifest'];validate_source_manifest(manifest)
   changes=[name for name,sha in manifest['files'].items() if digest(root/name)!=sha]
   if not payload['apply']:return {'operation':'plan','revision':manifest['revision'],'changes':changes,'liveContent':'preserved','transport':'verified-source-pull'}
   require_capacity()
   with tempfile.TemporaryDirectory(prefix='source-',dir=control) as folder:
    files=pull_source(manifest,root,Path(folder))
    return apply_release(root,container,control,state,state_path,payload,files,manifest)
  body=base64.b64decode(payload['archive'],validate=True);files,manifest=unpack(body,root)
  return apply_release(root,container,control,state,state_path,payload,files,manifest,body)

if __name__=='__main__':
 try:print(json.dumps(run(json.load(sys.stdin)),ensure_ascii=False))
 except Exception as error:print(json.dumps({'ok':False,'error':str(error)}));raise SystemExit(1)
