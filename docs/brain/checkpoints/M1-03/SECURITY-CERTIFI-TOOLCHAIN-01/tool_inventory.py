import hashlib, importlib.metadata, json, pathlib, subprocess, sys
BASE=pathlib.Path('/tmp/onskin-m103-certifi-0fd3eeace36a492bb97dfcd8d99231aa')
OUT=pathlib.Path(__file__).resolve().parent/'reproduction'
sys.path.insert(0,str(BASE/'repo/scripts/phase9/security_acceptance'))
from contract import tool_tree
rows={}
for name in ('old-tools','new-tools-02'):
    root=BASE/name; site=root/'semgrep'
    packages=sorted([{'name':d.metadata['Name'],'version':d.version} for d in importlib.metadata.distributions(path=[str(site)])],key=lambda d:d['name'].lower())
    binaries={}
    for rel,args in [('scanners/gitleaks',['version']),('scanners/trufflehog',['--version']),('scanners/osv',['--version']),('semgrep/semgrep/bin/semgrep-core',['--version'])]:
        p=root/rel; result=subprocess.run([str(p),*args],capture_output=True,timeout=30)
        binaries[rel]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
                       'version_exit':result.returncode,'version_stdout':result.stdout.decode(),'version_stderr':result.stderr.decode()}
    wheel_report=json.loads((root/'official-wheel-install.json').read_bytes())
    rows[name]={'packages':packages,'binaries':binaries,'semgrep_tree':tool_tree(site,python_site=True),
                'npm_tree':tool_tree(root/'npm/node_modules/npm'),
                'official_install': [{'name':d['metadata']['name'],'version':d['metadata']['version'],
                    'url':d['download_info']['url'],'hashes':d['download_info']['archive_info']['hashes']} for d in wheel_report['install']]}
(OUT/'package-and-binary-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
for key,old in rows['old-tools']['binaries'].items():
    new=rows['new-tools-02']['binaries'][key]
    assert (old['bytes'],old['sha256'])==(new['bytes'],new['sha256'])
    if old!=new: print(json.dumps({'version_output_varies':key,'old':old,'new':new}))
before={p['name'].lower():p['version'] for p in rows['old-tools']['packages']}
after={p['name'].lower():p['version'] for p in rows['new-tools-02']['packages']}
assert {p for p in before.keys()|after.keys() if before.get(p)!=after.get(p)}=={'certifi'}
(OUT/'package-and-binary-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps({'status':'PASS','packages_each':len(before),'only_version_change':'certifi','binary_identities_equal':True}))
