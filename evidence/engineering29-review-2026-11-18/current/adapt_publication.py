from pathlib import Path
import shutil

o = Path(__file__).resolve().parent
old = o.parent / 'ENGINEERING28_EVIDENCE'
a = o / 'audit'
a.mkdir()
for n in ['verify_evidence.py', 'verify_trees.py', 'verify_ancestry.py', 'GITHUB_PREFLIGHT.json']:
    shutil.copyfile(old / 'audit' / n, a / n)
s = (old / 'audit/gather.py').read_text(encoding='utf-8')
s = s.replace('1962b44aec384545638f4aaede36ac64ef31aebe', 'f8a364c38533cbd15b81bd5f52ea37c87cdf4000')
s = s.replace('efd3af803a2a71bd2fdd644ecfd500c619fb996c', '1962b44aec384545638f4aaede36ac64ef31aebe')
s = s.replace('ENGINEERING27R', 'ENGINEERING28').replace('sinceEngineering27R', 'sinceEngineering28')
s = s.replace("'engineering19':E19", "'engineering28':E19")
(a / 'gather.py').write_text(s, encoding='utf-8')
s = (old / 'audit/github_delivery.py').read_text(encoding='utf-8')
s = s.replace('engineering28-review-2026-11-18', 'engineering29-review-2026-11-18').replace('Engineering28', 'Engineering29')
s = s.replace('1962b44aec384545638f4aaede36ac64ef31aebe', 'f8a364c38533cbd15b81bd5f52ea37c87cdf4000')
s = s.replace('ad97b496949cdaae0cbfe5d8c778b3c54576e14f', '1e4d0720aef3d81eef1beed074ce0131c81828e6')
s = s.replace("PARENT='fdcade2438e0d8f8e1611f03cf6f3575dc1600ac'", "PARENT='63898e8dceb11d953bb1e2f137439c7e52c3e6fe'")
s = s.replace("'brain-latest-review-2026-11-18']", "'brain-latest-review-2026-11-18','engineering28-review-2026-11-18']")
s = s.replace("assert current['brain-latest-review-2026-11-18']==PARENT", "assert current['brain-latest-review-2026-11-18']=='fdcade2438e0d8f8e1611f03cf6f3575dc1600ac'\n assert current['engineering28-review-2026-11-18']==PARENT")
s = s.replace("assert current['brain-latest-review-2026-11-18','engineering28-review-2026-11-18']==PARENT", "assert current['brain-latest-review-2026-11-18']=='fdcade2438e0d8f8e1611f03cf6f3575dc1600ac'\n assert current['engineering28-review-2026-11-18']==PARENT")
s = s.replace("cmd=['git','push'", "cmd=['git','-c','push.followTags=false','-c','push.recurseSubmodules=no','push'")
s = s.replace("assert not hook.exists(),'unexpected pre-push hook'", """assert not hook.exists(),'unexpected pre-push hook'
 configured=subprocess.run(['git','config','--get','core.hooksPath'],cwd=R,capture_output=True,text=True)
 effectiveHookPath=configured.stdout.strip()
 if effectiveHookPath:
  hooksRoot=Path(effectiveHookPath);hooksRoot=hooksRoot if hooksRoot.is_absolute()else R/hooksRoot
  assert not (hooksRoot/'pre-push').exists(),'unexpected configured pre-push hook'
 assert txt('remote','get-url','--push','origin')=='https://github.com/TasfiqJ/onSkin.git'
""")
(a / 'github_delivery.py').write_text(s, encoding='utf-8')
print('Prepared isolated evidence-only tooling. No application refs changed.')
