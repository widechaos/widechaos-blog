"""Catalog authoring helpers for the existing content_cli; standard library only."""
import argparse,copy,fcntl,hashlib,ipaddress,json,os,re,tempfile
from datetime import date,datetime,timezone
from pathlib import Path
from urllib.parse import urlparse

ORIGIN = 'https://widechaos.cn'
SLUG = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
FM = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.S)
EXTENSIONS = ['fenced_code', 'codehilite', 'tables', 'toc', 'sane_lists', 'admonition', 'attr_list']
FIELDS = {
 'projects': ('id','title','tag','zh','en','url','kind','article','status','publishedAt','updatedAt','featuredRank','demo','topics','tool'),
 'tools': ('id','title','titleZh','titleEn','zh','en','url','availability','tag','status'),
 'collection': ('title','url','image','kind','status'),
}

def digest(value):
 return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def public_url(value):
 try:
  u=urlparse(value)
  if u.scheme!='https' or not u.hostname or u.username or u.password: return False
  host=u.hostname.lower()
  if host=='localhost' or host.endswith(('.local','.localhost','.internal')): return False
  try:
   if not ipaddress.ip_address(host).is_global: return False
  except ValueError: pass
  return True
 except (ValueError,TypeError): return False

def valid_date(value):
 try: return isinstance(value,str) and date.fromisoformat(value).isoformat()==value
 except ValueError: return False

def validate_catalog(catalog):
 """Validate authoring records; unpublished records stay private."""
 if not isinstance(catalog,dict): raise ValueError('Catalog must be an object')
 for section in FIELDS:
  items=catalog.get(section,[])
  if not isinstance(items,list): raise ValueError(section+' must be an array')
  seen=set()
  for item in items:
   if not isinstance(item,dict) or item.get('status') not in ('published','draft','archived'): raise ValueError(section+': explicit status required')
   key=item.get('id') if section!='collection' else (item.get('title'),item.get('url'),item.get('image'))
   if section!='collection' and not SLUG.fullmatch(str(key or '')): raise ValueError(section+': invalid id')
   if key in seen: raise ValueError(section+': duplicate record')
   seen.add(key)
   if item['status']!='published': continue
   if not str(item.get('title','')).strip(): raise ValueError(section+': title required')
   if section!='collection' and not public_url(item.get('url')): raise ValueError(section+': public HTTPS URL required')
   if section=='collection':
    image=item.get('image','');url=item.get('url','')
    if not re.fullmatch(r'/static/[A-Za-z0-9_./%-]+',image) or '..' in image: raise ValueError('Invalid collection asset path')
    if not public_url(url) and not (url.startswith('assets/') and '..' not in url): raise ValueError('Invalid collection URL')
   if section=='projects':
    if not all(isinstance(item.get(k),str) and item[k].strip() for k in ('zh','en','kind')): raise ValueError('Project descriptions and kind required')
    if item['kind'] not in catalog.get('projectKinds',{}): raise ValueError('Unknown project kind')
    if item.get('demo') not in (None,'router','bulletin','obsidian'): raise ValueError('Unknown demonstration')
    rank=item.get('featuredRank')
    if rank is not None and (not isinstance(rank,int) or isinstance(rank,bool) or rank<1): raise ValueError('Invalid featured rank')
    if 'tool' in item:
     if not isinstance(item['tool'],dict) or item['tool'].get('availability') not in ('web','install'): raise ValueError('Invalid tool availability')
     if item['tool'].get('url') and not public_url(item['tool']['url']): raise ValueError('Invalid tool URL')
   if section=='tools' and (item.get('availability') not in ('web','install') or not all(item.get(k) for k in ('zh','en'))): raise ValueError('Invalid tool')
   for field in ('publishedAt','updatedAt'):
    if field in item and not valid_date(item[field]): raise ValueError('Invalid '+field)
   if item.get('updatedAt') and item.get('publishedAt') and item['updatedAt']<item['publishedAt']: raise ValueError('Update precedes publication')
   if any(topic not in catalog.get('topics',{}) for topic in item.get('topics',[])): raise ValueError('Unknown topic')
 for section in ('topics','projectKinds'):
  if not isinstance(catalog.get(section,{}),dict): raise ValueError('Invalid label dictionary')
  for label in catalog.get(section,{}).values():
   if not isinstance(label,dict) or not label.get('zh') or not label.get('en'): raise ValueError('Bilingual labels required')
 for key,meta in catalog.get('articleMetadata',{}).items():
  if not SLUG.fullmatch(key) or not isinstance(meta,dict): raise ValueError('Invalid article metadata')
  if set(meta)-{'summary','topics','translationKey','updatedAt','discussionUrl'}: raise ValueError('Only public article metadata may enter the catalog')
 return catalog

