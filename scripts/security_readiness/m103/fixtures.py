"""Real upstream-core positive/negative synthetic scan, never repository coverage."""
import argparse, json, pathlib, subprocess, sys
from candidate import SHA, require, verify, write_json
HERE=pathlib.Path(__file__).resolve().parent


def exercise(candidate,work):
    verify(candidate);require(not work.exists(),'NEW_FIXTURE_WORK_REQUIRED');work.mkdir(mode=0o700)
    (work/'vulnerable.py').write_text('value = eval(input())\n')
    (work/'benign.py').write_text('value = int(input())\n')
    rule='rules:\n- id: synthetic-eval\n  languages: [python]\n  severity: ERROR\n  message: synthetic-only\n  pattern: eval(...)\n'
    (work/'rule.yaml').write_text(rule)
    command=[str(candidate/'venv/bin/semgrep'),'scan','--oss-only','--metrics=off','--disable-version-check',
             '--config',str(work/'rule.yaml'),'--json','--no-git-ignore',str(work/'vulnerable.py'),str(work/'benign.py')]
    p=subprocess.run([sys.executable,'-I','-B',str(HERE/'sandbox.py'),str(work/'home'),*command],cwd=work,capture_output=True,timeout=120)
    (work/'stdout.json').write_bytes(p.stdout);(work/'stderr.txt').write_bytes(p.stderr)
    valid=False;findings=None;errors=None
    try:
        result=json.loads(p.stdout);findings=result['results'];errors=result['errors']
        valid=p.returncode==0 and not errors and len(findings)==1 and findings[0]['path'].endswith('vulnerable.py') and findings[0]['check_id'].endswith('synthetic-eval')
    except (ValueError,KeyError,TypeError):pass
    write_json(work/'outcome.json',dict(admission='NONE',evidence_class='SYNTHETIC_COMPATIBILITY_ONLY',
        candidate_manifest_sha256=SHA((candidate/'candidate.json').read_bytes()),command=command,raw_exit=p.returncode,
        stdout_sha256=SHA(p.stdout),stderr_sha256=SHA(p.stderr),expected_one_vulnerable_zero_benign=valid,
        finding_count=None if findings is None else len(findings),error_count=None if errors is None else len(errors)))
    print(json.dumps(dict(admission='NONE',synthetic_compatibility=valid,raw_exit=p.returncode)))
    return 0 if valid else 1


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('candidate',type=pathlib.Path);p.add_argument('new_work',type=pathlib.Path)
    a=p.parse_args();sys.exit(exercise(a.candidate,a.new_work))
