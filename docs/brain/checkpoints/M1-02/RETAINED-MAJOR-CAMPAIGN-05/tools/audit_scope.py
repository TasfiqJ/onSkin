import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

repo = Path(r'C:\Users\jasim\Desktop\WeddingCards\work\m102-retained-resilience')
out = Path(__file__).resolve().parent
anchor = '99596bfceac782d740415503bc25452cac623254'
source = sys.argv[1] if len(sys.argv) > 1 else 'HEAD'
def git(*args): return subprocess.check_output(['git', *args], cwd=repo)
source = git('rev-parse', source).decode().strip()
checkpoint = 'docs/brain/checkpoints/M1-02/RETAINED-MAJOR-CAMPAIGN-05/'
def allowed(path):
    return bool(re.fullmatch(r'apps/mobile/src/features/(shelf|today|routine|scheduler|streak|notifications|photos|onboarding|settings|retainedRecovery)/.+', path)
        or re.fullmatch(r'apps/mobile/src/app/(shelf|onboarding|routine|photos|progress|settings)/.+', path)
        or re.fullmatch(r'apps/mobile/src/app/\(tabs\)/(today|shelf|progress|you)\.tsx', path)
        or path in ['docs/USER_FLOW_TREE.md', 'docs/E2E_TESTING_CHECKLIST.md', 'docs/phase-4/generated/source-worklist.json', 'docs/phase-4/generated/source-worklist.md', 'ONSKIN_BRAIN_HANDOFF.txt']
        or path.startswith(checkpoint))
commits = git('rev-list', '--reverse', anchor+'..'+source).decode().splitlines()
history = []
for commit in commits:
    paths = git('diff-tree', '--no-commit-id', '--name-only', '-r', commit).decode().splitlines()
    assert all(allowed(p) for p in paths), paths
    history.append(dict(commit=commit, tree=git('rev-parse', commit+'^{tree}').decode().strip(), paths=paths,
                        subject=git('show', '-s', '--format=%s', commit).decode().strip()))
paths = git('diff', '--name-only', anchor, source).decode().splitlines()
entries = []
for path in paths:
    if path.startswith(checkpoint) or path == 'ONSKIN_BRAIN_HANDOFF.txt': continue
    pair = {}
    for name, rev in [('before', anchor), ('after', source)]:
        line = git('ls-tree', rev, '--', path).decode().strip()
        if not line: pair[name] = None; continue
        mode, kind, blob = line.split('\t')[0].split()
        assert mode == '100644' and kind == 'blob', (path, line)
        raw = git('cat-file', 'blob', blob)
        pair[name] = dict(mode=mode, blob=blob, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    current = (repo/path).read_bytes()
    assert hashlib.sha256(current).hexdigest() == pair['after']['sha256'], path
    entries.append(dict(path=path, **pair))

protected = ['.github','scripts/phase4','scripts/phase9','scripts/security_readiness','supabase','docs/brain/state',
    'docs/brain/reviews','apps/mobile/src/lib/auth','apps/mobile/src/lib/consent','apps/mobile/src/lib/storage',
    'apps/mobile/src/lib/offline','apps/mobile/src/features/photos/encryptedStorage.ts','apps/mobile/src/features/photos/progressCaptureAuthority.ts',
    'apps/mobile/src/features/photos/store.ts','apps/mobile/src/features/notifications/permission.ts',
    'apps/mobile/src/features/streak/streak.ts','apps/mobile/src/app/shelf/[id].tsx','apps/mobile/src/app/onboarding/quiz.tsx',
    'apps/mobile/app.base.json','apps/mobile/app.config.ts','apps/mobile/eas.json','apps/mobile/ios','apps/mobile/android',
    'package.json','package-lock.json','apps/mobile/package.json','AGENTS.md','CLAUDE.md']
# Every existing checkpoint child is immutable; the new sibling is additive.
for parent in ['docs/brain/checkpoints', 'docs/brain/checkpoints/M1-02']:
    for line in git('ls-tree', anchor+':'+parent).decode().splitlines():
        path = parent+'/'+line.split('\t')[1]
        if path != 'docs/brain/checkpoints/M1-02': protected.append(path)
witnesses = []
for path in sorted(set(protected)):
    before = git('ls-tree', anchor, '--', path).decode().strip()
    after = git('ls-tree', source, '--', path).decode().strip()
    assert before == after, ('protected object changed', path, before, after)
    witnesses.append(dict(path=path, anchor_entry=before or None, source_entry=after or None))
    for commit in history:
        assert not any(changed == path or changed.startswith(path+'/') for changed in commit['paths']), ('intermediate protected edit', commit['commit'], path)
report = dict(anchor=anchor, source_commit=source, source_tree=git('rev-parse', source+'^{tree}').decode().strip(), entries=entries,
    protected_objects=witnesses, source_path_count=len(entries), intermediate_commits=history,
    prior_witness_note='Shelf mutations were a negative-scope witness in M1X-04; Campaign05 explicitly authorizes this path. Its changed bytes and preserved cancellation behavior are audited as source here, not falsely listed as immutable. All prior checkpoint blobs remain unchanged.')
(out/'source-scope.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'source':source,'tree':report['source_tree'],'source_paths':len(entries),'protected_objects':len(witnesses),'commits':len(history),'scope':'PASS'}))
