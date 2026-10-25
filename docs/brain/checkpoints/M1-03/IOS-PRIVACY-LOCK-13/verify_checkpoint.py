"""Authenticate Campaign13 evidence/source using an independently supplied digest.

This checks identities and custody boundaries; it grants no approval.
"""
import argparse,gzip,hashlib,json,re,stat,subprocess,sys,unicodedata,zipfile
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
PREFIX='docs/brain/checkpoints/M1-03/IOS-PRIVACY-LOCK-13/'
SOURCE='d94196a646d8e6f16936145f87d8822e0fff9ed5'

def require(value,message):
    if not value:raise ValueError(message)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def pairs(rows):
    result={}
    for key,value in rows:
        require(key not in result,'DUPLICATE_JSON_KEY:'+key);result[key]=value
    return result

def parse(raw):
    return json.loads(raw.decode('utf8'),object_pairs_hook=pairs,
        parse_constant=lambda value:(_ for _ in ()).throw(ValueError('NONFINITE_JSON')))

def safe(path):
    require(isinstance(path,str) and re.fullmatch(r'[A-Za-z0-9._/-]+',path) is not None and
        all(part and part not in ('.','..') and not part.endswith('.') for part in path.split('/')),
        'UNSAFE_PATH:'+str(path))
    return path

def regular(path,limit=128*1024*1024):
    for component in [path,*path.parents]:
        value=component.lstat()
        require(not stat.S_ISLNK(value.st_mode) and not getattr(value,'st_file_attributes',0)&1024,
            'LINK_OR_REPARSE:'+str(component))
    value=path.stat()
    require(stat.S_ISREG(value.st_mode) and value.st_nlink==1 and value.st_size<=limit,
        'NONREGULAR_OR_OVERSIZE:'+str(path))
    return path.read_bytes()

def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,stderr=subprocess.PIPE)

