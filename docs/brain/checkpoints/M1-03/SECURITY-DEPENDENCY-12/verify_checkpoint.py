"""Externally anchored Campaign12 source/evidence integrity. Never acceptance."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import stat
import subprocess
import sys
import unicodedata
import zipfile

AUTHORITY='BRAIN-M103-DEPENDENCY-WITNESS12-CANDIDATE-01'
PREFIX='docs/brain/checkpoints/M1-03/SECURITY-DEPENDENCY-12/'
BASE='9e3ba80e09579ee4855948f13297049791c4d5d7'


def require(ok,label):
    if not ok:raise ValueError(label)


def sha(raw):return hashlib.sha256(raw).hexdigest()


def regular(path):
    for p in [path,*path.parents]:
        info=p.lstat()
        require(not stat.S_ISLNK(info.st_mode) and not getattr(info,'st_file_attributes',0)&1024,'LINK_OR_REPARSE:'+str(p))
    require(stat.S_ISREG(path.lstat().st_mode) and path.stat().st_nlink==1,'NONREGULAR:'+str(path))
    return path.read_bytes()


def pairs(rows):
    result={}
    for k,v in rows:
        require(k not in result,'DUPLICATE_JSON_KEY:'+k);result[k]=v
    return result


def parse(raw):return json.loads(raw,object_pairs_hook=pairs)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256',required=True)
    parser.add_argument('--repo-root',type=Path)
    parser.add_argument('--checkpoint-dir',type=Path)
    args=parser.parse_args()
    checkpoint=args.checkpoint_dir or Path(__file__).resolve().parent
    root=args.repo_root or Path(__file__).resolve().parents[5]
    require(re.fullmatch('[0-9a-f]{64}',args.expected_manifest_sha256) is not None,'EXTERNAL_DIGEST_REQUIRED')
    raw=regular(checkpoint/'manifest.json')
    require(sha(raw)==args.expected_manifest_sha256,'EXTERNAL_MANIFEST_SHA256_MISMATCH')
    manifest=parse(raw)
    require(manifest['authority']==AUTHORITY and manifest['status']=='SUBMITTED_REVIEW_REQUIRED' and
        manifest['acceptanceGranted'] is False,'AUTHORITY_OR_NO_ACCEPTANCE')
    observed={}
    for p in checkpoint.rglob('*'):
        if p.is_dir():
            require(not p.is_symlink() and not getattr(p.lstat(),'st_file_attributes',0)&1024,'LINKED_DIRECTORY')
            continue
        name=p.relative_to(checkpoint).as_posix()
        key=unicodedata.normalize('NFKC',name).casefold()
        require(key not in observed,'CHECKPOINT_COLLISION');observed[key]=name
        regular(p)
    require(set(observed.values())==set(manifest['files'])|{'manifest.json'},'CHECKPOINT_INVENTORY')
    for name,row in manifest['files'].items():
        require(not name.startswith('/') and all(p not in ('','.','..') and ':' not in p and '\\' not in p for p in name.split('/')),'UNSAFE_PATH')
        data=regular(checkpoint/name)
        require(len(data)==row['bytes'] and sha(data)==row['sha256'],'CHECKPOINT_FILE:'+name)
    def git(*args):return subprocess.check_output(['git',*args],cwd=root,stderr=subprocess.PIPE)
    source=manifest['source']
    require(git('rev-parse',source['commit']+'^{tree}').decode().strip()==source['tree'],'SOURCE_TREE')
    require(git('merge-base','--is-ancestor',BASE,source['commit'])==b'','SOURCE_ANCESTRY')
    require(git('merge-base','--is-ancestor',source['commit'],'HEAD')==b'','DELIVERY_ANCESTRY')
    proof=parse(regular(checkpoint/'source-proof.json'))
    for row in proof['pinned_refs']:
        require(git('rev-parse',row['commit']+'^{tree}').decode().strip()==row['tree'],'OLD_REF_TREE:'+row['ref'])
    index={}
    for line in git('ls-files','--stage','-z').split(b'\0'):
        if line:
            info,name=line.decode().split('\t',1);mode,blob,stage=info.split()
            require(stage=='0','UNMERGED_INDEX');index[name]=(mode,blob)
    for row in proof['source_files']:
        path=row['path']
        require(index.get(path)==(row['mode'],row['blob']),'SOURCE_INDEX:'+path)
        require(sha(regular(root/path))==row['sha256'],'SOURCE_BYTES:'+path)
        require(sha(git('show',source['commit']+':'+path))==row['sha256'],'SOURCE_GIT_BYTES:'+path)
    handoff=manifest['handoff']
    require(index.get('ONSKIN_BRAIN_HANDOFF.txt')==(handoff['mode'],handoff['blob']) and
        sha(regular(root/'ONSKIN_BRAIN_HANDOFF.txt'))==handoff['sha256'],'HANDOFF_IDENTITY')
    protected=parse(gzip.decompress(regular(checkpoint/'protected-files.json.gz')))
    for row in protected:
        path=row['path']
        require(index.get(path)==(row['mode'],row['blob']),'PROTECTED_INDEX:'+path)
        require(sha(regular(root/path))==row['sha256'],'PROTECTED_BYTES:'+path)
    actual_chain=git('rev-list','--reverse',BASE+'..'+source['commit']).decode().splitlines()
    require(actual_chain==[x['commit'] for x in proof['source_chain']],'SOURCE_CHAIN')
    for row in proof['source_chain']:
        require(git('rev-parse',row['commit']+'^{tree}').decode().strip()==row['tree'],'INTERMEDIATE_TREE')
        require(git('rev-list','--parents','-n','1',row['commit']).decode().split()[1:]==row['parents'],'INTERMEDIATE_PARENTS')
    for commit in git('rev-list','--reverse',source['commit']+'..HEAD').decode().splitlines():
        require(len(git('rev-list','--parents','-n','1',commit).decode().split())==2,'TAIL_NOT_LINEAR')
        for name in git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines():
            require(name=='ONSKIN_BRAIN_HANDOFF.txt' or name.startswith(PREFIX),'EVIDENCE_TAIL_SCOPE:'+name)
    with zipfile.ZipFile(checkpoint/'evidence.zip') as archive:
        rows=parse(regular(checkpoint/'archive-index.json'))
        require(archive.namelist()==list(rows) and len(set(archive.namelist()))==len(rows),'ARCHIVE_INVENTORY')
        for name,row in rows.items():
            data=archive.read(name)
            require(sha(data)==row['sha256'] and len(data)==row['bytes'],'ARCHIVE_ENTRY:'+name)
    result=subprocess.run([sys.executable,'-B','scripts/release/full-app-j01/check.py'],cwd=root,capture_output=True)
    require(result.returncode==0,'CURRENT_GUARD:'+result.stdout.decode(errors='replace'))
    require(not git('status','--porcelain=v1'),'CHECKOUT_DIRTY')
    print(json.dumps(dict(verified=True,source=source,protected_files=len(protected),checkpoint_files=len(manifest['files'])+1,
        archived_files=len(rows),acceptanceGranted=False,security='FAIL/NO_GO',M2='NOT_AUTHORIZED',release='NO_GO')))


if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,TypeError,OSError,UnicodeError,subprocess.SubprocessError,zipfile.BadZipFile) as error:
        print(json.dumps(dict(verified=False,error=str(error),acceptanceGranted=False)));sys.exit(1)
