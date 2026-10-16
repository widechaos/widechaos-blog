"""Check tracked source for accidental credentials and non-website files."""
import json,re,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
PATTERNS={
 'private-key':r'-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----',
 'github-token':r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b',
 'cloud-key':r'\b(?:AKIA[A-Z0-9]{16}|LTAI[A-Za-z0-9]{12,})\b',
 'literal-credential':r'(?i)(?:bearer|appsecret|api[_-]?key|access[_-]?token|password|passwd)\s*[:=]\s*[\"\']([A-Za-z0-9_!@#$%^&*+=/.-]{12,})[\"\']',
}
ROOT_FILES={'.gitattributes','.gitignore','CLAUDE.md','README.md','index.html','package.json','requirements.txt','requirements-production.txt','serve.py','THIRD_PARTY.md'}

def source_path(name):
 p=Path(name)
 if '..' in p.parts or p.is_absolute():return False
 if name in ROOT_FILES:return True
 if p.parts[0] not in {'static','scripts','tests','integration','examples','docs','.github'}:return False
 if p.suffix in {'.pem','.key','.sql','.sqlite','.db','.bak','.log','.pid'} or p.name.startswith('.env'):return False
 if any(part in {'evidence','release','deployment','credentials','backups','content-owner','__pycache__'} for part in p.parts):return False
 if p.parts[0]=='static' and p.suffix not in {'.js','.css','.svg','.png','.jpg','.jpeg','.webp','.gif','.woff','.woff2','.ico','.txt'}:return False
 if any(word in p.name.lower() for word in ('lifehub','quant','cordis','credential','thinking','review_delivery','accounts','deploy_key')):return False
 return True

def findings(files):
 errors=[]
 for name,body in files.items():
  if not source_path(name):errors.append({'file':name,'rule':'non-website-path'})
  try:text=body.decode()
  except UnicodeDecodeError:continue
  for label,pattern in PATTERNS.items():
   if re.search(pattern,text):errors.append({'file':name,'rule':label})
 return errors

def main():
 names=subprocess.check_output(['git','-C',str(ROOT),'ls-files','-z']).decode().split('\0')
 files={name:(ROOT/name).read_bytes() for name in names if name and (ROOT/name).is_file()}
 errors=findings(files);print(json.dumps({'trackedFiles':len(files),'findings':errors},indent=2))
 return bool(errors)
if __name__=='__main__':sys.exit(main())
