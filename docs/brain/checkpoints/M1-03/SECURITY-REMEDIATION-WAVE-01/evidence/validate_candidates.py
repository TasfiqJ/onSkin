"""Measure family-only file deltas and independently let pip reject bad closures."""
import hashlib, json, os, pathlib, subprocess, sys, time
root=pathlib.Path(sys.argv[1]); package_root=pathlib.Path(os.environ.get('WAVE_PACKAGE_ROOT','/tmp')); base=package_root/'old'; out=pathlib.Path(sys.argv[2]); out.mkdir(exist_ok=False,parents=True)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance')); import contract as c
def files(site):
    return {p.relative_to(site).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in site.rglob('*') if p.is_file() and '__pycache__' not in p.parts and not p.relative_to(site).as_posix().startswith('bin/') and p.name!='RECORD'}
old=files(base/'semgrep'); rows=[]
for label in ('mcp','otel','combined'):
    work=package_root/label; new=files(work/'semgrep')
    delta=[{'path':n,'old_sha256':old.get(n),'new_sha256':new.get(n)} for n in sorted(old.keys()|new.keys()) if old.get(n)!=new.get(n)]
    bad=[r['path'] for r in delta if not ((label!='otel' and r['path'].startswith(('mcp/','mcp-'))) or (label!='mcp' and r['path'].startswith(('opentelemetry/','opentelemetry_'))))]
    (out/(label+'-file-delta.json')).write_text(json.dumps({'label':label,'changed_files':len(delta),'unexpected':bad,'rows':delta},indent=2)+'\n')
    req=pathlib.Path(os.environ.get('WAVE_CANDIDATES','/tmp/onskin-m103-wave01-candidates-7d13be9c'))/(label+'-requirements.txt')
    argv=[sys.executable,'-B','-m','pip','--isolated','install','--dry-run','--ignore-installed','--index-url','https://pypi.org/simple','--require-hashes','--only-binary=:all:','--no-input','--no-compile','--requirement',str(req),'--cache-dir',str(base/'cache/pip')]
    started=time.time()
    with (out/(label+'-resolver.log')).open('wb') as f: code=subprocess.run(argv,cwd=out,stdout=f,stderr=subprocess.STDOUT,timeout=300).returncode
    rows.append({'label':label,'argv':argv,'exit':code,'seconds':time.time()-started,'family_only_delta':not bad,'changed_files':len(delta),'resolver_log_sha256':c.SHA((out/(label+'-resolver.log')).read_bytes()),'eligible':False if code else 'REQUIRES_REVIEW'})
(out/'eligibility.json').write_text(json.dumps(rows,indent=2)+'\n'); print(json.dumps(rows,indent=2))
