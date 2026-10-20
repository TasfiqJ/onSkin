"""Only the independently issued M1-02 transition; prior profiles stay historical."""
import brain
import m1_profile

INPUT = 'docs/brain/checkpoints/M1-02/inputs'
REVIEW = 'docs/brain/reviews/M1-01/ACCEPTANCE'
DIGEST = 'bf9706ffe185ea6287588204818e4ae25dcf017a7e823345aadd30fc79600b78'
BASE = '31307694ebb9895ed8cfb77fa6ac532b789d2810'
TREE = 'c52f49d6f3dfa8cdee98d4a26c707ad8747576d0'
VERSION = 'brain-m1-01-accepted-m1-02-issued-9'
BRANCH = m1_profile.BRANCH
ACTIVE = 'docs/brain/m102-active.json'
CONT_INPUT = 'docs/brain/checkpoints/M1-02/CONT-01/inputs'
CONT_REVIEW = 'docs/brain/reviews/M1-02/REVIEW-01'
CONT_DIGEST = 'a74f8d38924807eb7892a05f6ec9477bf9ee3936a456093279eecac183a903bc'
CONT_BASE = '8c1149116df00f34314357d10929b32f52f6d118'
CONT_TREE = '58ad583815b55736f1e907e02d9c46853f0d1a11'
CONT_VERSION = 'brain-m1-02-partial-reviewed-cont01-issued-10'
CONT_ACTIVE = 'docs/brain/m102-cont01-active.json'


def validate_cont01(root):
    validate(root)
    raw = brain.read(root, CONT_INPUT + '/TASK_MANIFEST.json')
    brain.require(brain.digest(raw) == CONT_DIGEST, 'CONT-01 independent manifest differs')
    issued = brain.decode(raw)
    brain.require(issued['task_id'] == 'M1-02' and issued['iteration'] == 'CONT-01' and
                  issued['branch'] == BRANCH and issued['base_commit'] == CONT_BASE and
                  issued['base_tree'] == CONT_TREE and issued['state_version'] == CONT_VERSION,
                  'Wrong CONT-01 issuance')
    for row in issued['files']:
        blob = brain.read(root, CONT_INPUT + '/' + row['path'])
        brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'],
                      'CONT-01 immutable input differs')
        if row['path'].startswith('BRAIN_REVIEW/'):
            brain.require(blob == brain.read(root, CONT_REVIEW + '/' + row['path'].split('/', 1)[1]),
                          'CONT-01 approved review differs')
    current = brain.load(root, CONT_ACTIVE)
    expected = dict(schema_version=1, task_id='M1-02', iteration='CONT-01', branch=BRANCH,
                    approved_state_version=CONT_VERSION, accepted_tasks=['M0-01', 'M0-02', 'M1-01'],
                    review_overlay=CONT_REVIEW, base_commit=CONT_BASE, base_tree=CONT_TREE,
                    input_manifest_sha256=CONT_DIGEST, protected_source_go=False,
                    main_promotion_authorized=False, incremental_spend_usd=0, active_writers=1,
                    next_task=None, research_requests=[], proposal_expires_utc='2026-10-21T00:00:00Z')
    brain.require(set(current) == set(expected) | {'submission_status'}, 'Unknown CONT-01 field')
    brain.require(all(type(current[k]) is type(v) and current[k] == v for k, v in expected.items()),
                  'Unissued CONT-01 authority')
    brain.require(current['submission_status'] in ['IN_PROGRESS', 'PARTIAL', 'BLOCKED',
                  'SUBMITTED_REVIEW_REQUIRED'], 'Codex cannot accept CONT-01')
    old = brain.load(root, REVIEW + '/roadmap.json')['tasks']
    new = brain.load(root, CONT_REVIEW + '/roadmap.json')['tasks']
    brain.require([(r['id'], r['depends_on']) for r in old] ==
                  [(r['id'], r['depends_on']) for r in new] and len(new) == 47,
                  'CONT-01 roadmap drift')
    brain.git_snapshot(root, {'commit': CONT_BASE, 'tree': CONT_TREE}, 'CONT-01 base')
    brain.ancestor(root, CONT_BASE, brain.git(root, 'rev-parse', 'HEAD'), 'CONT-01 base -> head')
    return current


