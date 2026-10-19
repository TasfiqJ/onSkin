"""Single-owner automated source-only admission in the original Security workflow.

Every original job, nineteen raw artifacts, complete technical receipt, source,
installation and run binding must pass. No human approval or signature is claimed.
"""
import argparse, json, os, pathlib, re, shutil, stat, subprocess, sys, urllib.parse
import contract as c

JOBS = {
    'code-gates': {'phase9_verify', 'dependency_sbom', 'npm_audit_high', 'npm_exception_gate'},
    'secret-scan': {'gitleaks', 'gitleaks_exit', 'trufflehog'},
    'static-analysis': {'semgrep', 'osv', 'osv_exception_gate'},
}
MANIFESTS = {
    'code-gates': 'code/code-gates-outcomes.json',
    'secret-scan': 'secret/secret-scan-outcomes.json',
    'static-analysis': 'static/static-analysis-outcomes.json',
}
LEGACY_FILES = set(MANIFESTS.values()) | {
    'code/npm-audit-high.json', 'code/npm-audit-high.exit-code',
    'secret/gitleaks-results.sarif', 'secret/gitleaks-tool.json', 'static/osv-scan.json', 'static/osv-scan.exit-code',
    'code/dependency-inventory.json', 'code/dependency-sbom.exit-code',
    'code/dependency-sbom-audit.json', 'code/dependency-sbom-audit.exit-code',
    *{folder + '/' + mode + '-exception-gate' + suffix for folder, mode in [('code', 'npm'), ('static', 'osv')] for suffix in ('.stdout', '.stderr', '.exit-code')},
}

def legacy_inventory(directory):
    """Only the complete technical receipt may sit beside these nineteen files."""
    directory = pathlib.Path(directory)
    observed = set()
    for current, dirs, files in os.walk(directory, followlinks=False):
        for name in dirs:
            s = (pathlib.Path(current) / name).lstat()
            c.require(not stat.S_ISLNK(s.st_mode) and not getattr(s, 'st_file_attributes', 0) & 0x400,
                      'WORKFLOW_LINKED_DIRECTORY')
        if pathlib.Path(current) == directory / 'static':
            dirs[:] = [d for d in dirs if d != 'g97-evidence']
        for name in files:
            observed.add((pathlib.Path(current) / name).relative_to(directory).as_posix())
    c.require(observed == LEGACY_FILES, 'WORKFLOW_EVIDENCE_INVENTORY_DRIFT')
    return {name: c.SHA(c.safe(directory, name, allow_empty=name.endswith('.stdout'))) for name in sorted(observed)}

