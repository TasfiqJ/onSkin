"""Capture official metadata, download and hash only eligible family wheels."""
import email, hashlib, io, json, pathlib, re, sys, urllib.request, zipfile
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
req=(root/'scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt').read_text()
pins=dict(re.findall(r'^([\w.-]+)==([^ ]+)',req,re.M))
versions={'mcp':'1.30.0',**{n:('0.66b1' if v=='0.58b0' else '1.45.1') for n,v in pins.items() if n.startswith('opentelemetry-')}}
versions['opentelemetry-exporter-http-transport']='0.66b1'
versions['opentelemetry-exporter-otlp-common']='0.66b1'
rows=[]; replacements={}
for name,version in versions.items():
    url=f'https://pypi.org/pypi/{name}/{version}/json'
    try:
        raw=urllib.request.urlopen(url,timeout=45).read(); data=json.loads(raw)
        wheels=[w for w in data['urls'] if w['filename'].endswith('-py3-none-any.whl') and not w['yanked']]
        assert len(wheels)==1, 'UNAMBIGUOUS_UNIVERSAL_WHEEL_REQUIRED'
        wheel=wheels[0]; body=urllib.request.urlopen(wheel['url'],timeout=45).read()
        assert len(body)==wheel['size'] and hashlib.sha256(body).hexdigest()==wheel['digests']['sha256']
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            member=next(n for n in z.namelist() if n.endswith('.dist-info/METADATA'))
            meta=email.message_from_bytes(z.read(member))
            assert meta['Name'].replace('_','-').lower()==name and meta['Version']==version
            metadata_sha256=hashlib.sha256(z.read(member)).hexdigest()
        row={'name':name,'old_version':pins.get(name),'version':version,'metadata_url':url,'metadata_sha256':hashlib.sha256(raw).hexdigest(),
             'wheel_url':wheel['url'],'filename':wheel['filename'],'bytes':len(body),'sha256':wheel['digests']['sha256'],
             'wheel_metadata_sha256':metadata_sha256,'requires_python':meta['Requires-Python'],'requires_dist':meta.get_all('Requires-Dist',[]),'yanked':False,'status':'OFFICIAL_WHEEL_VERIFIED'}
        replacements[name]=f'{name}=={version} --hash=sha256:{row["sha256"]}'
    except Exception as e: row={'name':name,'version':version,'status':'BLOCKED','error':str(e)}
    rows.append(row)
for label,names in [('mcp',{'mcp'}),('otel',{n for n in versions if n!='mcp'}),('combined',set(versions))]:
    if names <= replacements.keys():
        text='\n'.join(replacements.get(line.split('==')[0],line) if line.split('==')[0] in names else line for line in req.splitlines())+'\n'
        text+=''.join(replacements[n]+'\n' for n in sorted(names-pins.keys()))
        (out/f'{label}-requirements.txt').write_text(text)
(out/'official-wheels.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps([{'name':r['name'],'version':r['version'],'status':r['status'],'error':r.get('error')} for r in rows],indent=2))
