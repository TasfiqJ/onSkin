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


def _validate_initial(root):
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


def validate(root):
    if (root / ON_ACTIVE).exists():
        return validate_overnight01(root)
    return _validate_initial(root)


def report(root, name):
    if name.startswith(ON_INPUT.rsplit('/', 1)[0] + '/'):
        value = m1_profile.report(root, name, task='M1-03', base=ON_BASE,
            validator=validate_overnight01, checkpoint=ON_INPUT.rsplit('/', 1)[0] + '/',
            continuation_bindings={'OVERNIGHT-01': (ON_INPUT, ON_BASE)})
        brain.require(value['schema_version'] == 3 and value['iteration'] == 'OVERNIGHT-01',
                      'OVERNIGHT-01 requires guarded continuation binding')
        brain.identities(value['scope_matrix'], ON_SCOPE)
        brain.require(bool(value['executions']), 'OVERNIGHT-01 requires actual executions')
        committed_artifacts(root, value['artifacts'])
        return value
    if name.startswith(CONT_INPUT.rsplit('/', 1)[0] + '/'):
        value = m1_profile.report(root, name, task='M1-03', base=BASE,
            validator=validate_cont01, checkpoint=CONT_INPUT.rsplit('/', 1)[0] + '/',
            continuation_bindings={'CONT-01': (CONT_INPUT, CONT_BASE)})
        brain.require(value['schema_version'] == 3 and value['iteration'] == 'CONT-01',
                      'M1-03 CONT-01 requires guarded continuation binding')
        brain.identities(value['scope_matrix'], CONT_SCOPE)
        brain.require(bool(value['executions']), 'CONT-01 requires actual bound executions')
        return value
    checkpoint = 'docs/brain/checkpoints/M1-03/'
    brain.require(name.startswith(checkpoint), 'Wrong M1-03 report path')
    value = m1_profile.report(root, name, task='M1-03', base=BASE, validator=_validate_initial,
                              checkpoint=checkpoint)
    brain.require(value['schema_version'] == 2, 'M1-03 uses guarded v2 evidence')
    brain.identities(value['scope_matrix'], SCOPE)
    brain.require(bool(value['executions']), 'M1-03 requires actual bound diagnostics')
    return value


# Additive bounded source-edit profile. INITIAL validation/report remain intact.
CONT_INPUT = 'docs/brain/checkpoints/M1-03/CONT-01/inputs'
CONT_REVIEW = 'docs/brain/reviews/M1-03/REVIEW-01'
CONT_DIGEST = '214f13a3406632c50f0c9eebc947c04bb11f56259c12d13f93744f866254508e'
CONT_BASE = 'c14a3105640034a9d7a47d34533f9bd40faa4cc4'
CONT_TREE = 'eb9bb55569b75dba730ae69e8eb5c703804cfc58'
CONT_VERSION = 'brain-m1-03-partial-reviewed-cont01-issued-12'
CONT_ACTIVE = 'docs/brain/m103-cont01-active.json'
CONT_SCOPE = ['M103C1-OBSERVER', 'M103C1-VITE', 'M103C1-CLASSIFIER',
              'M103C1-SECRETS', 'M103C1-CUSTODY', 'M103C1-EVIDENCE']


def validate_cont01(root):
    return _validate_cont01(root, fixed=False)


