"""Reject the tempting root-only node-forge removal in an isolated clone."""
import datetime, hashlib, json, os, pathlib, subprocess, sys, time, urllib.request
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=False)
npm=['node',os.environ.get('WAVE_NPMCLI','/tmp/onskin-m103-wave01-checks-7d13be9c/npm-runtime/node_modules/npm/bin/npm-cli.js')]
receipts=[]
def run(name,argv,timeout=600):
    begin=time.time()
    with (out/(name+'.log')).open('wb') as f:
        try: code=subprocess.run(argv,cwd=root,stdout=f,stderr=subprocess.STDOUT,timeout=timeout,env={**os.environ,'npm_config_cache':os.environ.get('WAVE_CANDIDATE_CACHE',str(out/'cache'))}).returncode
        except subprocess.TimeoutExpired: code=124
    receipts.append({'name':name,'argv':argv,'cwd':str(root),'exit':code,'started_unix':begin,'seconds':time.time()-begin,'log_sha256':hashlib.sha256((out/(name+'.log')).read_bytes()).hexdigest()})
    print(json.dumps({'name':name,'exit':code}),flush=True)
run('delete-direct',npm+['pkg','delete','devDependencies.node-forge'])
run('candidate-lock',npm+['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'])
run('candidate-ci',npm+['ci','--no-audit','--no-fund'])
run('candidate-audit',npm+['audit','--package-lock-only','--audit-level=high','--json'])
run('archive-tests',['node','--test','scripts/phase9/ios-archive-privacy-evidence.test.mjs'])
run('candidate-graph',npm+['ls','node-forge','--all','--json'])
patch=subprocess.check_output(['git','diff','--','package.json','package-lock.json'],cwd=root)
(out/'NON_ADMITTING_root_only_removal.patch').write_bytes(patch)
rows=[]
for name in ('node-forge','@expo/cli'):
    url='https://registry.npmjs.org/'+name.replace('/','%2f')+'/latest'
    raw=urllib.request.urlopen(url,timeout=30).read(); d=json.loads(raw)
    rows.append({'url':url,'metadata_sha256':hashlib.sha256(raw).hexdigest(),'name':d['name'],'version':d['version'],'node_forge_dependency':d.get('dependencies',{}).get('node-forge'),'integrity':d['dist']['integrity']})
audit=json.loads((out/'candidate-audit.log').read_bytes())
(out/'summary.json').write_text(json.dumps({'admission':'NONE','stage_edit':False,'candidate':'Remove only root direct node-forge; NOT A FIX',
    'receipts':receipts,'official_registry':rows,'candidate_audit_counts':audit.get('metadata',{}).get('vulnerabilities'),
    'remaining_node_forge':audit.get('vulnerabilities',{}).get('node-forge'),'decision':'REJECT: vulnerable Expo certificate dependency persists; passing archive fixtures cannot authorize removal or clear the advisory.'},indent=2)+'\n')
