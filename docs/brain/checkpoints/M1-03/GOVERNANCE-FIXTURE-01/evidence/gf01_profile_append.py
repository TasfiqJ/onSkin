

# Independent GOVERNANCE-FIXTURE-01 issuance; QR03 delivery seals its predecessor interval.
GF01_INPUT = 'docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/inputs'
GF01_REVIEW = 'docs/brain/reviews/M1-03/QR03-REVIEW01'
GF01_ACTIVE = 'docs/brain/m103-governance-fixture01-active.json'
GF01_BASE = 'dbcfce9770850d4655221bd3d4c3b5799553aed2'
GF01_TREE = '93d9a5789c1ce443cf0bcd86696fff044ff2fd64'
GF01_DIGEST = '6510d0f948e93517eb4c2bb5875f5988507642a3c10f065c8d250222dfeec30f'
GF01_SCOPE = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7']
GF01_ATTRIBUTES = (b'\n# Immutable GOVERNANCE-FIXTURE-01 issuance and independent QR03 review.\n'
    b'docs/brain/checkpoints/M1-03/GOVERNANCE-FIXTURE-01/inputs/** -text\n'
    b'docs/brain/reviews/M1-03/QR03-REVIEW01/** -text\n')
GF01_FROZEN = {
    'QR02': ('3dcaf50633024ec652fe7b14a5c9072eac92642e',
        'fd98eedb0cef6644d8e1538047aacbe44f10d837', [
        (QR02_ACTIVE, 'b3627c612b0ec20ff83daccf8d70a5d29903269e', '9449aa72f422ceab9f228d072630457f068dc65655e597b93e97b4723c5b5040', 1047),
        ('.gitattributes', '4df6bf56c6e79c84899654e20287919562e55fec', '58cc1493e2dd014812689be2685973a3a9150242b2bd1b45f50a174ea10e4c7b', 2129),
        ('scripts/brain/m103_profile.py', 'eed208833fb9fe672b6691233c4a8ef9f22003da', 'c9732ec5567dd610f0a39a43b3e9b3cb6774ae9de02b4678de2b8d3dba678c58', 54251)]),
    'QR03': (GF01_BASE, GF01_TREE, [
        (QR03_ACTIVE, '1bfeaad1a9b32a472d77e11a52981d5ed6480f99', '7b10de99c1472a9cbd9260b915e3432ba10bec8d36c9fdaacf9475a764491413', 961),
        ('.gitattributes', 'c06492f174db13630da9f8deb043a890d8d313f0', '0989b8860a3146dafc0821f6ffd18caa27c87c53bd25dbbd3819ca78991d52be', 2313),
        ('scripts/brain/m103_profile.py', '7024ccaf09c0c64362fa4b185f59ff29c24aa878', '8661c05110c04503154eca169be6a99f9c15d1ba0e0b4686d5263f674b4acf0c', 67627)]),
}


def gf01_active_expected():
    return dict(schema_version=1, task_id='M1-03', iteration='GOVERNANCE-FIXTURE-01',
        branch=BRANCH, base_commit=GF01_BASE, base_tree=GF01_TREE,
        input_manifest_sha256=GF01_DIGEST, authorization_id='M103-GOVERNANCE-FIXTURE01-SOURCE-EDIT-01',
        accepted_tasks=['M0-01', 'M0-02', 'M1-01', 'M1-02'], active_writers=1,
        incremental_spend_usd=0, protected_source_go=False, main_promotion_authorized=False,
        hosted_replay_authorized=False, clinical_research_or_release_authorized=False,
        source_edit_union_permitted=False, prior_reviews_mutable=False,
        protected_security_and_db_admission='CLOSED', next_task=None,
        original_security_proposal_expires_utc='2026-10-21T00:00:00Z',
        roadmap_tasks_count=47, module_identities_count=27, prior_adr_count=51)


def gf01_frozen_bytes(root, label, path):
    """Read authenticated delivery objects, never a current-source substitute."""
    import subprocess
    commit, tree, rows = GF01_FROZEN[label]
    brain.git_snapshot(root, dict(commit=commit, tree=tree), label + ' frozen fixture')
    _, oid, sha256, size = next(row for row in rows if row[0] == path)
    raw = subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + path])
    brain.require(brain.git(root, 'rev-parse', commit + ':' + path) == oid and
        brain.digest(raw) == sha256 and len(raw) == size, label + ' historical fixture bytes differ')
    return raw


