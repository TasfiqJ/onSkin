"""Two bounded OWASP custody attempts; exports identities only, never replacement rules."""
import argparse
import datetime
import pathlib
import re
import urllib.parse
import urllib.request

from review import BASE, FLAGS, canonical, git, inflate, need, sha

EXPECTED='5878942efc5da41d2124bbf32a627db594cc63c29c524737c36e54ba677270d1'


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        u=urllib.parse.urlparse(newurl)
        need(u.scheme=='https' and u.hostname=='semgrep.dev' and not u.username and not u.password,'UNTRUSTED_RULE_REDIRECT')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def historical(repo):
    candidates=[]
    for line in git(repo,'rev-list','--objects','--all').decode().splitlines():
        fields=line.split(' ',1)
        if len(fields)!=2:continue
        oid,name=fields
        if not (name.endswith(('.yaml','.yml')) or ('owasp' in name.lower() and name.endswith('.gz'))):continue
        if any(r['git_blob']==oid for r in candidates):continue
        need(len(candidates)<300,'HISTORICAL_RULE_CANDIDATE_LIMIT')
        kind=git(repo,'cat-file','-t',oid).decode().strip()
        if kind!='blob':continue
        size=int(git(repo,'cat-file','-s',oid));row=dict(path=name,git_blob=oid,bytes=size)
        if size>8*1024**2:row.update(status='OVERSIZE_NOT_READ',matches=False)
        else:
            body=git(repo,'cat-file','blob',oid);row.update(sha256=sha(body),matches=sha(body)==EXPECTED,status='HASHED')
            if name.endswith('.gz'):
                try:
                    expanded=inflate(body,8*1024**2)
                    row.update(inflated_bytes=len(expanded),inflated_sha256=sha(expanded),matches=row['matches'] or sha(expanded)==EXPECTED)
                except ValueError as e:row.update(inflation_status=str(e))
        candidates.append(row)
    return dict(approach='AUTHENTIC_LOCAL_GIT_HISTORY',source_ref=BASE,candidates=candidates,
                matches=any(r['matches'] for r in candidates))


def recover(repo,out):
    need(not out.exists(),'NEW_CUSTODY_RECEIPT_REQUIRED')
    attempts=[]
    try:
        request=urllib.request.Request('https://semgrep.dev/c/p/owasp-top-ten',headers={'User-Agent':'onSkin-nonadmitting-custody-review/1'})
        with urllib.request.build_opener(OfficialRedirect()).open(request,timeout=45) as response:
            body=response.read(8*1024**2+1);need(len(body)<=8*1024**2,'RULE_RESPONSE_LIMIT')
            attempts.append(dict(approach='OFFICIAL_NAMED_REGISTRY',url=response.geturl(),status=response.status,
                                 bytes=len(body),sha256=sha(body),matches=sha(body)==EXPECTED,
                                 issuer='Semgrep official registry; OWASP family name is not byte custody'))
    except Exception as e:
        attempts.append(dict(approach='OFFICIAL_NAMED_REGISTRY',status='UNAVAILABLE',error_type=type(e).__name__,matches=False))
    attempts.append(historical(repo))
    result=dict(expected_sha256=EXPECTED,attempts=attempts,
                recorded_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                recovered=any(r['matches'] for r in attempts),**FLAGS)
    out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(canonical(result))
    print('OWASP custody:',len(attempts),'attempts;',len(attempts[1]['candidates']),'historical candidates; recovered=',result['recovered'])


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True)
    a=p.parse_args();recover(a.repo.resolve(),a.out.absolute())
