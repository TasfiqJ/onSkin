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


def publish_components(directory, result):
    directory = directory.absolute()
    require(not directory.resolve().is_relative_to(ROOT.resolve()), 'OUTPUT_INSIDE_SOURCE')
    for parent in directory.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode) and
                not getattr(info, 'st_file_attributes', 0) & 1024, 'OUTPUT_PARENT')
    directory.mkdir(exist_ok=False)
    entries = {}
    for name, component in sorted(result['components'].items()):
        require(re.fullmatch('[a-z_]+', name), 'COMPONENT_NAME')
        value = dict(schema=1, qualification=result['qualification'], admission='NOT_GRANTED',
                     head=result['source']['head'] if result.get('source') is not None else None,
                     tree=result['source']['tree'] if result.get('source') is not None else None,
                     toolchainIdentitySHA256=result['toolchain']['identitySHA256'] if result.get('toolchain') is not None else None,
                     component=name, result=component)
        raw = canonical(value) + b'\n'
        with (directory/(name+'.json')).open('xb') as stream:
            stream.write(raw)
        entries[name+'.json'] = dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    with (directory/'index.json').open('xb') as stream:
        stream.write(canonical(dict(schema=1, files=entries, **summary(result['components']))) + b'\n')


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
    code, out, _ = execute([sys.executable, '-B', 'scripts/security22/test_security22.py'], root, 60)
    gate = loads(out)
    disclosure_gate(gate, code)
    components['disclosure_controls'] = dict(state='PASS', exit=code, **gate)
    progress['stage'] = 'PARTIAL_DISCLOSURE_GATE'
    progress['component'] = 'partial_disclosure_controls'
    components['partial_disclosure_controls'] = dict(state='INCOMPLETE', executed=True)
    code, out, _ = execute([sys.executable, '-B', 'scripts/security23/test_partial_results.py'], root, 60)
    partial = loads(out)
    require(code == 0 and partial == dict(testsRun=10, failures=0, errors=0, skipped=0, passed=True,
        qualification='SYNTHETIC_PARTIAL_PUBLICATION_ONLY') and type(partial['testsRun']) is int and
        all(type(partial[k]) is int for k in ('failures', 'errors', 'skipped')) and type(partial['passed']) is bool,
        'PARTIAL_GATE_FAILED')
    components['partial_disclosure_controls'] = dict(state='PASS', exit=code, **partial)
    progress['stage'] = 'TOOLCHAIN_DISCLOSURE_GATE'
    progress['component'] = 'toolchain_controls'
    components['toolchain_controls'] = dict(state='INCOMPLETE', executed=True)
    code, out, _ = execute([sys.executable, '-B', 'scripts/security23/test_toolchain.py', '--regressions'], root, 120)
    tooling_gate = loads(out)
    expected_not_run = 12 if os.name == 'nt' else 3
    require(code == 0 and tooling_gate.get('qualification') == 'SYNTHETIC_PINNED_MODEL_FILESYSTEM_CONTROLS_ONLY' and
        tooling_gate.get('state') == 'PASS' and tooling_gate.get('platform') == os.name and
        tooling_gate.get('acceptanceGranted') is False and
        all(type(tooling_gate.get(k)) is int for k in ('tests', 'passed', 'failed', 'errors', 'notRun')) and
        tooling_gate['tests'] == 43 and tooling_gate['passed'] == 43 - expected_not_run and
        tooling_gate['notRun'] == expected_not_run and tooling_gate['failed'] == tooling_gate['errors'] == 0,
        'TOOLCHAIN_GATE_FAILED')
    components['toolchain_controls'] = dict(state='PASS', exit=code,
        qualification=tooling_gate['qualification'], platform=os.name,
        **{k: tooling_gate[k] for k in ('tests', 'passed', 'failed', 'errors', 'notRun')})
    progress['stage'] = 'POLICY'
    progress['component'] = 'preflight'
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
    try:
        components['tooling_regressions'] = tap(['node', '--test', 'scripts/phase9/patch-tooling-security.test.mjs',
            'scripts/phase9/tooling-security-vulnerabilities.test.mjs', 'scripts/security22/dependency.test.mjs',
            'scripts/security22/patch-tooling.test.mjs'], root)
    except Exception as error:
        components['tooling_regressions'] = dict(state='INCOMPLETE', reason=diagnostic(error))
    progress['stage'] = 'NATIVE_PATCHES'
    progress['component'] = 'mandatory_native_patches'
    components['mandatory_native_patches'] = dict(state='INCOMPLETE', executed=True)
    try:
        code, _, _ = execute(['node', 'scripts/postinstall.mjs', '--check'], root, seconds=120)
        components['mandatory_native_patches'] = dict(state='PASS' if code == 0 else 'INCOMPLETE', exit=code)
    except Exception as error:
        components['mandatory_native_patches'] = dict(state='INCOMPLETE', reason=diagnostic(error))
    progress['stage'] = 'HISTORICAL_SOURCE_CONTRACT'
    progress['component'] = 'original_source_contract'
    components['original_source_contract'] = dict(state='INCOMPLETE', executed=True)
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
    after = snapshot(root, rules)
    after_tools = identity(root)
    require(before == after and before_tools == after_tools, 'INPUT_CHANGED_DURING_EXECUTION')
    components['execution_stability'] = dict(state='PASS')
    result = dict(schema=1, qualification='CURRENT_PUBLIC_TECHNICAL_CANDIDATE_ONLY', source=before,
                  toolchain=before_tools, components=components, executionComplete=True, **summary(components))
    return result