def original_jobs(directory, needs, commit, run_id, fresh):
    """Bind actual original outcomes and raw reports to the exact fresh scans."""
    c.require(isinstance(commit, str) and re.fullmatch('[0-9a-f]{40}', commit), 'WORKFLOW_COMMIT_INVALID')
    c.require(isinstance(run_id, str) and re.fullmatch('[1-9][0-9]{0,19}', run_id), 'WORKFLOW_RUN_INVALID')
    c.require(isinstance(needs, dict) and set(needs) == set(JOBS), 'WORKFLOW_REQUIRED_JOB_OMISSION')
    for name, result in needs.items():
        c.require(isinstance(result, dict) and set(result) == {'result', 'outputs'}
                  and result['result'] == 'success' and result['outputs'] == {},
                  'WORKFLOW_UNRELATED_JOB_FAILURE:' + name)
    manifests = {}
    for name, fields in JOBS.items():
        obj = c.load(directory, MANIFESTS[name])
        c.require(isinstance(obj, dict) and set(obj) == fields | {'job', 'sha', 'run_id'},
                  'WORKFLOW_OUTCOME_SCHEMA:' + name)
        c.require(obj['job'] == name and obj['sha'] == commit and obj['run_id'] == run_id,
                  'WORKFLOW_SOURCE_OR_RUN_DRIFT:' + name)
        c.require(all(type(value) is str for value in obj.values()), 'WORKFLOW_OUTCOME_TYPES')
        manifests[name] = obj
    code, secret, static = [manifests[name] for name in JOBS]
    c.require(code['phase9_verify'] == 'success' and code['dependency_sbom'] == 'failure', 'WORKFLOW_CODE_CHECK_FAILURE')
    c.require(secret['trufflehog'] == 'success', 'WORKFLOW_TRUFFLEHOG_FAILURE')
    c.require(static['semgrep'] == 'success', 'WORKFLOW_SEMGREP_FAILURE')
    # The untouched legacy policy is expired. Its refusal is retained, never
    # treated as an approval or allowed to authorize another advisory.
    c.require(code['npm_exception_gate'] == static['osv_exception_gate'] == 'failure',
              'WORKFLOW_LEGACY_POLICY_OUTCOME_DRIFT')
    exit_text = c.safe(directory, 'code/npm-audit-high.exit-code').decode().strip()
    c.require(exit_text in ('0', '1'), 'WORKFLOW_NPM_EXECUTION_ERROR')
    npm_exit = int(exit_text)
    c.require(npm_exit == fresh['npm-installed']['exit']
              and code['npm_audit_high'] == ('success' if npm_exit == 0 else 'failure'),
              'WORKFLOW_NPM_EXIT_DRIFT')
    npm = c.load(directory, 'code/npm-audit-high.json')
    c.require(c.audit_projection(npm) == c.audit_projection(fresh['npm-installed']['report']),
              'WORKFLOW_NPM_FINDING_DRIFT')
    # The original audited SBOM must retain its actual expired-policy refusal.
    # Only the exact two blockers computed by the unchanged legacy validator are
    # admissible. Package, provenance, summary and structural drift still reject.
    c.require(c.safe(directory, 'code/dependency-sbom.exit-code').decode().strip() == '1',
              'WORKFLOW_SBOM_EXECUTION_ERROR')
    c.require(c.safe(directory, 'code/dependency-sbom-audit.exit-code').decode().strip() == '1',
              'WORKFLOW_SBOM_AUDIT_EXECUTION_ERROR')
    # The separately preserved SBOM audit may have a cache-dependent transitive
    # subset, but must retain every exact primary advisory and source-bound row.
    c.initial_audit_subset(c.load(directory, 'code/dependency-sbom-audit.json'),
                           fresh['npm-installed']['report'])
    c.load(directory, 'code/dependency-inventory.json')
    sbom = subprocess.run(['node', str(c.HERE / 'workflow_contract.mjs'), 'sbom',
                           str(pathlib.Path(directory) / 'code')], cwd=c.ROOT,
                          capture_output=True, timeout=30, check=False)
    c.require(sbom.returncode == 0, 'WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT')
    sbom_result = c.parse_json(sbom.stdout)
    c.require(sbom_result.get('status') == 'EXACT_EXPIRED_SBOM_POLICY_REFUSAL_BOUND'
              and sbom_result.get('approval') is False, 'WORKFLOW_SBOM_VALIDATOR_DRIFT')
    osv_exit_text = c.safe(directory, 'static/osv-scan.exit-code').decode().strip()
    c.require(osv_exit_text in ('0', '1'), 'WORKFLOW_OSV_EXECUTION_ERROR')
    osv_exit = int(osv_exit_text)
    c.require(osv_exit == fresh['osv']['exit'], 'WORKFLOW_OSV_EXIT_DRIFT')
    osv = c.load(directory, 'static/osv-scan.json')
    c.require(static['osv'] == ('success' if fresh['osv']['exit'] == 0 else 'failure')
              and c.osv_projection(osv) == c.osv_projection(fresh['osv']['report']),
              'WORKFLOW_OSV_FINDING_DRIFT')
    # The unchanged legacy commands fetch live review data. Only their exact
    # policy refusals may continue: HTTP failures, new releases/fixes, crashes,
    # unexpected stdout or any different exit still fail closed.
    for folder, mode in [('code', 'npm'), ('static', 'osv')]:
        for suffix in ('.stdout', '.stderr', '.exit-code'):
            c.safe(directory, folder + '/' + mode + '-exception-gate' + suffix,
                   allow_empty=suffix == '.stdout')
    legacy = subprocess.run(['node', str(c.HERE / 'workflow_contract.mjs'), 'policies',
                             str(pathlib.Path(directory))], cwd=c.ROOT,
                            capture_output=True, timeout=30, check=False)
    c.require(legacy.returncode == 0, 'WORKFLOW_LEGACY_POLICY_REFUSAL_DRIFT')
    # The event-range Gitleaks action is supplementary to the freshly verified
    # full-ref scan. Infrastructure failures, unknown findings, duplicates and
    # forged ranges cannot masquerade as a known full-history finding.
    c.require(secret['gitleaks_exit'] in ('0', '2'), 'WORKFLOW_GITLEAKS_EXECUTION_ERROR')
    leak_exit = int(secret['gitleaks_exit'])
    c.require(secret['gitleaks'] == ('success' if leak_exit == 0 else 'failure'),
              'WORKFLOW_GITLEAKS_EXIT_DRIFT')
    tool = c.load(directory, 'secret/gitleaks-tool.json')
    c.require(isinstance(tool, dict) and set(tool) == {'version', 'sha256', 'exit'}
              and tool['version'] == '8.24.3' and type(tool['exit']) is int and tool['exit'] == 0
              and tool['sha256'] in c.load(c.HERE, 'proposal.json')['toolBytes']['gitleaks'],
              'WORKFLOW_GITLEAKS_TOOL_IDENTITY_DRIFT')
    sarif = c.load(directory, 'secret/gitleaks-results.sarif')
    c.require(isinstance(sarif, dict) and sarif.get('$schema') == 'https://json.schemastore.org/sarif-2.1.0.json'
              and sarif.get('version') == '2.1.0' and isinstance(sarif.get('runs'), list)
              and len(sarif['runs']) == 1, 'WORKFLOW_GITLEAKS_REPORT_SCHEMA')
    run = sarif['runs'][0]
    c.require(isinstance(run, dict) and isinstance(run.get('tool'), dict), 'WORKFLOW_GITLEAKS_REPORT_SCHEMA')
    driver = run['tool'].get('driver', {})
    c.require(isinstance(driver, dict) and driver.get('name') == 'gitleaks'
              # Official 8.24.3 emits this legacy SARIF format constant. Actual
              # executable identity is independently pinned above, never inferred here.
              and driver.get('semanticVersion') == 'v8.0.0',
              'WORKFLOW_GITLEAKS_VERSION_DRIFT')
    findings = run.get('results')
    c.require(isinstance(findings, list) and bool(findings) == (leak_exit == 2),
              'WORKFLOW_GITLEAKS_EXIT_REPORT_DRIFT')
    full = {item['Fingerprint']: item for item in fresh['gitleaks']['report']}
    seen = set()
    for finding in findings:
        locations = finding.get('locations')
        c.require(isinstance(locations, list) and len(locations) == 1, 'WORKFLOW_GITLEAKS_LOCATION_DRIFT')
        location = locations[0]['physicalLocation']
        path = urllib.parse.unquote(location['artifactLocation']['uri'])
        region = location['region']
        c.require(isinstance(region.get('snippet'), dict) and region['snippet'].get('text') == 'REDACTED',
                  'WORKFLOW_UNREDACTED_GITLEAKS_FINDING')
        start = region['startLine']
        c.require(type(start) is int and start > 0, 'WORKFLOW_GITLEAKS_RANGE_DRIFT')
        prior_commit = finding['partialFingerprints']['commitSha']
        fingerprint = f"{prior_commit}:{path}:{finding['ruleId']}:{start}"
        c.require(fingerprint in full and fingerprint not in seen, 'WORKFLOW_NEW_OR_DUPLICATE_GITLEAKS_FINDING')
        seen.add(fingerprint)
        if 'endLine' in region:
            c.require(type(region['endLine']) is int and region['endLine'] == full[fingerprint]['EndLine'],
                      'WORKFLOW_GITLEAKS_RANGE_DRIFT')
    return {'sourceCommit': commit, 'runId': run_id, 'originalJobs': needs,
            'outcomes': manifests, 'eventRangeHistoricalFindings': len(seen),
            'files': legacy_inventory(directory)}

