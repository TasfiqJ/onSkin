from pathlib import Path
import hashlib, json, subprocess

root = Path(__file__).resolve().parent
repo = root.parent / 'c16-candidate'
codec = 'apps/mobile/src/features/today/optionalChangeDraftCodec.ts'
test = 'apps/mobile/src/features/today/optionalChangeDraftProof22.test.ts'
patch = subprocess.check_output(['git', 'diff', '--binary', 'HEAD', '--', codec], cwd=repo)
test_bytes = (repo / test).read_bytes()
test_lines = test_bytes.decode('utf-8').splitlines()
addition = f'diff --git a/{test} b/{test}\nnew file mode 100644\n--- /dev/null\n+++ b/{test}\n@@ -0,0 +1,{len(test_lines)} @@\n'
addition += ''.join('+' + line + '\n' for line in test_lines)
(root / 'REJECTED_CANDIDATE.diff').write_bytes(patch + addition.encode('utf-8'))
(root / 'candidate-proof-invariants.ts').write_bytes(test_bytes)
state = {'status': 'REJECTED_PROTECTED_REGRESSION', 'head': subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),
         'files': {name: hashlib.sha256((repo / name).read_bytes()).hexdigest() for name in [codec, test]},
         'focusedReceipt': 'candidate-focused.json', 'candidateNewInMemoryTests': 3,
         'reason': 'Exact outer-draft/inner-event source proof equality refuses canonical v5 readback. Existing assertion unchanged.'}
(root / 'CANDIDATE_SOURCE.json').write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
