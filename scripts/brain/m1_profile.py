"""Explicitly issued M1-01 profile; historical M0 controls remain unchanged."""
import brain

REVIEW = 'docs/brain/reviews/M0-02/REVIEW-02'
INPUT = 'docs/brain/checkpoints/M1-01/inputs'
BASE = '6aa01995f6dcb94fd28d358badc9f8d1e0273d39'
TREE = '3a75ea56f12f9422affc6e09936993ffa9252c05'
BRANCH = 'stage/m1-retained-safety'
VERSION = 'brain-m0-02-accepted-m1-01-issued-5'
CONT_INPUT = 'docs/brain/checkpoints/M1-01/CONT-01/inputs'
CONT_REVIEW = 'docs/brain/reviews/M1-01/REVIEW-01'
CONT_DIGEST = '18555ec3257fb4c60fdf0f6de47ccc62403b39cf17d9d838cafd8f19b81585fa'
CONT02_INPUT = 'docs/brain/checkpoints/M1-01/CONT-02/inputs'
CONT02_REVIEW = 'docs/brain/reviews/M1-01/REVIEW-02'
CONT02_DIGEST = '4a5812eaac01c099c831a5f445898c1bd101d6a754aac497e67dfe50d966fcd1'
CONT02_BASE = '6b137a4f57ed9ad11cef0c91b49ca0bfaf71427a'


def validate_continuation(root):
    for inputs, review, digest, iteration in [
        (CONT_INPUT, CONT_REVIEW, CONT_DIGEST, 'CONT-01'),
        (CONT02_INPUT, CONT02_REVIEW, CONT02_DIGEST, 'CONT-02'),
    ]:
        raw = brain.read(root, inputs + '/TASK_MANIFEST.json')
        brain.require(brain.digest(raw) == digest, 'Continuation independently anchored manifest differs')
        manifest = brain.decode(raw)
        brain.require(manifest['task_id'] == 'M1-01' and manifest['iteration'] == iteration, 'Wrong continuation')
        for row in manifest['files']:
            blob = brain.read(root, inputs + '/' + row['path'])
            brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'], 'Continuation input changed')
            if row['path'].startswith('BRAIN_REVIEW/'):
                brain.require(blob == brain.read(root, review + '/' + row['path'].split('/', 1)[1]), 'Continuation review changed')


def validate(root):
    # Preserve all original anchors/refusals and the historical M0 profile.
    brain.verify_inputs(root)
    brain.validate_state(root)
    brain.mirrors(root)
    validate_continuation(root)
    _, manifest = brain.package_data(root, 'M1-01')
    issued = brain.load(root, INPUT + '/TASK_MANIFEST.json')
    brain.require(issued['branch'] == BRANCH and issued['base_commit'] == BASE and
                  issued['base_tree'] == TREE and issued['state_version'] == VERSION and
                  issued['main_promotion_authorized'] is False, 'Unexpected M1 authority')
    for row in manifest['files']:
        if row['path'].startswith('BRAIN_STATE/'):
            name = row['path'].split('/', 1)[1]
            brain.require(brain.read(root, REVIEW + '/' + name) ==
                          brain.read(root, INPUT + '/' + row['path']), 'Successor review changed')
    approved = brain.load(root, REVIEW + '/brain_state.json')
    current = brain.load(root, 'docs/brain/active.json')
    brain.require(set(current) == {'schema_version', 'task_id', 'branch', 'submission_status',
                  'approved_state_version', 'accepted_tasks', 'review_overlay',
                  'protected_source_go', 'main_promotion_authorized', 'incremental_spend_usd',
                  'active_writers', 'next_task', 'research_requests', 'proposal_expires_utc', 'continuation'},
                  'Unknown/missing active field')
    brain.require(type(current['schema_version']) is int and current['schema_version'] == 1,
                  'Invalid active schema')
    brain.require(current['task_id'] == approved['in_flight_task'] == 'M1-01' and
                  current['branch'] == BRANCH and current['review_overlay'] == REVIEW and
                  current['approved_state_version'] == approved['state_version'] == VERSION,
                  'Unissued active task/profile')
    brain.require(current['accepted_tasks'] == approved['accepted_tasks'] == ['M0-01', 'M0-02'],
                  'False acceptance')
    brain.require(current['continuation'] == {
        'iteration': 'CONT-02', 'input_manifest_sha256': CONT02_DIGEST,
        'review_overlay': CONT02_REVIEW, 'base_commit': CONT02_BASE,
        'state_version': 'brain-m1-01-partial-reviewed-cont02-issued-7',
    }, 'Unissued continuation overlay')
    brain.require(current['submission_status'] in ['IN_PROGRESS', 'PARTIAL', 'BLOCKED',
                  'SUBMITTED_REVIEW_REQUIRED'], 'Codex cannot accept M1')
    brain.require(current['protected_source_go'] is False and
                  current['main_promotion_authorized'] is False and
                  type(current['incremental_spend_usd']) is int and current['incremental_spend_usd'] == 0 and
                  type(current['active_writers']) is int and current['active_writers'] == 1 and
                  current['next_task'] is None and current['research_requests'] == [] and
                  current['proposal_expires_utc'] == '2026-10-21T00:00:00Z', 'Authority upgrade')
    brain.git_snapshot(root, {'commit': BASE, 'tree': TREE}, 'Accepted M1 base')
    brain.ancestor(root, BASE, brain.git(root, 'rev-parse', 'HEAD'), 'accepted base -> M1')
    brain.require(brain.git(root, 'branch', '--show-current') == BRANCH, 'Wrong M1 branch')
    return current