def perform(root):
    # Unknown bindings remain null. A failed preflight cannot certify a source or tool.
    names = ('disclosure_controls', 'partial_disclosure_controls', 'toolchain_controls', 'preflight', 'committed_metadata',
             'working_bytes', 'archive_coverage', 'generated_content', 'dependencies', 'tooling_regressions',
             'mandatory_native_patches', 'original_source_contract', 'protected_secret_history',
             'protected_static_analysis', 'execution_stability')
    components = {name: dict(state='NOT_RUN', executed=False) for name in names}
    components['qualified_custody'] = dict(state='BLOCKED_EXTERNAL_CUSTODY', executed=False,
        clearanceAuthority='INDEPENDENT_QUALIFIED_REVIEW_ONLY')
    progress = dict(stage='DISCLOSURE_GATE', component='disclosure_controls', source=None, toolchain=None)
    try:
        return perform_complete(root, components, progress)
    except (Exception, KeyboardInterrupt) as error:
        components[progress['component']] = dict(state='INCOMPLETE', executed=True,
            stage=progress['stage'], reason=diagnostic(error))
        components['execution_stability'] = dict(state='INCOMPLETE', stage=progress['stage'], reason=diagnostic(error))
        if components['preflight']['state'] != 'PASS':
            components['preflight'] = dict(state='INCOMPLETE', stage=progress['stage'], reason=diagnostic(error))
        return dict(schema=1, qualification='CURRENT_PUBLIC_TECHNICAL_CANDIDATE_ONLY',
            source=progress['source'], toolchain=progress['toolchain'], components=components,
            executionComplete=False, **summary(components))


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
        result = perform(ROOT)
        if args.mode == 'verify':
            # Re-execute checks against this clean source; never trust caller exit/count fields.
            require(canonical(expected) == canonical(result), 'STALE_OMITTED_OR_FABRICATED_RECEIPT')
            result['receiptVerified'] = True
        if args.output_dir is not None:
            publish_components(args.output_dir, result)
        print(canonical(result).decode())
        return 1 if result['executionComplete'] else 2
    except (Exception, KeyboardInterrupt) as error:
        print(canonical(dict(schema=1, state='INCOMPLETE', reason=diagnostic(error), acceptanceGranted=False,
                             candidateReady=False, release='NO_GO')).decode())
        return 2


if __name__ == '__main__':
    sys.exit(main())
