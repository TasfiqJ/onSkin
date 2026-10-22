"""Real upstream-core positive/negative synthetic scan, never repository coverage."""
import argparse, json, pathlib, subprocess, sys
from candidate import SHA, require, verify, write_json
from source_scan import snapshot,sealed_run
HERE=pathlib.Path(__file__).resolve().parent


def exercise(candidate,work):
    tool=verify(candidate);require(not work.exists(),'NEW_FIXTURE_WORK_REQUIRED');work.mkdir(mode=0o700)
    repo=work/'repo';repo.mkdir()
    (repo/'vulnerable.py').write_text('value = eval(input())\n')
    (repo/'benign.py').write_text('value = int(input())\n')
    def git(*args):return subprocess.check_output(['git','-C',str(repo),'-c','gc.auto=0','-c','maintenance.auto=false','-c','core.hooksPath=/dev/null',*args],stderr=subprocess.PIPE)
    git('init','-q');git('add','.')
    git('-c','user.name=Synthetic','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','Synthetic fixture')
    inventory=snapshot(repo,git('rev-parse','HEAD').decode().strip(),work/'source')
    rule='rules:\n- id: synthetic-eval\n  languages: [python]\n  severity: ERROR\n  message: synthetic-only\n  pattern: eval(...)\n'
    (work/'rules').mkdir();rule_path=work/'rules/rule.yaml';rule_path.write_text(rule)
    command=[str(candidate/'venv/bin/python'),'-I','-B',str(candidate/'venv/bin/semgrep'),'scan','--oss-only','--metrics=off','--disable-version-check',
             '--config',str(rule_path),'--json','--no-git-ignore','.']
    with (work/'stdout.json').open('wb') as out,(work/'stderr.txt').open('wb') as err:
        code=sealed_run(candidate,tool,inventory,repo,work,rule_path,SHA(rule.encode()),command,out,err,120)
    stdout=(work/'stdout.json').read_bytes();stderr=(work/'stderr.txt').read_bytes()
    valid=False;findings=None;errors=None
    try:
        result=json.loads(stdout);findings=result['results'];errors=result['errors']
        valid=code==0 and not errors and len(findings)==1 and findings[0]['path'].endswith('vulnerable.py') and findings[0]['check_id'].endswith('synthetic-eval')
    except (ValueError,KeyError,TypeError):pass
    write_json(work/'outcome.json',dict(admission='NONE',evidence_class='SYNTHETIC_COMPATIBILITY_ONLY',
        candidate_manifest_sha256=tool['manifest_sha256'],source_commit=inventory['source_commit'],command=command,raw_exit=code,
        stdout_sha256=SHA(stdout),stderr_sha256=SHA(stderr),expected_one_vulnerable_zero_benign=valid,
        finding_count=None if findings is None else len(findings),error_count=None if errors is None else len(errors)))
    print(json.dumps(dict(admission='NONE',synthetic_compatibility=valid,raw_exit=code)))
    return 0 if valid else 1


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('candidate',type=pathlib.Path);p.add_argument('new_work',type=pathlib.Path)
    a=p.parse_args();sys.exit(exercise(a.candidate,a.new_work))