def _validate_cont01(root, *, fixed):
    import subprocess
    _validate_initial(root)
    raw = brain.read(root, CONT_INPUT + '/TASK_MANIFEST.json')
    brain.require(brain.digest(raw) == CONT_DIGEST, 'CONT-01 independent manifest differs')
    issued = brain.decode(raw)
    brain.require((issued['task_id'], issued['iteration'], issued['base_commit'], issued['base_tree'],
                   issued['branch'], issued['state_version']) ==
                  ('M1-03', 'CONT-01', CONT_BASE, CONT_TREE, BRANCH, CONT_VERSION), 'Wrong CONT-01 issuance')
    for row in issued['files']:
        blob = brain.read(root, CONT_INPUT + '/' + row['path'])
        brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'], 'CONT-01 input differs')
        if row['path'].startswith('BRAIN_STATE/'):
            brain.require(blob == brain.read(root, CONT_REVIEW + '/' + row['path'].split('/', 1)[1]),
                          'CONT-01 review differs')
    authorization = CONT_REVIEW + '/SOURCE_EDIT_AUTHORIZATION.json'
    authority = brain.load(root, authorization)
    current = brain.load(root, CONT_ACTIVE)
    expected = dict(schema_version=1, task_id='M1-03', iteration='CONT-01', branch=BRANCH,
        original_task_base=BASE, base_commit=CONT_BASE, base_tree=CONT_TREE,
        approved_state_version=CONT_VERSION, input_manifest_sha256=CONT_DIGEST,
        accepted_tasks=['M0-01', 'M0-02', 'M1-01', 'M1-02'], review_overlay=CONT_REVIEW,
        source_edit_authorization=authorization, authorization_id='M103-CONT01-SOURCE-EDIT-01',
        protected_source_go=False, main_promotion_authorized=False, incremental_spend_usd=0,
        active_writers=1, next_task=None, research_requests=[], proposal_expires_utc='2026-10-21T00:00:00Z')
    brain.require(set(current) == set(expected) | {'submission_status'} and
        all(type(current[k]) is type(v) and current[k] == v for k, v in expected.items()),
        'CONT-01 unissued authority or false acceptance')
    brain.require(current['submission_status'] in ['IN_PROGRESS', 'PARTIAL', 'BLOCKED',
        'SUBMITTED_REVIEW_REQUIRED'], 'CONT-01 cannot self-accept')
    brain.require(brain.git(root, 'branch', '--show-current') == BRANCH, 'Wrong CONT-01 branch')
    brain.git_snapshot(root, {'commit': CONT_BASE, 'tree': CONT_TREE}, 'CONT-01 base')
    brain.ancestor(root, CONT_BASE, brain.git(root, 'rev-parse', 'HEAD'), 'CONT-01 base -> head')
    old = brain.load(root, 'docs/brain/state/roadmap.json')['tasks']
    new = brain.load(root, CONT_REVIEW + '/roadmap.json')['tasks']
    brain.require([(r['id'], r['depends_on']) for r in old] ==
                  [(r['id'], r['depends_on']) for r in new] and len(new) == 47, 'CONT-01 task identity drift')
    allowed = {r['path'] for key in ['allowed_existing_files', 'allowed_new_code_files'] for r in authority[key]}
    admin = authority['administrative_paths']
    allowed.update(admin['existing_exact_scope']); allowed.update(admin['derived_outputs'])
    allowed.add(CONT_ACTIVE)
    prefixes = [admin['new_review_overlay'], admin['new_checkpoint']]
    for row in authority['allowed_existing_files']:
        blob = subprocess.check_output(['git', '-C', str(root), 'show', CONT_BASE + ':' + row['path']])
        brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'], 'CONT-01 preimage differs')
    end = ON_BASE if fixed else 'HEAD'
    changes = brain.git(root, 'diff', '--name-only', CONT_BASE, end).splitlines()
    if not fixed:
        changes += brain.git(root, 'diff', '--name-only', 'HEAD').splitlines()
        changes += brain.git(root, 'ls-files', '--others', '--exclude-standard').splitlines()
    for commit in brain.git(root, 'rev-list', CONT_BASE + '..' + end).splitlines():
        changes += brain.git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit).splitlines()
    brain.require(all(p in allowed or any(p.startswith(prefix) for prefix in prefixes) for p in changes),
                  'CONT-01 path outside exact source-edit authorization')
    return current


ON_INPUT = 'docs/brain/checkpoints/M1-03/OVERNIGHT-01/inputs'
ON_REVIEW = 'docs/brain/reviews/M1-03/OVERNIGHT-AUTHORIZATION'
ON_ACTIVE = 'docs/brain/m103-overnight01-active.json'
ON_DIGEST = '41d67788702092c78946a27d0f7fb3035a8a62268a689ca94bcbc6bbec5a1794'
ON_BASE = '7305ff24c78d2f9d883e26a7ba2a8e6169902fd8'
ON_TREE = '8857cbcaa26c28b434235a53521636af77cb6b36'
ON_VERSION = 'brain-m1-03-overnight01-expanded-issuance-14'
ON_SCOPE = ['ON-A-INTEGRATION', 'ON-B-TOOLS', 'ON-C-COVERAGE', 'ON-C-TRIAGE',
            'ON-D-CUSTODY', 'ON-E-PUBLICATION']


def committed_artifacts(root, rows):
    """Delivery blobs, never ignored local overlays, carry report evidence."""
    import subprocess
    for row in rows:
        path = row['path']
        entries = brain.git(root, 'ls-tree', 'HEAD', '--', path).splitlines()
        brain.require(len(entries) == 1 and entries[0].split('\t', 1)[1] == path and
                      entries[0].startswith(('100644 blob ', '100755 blob ')),
                      'Artifact is not a committed regular Git blob: ' + path)
        blob = subprocess.check_output(['git', '-C', str(root), 'show', 'HEAD:' + path])
        brain.require(brain.digest(blob) == row['sha256'] and blob == brain.read(root, path),
                      'Committed artifact differs: ' + path)


