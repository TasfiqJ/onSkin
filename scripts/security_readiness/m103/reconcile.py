"""Exhaustive redacted, blob-bound proposals. No allowlist or credential probes."""
import argparse, hashlib, json, pathlib, re, subprocess
from functools import lru_cache
from candidate import SHA, require, write_json


@lru_cache(maxsize=64)
def blob(repo,commit,path):
    require(not path.startswith('/') and not any(p in {'','.','..'} for p in path.split('/')), 'FINDING_PATH')
    oid=subprocess.check_output(['git','-C',str(repo),'rev-parse',commit+':'+path]).decode().strip()
    raw=subprocess.check_output(['git','-C',str(repo),'cat-file','blob',oid])
    require(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==oid, 'FINDING_BLOB')
    return oid,raw


def propose_digest(repo,commit,path,start,end,input_path):
    oid,raw=blob(repo,commit,path);_,source=blob(repo,commit,input_path)
    require(type(start) is int and type(end) is int and 1<=start<=end<=len(raw.splitlines()), 'FINDING_RANGE')
    digest=SHA(source);lines=b'\n'.join(raw.splitlines()[start-1:end])
    require(digest.encode() in lines, 'PUBLIC_DIGEST_LOOKALIKE')
    return dict(kind='PUBLIC_INPUT_SHA256_PROPOSAL',git_blob=oid,path=path,start=start,end=end,
                proof_input=input_path,proof_input_sha256=digest,admission='NONE',review='UNREVIEWED_PROPOSAL')


def reconcile_gitleaks(repo,proof_path,sarif_path,output):
    proof_raw=proof_path.read_bytes();proof=json.loads(proof_raw)
    sarif_raw=sarif_path.read_bytes();sarif=json.loads(sarif_raw)
    require(SHA(sarif_raw)==proof['sarif_sha256'], 'ORIGINAL_ARTIFACT_DRIFT')
    head=proof['source']['head'];records=[];seen=set()
    current=proof['commands']['gitleaks-current']['report']
    for scope,values in [('CURRENT',current),('HISTORY',[r for run in sarif['runs'] for r in run.get('results',[])])]:
        for index,finding in enumerate(values):
            # Index and raw hash retain repeated reports as separate records.
            record=dict(scope=scope,index=index,raw_record_sha256=SHA(json.dumps(finding,sort_keys=True).encode()),
                        disposition='UNKNOWN',admission='NONE',review='UNREVIEWED_PROPOSAL')
            if scope=='CURRENT':
                path=finding['File']; marker='/current-source/'
                require(marker in path, 'ORIGINAL_CURRENT_PREFIX')
                path=path.split(marker,1)[1];commit=head
                start,end=finding['StartLine'],finding['EndLine'];rule=finding['RuleID']
            else:
                location=finding['locations'][0]['physicalLocation'];path=location['artifactLocation']['uri']
                region=location['region'];start=region['startLine'];end=region.get('endLine',start);rule=finding['ruleId']
                commit=finding.get('partialFingerprints',{}).get('commitSha','')
                if not re.fullmatch('[0-9a-f]{40}',commit):
                    record.update(path=path,start=start,end=end,rule=rule,reason='HISTORICAL_COMMIT_BINDING_UNRESOLVED')
                    records.append(record);continue
            record.update(path=path,start=start,end=end,rule=rule,source_commit=commit)
            try:
                oid,raw=blob(repo,commit,path)
                require(type(start) is int and type(end) is int and 1<=start<=end<=len(raw.splitlines()), 'FINDING_RANGE')
                record.update(git_blob=oid,content_sha256=SHA(raw),reason='SOURCE_BOUND_REDACTED_MATCH_REQUIRES_PROOF')
                # A narrowly reproducible proposal: manifest references exactly
                # the committed TASK_MANIFEST bytes beside an issued task.
                if scope=='CURRENT' and path.endswith(('.md','.txt','.json')):
                    parent=pathlib.PurePosixPath(path).parent
                    if path.endswith('TASK_MANIFEST.json'):input_path=None
                    elif 'inputs' in parent.parts:input_path=(parent/'TASK_MANIFEST.json').as_posix()
                    else:input_path=None
                    if input_path:
                        try:
                            proposal=propose_digest(repo,commit,path,start,end,input_path)
                            require(start==end and type(finding['StartColumn']) is int and type(finding['EndColumn']) is int,
                                    'REDACTED_COLUMN_PROOF_UNAVAILABLE')
                            line=raw.splitlines()[start-1]
                            begin,finish=finding['StartColumn'],finding['EndColumn']
                            require(1<=begin<=finish<=len(line)+1,'FINDING_COLUMN_RANGE')
                            expected=proposal['proof_input_sha256'].encode()
                            segment=line[begin-1:finish]
                            require(segment.count(expected)==1 and
                                    segment.replace(expected,b'REDACTED').decode()==finding['Match'],
                                    'REDACTED_MATCH_NOT_EXACTLY_REPRODUCIBLE')
                            record.update(disposition='PROPOSED_PUBLIC_INPUT_HASH',proof=proposal,reason='EXACT_COMMITTED_INPUT_REPRODUCTION')
                        except (ValueError,subprocess.CalledProcessError):pass
            except (ValueError,subprocess.CalledProcessError):record['reason']='SOURCE_OR_RANGE_UNRESOLVED'
            identity=(scope,index);require(identity not in seen,'DUPLICATE_FINDING');seen.add(identity);records.append(record)
    expected=len(current)+sum(len(r.get('results',[])) for r in sarif['runs'])
    require(len(records)==expected,'FINDING_OMISSION')
    write_json(output,dict(admission='NONE',classification='NON_ADMITTING_UNREVIEWED',
        evidence_origin='LOCAL_ORIGINAL_DIAGNOSTIC_NOT_PROVIDER_ARTIFACT',
        proof_sha256=SHA(proof_raw),sarif_sha256=SHA(sarif_raw),source_commit=head,
        source_tree=proof['source']['tree'],raw_count=expected,records=records,
        original_exits={k:v['exit'] for k,v in proof['commands'].items()},
        trufflehog_records='ZERO_REPORTED_BY_ORIGINAL; NOT_RERUN_OR_ADMITTED'))
    print(json.dumps(dict(admission='NONE',current=len(current),history=expected-len(current),
        proposed=sum(r['disposition'].startswith('PROPOSED') for r in records),unknown=sum(r['disposition']=='UNKNOWN' for r in records))))


def dependency_paths(lock):
    """Every installed lock path retains its workspace and dev/runtime status."""
    require(lock.get('lockfileVersion')==3,'LOCK_VERSION')
    return [dict(path=path,name=row.get('name') or path.rsplit('node_modules/',1)[-1],
            version=row.get('version'),exposure='DEVELOPER_BUILD' if row.get('dev') else 'RUNTIME_OR_SHARED',
            resolved_sha256=SHA(row.get('resolved','').encode()),integrity=row.get('integrity'))
            for path,row in sorted(lock['packages'].items()) if 'node_modules/' in path and not row.get('link')]


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['repo','proof','sarif','output']:p.add_argument('--'+n,required=True,type=pathlib.Path)
    a=p.parse_args();reconcile_gitleaks(a.repo,a.proof,a.sarif,a.output)
