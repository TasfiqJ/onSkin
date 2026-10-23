"""Try registry custody and all named Git-history rule blobs; never replace pins."""
import datetime, gzip, hashlib, json, pathlib, subprocess, sys, urllib.request
root=pathlib.Path('/work/repo');out=pathlib.Path('/evidence/rules');out.mkdir(exist_ok=False);scratch=pathlib.Path('/work/rules');scratch.mkdir(exist_ok=False)
sys.path.insert(0,str(root/'scripts/phase9/security_acceptance'));import contract as c
policy=c.load(c.HERE,'proposal.json');sha=lambda b:hashlib.sha256(b).hexdigest()
rows=[]
for name,pin in policy['rules'].items():
    url='https://semgrep.dev/c/p/'+name
    try:
        raw=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Semgrep/1.181.0'}),timeout=45).read()
        digest=sha(raw);match=digest==pin
        if match:(scratch/(name+'.yaml')).write_bytes(raw)
        rows.append(dict(name=name,url=url,bytes=len(raw),sha256=digest,expected_sha256=pin,matches_pin=match,retained_only_if_authentic=True))
    except Exception as e:rows.append(dict(name=name,url=url,error=type(e).__name__+': '+str(e)))
objects=subprocess.check_output(['git','rev-list','--objects','--all'],cwd=root).decode().splitlines();candidates=[];matched=[];seen=set()
for record in objects:
    oid,_,name=record.partition(' ')
    if oid in seen or not (name.endswith(('.yaml','.yml','.yaml.gz','.yml.gz')) or ('owasp' in name.lower() and name.endswith(('.json','.gz')))):continue
    seen.add(oid)
    if subprocess.check_output(['git','cat-file','-t',oid],cwd=root).strip()!=b'blob':continue
    raw=subprocess.check_output(['git','cat-file','blob',oid],cwd=root);digest=sha(raw)
    candidate=dict(path=name,git_blob=oid,bytes=len(raw),sha256=digest,matches_pin=digest==policy['rules']['owasp-top-ten'])
    if name.endswith('.gz'):
        try:
            inflated=gzip.decompress(raw);candidate.update(inflated_bytes=len(inflated),inflated_sha256=sha(inflated));candidate['matches_pin']|=sha(inflated)==policy['rules']['owasp-top-ten']
            if candidate['matches_pin']:raw=inflated
        except (ValueError,OSError,EOFError):candidate['gzip_status']='NOT_GZIP_OR_INVALID'
    candidates.append(candidate)
    if candidate['matches_pin']:
        (scratch/'owasp-top-ten.yaml').write_bytes(raw);matched.append(candidate)
result=dict(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),source_head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root).decode().strip(),
    approach1_registry=rows,approach2_named_git_history_blobs=candidates,history_candidate_count=len(candidates),history_pin_matches=matched,
    all_four_authentic=all((scratch/(n+'.yaml')).is_file() and sha((scratch/(n+'.yaml')).read_bytes())==pin for n,pin in policy['rules'].items()),
    original_rule_changed=False,current_sast_coverage_claim=False)
(out/'custody.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(registry=rows,history_candidates=len(candidates),history_matches=len(matched),all_four_authentic=result['all_four_authentic']),indent=2))