def validate_overnight01(root):
    import pathlib, subprocess
    # The old allowlist is applied only to its independently fixed interval.
    _validate_cont01(root, fixed=True)
    brain.git_snapshot(root, {'commit': ON_BASE, 'tree': ON_TREE}, 'OVERNIGHT-01 reviewed endpoint')
    raw = brain.read(root, ON_INPUT + '/TASK_MANIFEST.json')
    brain.require(brain.digest(raw) == ON_DIGEST, 'OVERNIGHT-01 independent manifest differs')
    issued = brain.decode(raw)
    brain.require((issued['task_id'], issued['iteration'], issued['base_commit'], issued['base_tree'],
                   issued['branch'], issued['state_version']) ==
                  ('M1-03', 'OVERNIGHT-01', ON_BASE, ON_TREE, BRANCH, ON_VERSION), 'Wrong OVERNIGHT-01 issuance')
    for row in issued['files']:
        blob = brain.read(root, ON_INPUT + '/' + row['path'])
        brain.require(len(blob) == row['bytes'] and brain.digest(blob) == row['sha256'], 'OVERNIGHT-01 input differs')
        if row['path'].startswith('BRAIN_STATE/'):
            brain.require(blob == brain.read(root, ON_REVIEW + '/' + row['path'].split('/', 1)[1]),
                          'OVERNIGHT-01 review differs')
    authority_path = ON_REVIEW + '/SOURCE_EDIT_AUTHORIZATION.json'
    authority = brain.load(root, authority_path)
    expected = dict(schema_version=1, task_id='M1-03', iteration='OVERNIGHT-01', branch=BRANCH,
        base_commit=ON_BASE, base_tree=ON_TREE, approved_state_version=ON_VERSION,
        input_manifest_sha256=ON_DIGEST, accepted_tasks=['M0-01','M0-02','M1-01','M1-02'],
        review_overlay=ON_REVIEW, source_edit_authorization=authority_path,
        authorization_id='M103-OVERNIGHT01-SOURCE-AND-DIAGNOSTIC-01', protected_source_go=False,
        main_promotion_authorized=False, incremental_spend_usd=0, active_writers=1, next_task=None,
        research_requests=[], proposal_expires_utc='2026-10-21T00:00:00Z')
    current = brain.load(root, ON_ACTIVE)
    brain.require(set(current) == set(expected) | {'submission_status'} and
        all(type(current[k]) is type(v) and current[k] == v for k,v in expected.items()),
        'OVERNIGHT-01 unissued authority or false acceptance')
    brain.require(current['submission_status'] in ['IN_PROGRESS','PARTIAL','BLOCKED','SUBMITTED_REVIEW_REQUIRED'],
                  'OVERNIGHT-01 cannot self-accept')
    brain.require(brain.git(root, 'branch', '--show-current') == BRANCH, 'Wrong OVERNIGHT-01 branch')
    brain.ancestor(root, ON_BASE, brain.git(root, 'rev-parse','HEAD'), 'OVERNIGHT-01 base -> head')
    approved = brain.load(root, ON_REVIEW + '/brain_state.json')
    brain.require(approved['state_version'] == ON_VERSION and approved['accepted_tasks'] == current['accepted_tasks'],
                  'OVERNIGHT-01 state differs')
    old = brain.load(root, 'docs/brain/state/roadmap.json')['tasks']
    new = brain.load(root, ON_REVIEW + '/roadmap.json')['tasks']
    brain.require(len(new)==47 and [(r['id'],r['depends_on']) for r in old] ==
                  [(r['id'],r['depends_on']) for r in new], 'OVERNIGHT-01 task identity drift')
    allowed = {r['path'] for key in ['allowed_existing_files','allowed_new_code_files',
                                   'allowed_new_data_files','allowed_recovered_artifacts'] for r in authority[key]}
    admin = authority['administrative_paths']
    allowed.update(admin['existing_exact_scope']); allowed.update(admin['derived_outputs']); allowed.add(ON_ACTIVE)
    prefixes = [admin['new_review_overlay'], admin['new_checkpoint']]
    changes = brain.git(root, 'diff','--name-only', ON_BASE).splitlines()
    changes += brain.git(root, 'ls-files','--others','--exclude-standard').splitlines()
    for commit in brain.git(root,'rev-list',ON_BASE+'..HEAD').splitlines():
        changes += brain.git(root,'diff-tree','--root','--no-commit-id','--name-only','-r',commit).splitlines()
    for path in set(changes):
        standalone = path.startswith('scripts/security_readiness/m103/')
        if standalone:
            brain.require(pathlib.PurePosixPath(path).suffix in authority['allowed_new_source_namespaces'][0]['permitted_extensions'],
                          'OVERNIGHT-01 diagnostic extension refused')
            absent = subprocess.run(['git','-C',str(root),'cat-file','-e',ON_BASE+':'+path],capture_output=True)
            brain.require(absent.returncode != 0, 'OVERNIGHT-01 namespace overwrote existing source')
        brain.require(path in allowed or standalone or any(path.startswith(p) for p in prefixes),
                      'OVERNIGHT-01 path outside exact authorization: '+path)
    return current
