from pathlib import Path
import shutil

out = Path(__file__).resolve().parent
old = out.parent / 'BRAIN_LATEST_REVIEW_2026-11-18'
audit = out / 'audit'; audit.mkdir(exist_ok=True)
for name in ['verify_evidence.py', 'verify_trees.py', 'GITHUB_PREFLIGHT.json']:
    shutil.copyfile(old / 'audit' / name, audit / name)
text = (old / 'audit/github_delivery.py').read_text(encoding='utf-8')
text = text.replace("BRANCH='brain-latest-review-2026-11-18'", "BRANCH='engineering28-review-2026-11-18'")
text = text.replace("PREFIX='evidence/brain-latest-review-2026-11-18/'", "PREFIX='evidence/engineering28-review-2026-11-18/'")
text = text.replace("PARENT='303538aadb990e0f6f5e56c926b874ca54ec1085'", "PARENT='fdcade2438e0d8f8e1611f03cf6f3575dc1600ac'")
text = text.replace("HEAD='efd3af803a2a71bd2fdd644ecfd500c619fb996c'", "HEAD='1962b44aec384545638f4aaede36ac64ef31aebe'")
text = text.replace("TREE='83670a073910a840c69368f1760d5cb59d021054'", "TREE='ad97b496949cdaae0cbfe5d8c778b3c54576e14f'")
text = text.replace("current['engineering19-review-2026-11-16']==PARENT", "current['engineering19-review-2026-11-16']==old['heads/engineering19-review-2026-11-16']['sha']")
text = text.replace("['main','stage/m1-native-runtime47','engineering19-review-2026-11-16']", "['main','stage/m1-native-runtime47','engineering19-review-2026-11-16','brain-latest-review-2026-11-18']")
text = text.replace("assert current['pr48']==", "assert current['brain-latest-review-2026-11-18']==PARENT\n assert current['pr48']==")
text = text.replace('relay latest Engineering27R source', 'publish Engineering28 local checkpoint')
text = text.replace("STAGE=O/'stage-v2'", "STAGE=O/'stage'")
(audit / 'github_delivery.py').write_text(text, encoding='utf-8')
gather = (old / 'audit/gather.py').read_text(encoding='utf-8').split('inventory=[]; historical=[]')[0]
gather = gather.replace("HEAD='efd3af803a2a71bd2fdd644ecfd500c619fb996c'", "HEAD='1962b44aec384545638f4aaede36ac64ef31aebe'")
gather = gather.replace("E19='2f699f6157c1d6414b7e74661a4e11e89a77ed92'", "E19='efd3af803a2a71bd2fdd644ecfd500c619fb996c'")
gather = gather.replace('RECENT_ENGINEERING19_TO_LATEST.patch', 'SESSION_ENGINEERING27R_TO_FINAL.patch').replace('CUMULATIVE_PR48_TO_LATEST.patch', 'CUMULATIVE_PR48_TO_FINAL.patch')
gather = gather.replace('sinceEngineering19', 'sinceEngineering27R').replace('COMMITS_SINCE_ENGINEERING19.json', 'COMMITS_SINCE_ENGINEERING27R.json')
gather = gather.replace("'engineering19':E19", "'engineering19':'2f699f6157c1d6414b7e74661a4e11e89a77ed92','engineering27R':E19")
gather += "\nprint(json.dumps({'head':HEAD,'tree':txt('rev-parse','HEAD^{tree}'),'patches':patchrows,'ancestryObjects':len(objects),'newCommits':len(commits)},indent=2))\n"
(audit / 'gather.py').write_text(gather, encoding='utf-8')
shutil.copyfile(old / 'raw/verify_ancestry.py', audit / 'verify_ancestry.py')
print('Prepared isolated evidence-only tooling; no Git refs changed.')