def write_gitleaks_tool():
    """Bind the executable installed by the pinned action, not SARIF's placeholder."""
    try:
        located = shutil.which('gitleaks')
        c.require(located, 'WORKFLOW_GITLEAKS_TOOL_MISSING')
        path = pathlib.Path(located)
        body = c.safe(path.parent, path.name, limit=512 * 1024**2)
        digest = c.SHA(body)
        c.require(digest in c.load(c.HERE, 'proposal.json')['toolBytes']['gitleaks'],
                  'WORKFLOW_GITLEAKS_TOOL_IDENTITY_DRIFT')
        process = subprocess.run([str(path), 'version'], capture_output=True, timeout=10, check=False)
        c.require(process.returncode == 0 and process.stdout == b'8.24.3\n' and not process.stderr,
                  'WORKFLOW_GITLEAKS_TOOL_VERSION_DRIFT')
        witness = {'version': '8.24.3', 'sha256': digest, 'exit': 0}
        directory = c.ROOT / 'docs/phase-9/generated/ci-scanner-evidence'
        directory.mkdir(parents=True, exist_ok=True)
        c.require(directory.resolve() == directory, 'WORKFLOW_LINKED_DIRECTORY')
        with (directory / 'gitleaks-tool.json').open('xb') as output:
            output.write(c.CANON(witness))
        print(json.dumps(witness, sort_keys=True))
        return 0
    except (ValueError, OSError, TypeError, subprocess.SubprocessError) as error:
        print(json.dumps({'status': 'REJECTED', 'code': str(error), 'acceptanceGranted': False}))
        return 1