def tree(ref):
    result={}
    for row in git('ls-tree','-r','-z',ref).split(b'\0'):
        if row:
            meta,path=row.split(b'\t',1);mode,kind,blob=meta.decode().split()
            result[path.decode()]=dict(mode=mode,kind=kind,blob=blob)
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expected-manifest-sha256',required=True)
    args=parser.parse_args()
    require(re.fullmatch('[0-9a-f]{64}',args.expected_manifest_sha256) is not None,'EXTERNAL_DIGEST_SHAPE')
    raw=regular(HERE/'manifest.json')
    require(sha(raw)==args.expected_manifest_sha256,'EXTERNAL_MANIFEST_DIGEST')
    manifest=parse(raw)
    require(manifest['version']==1 and manifest['source']['commit']==SOURCE and
        manifest['acceptanceGranted'] is False,'MANIFEST_VERSION_OR_ADMISSION')
    actual=set()
    for path in HERE.rglob('*'):
        require(not path.is_symlink() and not getattr(path.lstat(),'st_file_attributes',0)&1024,
            'CHECKPOINT_LINK')
        if path.is_file():actual.add(path.relative_to(HERE).as_posix())
    require(actual==set(manifest['files'])|{'manifest.json'},'CHECKPOINT_EXACT_INVENTORY')
    for name,row in manifest['files'].items():
        data=regular(HERE/safe(name))
        require(len(data)==row['bytes'] and sha(data)==row['sha256'],'CHECKPOINT_FILE:'+name)
    handoff=regular(ROOT/'ONSKIN_BRAIN_HANDOFF.txt')
    require(sha(handoff)==manifest['handoff_sha256'],'HANDOFF_SHA256')
    proof=parse(regular(HERE/'source-proof.json'))
    require(proof['source']==manifest['source'] and proof['source']['commit']==SOURCE,'SOURCE_BINDING')
    require(git('rev-parse',SOURCE+'^{tree}').decode().strip()==proof['source']['tree'],'SOURCE_TREE')
    head=git('rev-parse','HEAD').decode().strip()
    subprocess.run(['git','merge-base','--is-ancestor',SOURCE,head],cwd=ROOT,check=True,capture_output=True)
    current=tree('HEAD')
    for row in proof['changed_files']:
        path=safe(row['path']);identity=current.get(path)
        require(identity is not None and identity['kind']=='blob' and
            identity['mode']==row['after']['mode']=='100644' and identity['blob']==row['after']['blob'],
            'SOURCE_GIT_IDENTITY:'+path)
        require(sha(regular(ROOT/path))==row['after']['sha256'],'SOURCE_SHA256:'+path)
    protected_raw=gzip.decompress(regular(HERE/'protected-files.json.gz'))
    require(len(protected_raw)<=64*1024*1024 and sha(protected_raw)==proof['protected_inventory_sha256'],
        'PROTECTED_INVENTORY')
    protected=parse(protected_raw)
    require(len(protected)==proof['protected_count'],'PROTECTED_COUNT')
    for path,row in protected.items():
        safe(path);identity=current.get(path)
        require(identity is not None and identity['mode']==row['mode'] and identity['blob']==row['blob'],
            'PROTECTED_GIT_IDENTITY:'+path)
        require(sha(regular(ROOT/path))==row['sha256'],'PROTECTED_SHA256:'+path)
    for commit in proof['intermediate_commits']:
        require(git('rev-parse',commit['commit']+'^{tree}').decode().strip()==commit['tree'],'INTERMEDIATE_TREE')
        require(git('rev-list','--parents','-n','1',commit['commit']).decode().split()[1:]==commit['parents'],
            'INTERMEDIATE_PARENTS')
        intermediate=tree(commit['commit'])
        for row in commit['changes']:
            identity=intermediate.get(row['path'])
            require(identity is not None and identity['mode']==row['after']['mode'] and
                identity['blob']==row['after']['blob'],'INTERMEDIATE_FILE')
    for name,row in proof['old_refs'].items():
        require(git('rev-parse',row['sha']+'^{tree}').decode().strip()==row['tree'],'OLD_REF_TREE:'+name)
    for path in proof['absences']:require(not (ROOT/safe(path)).exists(),'ABSENCE:'+path)
    for commit in git('rev-list','--reverse',SOURCE+'..'+head).decode().splitlines():
        parents=git('rev-list','--parents','-n','1',commit).decode().split()
        require(len(parents)==2,'EVIDENCE_TAIL_LINEAR')
        for line in git('diff','--raw','--no-abbrev','--no-renames','-z',parents[1],commit).split(b'\0')[::2]:
            if line:
                require(line.decode().split()[1]=='100644' and line.decode().split()[-1] in ('A','M'),
                    'EVIDENCE_TAIL_MODE')
        paths=git('diff','--name-only','--no-renames',parents[1],commit).decode().splitlines()
        require(all(path=='ONSKIN_BRAIN_HANDOFF.txt' or path.startswith(PREFIX) for path in paths),
            'EVIDENCE_TAIL_SCOPE')
    index=parse(regular(HERE/'archive-index.json'))
    with zipfile.ZipFile(HERE/'evidence.zip') as archive:
        entries=archive.infolist();names=[entry.filename for entry in entries]
        require(len(entries)<=4096 and len(names)==len(set(names)) and set(names)==set(index),'ARCHIVE_INVENTORY')
        folded=set()
        for entry in entries:
            name=safe(entry.filename);key=unicodedata.normalize('NFKC',name).casefold()
            require(key not in folded and stat.S_IFMT(entry.external_attr>>16)==stat.S_IFREG,
                'ARCHIVE_REGULAR_COLLISION')
            folded.add(key);data=archive.read(entry)
            require(sha(data)==index[name]['sha256'] and len(data)==index[name]['bytes'],'ARCHIVE_FILE:'+name)
    require(not git('status','--porcelain=v1'),'CHECKOUT_NOT_CLEAN')
    print(json.dumps(dict(verified=True,source=proof['source'],evidence_head=head,
        evidence_tree=git('rev-parse',head+'^{tree}').decode().strip(),protected_files=len(protected),
        archived_files=len(index),acceptanceGranted=False,release='NO_GO'),sort_keys=True))

if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError,zipfile.BadZipFile) as error:
        print(json.dumps(dict(verified=False,error=str(error),acceptanceGranted=False,release='NO_GO')))
        sys.exit(1)
