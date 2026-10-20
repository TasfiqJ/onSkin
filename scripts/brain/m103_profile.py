"""Only the independently issued M1-03 successor; historical refusals remain."""
import brain
import m1_profile
import m102_profile

INPUT = 'docs/brain/checkpoints/M1-03/inputs'
REVIEW = 'docs/brain/reviews/M1-02/ACCEPTANCE'
DIGEST = 'e580ae55c3aa97fe18a8b4e8782b1887ee503b3fec88df0034aa82cc2edee95f'
BASE = '2de9ef75a1a1d539b0520ca22160abd6171c9c3b'
TREE = 'fb88a57fca2d54bf7975d6b6b0ede12c3a8bd1a0'
VERSION = 'brain-m1-02-accepted-m1-03-issued-11'
BRANCH = m1_profile.BRANCH
ACTIVE = 'docs/brain/m103-active.json'
SCOPE = ['M103-IDENTITY', 'M103-CORE05', 'M103-DATABASE', 'M103-CUSTODY',
         'M103-SECURITY', 'M103-REVIEW', 'M103-EVIDENCE']


def validate(root):
    m102_profile.validate_cont01(root)
    raw = brain.read(root, INPUT + '/TASK_MANIFEST.json')
    brain.require(brain.digest(raw) == DIGEST, 'M1-03 independent manifest differs')
    issued = brain.decode(raw)
    brain.require(issued['task_id'] == 'M1-03' and issued['iteration'] == 'INITIAL' and
                  issued['branch'] == BRANCH and issued['base_commit'] == BASE and
                  issued['base_tree'] == TREE and issued['state_version'] == VERSION,
                  'Wrong M1-03 issuance')
    for row in issued['files']:
        blob = brain.read(root, INPUT + '/' + row['path'])
        brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'],
                      'M1-03 immutable input differs')
        if row['path'].startswith('BRAIN_STATE/'):
            brain.require(blob == brain.read(root, REVIEW + '/' + row['path'].split('/', 1)[1]),
                          'M1-02 acceptance successor differs')
    current = brain.load(root, ACTIVE)
    expected = dict(schema_version=1, task_id='M1-03', branch=BRANCH,
                    approved_state_version=VERSION,
                    accepted_tasks=['M0-01', 'M0-02', 'M1-01', 'M1-02'], review_overlay=REVIEW,
                    base_commit=BASE, base_tree=TREE, input_manifest_sha256=DIGEST,
                    protected_source_go=False, main_promotion_authorized=False,
                    incremental_spend_usd=0, active_writers=1, next_task=None, research_requests=[],
                    proposal_expires_utc='2026-10-21T00:00:00Z')
    brain.require(set(current) == set(expected) | {'submission_status'}, 'Unknown M1-03 field')
    brain.require(all(type(current[k]) is type(v) and current[k] == v for k, v in expected.items()),
                  'Unissued M1-03 authority or false acceptance')
    approved = brain.load(root, REVIEW + '/brain_state.json')
    brain.require(approved['state_version'] == VERSION and approved['in_flight_task'] == 'M1-03' and
                  approved['accepted_tasks'] == current['accepted_tasks'], 'Unissued M1-03 successor')
    brain.require(current['submission_status'] in ['IN_PROGRESS', 'PARTIAL', 'BLOCKED',
                  'SUBMITTED_REVIEW_REQUIRED'], 'Codex cannot accept M1-03')
    old = brain.load(root, 'docs/brain/state/roadmap.json')['tasks']
    new = brain.load(root, REVIEW + '/roadmap.json')['tasks']
    brain.require([(r['id'], r['depends_on']) for r in old] ==
                  [(r['id'], r['depends_on']) for r in new] and len(new) == 47,
                  'M1-03 roadmap identity/dependency drift')
    brain.git_snapshot(root, {'commit': BASE, 'tree': TREE}, 'M1-03 accepted base')
    brain.ancestor(root, BASE, brain.git(root, 'rev-parse', 'HEAD'), 'M1-03 base -> head')
    return current


def report(root, name):
    checkpoint = 'docs/brain/checkpoints/M1-03/'
    brain.require(name.startswith(checkpoint), 'Wrong M1-03 report path')
    value = m1_profile.report(root, name, task='M1-03', base=BASE, validator=validate,
                              checkpoint=checkpoint)
    brain.require(value['schema_version'] == 2, 'M1-03 uses guarded v2 evidence')
    brain.identities(value['scope_matrix'], SCOPE)
    brain.require(bool(value['executions']), 'M1-03 requires actual bound diagnostics')
    return value