def read_catalog(path):
 value=json.loads(Path(path).read_text());validate_catalog(value);return value

def merge_catalog(base,patch):
 if not isinstance(patch,dict):raise ValueError('Patch must be an object')
 permitted={'projects','tools','collection','topics','projectKinds','articleMetadata','categoryLabels'}
 if set(patch)-permitted:raise ValueError('Unsupported catalog sections; article bodies and publication status belong to the blog engine')
 result=copy.deepcopy(base)
 for section,values in patch.items():
  if section in FIELDS:
   if not isinstance(values,list):raise ValueError('Records must be arrays')
   key=lambda i:i.get('id') if section!='collection' else (i.get('title'),i.get('url'),i.get('image'))
   existing={key(i):i for i in result.get(section,[])};seen=set()
   for item in values:
    if not isinstance(item,dict) or item.get('status') not in ('published','draft','archived'):raise ValueError('Each record requires explicit status')
    if set(item)-set(FIELDS[section]):raise ValueError('Unsupported record fields')
    k=key(item)
    if not k or k in seen:raise ValueError('Missing or duplicate update key')
    seen.add(k);existing[k]={**existing.get(k,{}),**item}
   result[section]=list(existing.values())
  else:
   if not isinstance(values,dict):raise ValueError('Metadata updates must be dictionaries')
   result[section]={**result.get(section,{}),**copy.deepcopy(values)}
 return validate_catalog(result)

def apply_update(path,patch,expected_revision,authorization,source_reference,dry_run=False):
 if not str(authorization or '').strip() or not public_url(source_reference):raise ValueError('Existing authorization and public source reference required')
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
 with path.with_suffix('.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  current=read_catalog(path);revision=digest(current)
  if expected_revision!=revision:raise ValueError('Catalog changed; read current revision and retry the reviewed update')
  updated=merge_catalog(current,patch)
  if not dry_run:
   fd,tmp=tempfile.mkstemp(prefix=path.name+'.',dir=path.parent)
   try:
    with os.fdopen(fd,'w') as f:json.dump(updated,f,ensure_ascii=False,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    os.chmod(tmp,0o600);os.replace(tmp,path)
   finally:
    if os.path.exists(tmp):os.unlink(tmp)
   # Receipt contains no draft bodies or copied credentials.
   record={'at':datetime.now(timezone.utc).isoformat(),'revision':digest(updated),'previous':revision,'patchDigest':digest(patch),'authorization':authorization,'sourceReference':source_reference}
   audit=path.with_suffix('.audit.jsonl')
   with audit.open('a') as f:f.write(json.dumps(record,ensure_ascii=False)+'\n')
   os.chmod(audit,0o600)
  return {'ok':True,'dryRun':dry_run,'revision':digest(updated),'previous':revision,'counts':{k:len(updated.get(k,[])) for k in FIELDS}}

def dispatch(payload,path=None):
 path=path or os.environ.get('SITE_CATALOG_PATH',str(Path(__file__).resolve().parents[1]/'content/site-catalog.json'))
 op=payload.get('op')
 if op=='site_catalog_get':
  catalog=read_catalog(path);return {'catalog':catalog,'revision':digest(catalog)}
 if op=='site_catalog_update':return apply_update(path,payload.get('patch'),payload.get('expected_revision'),payload.get('authorization'),payload.get('source_reference'),bool(payload.get('dry_run',True)))
 raise ValueError('Unknown catalog operation')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--catalog',required=True);sub=parser.add_subparsers(dest='command',required=True)
 sub.add_parser('get');update=sub.add_parser('update');update.add_argument('--patch',required=True);update.add_argument('--expected-revision',required=True);update.add_argument('--authorization',required=True);update.add_argument('--source-reference',required=True);update.add_argument('--dry-run',action='store_true')
 args=parser.parse_args()
 if args.command=='get':payload={'op':'site_catalog_get'}
 else:payload={'op':'site_catalog_update','patch':json.loads(Path(args.patch).read_text()),'expected_revision':args.expected_revision,'authorization':args.authorization,'source_reference':args.source_reference,'dry_run':args.dry_run}
 print(json.dumps(dispatch(payload,args.catalog),ensure_ascii=False))

if __name__=='__main__':main()
