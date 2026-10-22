"""Object-derived complete path inventory and exact-rule diagnostic execution."""
import argparse, gzip, hashlib, json, pathlib, re, subprocess, sys
from candidate import SHA, require, verify, write_json
from integrity import regular, tree, MutationGuard
from capsule import check_runtime

HERE=pathlib.Path(__file__).resolve().parent
SUPPORTED={'.py','.js','.jsx','.mjs','.cjs','.ts','.tsx','.json','.yaml','.yml','.sh','.sql',
           '.html','.css','.go','.java','.kt','.swift','.rb','.php','.c','.h','.cpp','.cc','.rs','.vue','.xml','.tf'}
LANGUAGES={'.py':{'python'},'.js':{'javascript','js'},'.jsx':{'javascript','js'},'.mjs':{'javascript','js'},
    '.cjs':{'javascript','js'},'.ts':{'typescript','ts'},'.tsx':{'typescript','ts'},'.json':{'json'},
    '.yaml':{'yaml'},'.yml':{'yaml'},'.sh':{'bash'},'.html':{'html'},'.go':{'go'},'.java':{'java'},
    '.kt':{'kotlin','kt'},'.swift':{'swift'},'.rb':{'ruby'},'.php':{'php'},'.tf':{'terraform','hcl'}}


def validate_outcomes(value,source_commit,rule_pins):
    require(value.get('source_commit')==source_commit and value.get('admission')=='NONE','STALE_SOURCE_OR_ADMISSION')
    runs=value['runs'];require(len(runs)==len(rule_pins) and {r['bundle'] for r in runs}==set(rule_pins), 'MISSING_OR_DUPLICATE_BUNDLE')
    for row in runs:
        require(row['expected_sha256']==rule_pins[row['bundle']],'RULE_DRIFT')
        require(type(row['raw_exit']) is int or (row['raw_exit'] is None and row['status'].startswith(('BLOCKED','TIMEOUT'))),'UNTYPED_EXIT')
        if row.get('coverage_complete'):
            require(row['raw_exit']==0 and not row.get('errors') and not row.get('unscanned_targets') and
                    row['status']=='EXECUTED' and not row.get('skipped_rules') and not row.get('fixpoint_timeouts'), 'FALSE_COMPLETENESS')
    return value


def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])


def snapshot(repo,commit,destination):
    require(not destination.exists() and not destination.is_symlink(), 'NEW_SNAPSHOT_REQUIRED')
    head=git(repo,'rev-parse',commit+'^{commit}').decode().strip()
    require(head==commit, 'FULL_EXACT_COMMIT_REQUIRED')
    tree=git(repo,'rev-parse',commit+'^{tree}').decode().strip()
    rows=[];destination.mkdir(mode=0o700)
    # One Git object reader avoids reopening the large shared pack per path.
    with subprocess.Popen(['git','-C',str(repo),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE) as objects:
        for entry in git(repo,'ls-tree','-rz','--full-tree',commit).split(b'\0'):
            if not entry:continue
            meta,name=entry.split(b'\t',1);mode,kind,oid=meta.decode().split();name=name.decode('utf-8')
            require(not name.startswith('/') and not any(p in {'','.','..'} for p in name.split('/')) and
                    not any(c in name for c in '\\:\0\r\n'), 'SOURCE_PATH_REFUSED')
            row=dict(path=name,mode=mode,git_blob=oid)
            if kind!='blob' or mode not in {'100644','100755'}:
                row.update(partition='UNSUPPORTED',reason='NONREGULAR_GIT_OBJECT')
            else:
                objects.stdin.write((oid+'\n').encode());objects.stdin.flush()
                header=objects.stdout.readline().decode().split()
                require(len(header)==3 and header[:2]==[oid,'blob'],'GIT_OBJECT_HEADER')
                raw=objects.stdout.read(int(header[2]));require(objects.stdout.read(1)==b'\n','GIT_OBJECT_TRUNCATED')
                calculated=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
                require(calculated==oid, 'GIT_BLOB_DRIFT')
                row.update(bytes=len(raw),sha256=SHA(raw))
                try:raw.decode('utf-8');text=b'\0' not in raw
                except UnicodeDecodeError:text=False
                if text:
                    target=destination/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw);target.chmod(0o444)
                    info=target.lstat();row['materialized_identity']=[info.st_dev,info.st_ino,info.st_mtime_ns,info.st_ctime_ns]
                row['materialized']=text
                row.update(partition='PENDING' if text else 'UNSUPPORTED',reason='TEXT_FOR_GENERIC_OR_LANGUAGE_RULES' if text else 'BINARY')
            rows.append(row)
        objects.stdin.close();require(objects.wait()==0,'GIT_OBJECT_READER_FAILED')
    inventory=dict(source_commit=head,source_tree=tree,admission='NONE',materialized_root=str(destination.absolute()),paths=rows)
    write_json(destination.parent/(destination.name+'-inventory.json'),inventory)
    return inventory


