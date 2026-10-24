"""Build the factual execution index and non-self-referential byte manifest."""
import datetime, hashlib, json, pathlib, sys

CP = pathlib.Path(__file__).resolve().parent
ROOT = CP.parents[4]

def save(path, value):
    path.write_bytes((json.dumps(value, indent=2) + '\n').encode())

if '--manifest' in sys.argv:
    entries = []
    for path in sorted([p for p in CP.rglob('*') if p.is_file() and p.name != 'evidence-manifest.json'] + [ROOT / 'ONSKIN_BRAIN_HANDOFF.txt']):
        data = path.read_bytes()
        entries.append(dict(path=path.relative_to(ROOT).as_posix(), bytes=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
            git_blob=hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()))
    save(CP / 'evidence-manifest.json', dict(excluded_self='evidence-manifest.json', entries=entries))
    print('Manifest:', len(entries), 'regular evidence/handoff entries; excludes itself.')
else:
    scope = json.loads((CP / 'source-scope.json').read_bytes())
    preflight = json.loads((CP / 'preflight.json').read_bytes())
    receipts = []
    for path in sorted((CP / 'receipts').glob('*.json')):
        receipt = json.loads(path.read_bytes())
        receipts.append(dict(path=path.relative_to(ROOT).as_posix(), **receipt))
    report = dict(schema_version=1, status='SUBMITTED_REVIEW_REQUIRED',
        evidence_class='CODEX_REPRODUCED_SOURCE_AND_SYNTHETIC_WEB',
        authorization='M1X-RETAINED-EXPERIENCE04-CLIENT-CANDIDATE-01',
        created_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        branch='stage/m1-retained-resilience', pr=11,
        anchor=scope['anchor'], source_commit=scope['source_commit'], source_tree=scope['source_tree'],
        source_paths=13, production_paths=5, test_paths=5, flow_paths=1, generated_paths=2,
        delivery_commit=None, delivery_tree=None,
        delivery_note='Actual evidence-tail identity and its CI are read after push and reported in PR11/final response; no future self-hash.',
        validation=dict(new_regressions=18, original_failure_vectors=17, original_safeguards=1,
            retained_passed=2047, retained_files=170, root_passed=6119, mobile_passed=6095, console_passed=24,
            root_files=479, forced_root_exit=0, forced_typecheck_exit=0, forced_lint_exit=0,
            cached_tasks=0, worklist_exits=[0,1,0], protected_identities=22,
            web375='PASS', web390='PASS', cross_owner390='PASS', screenshots=28,
            changed_geometry_snapshots=20, visible_control_issues=0, horizontal_overflow=0),
        versions=preflight['versions'], intake_ci=preflight['baseline_ci'],
        final_head_ci='Separate actual post-push readback; no borrowed status.',
        source_scope='source-scope.json', source_history='source-commits.json', receipts=receipts,
        limitations=['Native/device photo filesystem and camera NOT_RUN', 'OS permission/delivery NOT_RUN',
            'Installed offline cold start NOT_RUN', 'Paid-positive/provider/hosted replay NOT_RUN',
            'Clinical/native/signing/TestFlight/release NOT_AUTHORIZED'],
        gates=dict(original_g97='FAIL/NO_GO', m103='BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED',
            m201='NOT_AUTHORIZED', main_promotion=False, proposal_expiry_utc='2026-10-21T00:00:00Z'),
        spend_usd=0)
    save(CP / 'completion-report.json', report)
    print('Report:', len(receipts), 'actual command receipts; versions:', preflight['versions'])
