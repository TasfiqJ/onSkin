"""Build the strict, non-admitting handoff from actual retained receipts."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path.cwd()
checkpoint = Path('docs/brain/checkpoints/M1-03/QUALITY-RECOVERY-01')
measured = '8dc7721b2d169e15d916f2bb3a9034bafbdb67b9'
implementation = '1bd013f5e68a671f76a3f9749e3b7fb395d49f15'
def sha(path):
    return hashlib.sha256((root / path).read_bytes()).hexdigest()
def save(path, value):
    (root / path).write_bytes((json.dumps(value, indent=2) + '\n').encode())
executions = []
for path in sorted((root / checkpoint / 'evidence').glob('*.receipt.json')):
    receipt = json.loads(path.read_bytes())
    if receipt['source_commit'] not in {implementation, measured} or receipt.get('dirty_source_at_start'):
        continue  # Preserved exploratory artifacts do not claim a measured source execution.
    executions.append(dict(id=path.name.removesuffix('.receipt.json'), axis='source', admission='NONE',
        evidence_class='INDEPENDENTLY_REPRODUCED', artifact=path.relative_to(root).as_posix(),
        sha256=sha(path), **{k: receipt[k] for k in ['command', 'working_directory', 'environment',
        'source_commit', 'source_tree', 'status', 'exit_code']}))
observations = {}
for path in sorted((root / checkpoint / 'evidence').glob('ci-*.json')):
    value = json.loads(path.read_bytes())
    if value.get('kind') == 'CI_OBSERVATION':
        for row in value['runs']:
            prior = observations.get(row['run_id'])
            if prior is None or value['recorded_at_utc'] > prior[0]:
                observations[row['run_id']] = (value['recorded_at_utc'], {**row,
                    'repository': 'TasfiqJ/onSkin', 'artifact': path.relative_to(root).as_posix()})
paths = [f.relative_to(root) for f in (root / checkpoint).rglob('*') if f.is_file() and
         f.name not in {'completion-report.json', 'SHA256SUMS.json'}]
paths += [f.relative_to(root) for f in (root / 'docs/brain/reviews/M1-03/SC03-REVIEW01').rglob('*') if f.is_file()]
paths += [Path(p) for p in ['apps/mobile/package.json', 'package-lock.json', 'package.json', '.gitattributes',
    'scripts/brain/m103_profile.py', 'scripts/brain/test_m103_quality_recovery01_profile.py',
    'docs/brain/m103-quality-recovery01-active.json', 'docs/phase-4/generated/source-worklist.json',
    'docs/phase-4/generated/source-worklist.md']]
artifacts = [dict(path=p.as_posix(), sha256=sha(p)) for p in sorted(set(paths))]
save(checkpoint / 'SHA256SUMS.json', dict(schema_version=1, admission='NONE', objects=artifacts))
artifacts.append(dict(path=(checkpoint / 'SHA256SUMS.json').as_posix(), sha256=sha(checkpoint / 'SHA256SUMS.json')))
ids = {r['id'] for r in executions}
def scope(id, status, refs, detail):
    return dict(id=id, status=status, evidence=[n for n in refs if n in ids], detail=detail)
report = dict(schema_version=3, task_id='M1-03', iteration='QUALITY-RECOVERY-01',
    branch='stage/m1-retained-safety', status='BLOCKED', measured=dict(commit=measured,
    tree=subprocess.check_output(['git', 'rev-parse', measured + '^{tree}']).decode().strip()),
    delivery_ref='refs/heads/stage/m1-retained-safety', executions=executions, artifacts=artifacts,
    scope_matrix=[
      scope('Q1', 'PASS', ['final-source-profile'], 'Exact issuance, all preimages and separate intervals verified.'),
      scope('Q2', 'PARTIAL_TESTED', ['registry-expo', 'registry-network', 'expo-compatibility'],
            'Two requested packages resolved; four other SDK patch requirements remain; no compatibility PASS.'),
      scope('Q3', 'PARTIAL_TESTED', ['final-ci', 'final-forced-test', 'final-forced-typecheck',
            'final-forced-lint', 'installed-native', 'expo-doctor', 'ios-privacy-check', 'store-source-contract'],
            'Forced root checks pass; Doctor and frozen lock-bound SDK mapping fail.'),
      scope('Q4', 'PARTIAL_TESTED', ['governance', 'original-secret-fixtures', 'original-security-contracts'],
            'Governance77:75pass+2skip; secret12pass. Original Security82-case discovery fails23failureevents+2errors; no fixture weakened.'),
      scope('Q5', 'PASS', ['final-worklist-check', 'final-source-profile'],
            'Clean canonical worklist; strict report requires every artifact to be a matching committed blob.'),
      scope('Q6', 'BLOCKED', [], 'Actual provider observations are separate CI artifacts; original gates remain closed.'),
      scope('Q7', 'PARTIAL_TESTED', ['final-source-profile'], 'Safe stage delivery for independent Brain review; no acceptance.')],
    axes=dict(source='PARTIAL_TESTED_NOT_COMPLETE', integration='NOT_RUN', surface='NOT_RUN',
       physical_device='NOT_RUN', live_provider='NOT_ADMITTED', qualified_review='NOT_ADMITTED',
       clinical='BLOCKED', commercial='NOT_ADMITTED', release='NOT_ADMITTED'),
    blockers=[
       'PARTIAL_SAFE_BLOCKED: Expo check retains @expo/ui57.0.25/router57.0.28/sharing57.0.23/widgets57.0.26 mismatches.',
       'Widget57.0.27 requires independently reviewed unlisted version/SRI/native payload and source contract changes.',
       'New lock SHA256 invalidates three frozen docs/phase-9/ios-sdk-package-mapping.json bindings; unlisted path cannot be edited.',
       'Canonical immutable ECR PostgreSQL acquisition still fails Data limit exceeded; original PG rehearsals do not replace it.',
       'Original Security safe contracts82cases FAIL23failureevents+2errors: WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT; original fixtures unedited.',
       'Original provider Security failed; secret/static/code/source-acceptance findings remain unreviewed; old proposal expired2026-10-21T00:00:00Z.',
       'DB06/DB08/R2B, native/device, qualified/clinical/release and main promotion remain unadmitted; admission NONE.'],
    context_health=dict(level='LOW', compaction_observed=False, reason='Bounded source scope delivered; stop for independent Brain review.'),
    ci=[row for _, row in observations.values()])
save(checkpoint / 'completion-report.json', report)
print('Report artifacts', len(artifacts), 'checksum objects', len(artifacts) - 1,
      'bound executions', len(executions), 'CI observations', len(observations), 'admission NONE')