def validate_inventory(inventory,repo):
    entries=git(repo,'ls-tree','-rz','--full-tree',inventory['source_commit']).split(b'\0')
    expected={e.split(b'\t',1)[1].decode():e.split(b'\t',1)[0].decode().split()[2] for e in entries if e}
    paths=inventory['paths']
    require(len({r['path'] for r in paths})==len(paths) and {r['path']:r['git_blob'] for r in paths}==expected,
            'TARGET_OMISSION_DUPLICATE_OR_DRIFT')
    require(inventory['source_tree']==git(repo,'rev-parse',inventory['source_commit']+'^{tree}').decode().strip(),'SOURCE_TREE_DRIFT')
    root=pathlib.Path(inventory['materialized_root']);actual=tree(root)
    files={r['path']:r for r in actual if not r.get('directory')}
    materialized={r['path']:r for r in paths if r.get('materialized')}
    require(set(files)==set(materialized),'EXPORTED_PATH_ADDITION_OR_OMISSION')
    expected_dirs={str(parent) for name in materialized for parent in pathlib.PurePosixPath(name).parents if str(parent)!='.'}
    require({r['path'] for r in actual if r.get('directory')}==expected_dirs,'EXPORTED_DIRECTORY_DRIFT')
    for name,row in materialized.items():
        raw=regular(root/name)
        info=(root/name).lstat()
        require([info.st_dev,info.st_ino,info.st_mtime_ns,info.st_ctime_ns]==row['materialized_identity'],'EXPORTED_RENAME_OR_REWRITE')
        require(files[name]['sha256']==row['sha256']==SHA(raw) and len(raw)==row['bytes'] and
            hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==row['git_blob'],'EXPORTED_GIT_BYTES_DRIFT')
    return actual


def sealed_run(candidate,tool,inventory,repo,work,rule,digest,command,out,err,timeout):
    """No source execution on mutable host inputs, including transient rewrites."""
    runtime_roots=[pathlib.Path(d['path']) for d in tool['runtime']['directories']]
    runtime_roots += [pathlib.Path(r['resolved']) for r in tool['runtime']['files']]
    manifest_sha=tool['manifest_sha256']
    with MutationGuard([candidate,pathlib.Path(inventory['materialized_root']),HERE,rule.parent,*runtime_roots]) as guard:
        source_tree=validate_inventory(inventory,repo);verify(candidate,manifest_sha)
        require(SHA(regular(rule))==digest,'RULE_DRIFT')
        request=work/'capsule-request.json'
        write_json(request,dict(runtime=tool['runtime'],source=inventory['materialized_root'],rule=str(rule),rule_sha256=digest,
            python=tool['runtime']['files'][next(i for i,r in enumerate(tool['runtime']['files']) if r['path']=='/usr/bin/python3.12')]['path'],
            copies=[['source',inventory['materialized_root'],source_tree,False],
                    ['venv',str(candidate/'venv'),tool['installed_tree'],True],
                    ['helpers',str(HERE),tree(HERE),False]],command=command))
        wrapped=['/usr/bin/bwrap','--unshare-all','--die-with-parent','--new-session','--ro-bind','/','/',
            '--tmpfs','/tmp','--dir','/tmp/capsule','--ro-bind',str(work),str(work),'--proc','/proc','--dev','/dev','--',sys.executable,'-I','-B',str(HERE/'capsule.py'),'_inside',str(request)]
        guard.check()
        try:
            # A timeout kills the entire namespace/process group, never leaves a
            # scanner rewriting temporary files after TemporaryDirectory cleanup.
            with subprocess.Popen(wrapped,cwd=inventory['materialized_root'],stdout=out,stderr=err,start_new_session=True) as process:
                try:process.wait(timeout=timeout)
                except BaseException:
                    import os,signal
                    os.killpg(process.pid,signal.SIGKILL);process.wait();raise
                result=process.returncode
        finally:
            validate_inventory(inventory,repo);verify(candidate,manifest_sha)
            require(SHA(regular(rule))==digest,'FINAL_RULE_DRIFT');guard.check()
        return result


