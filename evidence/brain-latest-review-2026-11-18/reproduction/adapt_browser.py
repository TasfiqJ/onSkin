import difflib,hashlib,json,os,subprocess,sys
from pathlib import Path
o=Path(__file__).resolve().parent.parent;r=o.parent/'c16-candidate'
original=(r/'scripts/e2e/optional-change-drafts21.mjs').read_text(encoding='utf-8')
edited=original.replace("from './cat04-catalog-recovery-audit.mjs'", "from '"+(r/'scripts/e2e/cat04-catalog-recovery-audit.mjs').as_uri()+"'")
edited=edited.replace("const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');",'const repo = '+json.dumps(str(r))+';')
old="document.body.innerText.includes('Your optional change notes')"
new="!!document.querySelector('[aria-label=\"Find recorded changes\"]')"
assert edited.count(old)==1;edited=edited.replace(old,new)
p=o/'audit/optional-current-navigation.mjs';assert not p.exists();p.write_text(edited,encoding='utf-8')
(o/'audit/OPTIONAL_BROWSER_ADAPTATION.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),edited.splitlines(True),fromfile='original tracked driver',tofile='external evidence driver')),encoding='utf-8')
(o/'audit/OPTIONAL_BROWSER_ADAPTATION.json').write_text(json.dumps({'reason':'E27 collapsed header is visible before history opens. Original E21 driver mistakes heading for expanded history; captured failure DOM confirms collapsed state.','edits':['relocate helper import to exact existing file URI','pin same existing repository path from external driver','use existing Find recorded changes control as expanded-history marker instead of heading'],'assertionsRemoved':False,'applicationSourceChanged':False,'originalSha256':hashlib.sha256((r/'scripts/e2e/optional-change-drafts21.mjs').read_bytes()).hexdigest(),'externalDriverSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'originalFailurePreserved':True},indent=2),encoding='utf-8')
os.environ['BROWSER_PATH']=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
os.environ['ONSKIN_CHANGE_EVIDENCE']=str(o/'checks/optional-browser-adapted')
raise SystemExit(subprocess.run([sys.executable,'-X','utf8',str(o/'audit/run_check.py'),'current-optional-browser-adapted','node',str(p)],cwd=r).returncode)
