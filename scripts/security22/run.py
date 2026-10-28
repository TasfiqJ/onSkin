"""Execute current public checks; always preserve separate qualified-custody refusal."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import os
import stat
import sys

from collect import execute
from evaluate import dependency, summary
from inventory import snapshot, regular
from redact import Refusal, canonical, diagnostic, loads, require
from toolchain import identity

ROOT = Path(__file__).absolute().parents[2]

TOOLCHAIN_CASES = frozenset(('''actual_nonprivileged_posix_denial actual_windows_acl_denial
actual_windows_junction_reparse bound_depth bound_file_bytes bound_file_count bound_total_bytes
case_parent_alias chained_link changed_metadata changed_target changed_windows_shim complete_declared_installation
cyclic_link dangling_link declared_model_tampering directory_link directory_time_mutation empty_and_duplicate_bin_model
enumeration_error escaping_link extra_content extra_empty_directory fifo fixture_model_cannot_enter_production_identity
fstat_error hardlink hash_mismatch missing_bin missing_directory_and_restoration missing_files_and_restoration
open_time_mutation posix_root_link_containment profile_boolean_counts profile_invalid_counts read_error setid
silent_enumerator_omission stat_error target_link undeclared_bin undeclared_link unicode_parent_alias
cross_domain_birthtime_preserves_other_identity_fields same_handle_change_time_mutation_refused
prior_metadata_change_keeps_exact_content_identity duplicate_failure_cleanup_is_one_incomplete_case
fixture_uses_canonical_temporary_parent''').split())
TOOLCHAIN_CASES = frozenset('test_' + name for name in TOOLCHAIN_CASES)
TOOLCHAIN_NOT_RUN = ({'test_'+name: 'POSIX_FILESYSTEM_CONTROL_NOT_RUN_ON_WINDOWS' for name in
    ('actual_nonprivileged_posix_denial', 'case_parent_alias', 'chained_link', 'cyclic_link', 'dangling_link',
     'directory_link', 'escaping_link', 'fifo', 'posix_root_link_containment', 'setid', 'target_link', 'undeclared_link')}
    if os.name == 'nt' else {'test_actual_windows_acl_denial': 'WINDOWS_ACL_CONTROL_NOT_RUN_ON_POSIX',
        'test_actual_windows_junction_reparse': 'WINDOWS_REPARSE_CONTROL_NOT_RUN_ON_POSIX',
        'test_changed_windows_shim': 'WINDOWS_SHIM_CONTROL_NOT_RUN_ON_POSIX'})


def toolchain_gate_report(value, code):
    keys = {'schema', 'qualification', 'state', 'tests', 'passed', 'failed', 'errors', 'notRun',
            'platform', 'cases', 'acceptanceGranted'}
    require(type(code) is int and 0 <= code <= 255 and type(value) is dict and set(value) == keys and type(value['schema']) is int and value['schema'] == 1 and
        value['qualification'] == 'SYNTHETIC_PINNED_MODEL_FILESYSTEM_CONTROLS_ONLY' and value['state'] in ('PASS', 'INCOMPLETE') and
        value['platform'] == os.name and value['acceptanceGranted'] is False and
        all(type(value[k]) is int and 0 <= value[k] <= 48 for k in ('tests', 'passed', 'failed', 'errors', 'notRun')) and
        value['tests'] == 48 and type(value['cases']) is list and len(value['cases']) == 48, 'TOOLCHAIN_GATE_FAILED')
    names, counts, failures = set(), {state: 0 for state in ('PASS', 'FAIL', 'INCOMPLETE', 'NOT_RUN')}, []
    for case in value['cases']:
        require(type(case) is dict and type(case.get('name')) is str and case['name'] in TOOLCHAIN_CASES and
            case['name'] not in names and case.get('state') in counts and
            set(case) == ({'name', 'state', 'reason'} if case['state'] == 'NOT_RUN' else {'name', 'state'}), 'TOOLCHAIN_GATE_FAILED')
        if case['state'] == 'NOT_RUN':
            require(case['name'] in TOOLCHAIN_NOT_RUN and case['reason'] == TOOLCHAIN_NOT_RUN[case['name']], 'TOOLCHAIN_GATE_FAILED')
        else: require(case['name'] not in TOOLCHAIN_NOT_RUN or case['state'] != 'PASS', 'TOOLCHAIN_GATE_FAILED')
        names.add(case['name']); counts[case['state']] += 1
        if case['state'] in ('FAIL', 'INCOMPLETE'): failures.append(case['name'])
    require(names == TOOLCHAIN_CASES and counts == dict(PASS=value['passed'], FAIL=value['failed'],
        INCOMPLETE=value['errors'], NOT_RUN=value['notRun']), 'TOOLCHAIN_GATE_FAILED')
    return dict(state='PASS' if code == 0 and value['state'] == 'PASS' and not failures and
        value['notRun'] == (12 if os.name == 'nt' else 3) else 'INCOMPLETE', exit=code,
        qualification=value['qualification'], platform=os.name, observedPythonVersion=list(sys.version_info[:3]),
        failedCases=sorted(failures),
        **{k: value[k] for k in ('tests', 'passed', 'failed', 'errors', 'notRun')})


def prepare_output(directory):
    directory = directory.absolute()
    require(not directory.resolve().is_relative_to(ROOT.resolve()), 'OUTPUT_INSIDE_SOURCE')
    for parent in directory.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'OUTPUT_PARENT')
    directory.mkdir(exist_ok=False)
    return directory


class OutputJournal:
    """Exclusive durable records survive even an uncatchable process stop."""
    def __init__(self, directory):
        self.directory = prepare_output(directory)
        info = self.directory.lstat()
        self.identity = (info.st_dev, info.st_ino)
        self.files, self.sequence = {}, 0

    def validate(self):
        for parent in (self.directory, *self.directory.parents):
            info = parent.lstat()
            require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'OUTPUT_PARENT')
        info = self.directory.lstat()
        require((info.st_dev, info.st_ino) == self.identity, 'OUTPUT_CHANGED')

    def write(self, name, raw):
        self.validate()
        require(re.fullmatch('[a-z_0-9-]+\\.json', name), 'COMPONENT_NAME')
        try:
            with (self.directory/name).open('xb') as stream:
                stream.write(raw); stream.flush(); os.fsync(stream.fileno())
            self.validate()
        except OSError:
            raise Refusal('OUTPUT_WRITE_INCOMPLETE') from None

    def record(self, result):
        require(self.sequence < 64, 'PROGRESS_BOUND')
        name = 'progress-' + str(self.sequence).zfill(3) + '.json'; self.sequence += 1
        raw = canonical(result) + b'\n'
        self.write(name, raw)
        self.files[name] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


class Progress(dict):
    def __init__(self, components, observer):
        super().__init__(stage='DISCLOSURE_GATE', component='disclosure_controls', source=None, toolchain=None)
        self.components, self.observer = components, observer
        self.notify()

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        if key in ('stage', 'source', 'toolchain'): self.notify()

    def notify(self):
        if self.observer is not None:
            self.observer(dict(schema=1, qualification='CURRENT_PUBLIC_TECHNICAL_CANDIDATE_ONLY',
                source=self['source'], toolchain=self['toolchain'], components=self.components,
                executionComplete=False, stage=self['stage'], **summary(self.components)))


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        raise Refusal('ARGUMENT_SCOPE')


def receipt_bytes(path):
    path = path.absolute()
    for parent in path.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'RECEIPT_PARENT')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not stat.S_ISLNK(info.st_mode) and info.st_nlink == 1 and
            not getattr(info, 'st_file_attributes', 0) & 1024 and info.st_size <= 8*1024*1024, 'RECEIPT_FILE')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_BINARY', 0))
    with os.fdopen(descriptor, 'rb') as stream:
        opened = os.fstat(stream.fileno())
        require((opened.st_ino, opened.st_size, opened.st_mtime_ns) ==
                (info.st_ino, info.st_size, info.st_mtime_ns), 'RECEIPT_CHANGED')
        raw = stream.read(8*1024*1024 + 1)
    after = path.lstat()
    require(len(raw) == info.st_size and (after.st_ino, after.st_size, after.st_mtime_ns) ==
            (info.st_ino, info.st_size, info.st_mtime_ns), 'RECEIPT_CHANGED')
    return raw


def publish_components(directory, result, journal=None):
    directory = prepare_output(directory) if journal is None else journal.directory
    if journal is not None: journal.validate()
    entries = dict(journal.files) if journal is not None else {}
    for name, component in sorted(result['components'].items()):
        require(re.fullmatch('[a-z_]+', name), 'COMPONENT_NAME')
        value = dict(schema=1, qualification=result['qualification'], admission='NOT_GRANTED',
                     head=result['source']['head'] if result.get('source') is not None else None,
                     tree=result['source']['tree'] if result.get('source') is not None else None,
                     toolchainIdentitySHA256=result['toolchain']['identitySHA256'] if result.get('toolchain') is not None else None,
                     component=name, result=component)
        raw = canonical(value) + b'\n'
        if journal is not None: journal.write(name+'.json', raw)
        else:
            with (directory/(name+'.json')).open('xb') as stream: stream.write(raw)
        entries[name+'.json'] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    raw = canonical(dict(schema=1, files=entries, **summary(result['components']))) + b'\n'
    if journal is not None: journal.write('index.json', raw)
    else:
        with (directory/'index.json').open('xb') as stream: stream.write(raw)


def policy(root):
    value = loads(regular(root, 'scripts/security22/policy.json', 65536))
    expected = dict(schema=1, qualification='CURRENT_PUBLIC_TECHNICAL_CANDIDATE_ONLY',
        baseHead='34fac69f3ba527724ecdf2d1cef69f27372756ad', baseTree='832baeae6421bfaa6fb668b025932d2c49a4f33c',
        requiredRefs=['refs/remotes/origin/stage/m1-security-recovery22', 'refs/remotes/origin/main'],
        maxFileBytes=134217728, maxExpandedBytes=536870912, maxArchiveMembers=20000,
        maxArchiveDepth=4, maxRatio=500, release='NO_GO', acceptanceGranted=False,
        protectedScans='BLOCKED_EXTERNAL_CUSTODY')
    require(value == expected and all(type(value[key]) is type(item) for key, item in expected.items()), 'POLICY_SCHEMA')
    return value


def tap(argv, root):
    code, out, _ = execute(argv, root, seconds=300)
    counts = {}
    for name in ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'):
        matches = re.findall(rb'^# '+name.encode()+rb' (\d+)\r?$', out, re.M)
        require(len(matches) == 1, 'TAP_INCOMPLETE')
        counts[name] = int(matches[0])
    complete = counts['tests'] == counts['pass'] + counts['fail'] + counts['cancelled'] + counts['skipped'] + counts['todo']
    passed = code == 0 and complete and counts['tests'] > 0 and counts['tests'] == counts['pass']
    return dict(state='PASS' if passed else 'INCOMPLETE', exit=code, counts=counts)


def disclosure_gate(gate, code):
    expected = dict(errors=0, failures=0, passed=True,
        qualification='SYNTHETIC_DISCLOSURE_AND_BOUNDS_ONLY', skipped=0, testsRun=26)
    require(code == 0 and gate == expected and all(type(gate[key]) is type(value)
            for key, value in expected.items()), 'DISCLOSURE_GATE_FAILED')


def perform_complete(root, components, progress):
    # A failed synthetic disclosure gate prevents ANY real-output collection.
    components['disclosure_controls'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    code, out, _ = execute([sys.executable, '-B', 'scripts/security22/test_security22.py'], root, 60)
    gate = loads(out)
    disclosure_gate(gate, code)
    components['disclosure_controls'] = dict(state='PASS', exit=code, **gate)
    progress['stage'] = 'PARTIAL_DISCLOSURE_GATE'
    progress['component'] = 'partial_disclosure_controls'
    components['partial_disclosure_controls'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    code, out, _ = execute([sys.executable, '-B', 'scripts/security23/test_partial_results.py'], root, 60)
    partial = loads(out)
    require(code == 0 and partial == dict(testsRun=13, failures=0, errors=0, skipped=0, passed=True,
        qualification='SYNTHETIC_PARTIAL_PUBLICATION_ONLY') and type(partial['testsRun']) is int and
        all(type(partial[k]) is int for k in ('failures', 'errors', 'skipped')) and type(partial['passed']) is bool,
        'PARTIAL_GATE_FAILED')
    components['partial_disclosure_controls'] = dict(state='PASS', exit=code, **partial)
    progress['stage'] = 'TOOLCHAIN_DISCLOSURE_GATE'
    progress['component'] = 'toolchain_controls'
    components['toolchain_controls'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    code, out, _ = execute([sys.executable, '-B', 'scripts/security23/test_toolchain.py', '--regressions'], root, 120)
    tooling_gate = loads(out)
    components['toolchain_controls'] = toolchain_gate_report(tooling_gate, code)
    require(components['toolchain_controls']['state'] == 'PASS', 'TOOLCHAIN_GATE_FAILED')
    progress['stage'] = 'INPUT_DISCLOSURE_GATE'
    progress['component'] = 'inventory_controls'
    components['inventory_controls'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    code, out, _ = execute([sys.executable, '-B', 'scripts/security23/test_integration.py'], root, 60)
    input_gate = loads(out)
    require(code == 0 and input_gate == dict(testsRun=6, failures=0, errors=0, skipped=0, passed=True,
        qualification='SYNTHETIC_PUBLIC_INPUT_CONTROLS_ONLY') and type(input_gate['passed']) is bool and
        all(type(input_gate[k]) is int for k in ('testsRun', 'failures', 'errors', 'skipped')), 'INPUT_GATE_FAILED')
    components['inventory_controls'] = dict(state='PASS', exit=code, **input_gate)
    progress['stage'] = 'POLICY'
    progress['component'] = 'preflight'
    components['preflight'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    rules = policy(root)
    progress['stage'] = 'TOOLCHAIN'
    before_tools = identity(root)
    progress['toolchain'] = before_tools
    progress['stage'] = 'SOURCE_INVENTORY'
    before = snapshot(root, rules)
    progress['source'] = before
    components['preflight'] = dict(state='PASS')
    components['committed_metadata'] = before['metadata']
    components['working_bytes'] = before['workingBytes']
    components['archive_coverage'] = before['archiveCoverage']
    components['generated_content'] = dict(state='PASS' if before['generated']['state'] == 'EXPLICIT_DEPENDENCY_COMPONENT_SCOPE' else 'INCOMPLETE',
                                            **{key: value for key, value in before['generated'].items() if key != 'state'})
    progress['stage'] = 'DEPENDENCIES'
    progress['component'] = 'dependencies'
    components['dependencies'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    try:
        code, out, _ = execute(['node', 'scripts/security22/dependency.mjs'], root, seconds=600)
        components['dependencies'] = dependency(loads(out), code, before_tools['inputs']['package-lock.json'],
            lock_document=loads(regular(root, 'package-lock.json', 16*1024*1024)),
            npm_cli_sha256=before_tools['tools']['npm']['cliSHA256'],
            node_version=before_tools['tools']['node']['version'])
    except Exception as error:
        components['dependencies'] = dict(state='INCOMPLETE', reason=diagnostic(error))
    progress['stage'] = 'TOOLING'
    progress['component'] = 'tooling_regressions'
    components['tooling_regressions'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    try:
        components['tooling_regressions'] = tap(['node', '--test', 'scripts/phase9/patch-tooling-security.test.mjs',
            'scripts/phase9/tooling-security-vulnerabilities.test.mjs', 'scripts/security22/dependency.test.mjs',
            'scripts/security22/patch-tooling.test.mjs'], root)
    except Exception as error:
        components['tooling_regressions'] = dict(state='INCOMPLETE', reason=diagnostic(error))
    progress['stage'] = 'NATIVE_PATCHES'
    progress['component'] = 'mandatory_native_patches'
    components['mandatory_native_patches'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    try:
        code, _, _ = execute(['node', 'scripts/postinstall.mjs', '--check'], root, seconds=120)
        components['mandatory_native_patches'] = dict(state='PASS' if code == 0 else 'INCOMPLETE', exit=code)
    except Exception as error:
        components['mandatory_native_patches'] = dict(state='INCOMPLETE', reason=diagnostic(error))
    progress['stage'] = 'HISTORICAL_SOURCE_CONTRACT'
    progress['component'] = 'original_source_contract'
    components['original_source_contract'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    try:
        code, out, _ = execute([sys.executable, '-B', 'scripts/phase9/security_acceptance/contract.py', 'source', '--root', '.'], root, 180)
        report = loads(out)
        reason = report.get('code')
        require(reason in ('SOURCE_INVENTORY_DRIFT', 'PROPOSAL_EXPIRED_OR_CHANGED') and code == 1 and
                report.get('acceptanceGranted') is False and report.get('rawScannerPass') is False, 'HISTORICAL_RESULT_CHANGED')
        components['original_source_contract'] = dict(state='INCOMPLETE', exit=code, classification='HISTORICAL_CONTRACT_REFUSAL', reason=reason)
    except Exception as error:
        components['original_source_contract'] = dict(state='INCOMPLETE', reason=diagnostic(error))
    # The protected interface consumes no caller-provided signature or clean descriptor.
    # Qualified original findings, history and current secret/static scan custody remain external.
    components['protected_secret_history'] = dict(state='BLOCKED_EXTERNAL_CUSTODY', executed=False,
        historyCommits=before['history']['commits'], historyObjects=before['history']['reachableObjects'])
    components['protected_static_analysis'] = dict(state='NOT_RUN', executed=False, reason='QUALIFIED_TOOL_RULE_AND_OUTPUT_CUSTODY_REQUIRED')
    components['qualified_custody'] = dict(state='BLOCKED_EXTERNAL_CUSTODY', executed=False,
        clearanceAuthority='INDEPENDENT_QUALIFIED_REVIEW_ONLY')
    progress['stage'] = 'STABILITY'
    progress['component'] = 'execution_stability'
    components['execution_stability'] = dict(state='INCOMPLETE', executed=True)
    progress.notify()
    after = snapshot(root, rules)
    after_tools = identity(root)
    require(before == after and before_tools == after_tools, 'INPUT_CHANGED_DURING_EXECUTION')
    components['execution_stability'] = dict(state='PASS')
    result = dict(schema=1, qualification='CURRENT_PUBLIC_TECHNICAL_CANDIDATE_ONLY', source=before,
                  toolchain=before_tools, components=components, executionComplete=True, **summary(components))
    return result


def perform(root, observer=None):
    # Unknown bindings remain null. A failed preflight cannot certify a source or tool.
    names = ('disclosure_controls', 'partial_disclosure_controls', 'toolchain_controls', 'inventory_controls', 'preflight', 'committed_metadata',
             'working_bytes', 'archive_coverage', 'generated_content', 'dependencies', 'tooling_regressions',
             'mandatory_native_patches', 'original_source_contract', 'protected_secret_history',
             'protected_static_analysis', 'execution_stability')
    components = {name: dict(state='NOT_RUN', executed=False) for name in names}
    components['qualified_custody'] = dict(state='BLOCKED_EXTERNAL_CUSTODY', executed=False,
        clearanceAuthority='INDEPENDENT_QUALIFIED_REVIEW_ONLY')
    progress = Progress(components, observer)
    try:
        return perform_complete(root, components, progress)
    except (Exception, KeyboardInterrupt) as error:
        components[progress['component']] = dict(components[progress['component']], state='INCOMPLETE', executed=True,
            stage=progress['stage'], reason=diagnostic(error))
        components['execution_stability'] = dict(state='INCOMPLETE', stage=progress['stage'], reason=diagnostic(error))
        if components['preflight']['state'] != 'PASS':
            components['preflight'] = dict(state='INCOMPLETE', stage=progress['stage'], reason=diagnostic(error))
        result = dict(schema=1, qualification='CURRENT_PUBLIC_TECHNICAL_CANDIDATE_ONLY',
            source=progress['source'], toolchain=progress['toolchain'], components=components,
            executionComplete=False, **summary(components))
        if observer is not None: observer(result)
        return result


def main():
    try:
        parser = SafeParser(description=__doc__)
        parser.add_argument('mode', nargs='?', choices=('run', 'inventory', 'verify'), default='run')
        parser.add_argument('--receipt', type=Path)
        parser.add_argument('--output-dir', type=Path)
        args = parser.parse_args()
        if args.mode == 'inventory':
            require(args.receipt is None and args.output_dir is None, 'ARGUMENT_SCOPE')
            result = snapshot(ROOT, policy(ROOT))
            print(canonical(result).decode())
            return 0 if all(result[key]['state'] == 'PASS' for key in ('metadata', 'workingBytes', 'archiveCoverage')) else 2
        require((args.mode == 'verify') == (args.receipt is not None), 'ARGUMENT_SCOPE')
        expected = loads(receipt_bytes(args.receipt)) if args.mode == 'verify' else None
        journal = OutputJournal(args.output_dir) if args.output_dir is not None else None
        result = perform(ROOT, journal.record if journal is not None else None)
        if args.mode == 'verify':
            # Re-execute checks against this clean source; never trust caller exit/count fields.
            require(canonical(expected) == canonical(result), 'STALE_OMITTED_OR_FABRICATED_RECEIPT')
            result['receiptVerified'] = True
        if args.output_dir is not None:
            journal.record(result)
            publish_components(args.output_dir, result, journal)
        print(canonical(result).decode())
        return 1 if result['executionComplete'] else 2
    except (Exception, KeyboardInterrupt) as error:
        print(canonical(dict(schema=1, state='INCOMPLETE', reason=diagnostic(error), acceptanceGranted=False,
                             candidateReady=False, release='NO_GO')).decode())
        return 2


if __name__ == '__main__':
    sys.exit(main())
