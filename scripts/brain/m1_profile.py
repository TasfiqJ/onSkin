"""Explicitly issued M1-01 profile; historical M0 controls remain unchanged."""
import brain

REVIEW = 'docs/brain/reviews/M0-02/REVIEW-02'
INPUT = 'docs/brain/checkpoints/M1-01/inputs'
BASE = '6aa01995f6dcb94fd28d358badc9f8d1e0273d39'
TREE = '3a75ea56f12f9422affc6e09936993ffa9252c05'
BRANCH = 'stage/m1-retained-safety'
VERSION = 'brain-m0-02-accepted-m1-01-issued-5'


def validate(root):
    # Preserve all original anchors/refusals and the historical M0 profile.
    brain.verify_inputs(root)
    brain.validate_state(root)
    brain.mirrors(root)
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
                  'active_writers', 'next_task', 'research_requests', 'proposal_expires_utc'},
                  'Unknown/missing active field')
    brain.require(type(current['schema_version']) is int and current['schema_version'] == 1,
                  'Invalid active schema')
    brain.require(current['task_id'] == approved['in_flight_task'] == 'M1-01' and
                  current['branch'] == BRANCH and current['review_overlay'] == REVIEW and
                  current['approved_state_version'] == approved['state_version'] == VERSION,
                  'Unissued active task/profile')
    brain.require(current['accepted_tasks'] == approved['accepted_tasks'] == ['M0-01', 'M0-02'],
                  'False acceptance')
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
    brain.require(set(value) == {'schema_version', 'task_id', 'branch', 'status', 'measured',
                  'delivery_ref', 'executions', 'artifacts', 'scope_matrix', 'axes', 'blockers',
                  'context_health'}, 'Unknown/missing M1 report field')
    brain.require(type(value['schema_version']) is int and value['schema_version'] == 1 and
                  value['task_id'] == 'M1-01' and value['branch'] == BRANCH and
                  value['status'] in ['PARTIAL', 'BLOCKED', 'SUBMITTED_REVIEW_REQUIRED'],
                  'Invalid M1 report authority/status')
    brain.require(value['delivery_ref'] == 'refs/heads/' + BRANCH, 'Invalid delivery ref')
    brain.git_snapshot(root, value['measured'], 'Measured M1 source')
    brain.ancestor(root, BASE, value['measured']['commit'], 'accepted base -> measured')
    brain.ancestor(root, value['measured']['commit'], brain.git(root, 'rev-parse', 'HEAD'),
                   'measured -> delivery')
    brain.require(isinstance(value['executions'], list) and isinstance(value['artifacts'], list),
                  'Invalid evidence lists')
    for entry in value['executions']:
        brain.validate_execution(root, entry)
    for item in value['artifacts']:
        brain.require(set(item) == {'path', 'sha256'} and
                      brain.digest(brain.read(root, item['path'])) == item['sha256'],
                      'Report artifact hash differs')
    # Evidence dimensions stay independent; no M1 report grants external admission.
    brain.require(set(value['axes']) == {'source', 'integration', 'surface', 'physical_device',
                  'live_provider', 'qualified_review', 'clinical', 'commercial', 'release'},
                  'Missing evidence axis')
    brain.require(all(value['axes'][k] in ['NOT_RUN', 'BLOCKED', 'NOT_ADMITTED'] for k in
                  ['integration', 'physical_device', 'live_provider', 'qualified_review',
                   'clinical', 'commercial', 'release']), 'Unissued external admission')
    return value