def gf01_fixture_source(prior, label):
    """The sole permitted test-module delta is this setUp byte-source replacement."""
    commit, tree, rows = GF01_FROZEN[label]
    old = (f"        for name in [p.{label}_ACTIVE, '.gitattributes', 'scripts/brain/m103_profile.py']:\n"
        "            shutil.copyfile(brain.ROOT / name, self.root / name)\n")
    new = (f"        frozen = '{commit}'\n"
        f"        brain.git_snapshot(brain.ROOT, dict(commit=frozen, tree='{tree}'), '{label} frozen fixture')\n"
        f"        for name, oid, sha256, size in {rows!r}:\n"
        "            raw = subprocess.check_output(['git', '-C', str(brain.ROOT), 'show', frozen + ':' + name])\n"
        "            brain.require(brain.git(brain.ROOT, 'rev-parse', frozen + ':' + name) == oid and\n"
        f"                brain.digest(raw) == sha256 and len(raw) == size, '{label} historical fixture bytes differ')\n"
        "            (self.root / name).write_bytes(raw)\n")
    brain.require(prior.count(old.encode()) == 1, 'GF01 fixture replacement ambiguous')
    return prior.replace(old.encode(), new.encode())


def validate_governance_fixture01(root):
    import subprocess
    brain.git_snapshot(root, dict(commit=GF01_BASE, tree=GF01_TREE), 'GF01 exact issued base')
    brain.require(brain.git(root, 'branch', '--show-current') == BRANCH, 'Wrong GF01 branch')
    brain.ancestor(root, GF01_BASE, brain.git(root, 'rev-parse', 'HEAD'), 'GF01 base -> head')
    raw = brain.read(root, GF01_INPUT + '/TASK_MANIFEST.json')
    brain.require(brain.digest(raw) == GF01_DIGEST, 'GF01 external manifest differs')
    manifest = brain.decode(raw)
    brain.require((manifest['task_id'], manifest['iteration'], manifest['base_commit'],
        manifest['base_tree'], manifest['branch'], manifest['authorization_id'], manifest['file_count']) ==
        ('M1-03', 'GOVERNANCE-FIXTURE-01', GF01_BASE, GF01_TREE, BRANCH,
         'M103-GOVERNANCE-FIXTURE01-SOURCE-EDIT-01', 13), 'GF01 issuance differs')
    for row in manifest['files'] + [dict(path='TASK_MANIFEST.json', bytes=len(raw), sha256=GF01_DIGEST)]:
        data = brain.read(root, GF01_INPUT + '/' + row['path'])
        brain.require(len(data) == row['bytes'] and brain.digest(data) == row['sha256'], 'GF01 immutable input differs')
        brain.require(data == brain.read(root, GF01_REVIEW + '/' + row['path']), 'GF01 immutable review differs')
    active = brain.load(root, GF01_ACTIVE)
    expected = gf01_active_expected()
    brain.require(set(active) == set(expected) | {'submission_status'} and
        all(type(active[k]) is type(v) and active[k] == v for k, v in expected.items()), 'GF01 false authority or acceptance')
    brain.require(active['submission_status'] in ['IN_PROGRESS', 'PARTIAL', 'BLOCKED', 'SUBMITTED_REVIEW_REQUIRED'],
        'GF01 cannot self-accept')
    authority = brain.load(root, GF01_INPUT + '/SOURCE_EDIT_AUTHORIZATION.json')
    existing = {row['path'] for row in authority['allowed_existing_files']}
    for row in authority['allowed_existing_files'] + authority['protected_unchanged']:
        path = row['path']
        data = subprocess.check_output(['git', '-C', str(root), 'show', GF01_BASE + ':' + path])
        brain.require(len(data) == row['bytes'] and brain.digest(data) == row['sha256'] and
            brain.git(root, 'rev-parse', GF01_BASE + ':' + path) == row['git_blob'], 'GF01 preimage mismatch: ' + path)
        if path not in existing:
            brain.require(brain.read(root, path) == data, 'GF01 protected source drift: ' + path)
    # The delivered QR03 commit/tree is immutable. Historical default validators
    # still refuse successors; only the new grant governs base..HEAD, without union.
    validate_quality_recovery02(root, fixed=True)
    changes = brain.git(root, 'diff', '--name-only', GF01_BASE).splitlines()
    changes += brain.git(root, 'ls-files', '--others', '--exclude-standard').splitlines()
    commits = brain.git(root, 'rev-list', GF01_BASE + '..HEAD').splitlines()
    for commit in commits:
        brain.require(len(brain.git(root, 'rev-list', '--parents', '-n', '1', commit).split()) == 2,
            'GF01 merge or unrelated root refused')
        changes += brain.git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit).splitlines()
        brain.require(not brain.git(root, 'diff-tree', '--diff-filter=D', '--no-commit-id', '--name-only', '-r', commit),
            'GF01 deletion refused')
    for path in set(changes):
        if path not in existing:
            prior = subprocess.run(['git', '-C', str(root), 'cat-file', '-e', GF01_BASE + ':' + path], capture_output=True)
            brain.require(prior.returncode != 0 and (path in authority['new_exact_files'] or
                any(path.startswith(prefix) for prefix in authority['new_prefixes'])), 'GF01 path outside exact authorization: ' + path)
        brain.safe_file(root, path)
    prior = subprocess.check_output(['git', '-C', str(root), 'show', GF01_BASE + ':.gitattributes'])
    restricted = {'.gitattributes': prior + GF01_ATTRIBUTES}
    brain.require(brain.read(root, '.gitattributes') == restricted['.gitattributes'], 'GF01 immutable markers differ')
    prior = gf01_frozen_bytes(root, 'QR03', 'scripts/brain/m103_profile.py')
    source = brain.read(root, 'scripts/brain/m103_profile.py')
    brain.require(source.startswith(prior + b'\n\n# Independent GOVERNANCE-FIXTURE-01 issuance;'),
        'GF01 historical governance source differs')
    for label in GF01_FROZEN:
        for path, _, _, _ in GF01_FROZEN[label][2]:
            gf01_frozen_bytes(root, label, path)
        path = 'scripts/brain/test_m103_quality_recovery' + label[-2:] + '_profile.py'
        original = subprocess.check_output(['git', '-C', str(root), 'show', GF01_BASE + ':' + path])
        restricted[path] = gf01_fixture_source(original, label)
        brain.require(brain.read(root, path) == restricted[path], 'GF01 setUp-only fixture source differs')
    # Reverting an unauthorized edit inside an allowed filename cannot erase it.
    for commit in commits:
        for path, expected_bytes in restricted.items():
            data = subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + path])
            brain.require(data == expected_bytes, 'GF01 intermediate restricted source differs: ' + path)
        data = subprocess.check_output(['git', '-C', str(root), 'show', commit + ':scripts/brain/m103_profile.py'])
        brain.require(data.startswith(prior + b'\n\n# Independent GOVERNANCE-FIXTURE-01 issuance;'),
            'GF01 intermediate historical governance source differs')
        touched = brain.git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit).splitlines()
        for path in touched:
            if path.startswith((GF01_INPUT + '/', GF01_REVIEW + '/')):
                data = subprocess.check_output(['git', '-C', str(root), 'show', commit + ':' + path])
                brain.require(data == brain.read(root, path), 'GF01 intermediate immutable issuance differs')
    return active