def run(candidate,repo,commit,work,rules,rule_pins,expected_tool):
    require(not work.exists(),'NEW_SCAN_WORK_REQUIRED');work.mkdir(mode=0o700)
    tool=verify(candidate,expected_tool); source=work/'source'; inventory=snapshot(repo,commit,source)
    validate_inventory(inventory,repo);runs=[]
    targets={r['path'] for r in inventory['paths'] if r['partition']=='PENDING'}
    for name,digest in sorted(rule_pins.items()):
        rule=rules/(name+'.yaml')
        row=dict(bundle=name,expected_sha256=digest,admission='NONE')
        if not rule.is_file() or SHA(rule.read_bytes())!=digest:
            row.update(status='BLOCKED_RULE_UNAVAILABLE_OR_DRIFT',raw_exit=None);runs.append(row);continue
        local=work/'rules'/(name+'.yaml');local.parent.mkdir(exist_ok=True);local.write_bytes(regular(rule))
        # Validate YAML using the same installed parser used by the candidate.
        parse=[str(candidate/'venv/bin/python'),'-I','-B','-c',
            'import sys,json;from ruamel.yaml import YAML;d=YAML(typ="safe").load(open(sys.argv[1]));print(json.dumps([{ "id":r["id"],"languages":r["languages"],"paths":r.get("paths",{})} for r in d["rules"]]))',str(local)]
        with (work/(name+'.rules.json')).open('wb') as out,(work/(name+'.rules.stderr')).open('wb') as err:
            code=sealed_run(candidate,tool,inventory,repo,work,local,digest,parse,out,err,180)
        require(code==0,'RULE_PARSE_FAILURE');rule_rows=json.loads((work/(name+'.rules.json')).read_bytes());ids=[r['id'] for r in rule_rows]
        require(len(set(ids))==len(ids),'DUPLICATE_RULE_ID')
        all_languages={lang.lower() for r in rule_rows for lang in r['languages']}
        applicable=targets if all_languages & {'generic','regex'} else {
            name for name in targets if LANGUAGES.get(pathlib.PurePosixPath(name).suffix.lower(),set()) & all_languages or
            (pathlib.PurePosixPath(name).name=='Dockerfile' and 'dockerfile' in all_languages)}
        row.update(rule_ids=ids,rule_languages=rule_rows,rule_sha256=digest,rule_count=len(ids),
            applicable_targets=sorted(applicable),not_applicable_target_count=len(targets-applicable))
        cmd=[str(candidate/'venv/bin/python'),'-I','-B',str(candidate/'venv/bin/semgrep'),'scan','--oss-only','--metrics=off','--disable-version-check',
             '--config',str(local),'--json','--time','--no-rewrite-rule-ids','--no-git-ignore','--scan-unknown-extensions','--timeout','10','--max-target-bytes','0','.']
        try:
            with (work/(name+'.raw.json')).open('wb') as out,(work/(name+'.stderr')).open('wb') as err:
                code=sealed_run(candidate,tool,inventory,repo,work,local,digest,cmd,out,err,900)
            row.update(raw_exit=code,status='EXECUTED',final_integrity='PASS')
        except subprocess.TimeoutExpired:row.update(raw_exit=None,status='TIMEOUT')
        raw=(work/(name+'.raw.json')).read_bytes(); row['raw_sha256']=SHA(raw)
        row['stderr_sha256']=SHA((work/(name+'.stderr')).read_bytes())
        # Raw source-bearing outputs stay private. Only an exhaustive redacted
        # derivative with content hashes may be published after inspection.
        try:
            result=json.loads(raw);require(isinstance(result.get('results'),list) and isinstance(result.get('errors'),list),'TRUNCATED_REPORT')
            # Preserve the entire ordered rule/file timing matrix once, without
            # repeatedly expanding hundreds of MB of zero timings into summaries.
            profile=work/(name+'.rule-file-profile.json.gz')
            profile.write_bytes(gzip.compress(json.dumps(dict(source_commit=commit,bundle=name,
                rule_sha256=digest,rules=result.get('time',{}).get('rules',[]),targets=result.get('time',{}).get('targets',[])),
                sort_keys=True,separators=(',',':')).encode(),mtime=0))
            scanned=set(result.get('paths',{}).get('scanned',[]));scanned={x.removeprefix('./') for x in scanned}
            row.update(scanned_paths=sorted(scanned),unscanned_targets=sorted(applicable-scanned),
                errors=[{k:v for k,v in e.items() if k in {'type','code','level','path','spans'}} for e in result['errors']],
                findings=[dict(id=SHA(json.dumps(f,sort_keys=True).encode()),path=f['path'].removeprefix('./'),
                    rule=f['check_id'],start=f['start'],end=f['end'],severity=f.get('extra',{}).get('severity'),
                    disposition='UNRESOLVED',git_blob=next((r['git_blob'] for r in inventory['paths'] if r['path']==f['path'].removeprefix('./')),None)) for f in result['results']],
                raw_finding_count=len(result['results']),raw_error_count=len(result['errors']),
                skipped_rules=result.get('skipped_rules',[]),
                profiled_rule_ids=result.get('time',{}).get('rules',[]),
                rule_file_profile=dict(path=profile.name,sha256=SHA(regular(profile)),bytes=profile.stat().st_size),
                fixpoint_timeouts=[{**{k:v for k,v in warning.items() if k in {'error_type','severity','location'}},
                    'message_sha256':SHA(warning.get('message','').encode())} for warning in result.get('time',{}).get('fixpoint_timeouts',[])],
                zero_timing_means='NO_POSITIVE_EXECUTION_PROOF; retain engine prefilter/language/path and error limits')
            row['coverage_complete']=not row['unscanned_targets'] and not row['errors'] and row['raw_exit']==0 and not row['skipped_rules'] and not row['fixpoint_timeouts']
        except (ValueError,KeyError,TypeError):row.update(status='FAILED_OR_INVALID_REPORT',coverage_complete=False)
        row['command']=cmd;runs.append(row)
        write_json(work/'coverage.json',dict(admission='NONE',classification='NON_ADMITTING_UNREVIEWED',
            source_commit=commit,source_tree=inventory['source_tree'],tool_manifest_sha256=SHA((candidate/'candidate.json').read_bytes()),
            inventory_sha256=SHA((work/'source-inventory.json').read_bytes()),runs=runs))
    coverage=dict(admission='NONE',classification='NON_ADMITTING_UNREVIEWED',source_commit=commit,
        source_tree=inventory['source_tree'],tool_manifest_sha256=SHA((candidate/'candidate.json').read_bytes()),
        inventory_sha256=SHA((work/'source-inventory.json').read_bytes()),runs=runs)
    validate_inventory(inventory,repo);verify(candidate,tool['manifest_sha256'])
    validate_outcomes(coverage,commit,rule_pins);write_json(work/'coverage.json',coverage)
    for row in inventory['paths']:
        if row['partition']=='PENDING':
            relevant=[r['bundle'] for r in runs if row['path'] in r.get('applicable_targets',targets)]
            covered=[r['bundle'] for r in runs if row['path'] in r.get('scanned_paths',[])]
            failed=any(row['path'] in r.get('unscanned_targets',[]) or
                any(w.get('location',{}).get('path','').removeprefix('./')==row['path'] for w in r.get('fixpoint_timeouts',[])) or
                any(e.get('path','').removeprefix('./')==row['path'] or any(sp.get('file','').removeprefix('./')==row['path'] for sp in e.get('spans',[])) for e in r.get('errors',[])) for r in runs)
            row.update(partition='SCANNED' if not failed and set(relevant)<=set(covered) else 'FAILED',
                       applicable_bundles=relevant,scanned_bundles=covered)
    write_json(work/'partition.json',inventory)
    complete=len(runs)==len(rule_pins) and all(r.get('coverage_complete') for r in runs)
    findings=sum(r.get('raw_finding_count',0) for r in runs)
    write_json(work/'outcome.json',dict(admission='NONE',execution_complete=complete,findings=findings,
        raw_outcomes=[dict(bundle=r['bundle'],raw_exit=r['raw_exit'],status=r['status']) for r in runs]))
    print(json.dumps(dict(admission='NONE',paths=len(inventory['paths']),supported_targets=len(targets),complete=complete,findings=findings)))
    return 0 if complete and not findings else 1


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for n in ['candidate','repo','commit','work','rules','pins','tool-manifest-sha256']:p.add_argument('--'+n,required=True)
    a=p.parse_args();pins=json.loads(pathlib.Path(a.pins).read_bytes())['rule_bundle_sha256']
    sys.exit(run(pathlib.Path(a.candidate),pathlib.Path(a.repo),a.commit,pathlib.Path(a.work),pathlib.Path(a.rules),pins,a.tool_manifest_sha256))