def main():
    if sys.argv[1:] == ['gitleaks-tool']:
        return write_gitleaks_tool()
    p = argparse.ArgumentParser()
    p.add_argument('mode', choices=['check', 'accept'])
    p.add_argument('--evidence', required=True)
    p.add_argument('--workflow-evidence', required=True)
    p.add_argument('--original-jobs', required=True)
    p.add_argument('--commit', required=True)
    p.add_argument('--run-id', required=True)
    a = p.parse_args()
    try:
        root = c.ROOT; policy = c.load(c.HERE, 'proposal.json')
        scope = c.validate_policy(policy)
        c.source(root, policy); c.scan_coverage(policy, root)
        head = c.git(root, 'rev-parse', 'HEAD').decode().strip()
        tree = c.git(root, 'rev-parse', 'HEAD^{tree}').decode().strip()
        c.require(head == a.commit and not c.git(root, 'status', '--porcelain', '--untracked-files=all').strip(),
                  'WORKFLOW_SOURCE_NOT_COMMITTED_CLEAN')
        directory = pathlib.Path(a.workflow_evidence).resolve()
        evidence = pathlib.Path(a.evidence).resolve()
        c.require(evidence == directory / 'static/g97-evidence', 'WORKFLOW_TECHNICAL_ARTIFACT_SUBSTITUTION')
        technical = c.evidence(root, evidence, policy, root)
        normalized = lambda value: value.replace('\\', '/').removeprefix('//?/').rstrip('/').casefold()
        c.require(normalized(technical['executionRoot']) == normalized(technical['installedExecutionRoot'])
                  == normalized(str(root)), 'WORKFLOW_EXTERNAL_SOURCE_OR_INSTALL_FORBIDDEN')
        raw = {name: c.load(evidence, profile['file']) for name, profile in policy['scannerReports'].items()}
        workflow = original_jobs(directory, c.parse_json(a.original_jobs.encode()), a.commit, a.run_id, raw)
        decision = {'technicalEvidenceSha256': technical['evidenceSha256'], 'originalSecurityWorkflow': workflow}
        digest = c.SHA(c.CANON(decision))
        context = 'LOCAL_REHEARSAL_NO_GITHUB_CI_AUTHORITY'
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            c.require(os.environ.get('GITHUB_WORKFLOW') == 'Security'
                      and os.environ.get('GITHUB_REPOSITORY', '').casefold() == 'tasfiqj/onskin'
                      and os.environ.get('GITHUB_SHA') == head
                      and os.environ.get('GITHUB_RUN_ID') == a.run_id
                      and os.environ.get('GITHUB_JOB') == 'automated-source-security-acceptance',
                      'ORIGINAL_SECURITY_CONTEXT_DRIFT')
            context = 'ORIGINAL_SECURITY_GITHUB_ACTIONS'
        print(json.dumps({'status': 'ORIGINAL_SECURITY_SINGLE_OWNER_SOURCE_ONLY_ACCEPTED'
                          if a.mode == 'accept' else 'WORKFLOW_TECHNICAL_EVIDENCE_VALID; AUTOMATED_ACCEPTANCE_REQUIRED',
                          'sourceCommit': head, 'sourceTree': tree, 'proposalSha256': c.SHA(c.CANON(policy)),
                          'decisionEvidenceSha256': digest, 'decision': decision,
                          'acceptance': scope, 'executionContext': context,
                          'validUntil': policy['notAfter'], 'rawScannerPass': False,
                          'independentHumanApproval': False, 'releaseAuthority': False,
                          'databaseReplayAuthority': False, 'integrationAuthority': False}, sort_keys=True))
        return 0
    except (ValueError, KeyError, OSError, TypeError, subprocess.SubprocessError) as error:
        print(json.dumps({'status': 'REJECTED', 'code': str(error) if isinstance(error, c.Rejected)
                          else type(error).__name__, 'acceptanceGranted': False, 'rawScannerPass': False}))
        return 1

if __name__ == '__main__':
    sys.exit(main())
