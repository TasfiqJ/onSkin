"""Isolate the optional-extra conflict from Semgrep solver backtracking."""
import hashlib,json,pathlib,subprocess,sys
out=pathlib.Path('/evidence/extra-check');out.mkdir(exist_ok=False)
args=[sys.executable,'-B','-m','pip','--isolated','--python','/work/bridge2/candidate-env/bin/python','install','--dry-run','--only-binary=:all:','--index-url','https://pypi.org/simple','mcp[cli]==1.30.0','typer==0.1.0']
with (out/'mcp-cli-extra.log').open('wb') as f:code=subprocess.run(args,cwd='/work/bridge2',stdout=f,stderr=subprocess.STDOUT,timeout=120).returncode
raw=(out/'mcp-cli-extra.log').read_bytes();assert code==1 and b'typer' in raw and b'conflicting dependencies' in raw
(out/'mcp-cli-extra.receipt.json').write_text(json.dumps(dict(argv=args,cwd='/work/bridge2',exit=code,log_sha256=hashlib.sha256(raw).hexdigest(),decision='EXPECTED_REFUSAL'),indent=2)+'\n')
print('PASS: isolated incompatible MCP CLI extra refused by genuine pip solver (exit 1)')
