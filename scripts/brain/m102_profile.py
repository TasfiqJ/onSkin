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
    brain.require(name.startswith('docs/brain/checkpoints/M1-02/'), 'Wrong M1-02 report path')
    value = m1_profile.report(root, name, task='M1-02', base=BASE, validator=validate,
                              checkpoint='docs/brain/checkpoints/M1-02/')
    brain.require(value['schema_version'] == 2, 'M1-02 uses the guarded v2 report')
    brain.identities(value['scope_matrix'], ['M102-TODAY', 'M102-CYCLE', 'M102-REPLAY',
                     'M102-DIARY', 'M102-REMIND', 'M102-BOUNDARY',
                     'M102-CLAIMS-MONEY', 'M102-EVIDENCE'])
    return value