def report_governance_fixture01(root, name):
    value = m1_profile.report(root, name, task='M1-03', base=GF01_BASE,
        validator=validate_governance_fixture01, checkpoint=GF01_INPUT.rsplit('/', 1)[0] + '/',
        continuation_bindings={'GOVERNANCE-FIXTURE-01': (GF01_INPUT, GF01_BASE)})
    brain.require(value['schema_version'] == 3 and value['iteration'] == 'GOVERNANCE-FIXTURE-01', 'Wrong GF01 report iteration')
    brain.identities(value['scope_matrix'], GF01_SCOPE)
    brain.require(bool(value['executions']), 'GF01 requires actual executions')
    committed_artifacts(root, value['artifacts'])
    if value['status'] == 'SUBMITTED_REVIEW_REQUIRED':
        required = {'full-governance', 'targeted-qr02', 'targeted-qr03', 'fixture-ast-proof',
            'fresh-npm-ci', 'forced-root-tests', 'forced-typecheck', 'forced-lint', 'original-secret12',
            'source-worklist-check', 'original-security70'}
        entries = {entry['id']: entry for entry in value['executions']}
        brain.require(required <= entries.keys(), 'GF01 missing required execution')
        brain.require(all(entries[key]['status'] == 'PASS' for key in required - {'original-security70'}),
            'GF01 required source execution failed')
        for key, passed, skipped in [('full-governance', 97, 2), ('targeted-qr02', 8, 0),
                ('targeted-qr03', 8, 0), ('forced-root-tests', 6067, 0), ('original-secret12', 12, 0)]:
            counts = brain.load(root, entries[key]['artifact'])['counts']
            brain.require(counts['passed'] >= passed and counts['failed'] == 0 and counts['skipped'] == skipped,
                'GF01 required test inventory differs: ' + key)
    return value


_validate_before_gf01 = validate
_report_before_gf01 = report


def validate(root):
    return validate_governance_fixture01(root) if (root / GF01_ACTIVE).exists() else _validate_before_gf01(root)


def report(root, name):
    return report_governance_fixture01(root, name) if name.startswith(GF01_INPUT.rsplit('/', 1)[0] + '/') else _report_before_gf01(root, name)