def report(root, name):
    validate(root)
    value = brain.load(root, name)
    fields = {'schema_version', 'task_id', 'branch', 'status', 'measured',
                  'delivery_ref', 'executions', 'artifacts', 'scope_matrix', 'axes', 'blockers',
                  'context_health'}
    brain.require(set(value) == fields | ({'ci'} if value.get('schema_version') in [2, 3] else set()) |
                  ({'iteration'} if value.get('schema_version') == 3 else set()), 'Unknown/missing M1 report field')
    brain.require(type(value['schema_version']) is int and value['schema_version'] in [1, 2, 3] and
                  value['task_id'] == 'M1-01' and value['branch'] == BRANCH and
                  value['status'] in ['PARTIAL', 'BLOCKED', 'SUBMITTED_REVIEW_REQUIRED'],
                  'Invalid M1 report authority/status')
    brain.require(value['delivery_ref'] == 'refs/heads/' + BRANCH, 'Invalid delivery ref')
    brain.git_snapshot(root, value['measured'], 'Measured M1 source')
    if value['schema_version'] == 3:
        brain.require(value['iteration'] == 'CONT-02' and name.startswith(CONT02_INPUT.rsplit('/', 1)[0] + '/'), 'Wrong continuation report binding')
        brain.ancestor(root, CONT02_BASE, value['measured']['commit'], 'CONT-02 base -> measured')
    brain.ancestor(root, BASE, value['measured']['commit'], 'accepted base -> measured')
    brain.ancestor(root, value['measured']['commit'], brain.git(root, 'rev-parse', 'HEAD'),
                   'measured -> delivery')
    brain.require(isinstance(value['executions'], list) and isinstance(value['artifacts'], list),
                  'Invalid evidence lists')
    artifacts = {item['path']: item for item in value['artifacts']}
    brain.require(len(artifacts) == len(value['artifacts']), 'Duplicate report artifact')
    brain.require(name not in artifacts and 'ONSKIN_BRAIN_HANDOFF.txt' not in artifacts, 'Self-referential report artifact')
    for item in value['artifacts']:
        brain.require(set(item) == {'path', 'sha256'} and
                      brain.digest(brain.read(root, item['path'])) == item['sha256'],
                      'Report artifact hash differs')
    ids = set()
    for entry in value['executions']:
        brain.require(isinstance(entry.get('id'), str) and entry['id'] and entry['id'] not in ids, 'Duplicate/missing execution id')
        ids.add(entry['id'])
        brain.require(entry.get('axis') in ['source', 'integration', 'surface'] and entry.get('admission') == 'NONE', 'Invalid execution axis/admission')
        brain.require(entry['artifact'] in artifacts and artifacts[entry['artifact']]['sha256'] == entry['sha256'], 'Execution receipt not listed')
        receipt = brain.validate_execution(root, entry)
        brain.require(receipt['output']['path'] in artifacts, 'Execution output not listed')
        brain.ancestor(root, entry['source_commit'], value['measured']['commit'], 'execution -> measured')
    # The evidence-only tail cannot silently substitute unmeasured runtime,
    # test, configuration, tooling, or authority changes, including dirty files.
    changed = brain.git(root, 'diff', '--name-only', value['measured']['commit']).splitlines()
    changed += brain.git(root, 'ls-files', '--others', '--exclude-standard').splitlines()
    allowed = lambda path: path == 'ONSKIN_BRAIN_HANDOFF.txt' or path.startswith('docs/brain/checkpoints/M1-01/')
    brain.require(all(allowed(path) for path in changed), 'Implementation differs from measured snapshot: ' + ', '.join(path for path in changed if not allowed(path)))
    # Evidence dimensions stay independent; no M1 report grants external admission.
    brain.require(set(value['axes']) == {'source', 'integration', 'surface', 'physical_device',
                  'live_provider', 'qualified_review', 'clinical', 'commercial', 'release'},
                  'Missing evidence axis')
    brain.require(all(value['axes'][k] in ['NOT_RUN', 'BLOCKED', 'NOT_ADMITTED'] for k in
                  ['physical_device', 'live_provider', 'qualified_review',
                   'clinical', 'commercial', 'release']), 'Unissued external admission')
    for axis in ['source', 'integration', 'surface']:
        status = value['axes'][axis]
        brain.require(status in ['PASS', 'FAIL', 'PARTIAL_TESTED_NOT_COMPLETE', 'NOT_RUN', 'BLOCKED',
                      'FAILED_EXPO_WEB_390_ONBOARDING_TIMEOUT'], 'Invalid typed evidence outcome')
        entries = [entry for entry in value['executions'] if entry['axis'] == axis]
        # The original schema attributed its failed surface runner to source.
        if value['schema_version'] == 1 and axis == 'surface':
            entries = [e for e in value['executions'] if e['id'].startswith('surface-')]
        if status in ['PASS', 'PARTIAL_TESTED_NOT_COMPLETE']:
            brain.require(entries and any(e['status'] == 'PASS' for e in entries), 'Unsupported axis PASS/partial evidence')
            if status == 'PASS':
                brain.require(all(e['status'] == 'PASS' for e in entries) and all(e['source_commit'] == value['measured']['commit'] for e in entries), 'PASS requires exact measured executions without failures')
        if status in ['FAIL', 'FAILED_EXPO_WEB_390_ONBOARDING_TIMEOUT']:
            brain.require(any(e['status'] == 'FAIL' for e in entries), 'Unsupported axis failure')
    brain.require(isinstance(value['scope_matrix'], list) and isinstance(value['blockers'], list), 'Invalid scope/blockers')
    for row in value['scope_matrix']:
        brain.require(isinstance(row, dict) and isinstance(row.get('evidence'), list) and all(e in ids for e in row['evidence']), 'Unbound scope evidence')
        brain.require(row.get('status') in ['PASS', 'FAIL', 'PARTIAL_TESTED', 'SOURCE_TESTED_SURFACE_FAILED', 'NOT_RUN', 'BLOCKED'], 'Invalid scope outcome')
        if row['status'] in ['PASS', 'PARTIAL_TESTED', 'SOURCE_TESTED_SURFACE_FAILED']:
            brain.require(row['evidence'] and any(next(e for e in value['executions'] if e['id'] == ref)['status'] == 'PASS' for ref in row['evidence']), 'Unsupported tested scope')
        if row.get('status') == 'PASS':
            brain.require(row['evidence'] and all(next(e for e in value['executions'] if e['id'] == ref)['status'] == 'PASS' for ref in row['evidence']), 'Unsupported scope PASS')
    seen_ci = set()
    brain.require(isinstance(value.get('ci', []), list), 'Invalid CI inventory')
    for row in value.get('ci', []):
        brain.require(row['run_id'] not in seen_ci, 'Duplicate CI run')
        seen_ci.add(row['run_id'])
        brain.ci_consistency(root, row, artifacts)
    return value