def validate(root):
    m1_profile.validate(root)
    raw = brain.read(root, INPUT + '/TASK_MANIFEST.json')
    brain.require(brain.digest(raw) == DIGEST, 'M1-02 independently anchored manifest differs')
    issued = brain.decode(raw)
    brain.require(issued['task_id'] == 'M1-02' and issued['branch'] == BRANCH and
                  issued['base_commit'] == BASE and issued['base_tree'] == TREE and
                  issued['state_version'] == VERSION, 'Wrong M1-02 issuance')
    for row in issued['files']:
        blob = brain.read(root, INPUT + '/' + row['path'])
        brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'],
                      'M1-02 immutable input differs')
        if row['path'].startswith('BRAIN_STATE/'):
            brain.require(blob == brain.read(root, REVIEW + '/' + row['path'].split('/', 1)[1]),
                          'M1-01 acceptance successor differs')
    approved = brain.load(root, REVIEW + '/brain_state.json')
    current = brain.load(root, ACTIVE)
    expected = dict(schema_version=1, task_id='M1-02', branch=BRANCH,
                    approved_state_version=VERSION, accepted_tasks=['M0-01', 'M0-02', 'M1-01'],
                    review_overlay=REVIEW, protected_source_go=False, main_promotion_authorized=False,
                    incremental_spend_usd=0, active_writers=1, next_task=None, research_requests=[],
                    proposal_expires_utc='2026-10-21T00:00:00Z', input_manifest_sha256=DIGEST)
    brain.require(set(current) == set(expected) | {'submission_status'}, 'Unknown M1-02 active field')
    brain.require(all(type(current[k]) is type(v) and current[k] == v for k, v in expected.items()),
                  'Unissued M1-02 authority or false acceptance')
    brain.require(approved['state_version'] == VERSION and approved['in_flight_task'] == 'M1-02' and
                  approved['accepted_tasks'] == current['accepted_tasks'], 'Unissued M1-02 successor')
    brain.require(current['submission_status'] in ['IN_PROGRESS', 'PARTIAL', 'BLOCKED',
                  'SUBMITTED_REVIEW_REQUIRED'], 'Codex cannot accept M1-02')
    old = brain.load(root, 'docs/brain/state/roadmap.json')['tasks']
    new = brain.load(root, REVIEW + '/roadmap.json')['tasks']
    brain.require([(r['id'], r['depends_on']) for r in old] ==
                  [(r['id'], r['depends_on']) for r in new] and len(new) == 47,
                  'Roadmap identity/dependency drift')
    brain.git_snapshot(root, {'commit': BASE, 'tree': TREE}, 'Accepted M1-02 base')
    brain.ancestor(root, BASE, brain.git(root, 'rev-parse', 'HEAD'), 'accepted base -> M1-02')
    return current


def report(root, name):
    if '/CONT-01/' in name:
        value = m1_profile.report(root, name, task='M1-02', base=BASE, validator=validate_cont01,
                                  checkpoint='docs/brain/checkpoints/M1-02/CONT-01/',
                                  continuation_bindings={'CONT-01': (CONT_INPUT, CONT_BASE)})
        brain.require(value['schema_version'] == 3 and value['iteration'] == 'CONT-01',
                      'CONT-01 requires exact continuation binding')
        brain.identities(value['scope_matrix'], ['M102-R1-F1', 'M102-R1-F2', 'M102-R1-F3',
                         'M102-CORRECTION', 'M102-PRIVACY', 'M102-EVIDENCE', 'M102-PROTECTED'])
        correction = next(row for row in value['scope_matrix'] if row['id'] == 'M102-CORRECTION')
        brain.require(correction.get('undo') == 'UNAVAILABLE_RETAINED_APPEND_ONLY' and
                      correction['status'] != 'PASS', 'Retained undo cannot PASS')
        return value
    brain.require(name.startswith('docs/brain/checkpoints/M1-02/'), 'Wrong M1-02 report path')
    value = m1_profile.report(root, name, task='M1-02', base=BASE, validator=validate,
                              checkpoint='docs/brain/checkpoints/M1-02/')
    brain.require(value['schema_version'] == 2, 'M1-02 uses the guarded v2 report')
    brain.identities(value['scope_matrix'], ['M102-TODAY', 'M102-CYCLE', 'M102-REPLAY',
                     'M102-DIARY', 'M102-REMIND', 'M102-BOUNDARY',
                     'M102-CLAIMS-MONEY', 'M102-EVIDENCE'])
    return value
