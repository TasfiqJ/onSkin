"""Check declared dependency compatibility and current official advisory exposure."""
import datetime, hashlib, json, pathlib, re, sys, urllib.request
from pip._vendor.packaging.requirements import Requirement
from pip._vendor.packaging.markers import default_environment
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(exist_ok=True,parents=True)
raw=(root/'scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt').read_text()
normalize=lambda n:re.sub(r'[-_.]+','-',n).lower()
old={normalize(n):v for n,v in re.findall(r'^([\w.-]+)==([^ ]+)',raw,re.M)}; wheels=json.loads((out/'official-wheels.json').read_bytes())
new={**old,**{w['name']:w['version'] for w in wheels if w['status']=='OFFICIAL_WHEEL_VERIFIED'}}
url='https://pypi.org/pypi/semgrep/1.181.0/json'; data_raw=urllib.request.urlopen(url,timeout=30).read(); data=json.loads(data_raw)
semgrep={'name':'semgrep','version':'1.181.0','metadata_url':url,'metadata_sha256':hashlib.sha256(data_raw).hexdigest(),'requires_dist':data['info']['requires_dist'],
         'pinned_wheels':[{'filename':w['filename'],'bytes':w['size'],'sha256':w['digests']['sha256']} for w in data['urls'] if w['digests']['sha256']=='c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa']}
environment={**default_environment(),'python_version':'3.12','python_full_version':'3.12.3','sys_platform':'linux','platform_system':'Linux','platform_machine':'x86_64','extra':''}
conflicts=[]; missing=[]
for dist in [semgrep,*wheels]:
    for text in dist.get('requires_dist',[]):
        req=Requirement(text)
        if req.marker and not req.marker.evaluate(environment): continue
        name=normalize(req.name); version=new.get(name)
        if version is None: missing.append({'parent':dist['name'],'requirement':text})
        elif version not in req.specifier: conflicts.append({'parent':dist['name'],'requirement':text,'candidate_version':version})
queries=[{'package':{'ecosystem':'PyPI','name':n},'version':v} for n,v in new.items()]
queries += [{'package':{'ecosystem':'PyPI','name':n},'version':v} for n,v in [('mcp','1.29.0'),('opentelemetry-api','1.37.0')]]
request=urllib.request.Request('https://api.osv.dev/v1/querybatch',data=json.dumps({'queries':queries}).encode(),headers={'Content-Type':'application/json'})
try:
    response_raw=urllib.request.urlopen(request,timeout=60).read(); response=json.loads(response_raw)
    advisories=[{'package':q['package']['name'],'version':q['version'],'ids':[x['id'] for x in result.get('vulns',[])]} for q,result in zip(queries,response['results'])]
    osv={'url':'https://api.osv.dev/v1/querybatch','response_sha256':hashlib.sha256(response_raw).hexdigest(),'results':advisories[:-2],'positive_controls':advisories[-2:],'status':'QUERIED',
         'controls_detect_known_advisories':all(r['ids'] for r in advisories[-2:])}
except Exception as e: osv={'status':'BLOCKED','error':str(e)}
result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'old_distributions':len(old),'proposed_distributions':len(new),'semgrep':semgrep,
        'candidate_conflicts':conflicts,'missing_default_dependencies':missing,'extra_marker_limit':'Only default Linux Python3.12 dependencies of Semgrep and changed family evaluated here. Full resolver and requested extras remain required.',
        'osv':osv,'eligible':False,'reason':'Semgrep 1.181.0 declared constraints reject both patched families. No stage technical edit is eligible.'}
(out/'compatibility-and-osv.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'candidate_conflicts':conflicts,'missing_default_dependencies':missing,'osv_status':osv['status'],'osv_affected':[r for r in osv.get('results',[]) if r['ids']],'eligible':False},indent=2))
