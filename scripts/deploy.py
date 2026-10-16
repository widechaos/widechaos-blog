"""Deploy a CI-verified Git commit through the existing SSH management path."""
import argparse,base64,json,subprocess,sys
from pathlib import Path
from build_release import ROOT,git,release_bytes

def ci_passed(revision):
 response=subprocess.check_output(['gh','api',f'repos/widechaos/widechaos-blog/actions/workflows/ci.yml/runs?head_sha={revision}&event=push'])
 runs=json.loads(response)['workflow_runs']
 return any(run['head_sha']==revision and run['status']=='completed' and run['conclusion']=='success' for run in runs)

def main():
 p=argparse.ArgumentParser();p.add_argument('--config',type=Path,required=True,help='Private local deployment settings, outside the repository');p.add_argument('--ref',default='origin/main');p.add_argument('--target',help='Existing SSH alias for the content host')
 p.add_argument('--bridge',help='Existing SSH host/alias for the management machine');p.add_argument('--bridge-port',type=int,default=22)
 p.add_argument('--root');p.add_argument('--container');p.add_argument('--timeout',type=int,default=600)
 group=p.add_mutually_exclusive_group();group.add_argument('--apply',action='store_true');group.add_argument('--rollback',action='store_true');a=p.parse_args()
 config_path=a.config.resolve()
 if config_path==ROOT or ROOT in config_path.parents:p.error('Keep deployment settings outside this public repository')
 config=json.loads(config_path.read_text())
 for key in ('target','bridge','bridge_port','root','container'):
  if key in config:setattr(a,key,config[key])
 if not a.target or not a.root or not a.container:p.error('Local settings must name target, root and container')
 if not 1<=a.bridge_port<=65535:p.error('Invalid SSH port')
 if not a.root.startswith('/'):p.error('--root must be absolute')
 if git('status','--porcelain').strip():raise SystemExit('Commit or move local changes before deployment')
 git('fetch','origin','main')
 payload={'root':a.root,'container':a.container,'operation':'rollback' if a.rollback else 'deploy','apply':a.apply,'private_probes':config.get('private_probes',[])}
 if not a.rollback:
  archive,manifest=release_bytes(a.ref)
  # Only commits reachable from main, with successful source checks, can go live.
  subprocess.run(['git','-C',str(ROOT),'merge-base','--is-ancestor',manifest['revision'],'origin/main'],check=True)
  if a.apply and not ci_passed(manifest['revision']):raise SystemExit('The selected commit has no successful push CI run')
  payload['archive']=base64.b64encode(archive).decode()
 script=(ROOT/'scripts/deploy_remote.py').read_text()
 import shlex
 remote_command='python3 -c '+shlex.quote(script)
 options=['-T','-o','BatchMode=yes','-o','ConnectTimeout=15','-o','ServerAliveInterval=10','-o','ServerAliveCountMax=3']
 if a.bridge:
  forward='import json,subprocess,sys\np=json.load(sys.stdin)\nr=subprocess.run('+repr(['ssh',*options,a.target,remote_command])+',input=json.dumps(p),text=True,capture_output=True)\nprint(r.stdout);print(r.stderr[-1000:] if r.returncode else "");raise SystemExit(r.returncode)'
  command=['ssh','-p',str(a.bridge_port),*options,a.bridge,'python3 -c '+shlex.quote(forward)]
 else:command=['ssh',*options,a.target,remote_command]

 try:
  result=subprocess.run(command,input=json.dumps(payload),text=True,capture_output=True,timeout=a.timeout)
 except subprocess.TimeoutExpired:
  raise SystemExit('Deployment transport timed out; verify the host deployment receipt before retrying. No connection settings are printed.')
 print(result.stdout);print(result.stderr[-1000:] if result.returncode else '');raise SystemExit(result.returncode)
if __name__=='__main__':main()
