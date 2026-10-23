"""Authenticate all old/new wheel URLs and every wheel RECORD/member byte."""
import base64,concurrent.futures,csv,email,hashlib,io,json,pathlib,re,sys,urllib.request,zipfile
out=pathlib.Path('/evidence/wheel-proof');out.mkdir(exist_ok=False)
root=pathlib.Path('/work/repo');site=pathlib.Path('/work/bridge2/upstream-proof')
sha=lambda b:hashlib.sha256(b).hexdigest()
old=json.loads(pathlib.Path('/evidence/bridge2/old-wheel-members.json').read_bytes());changed=json.loads(pathlib.Path('/evidence/official/official-wheels.json').read_bytes())
pins={r['name'].lower().replace('_','-'):r for r in old}
for row in changed:pins[row['name']]=row
requests=[('old',r) for r in old]+[('new',r) for r in changed]
def validate(item):
    label,row=item;name=row['name'];version=row['version'];url=f'https://pypi.org/pypi/{name}/{version}/json'
    metadata_raw=urllib.request.urlopen(url,timeout=45).read();data=json.loads(metadata_raw)
    matches=[w for w in data['urls'] if w['filename']==row['filename'] and w['digests']['sha256']==row['sha256']]
    assert len(matches)==1 and not matches[0]['yanked'];wheel=matches[0]
    if label=='old':raw=(pathlib.Path('/work/bridge2/old-wheels')/wheel['filename']).read_bytes()
    else:raw=urllib.request.urlopen(wheel['url'],timeout=45).read()
    assert len(raw)==wheel['size'] and sha(raw)==row['sha256']
    members=[]
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert len(z.namelist())==len(set(z.namelist()))
        record=next(n for n in z.namelist() if n.endswith('.dist-info/RECORD'))
        for member,digest,size in csv.reader(io.StringIO(z.read(record).decode())):
            assert '..' not in pathlib.PurePosixPath(member).parts and not member.startswith('/')
            body=z.read(member)
            if digest:
                algorithm,value=digest.split('=',1);assert algorithm=='sha256'
                assert base64.urlsafe_b64encode(hashlib.sha256(body).digest()).rstrip(b'=').decode()==value and len(body)==int(size)
            members.append(dict(path=member,sha256=sha(body),bytes=len(body)))
        meta=email.message_from_bytes(z.read(next(n for n in z.namelist() if n.endswith('.dist-info/METADATA'))))
        assert meta['Version']==version
        installed_checked=0;exceptions=[]
        if label=='new':
            for item in members:
                if item['path'].endswith('.dist-info/RECORD'):exceptions.append(dict(path=item['path'],reason='pip-generated RECORD retained separately'));continue
                target=site/item['path'];assert target.is_file() and sha(target.read_bytes())==item['sha256'],item['path'];installed_checked+=1
    return dict(label=label,name=name,version=version,filename=wheel['filename'],wheel_url=wheel['url'],sha256=sha(raw),bytes=len(raw),yanked=False,
        pypi_metadata_url=url,pypi_metadata_sha256=sha(metadata_raw),record_members_verified=len(members),installed_members_checked=installed_checked,installed_exceptions=exceptions)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:rows=list(pool.map(validate,requests))
semgrep_source='https://raw.githubusercontent.com/semgrep/semgrep/v1.181.0/cli/pyproject.toml'
try:
    raw=urllib.request.urlopen(semgrep_source,timeout=45).read()
    source=dict(url=semgrep_source,sha256=sha(raw),constraint_lines=[line.strip() for line in raw.decode().splitlines() if any(n in line for n in ('mcp==','opentelemetry-api','opentelemetry-sdk','opentelemetry-exporter-otlp-proto-http'))])
except Exception as e:source=dict(url=semgrep_source,error=type(e).__name__+': '+str(e),status='NOT_RECOVERED')
(out/'proof.json').write_text(json.dumps(dict(wheels=rows,old_wheels=len(old),new_wheels=len(changed),all_verified=True,independent_semgrep_source_reference=source),indent=2)+'\n')
print(json.dumps(dict(old_wheels=len(old),new_wheels=len(changed),all_verified=True,source_reference=source)))
