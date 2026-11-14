"""Compile/run actual C47 widget function bodies with explicit Foundation test ports.

No production function implementation is copied into this runner. The two repaired
function bodies and their real decoding/transition/publication helpers are extracted
verbatim from the current source. SQLite, WidgetKit and JavaScript execution are
instrumented ports: this is a boundary behavior check, not native app/storage proof.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time

PREFIX = 'scripts/phase5/expo-widgets-57.0.26/'
LIMIT = 256 * 1024


def need(value, code):
    if not value:
        raise ValueError('C47_SWIFT_BEHAVIOR_' + code)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode('utf-8')


def safe_directory(path):
    path = Path(os.path.abspath(path))
    for parent in [*reversed(path.parents), path]:
        info = parent.lstat()
        need(stat.S_ISDIR(info.st_mode) and not parent.is_symlink() and
             not getattr(info, 'st_file_attributes', 0) & 0x400, 'INPUT_DIRECTORY')
    need(path.resolve() == path, 'DIRECTORY_ALIAS')


def read_regular(path):
    path = Path(os.path.abspath(path))
    safe_directory(path.parent)
    before = path.lstat()
    need(stat.S_ISREG(before.st_mode) and before.st_nlink == 1 and not path.is_symlink() and
         not getattr(before, 'st_file_attributes', 0) & 0x400 and before.st_size <= LIMIT, 'INPUT_TYPE')
    with path.open('rb') as stream:
        raw = stream.read(LIMIT + 1)
        opened = os.fstat(stream.fileno())
    after = path.lstat()
    need(len(raw) == before.st_size <= LIMIT and all(
        (item.st_dev, item.st_ino, item.st_size, item.st_mtime_ns) ==
        (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns)
        for item in [opened, after]), 'INPUT_CHANGED')
    return raw


def extract_block(source, marker):
    """A bounded lexical brace scan; string/comment braces are not Swift scopes."""
    need(source.count(marker) == 1, 'DECLARATION_CARDINALITY:' + marker)
    start = source.index(marker)
    cursor, depth, opened = start, 0, None
    while cursor < len(source):
        if source.startswith('//', cursor):
            end = source.find('\n', cursor)
            cursor = len(source) if end < 0 else end + 1
            continue
        if source.startswith('/*', cursor):
            comments = 1
            cursor += 2
            while comments and cursor < len(source):
                if source.startswith('/*', cursor): comments += 1; cursor += 2
                elif source.startswith('*/', cursor): comments -= 1; cursor += 2
                else: cursor += 1
            need(comments == 0, 'UNTERMINATED_COMMENT')
            continue
        if source[cursor] == '"':
            delimiter = '"""' if source.startswith('"""', cursor) else '"'
            cursor += len(delimiter)
            while cursor < len(source):
                if source[cursor] == '\\': cursor += 2
                elif source.startswith(delimiter, cursor): cursor += len(delimiter); break
                else: cursor += 1
            else:
                raise ValueError('C47_SWIFT_BEHAVIOR_UNTERMINATED_STRING')
            continue
        if source[cursor] == '{':
            if opened is None: opened = cursor
            depth += 1
        elif source[cursor] == '}':
            depth -= 1
            if opened is not None and depth == 0:
                return {'text': source[start:cursor + 1], 'body': source[opened + 1:cursor],
                        'line': source[:start].count('\n') + 1}
        cursor += 1
    raise ValueError('C47_SWIFT_BEHAVIOR_UNTERMINATED_DECLARATION:' + marker)


PORTS = r'''
import Foundation
import CoreFoundation
import Darwin

@@ERROR@@
@@RECORD@@

struct WidgetJavaScriptError: Error { let message: String }
typealias WidgetJavaScriptResult<Value> = Result<Value, WidgetJavaScriptError>
struct HarnessFailure: Error { let message: String }
enum HarnessFault: Error { case injectedCanonical }
func require(_ value: Bool, _ message: String) throws {
  if !value { throw HarnessFailure(message: message) }
}
func errorCode(_ error: Error) -> String {
  if let fault = error as? HarnessFault { switch fault { case .injectedCanonical: return "injectedCanonical" } }
  if let native = error as? LayerwellWidgetLifecycleError {
    switch native {
    case .invalidInput: return "invalidInput"
    case .unavailable: return "unavailable"
    case .unauthorized: return "unauthorized"
    case .stale: return "stale"
    case .storage: return "storage"
    }
  }
  return "unexpected-error"
}

enum Probe {
  static var rows: [[String: Any]] = []
  static var timeline: [[String: Any]] = []
  static var evaluation: WidgetJavaScriptResult<[String: Any]?> = .success(nil)
  static var appendAttempts = 0
  static var committedSpyEvents = 0
  static var evaluatorCalls = 0
  static var reloads = 0
  static var publicationEnabled = true
  static var publicationCalls = 0
  static var publicationResult = #"{"status":"published"}"#
  static var receivedNonce = ""
  static var receivedTimeline = ""
  static var canonicalReceiptFault = false
  static var authorityOwner = "11111111-1111-4111-8111-111111111111"
  static let authorityNonce = "44444444-4444-4444-8444-444444444444"
  static func reset(_ props: [String: Any]) {
    timeline = [["props": props]]
    evaluation = .success(nil)
    appendAttempts = 0; committedSpyEvents = 0; evaluatorCalls = 0; reloads = 0
    publicationEnabled = true; publicationCalls = 0
    publicationResult = #"{"status":"published"}"#
    receivedNonce = ""; receivedTimeline = ""; canonicalReceiptFault = false
    authorityOwner = "11111111-1111-4111-8111-111111111111"
  }
}
enum WidgetsStorage {
  static func getString(forKey _: String) -> String? { "synthetic-evaluator-port" }
}
final class WidgetCenter {
  static let shared = WidgetCenter()
  func reloadTimelines(ofKind _: String) { Probe.reloads += 1 }
}
func evaluateWidgetButtonPress(layout _: String, props _: [String: Any],
                               environment _: [String: Any]) -> WidgetJavaScriptResult<[String: Any]?> {
  Probe.evaluatorCalls += 1
  return Probe.evaluation
}

enum LayerwellWidgetLifecycleStore {
@@CONSTANTS@@
  private static let configuredDeepLink: String? = "onskin://today"
  private static var publicationIsEnabled: Bool { Probe.publicationEnabled }
@@FUNCTIONS@@
  // Only the canonical encoder port is fault-injectable. The real encoder body
  // above is unchanged; its declaration name alone is changed to permit this port.
  private static func canonicalJSON(_ value: Any, maximumBytes: Int = maximumJSONBytes) throws -> String {
    if Probe.canonicalReceiptFault, let object = value as? [String: String],
       object.count == 1, object["status"] == "published" { throw HarnessFault.injectedCanonical }
    return try productionCanonicalJSON(value, maximumBytes: maximumBytes)
  }
  static func currentTimelineDictionaries() throws -> [[String: Any]] { Probe.timeline }
  private static func readAuthorityJSON() throws -> String {
    let value: [String: Any] = ["authorityNonce": Probe.authorityNonce, "ownerGeneration": Probe.authorityOwner]
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    return String(data: data, encoding: .utf8)!
  }
  static func publishTimelineJSON(expectedAuthorityNonce: String, timelineJSON: String) throws -> String {
    Probe.publicationCalls += 1
    Probe.receivedNonce = expectedAuthorityNonce; Probe.receivedTimeline = timelineJSON
    return Probe.publicationResult
  }
@@APPEND_PREFIX@@
    // The production prefix above performs every pre-storage guard/decoder and
    // transition check. This marks crossing the storage port; no SQLite is modeled.
    _ = actionToken
    Probe.committedSpyEvents += 1
    return true
  }
}

struct HarnessWidgetInteraction {
  var target: String? = "widget-action:complete-next"
  var entryIndex: Int? = 0
  var environmentString: String? = "{}"
@@INTERACTION@@
  func exercise() { performLayerwellInteraction(source: LayerwellWidgetLifecycleStore.widgetName) }
}

func fixtureProps() -> [String: Any] {
  let now = Int64(Date().timeIntervalSince1970 * 1_000)
  return ["actionTokens": ["33333333-3333-4333-8333-333333333333"],
    "completedCount": 0, "deepLink": "onskin://today", "interactionRevision": 0,
    "localDate": "2026-11-04", "ownerGeneration": "11111111-1111-4111-8111-111111111111",
    "pendingActionTokens": [String](), "phase": "AM", "schemaVersion": 2,
    "snapshotNonce": "22222222-2222-4222-8222-222222222222", "staleAtMs": now + 30_000,
    "status": "ready", "totalCount": 1, "updatedAtMs": now - 1_000]
}
func validPatch() -> [String: Any] {
  ["actionTokens": [String](), "completedCount": 1, "interactionRevision": 1,
   "pendingActionTokens": ["33333333-3333-4333-8333-333333333333"], "status": "complete",
   "updatedAtMs": Int64(Date().timeIntervalSince1970 * 1_000)]
}
func interaction(_ name: String, _ evaluation: WidgetJavaScriptResult<[String: Any]?>,
                 props: [String: Any]? = nil, enabled: Bool = true,
                 expectedAttempts: Int, expectedEvents: Int) throws {
  Probe.reset(props ?? fixtureProps()); Probe.evaluation = evaluation; Probe.publicationEnabled = enabled
  HarnessWidgetInteraction().exercise()
  try require(Probe.appendAttempts == expectedAttempts, name + ": append port count")
  try require(Probe.committedSpyEvents == expectedEvents, name + ": rejected action crossed commit spy")
  try require(Probe.reloads == 1, name + ": reload path")
  Probe.rows.append(["name": name, "passed": true, "append_attempts": Probe.appendAttempts,
    "committed_spy_events": Probe.committedSpyEvents, "evaluator_calls": Probe.evaluatorCalls])
}
func publicationEntries(_ current: [String: Any]) -> [[String: Any]] {
  var stale = current
  stale["status"] = "stale"; stale["phase"] = "none"; stale["completedCount"] = 0
  stale["totalCount"] = 0; stale["actionTokens"] = [String](); stale["pendingActionTokens"] = [String]()
  return [["timestamp": current["updatedAtMs"]!, "props": current],
          ["timestamp": current["staleAtMs"]!, "props": stale]]
}
func publication(_ name: String, result: String = #"{"status":"published"}"#,
                 enabled: Bool = true, canonicalFault: Bool = false, ownerMismatch: Bool = false,
                 expectedError: String? = nil, expectedCalls: Int = 1) throws {
  let current = fixtureProps(); Probe.reset(current)
  Probe.publicationResult = result; Probe.publicationEnabled = enabled; Probe.canonicalReceiptFault = canonicalFault
  if ownerMismatch { Probe.authorityOwner = "55555555-5555-4555-8555-555555555555" }
  var observedError: String?
  do { try LayerwellWidgetLifecycleStore.publishTimelineEntries(publicationEntries(current)) }
  catch { observedError = errorCode(error) }
  try require(observedError == expectedError, name + ": error propagation " + (observedError ?? "none"))
  try require(Probe.publicationCalls == expectedCalls, name + ": publication port count")
  if expectedCalls == 1 {
    try require(Probe.receivedNonce == Probe.authorityNonce && !Probe.receivedTimeline.isEmpty,
                name + ": native authority/timeline arguments")
  }
  Probe.rows.append(["name": name, "passed": true, "publication_port_calls": Probe.publicationCalls,
    "error": observedError ?? "none"])
}
func runScenarios() throws {
  try interaction("nil-rejected-before-append", .success(nil), expectedAttempts: 0, expectedEvents: 0)
  try interaction("valid-transition-crosses-commit-port-once", .success(validPatch()), expectedAttempts: 1, expectedEvents: 1)
  try interaction("empty-result-rejected-without-event", .success([:]), expectedAttempts: 1, expectedEvents: 0)
  try interaction("malformed-result-rejected-without-event", .success(["completedCount": "invalid"]), expectedAttempts: 1, expectedEvents: 0)
  try interaction("evaluation-error-rejected-before-append", .failure(WidgetJavaScriptError(message: "synthetic evaluation error")), expectedAttempts: 0, expectedEvents: 0)
  var owner = validPatch(); owner["ownerGeneration"] = "55555555-5555-4555-8555-555555555555"
  try interaction("owner-transition-rejected-without-event", .success(owner), expectedAttempts: 1, expectedEvents: 0)
  var expired = fixtureProps(); let now = Int64(Date().timeIntervalSince1970 * 1_000)
  expired["updatedAtMs"] = now - 2_000; expired["staleAtMs"] = now - 1_000
  var expiredPatch = validPatch(); expiredPatch["updatedAtMs"] = expired["updatedAtMs"]
  try interaction("expired-transition-rejected-without-event", .success(expiredPatch), props: expired, expectedAttempts: 1, expectedEvents: 0)
  var revision = validPatch(); revision["interactionRevision"] = 2
  try interaction("revision-jump-rejected-without-event", .success(revision), expectedAttempts: 1, expectedEvents: 0)
  var token = validPatch(); token["pendingActionTokens"] = ["66666666-6666-4666-8666-666666666666"]
  try interaction("wrong-token-rejected-without-event", .success(token), expectedAttempts: 1, expectedEvents: 0)
  try interaction("disabled-publication-rejected-without-event", .success(validPatch()), enabled: false, expectedAttempts: 1, expectedEvents: 0)
  try publication("published-receipt-accepted")
  try publication("pending-receipt-is-stale", result: #"{"status":"outbox_pending"}"#, expectedError: "stale")
  try publication("canonical-error-propagates", canonicalFault: true, expectedError: "injectedCanonical")
  try publication("publication-disabled-refuses-before-port", enabled: false, expectedError: "unavailable", expectedCalls: 0)
  try publication("authority-owner-mismatch-refuses-before-port", ownerMismatch: true, expectedError: "unauthorized", expectedCalls: 0)
  try publication("noncanonical-published-receipt-is-stale", result: #"{"status": "published"}"#, expectedError: "stale")
}
do {
  try runScenarios()
  try require(Probe.rows.count == 16, "scenario inventory")
  let report: [String: Any] = ["status": "SWIFT_BEHAVIOR_PASS", "scenario_count": Probe.rows.count,
    "cases": Probe.rows, "native_sqlite_or_ios_runtime_qualified": false,
    "qualification": "Actual production function bodies/validation; Foundation test ports only."]
  let raw = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
  print(String(data: raw, encoding: .utf8)!)
} catch {
  let report: [String: Any] = ["status": "SWIFT_BEHAVIOR_FAIL", "scenario_count": Probe.rows.count,
    "error": String(describing: error), "native_sqlite_or_ios_runtime_qualified": false]
  let raw = try! JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
  print(String(data: raw, encoding: .utf8)!)
  exit(1)
}
'''


def generate(app_raw, store_raw):
    app, store = app_raw.decode('utf-8'), store_raw.decode('utf-8')
    records = []

    def fragment(source, marker, path, rename=None):
        selected = extract_block(source, marker)
        original = selected['text']
        text = original if rename is None else original.replace(*rename, 1)
        records.append({'path': path, 'declaration': marker.strip(), 'line': selected['line'],
            'declaration_sha256': sha(original.encode()), 'body_sha256': sha(selected['body'].encode()),
            'declaration_name_adjustment_only': rename is not None})
        return '#sourceLocation(file: ' + json.dumps(path) + ', line: ' + str(selected['line']) + ')\n' + text + '\n#sourceLocation()\n'

    store_path, app_path = PREFIX + 'LayerwellWidgetLifecycleStore.swift', PREFIX + 'AppIntent.swift'
    error = fragment(store, 'enum LayerwellWidgetLifecycleError:', store_path)
    record = fragment(store, 'private struct LayerwellWidgetPropsRecord {', store_path)
    functions = []
    for name in ['exactInt', 'uuid', 'tokenArray', 'isLocalDate', 'canonicalJSON',
                 'decodeWidgetProps', 'sameStrings', 'validateTransition', 'validatedPublication']:
        marker = '  private static func ' + name + '('
        rename = ('func canonicalJSON(', 'func productionCanonicalJSON(') if name == 'canonicalJSON' else None
        functions.append(fragment(store, marker, store_path, rename))
    functions.append(fragment(store, '  static func publishTimelineEntries(', store_path))
    constants = []
    for name in ['widgetName', 'interactionTarget', 'propsSchemaVersion', 'maximumActions',
                 'maximumLeaseMs', 'maximumSafeInteger', 'maximumJSONBytes']:
        rows = re.findall(r'^  (?:private )?static let ' + re.escape(name) + r'\b[^\r\n]*', store, re.M)
        need(len(rows) == 1, 'CONSTANT_CARDINALITY:' + name)
        constants.append(rows[0])
    patterns = re.findall(r'^  private static let uuidPattern = try! NSRegularExpression\(\r?\n[^\r\n]+\r?\n  \)', store, re.M)
    need(len(patterns) == 1, 'UUID_PATTERN_CARDINALITY')
    constants.append(patterns[0])
    append = extract_block(store, '  static func appendInteraction(')
    boundary = '    let inserted = try withExclusiveStore { urls in'
    need(append['text'].count(boundary) == 1, 'APPEND_STORAGE_PORT_BOUNDARY')
    prefix = append['text'].split(boundary)[0]
    opening = prefix.index('{') + 1
    prefix = prefix[:opening] + '\n    Probe.appendAttempts += 1' + prefix[opening:]
    records.append({'path': store_path, 'declaration': 'appendInteraction pre-storage prefix',
        'line': append['line'], 'source_prefix_sha256': sha(append['text'].split(boundary)[0].encode()),
        'observation_only_instrumentation': 'appendAttempts counter at entry',
        'storage_body_is_test_port': True})
    interaction = fragment(app, '  private func performLayerwellInteraction(', app_path)
    replacements = {'ERROR': error, 'RECORD': record, 'CONSTANTS': '\n'.join(constants),
                    'FUNCTIONS': '\n'.join(functions), 'APPEND_PREFIX': prefix, 'INTERACTION': interaction}
    text = PORTS
    for key, value in replacements.items():
        token = '@@' + key + '@@'
        need(text.count(token) == 1, 'TEMPLATE_TOKEN')
        text = text.replace(token, value)
    need('@@' not in text, 'UNRESOLVED_TEMPLATE_TOKEN')
    return text.encode('utf-8'), records


def run(command, output, name, timeout):
    started = time.monotonic()
    with (output / (name + '.stdout')).open('xb') as stdout, (output / (name + '.stderr')).open('xb') as stderr:
        try:
            result = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=timeout, check=False)
            code, timed_out = result.returncode, False
        except subprocess.TimeoutExpired:
            code, timed_out = 124, True
    rows = {}
    for stream in ('stdout', 'stderr'):
        path = output / (name + '.' + stream)
        need(path.stat().st_size <= 1024 * 1024, 'LOG_BOUND')
        raw = path.read_bytes()
        rows[stream] = {'path': path.name, 'bytes': len(raw), 'sha256': sha(raw)}
    return {'command': command, 'exit_code': code, 'timed_out': timed_out,
        'deadline_seconds': timeout, 'elapsed_seconds': round(time.monotonic() - started, 6), **rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path, default=Path(__file__).absolute().parents[3])
    parser.add_argument('--expected-head', default=os.environ.get('C47_EXPECTED_HEAD'))
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--emit-only', '--check-only', dest='emit_only', action='store_true',
                        help='Generate only; never a behavior PASS.')
    args = parser.parse_args()
    root, output = Path(os.path.abspath(args.source_root)), Path(os.path.abspath(args.output))
    safe_directory(root)
    safe_directory(output.parent)
    need(not output.is_relative_to(root) and not os.path.lexists(output), 'NEW_OUTPUT_OUTSIDE_SOURCE')
    source_identity = None
    if not args.emit_only:
        need(sys.platform == 'darwin', 'MACOS_REQUIRED')
        need(args.expected_head is not None and re.fullmatch(r'[a-f0-9]{40}', args.expected_head), 'EXPECTED_HEAD')
        git = lambda *argv: subprocess.check_output(['git', '--no-replace-objects', *argv], cwd=root, timeout=30)
        head = git('rev-parse', 'HEAD').decode().strip()
        need(head == args.expected_head and not git('status', '--porcelain', '--untracked-files=normal'), 'SOURCE_HEAD_OR_DIRT')
        source_identity = {'head': head, 'tree': git('rev-parse', 'HEAD^{tree}').decode().strip()}
    source = {name: read_regular(root / (PREFIX + name)) for name in ('AppIntent.swift', 'LayerwellWidgetLifecycleStore.swift')}
    if source_identity:
        for name, raw in source.items():
            need(git('show', args.expected_head + ':' + PREFIX + name) == raw, 'RAW_GIT_SOURCE:' + name)
    swift, functions = generate(source['AppIntent.swift'], source['LayerwellWidgetLifecycleStore.swift'])
    output.mkdir()
    (output / 'main.swift').write_bytes(swift)
    receipt = {'schema': 1, 'status': 'GENERATED_NOT_RUN', 'source_identity': source_identity,
        'source_files': [{'path': PREFIX + name, 'bytes': len(raw), 'sha256': sha(raw)} for name, raw in source.items()],
        'production_fragments': functions, 'generated_swift_sha256': sha(swift),
        'runner_sha256': sha(read_regular(__file__)), 'expected_scenarios': 16,
        'native_sqlite_or_ios_runtime_qualified': False, 'release': 'NO_GO', 'acceptance_granted': False,
        'qualification': 'Actual repaired function bodies and production validation with explicit Foundation test ports; '
            'no SQLite/cross-process/WidgetKit/AppIntent or full iOS application qualification.'}
    (output / 'generation.json').write_bytes(encoded(receipt))
    if args.emit_only:
        print(json.dumps(receipt, sort_keys=True))
        return 0
    commands = []
    commands.append(run(['xcrun', 'swiftc', '-swift-version', '5', '-Onone', str(output / 'main.swift'),
                         '-o', str(output / 'behavior-harness')], output, 'compile', 60))
    observed = None
    if commands[-1]['exit_code'] == 0:
        commands.append(run([str(output / 'behavior-harness')], output, 'behavior', 30))
        lines = (output / 'behavior.stdout').read_text(encoding='utf-8').splitlines()
        if lines:
            try: observed = json.loads(lines[-1])
            except ValueError: pass
    need(all(read_regular(root / (PREFIX + name)) == raw for name, raw in source.items()), 'SOURCE_INPUT_RACE')
    need(git('rev-parse', 'HEAD').decode().strip() == args.expected_head, 'SOURCE_HEAD_RACE')
    passed = len(commands) == 2 and all(row['exit_code'] == 0 for row in commands) and isinstance(observed, dict) and \
        observed.get('status') == 'SWIFT_BEHAVIOR_PASS' and observed.get('scenario_count') == 16 and \
        len(observed.get('cases', [])) == 16 and all(row.get('passed') is True for row in observed['cases'])
    receipt.update(status='SWIFT_BEHAVIOR_PASS' if passed else 'SWIFT_BEHAVIOR_FAIL',
                   commands=commands, behavior=observed, source_inputs_reread_unchanged=True)
    raw = encoded(receipt)
    (output / 'RESULTS.json').write_bytes(raw)
    print(json.dumps({'status': receipt['status'], 'results_sha256': sha(raw),
                      'source_identity': source_identity, 'native_sqlite_or_ios_runtime_qualified': False}, sort_keys=True))
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
