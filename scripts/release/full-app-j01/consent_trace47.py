"""C04 separate Release observation of the preserved ordinary failure; no admission."""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import plistlib
import re
import tarfile

AUTH = 'BRAIN-C47-CONSENT-RUNTIME-CLOSURE-04'
MARKER = 'C47_SEPARATE_CONSENT_DIAGNOSTIC_04'
SOURCE = 'apps/mobile/src/features/healthConsent/lifecycle.ts'
SOURCE_SHA = '54a3bb1fa58de8d6efc029407da8841fe3974d0a4d0679efa59141fd360a4186'
OLD_SWIFT_SHA = '01a6948a2fb1ce456f4bac19d7d009969c12edc079b0ba332698af4c0490701e'
MAX_EVENTS = 256
MAX_TRACE = 262144
STATES = {'unconsented', 'active', 'withdrawing', 'withdrawn', 'verification_required'}
REASONS = {'status_unavailable', 'consent_contract_mismatch', 'processing_epoch_changed',
           'authoritative_unconsented', 'local_consent_unavailable',
           'withdrawal_status_unavailable', 'owner_unavailable'}
AGE = {'checking', 'current', 'reverification_required', 'missing', 'legacy', 'invalid',
       'unsupported', 'policy_mismatch', 'unavailable'}
OPERATIONS = {'startup', 'app-state', 'age-query', 'age-store-read', 'lifecycle-published',
              'lease-change', 'reconcile-read', 'unconfigured-enter',
              'withdrawal-cleanup-error', 'verification-cleanup-error',
              'active-consent-cleanup-error', 'initial-consent-cleanup-error',
              'initial-unconsented-cleanup-start', 'reconcile-error'}
ERROR_NAMES = {'Error', 'TypeError', 'RangeError', 'SyntaxError', 'AccountGenerationLeaseError',
               'OTHER_ERROR', 'NON_ERROR'}
ERROR_CODES = {'ACCOUNT_GENERATION_CHANGED', 'HEALTH_DATA_LIFECYCLE_INVALID',
               'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH', 'HEALTH_DATA_LIFECYCLE_TRANSITION_STALE',
               'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE', 'HEALTH_DATA_LIFECYCLE_WORKFLOW_STALE',
               'PRIVATE_STORAGE_UNAVAILABLE', 'PRIVATE_STORAGE_INVALID', 'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED', 'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_INVALID', 'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_MISMATCH', 'UNCLASSIFIED'}


def need(value, code):
    if not value:
        raise ValueError('C47_CONSENT_TRACE_' + code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def document(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n', encoding='utf8')


TS_OBSERVER = r'''
// Separate generated C04 diagnostic only; exact source is restored in finally.
function c47Trace04(operation: string, record: HealthDataLifecycleRecord | null, error?: unknown): void {
  try {
    const hook = (globalThis as typeof globalThis & {
      __C47_CONSENT_TRACE04__?: (event: Record<string, unknown>) => void;
    }).__C47_CONSENT_TRACE04__;
    if (!hook) return;
    const lease = activeHealthProcessingLeaseSnapshot();
    const errorName = error instanceof Error ? error.name : error === undefined ? null : 'NON_ERROR';
    const errorMessage = error instanceof Error ? error.message : '';
    const codes = ['ACCOUNT_GENERATION_CHANGED', 'HEALTH_DATA_LIFECYCLE_INVALID',
      'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH', 'HEALTH_DATA_LIFECYCLE_TRANSITION_STALE',
      'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE', 'HEALTH_DATA_LIFECYCLE_WORKFLOW_STALE',
      'PRIVATE_STORAGE_UNAVAILABLE', 'PRIVATE_STORAGE_INVALID', 'HEALTH_PURPOSE_LOCAL_CLEAR_FAILED', 'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_INVALID', 'HEALTH_PURPOSE_LOCAL_CLEAR_OWNER_MISMATCH'];
    hook({operation, state: record?.state ?? null,
      reason: record?.verificationReason ?? null, resumeState: record?.verificationResumeState ?? null,
      cleanupComplete: record?.localCleanupComplete ?? null,
      activationRoutePending: record?.activationRoutePending ?? null,
      epochZero: record === null ? null : record.processingEpoch === 0,
      leasePresent: lease !== null,
      leaseOwnerMatches: record === null || lease === null ? null : lease.ownerUserId === record.ownerUserId,
      leaseEpochMatches: record === null || lease === null ? null : lease.epoch === record.processingEpoch,
      errorClass: errorName === null ? null : ['Error', 'TypeError', 'RangeError', 'SyntaxError',
        'AccountGenerationLeaseError', 'NON_ERROR'].includes(errorName) ? errorName : 'OTHER_ERROR',
      errorCode: error === undefined ? null : codes.includes(errorMessage) ? errorMessage : 'UNCLASSIFIED'});
  } catch { /* Diagnostic observers cannot interrupt an authority transition. */ }
}
'''


def transformed_source(original):
    need(digest(original) == SOURCE_SHA, 'EXACT_F218_LIFECYCLE_PREIMAGE')
    text = original.decode('utf8')
    anchor = 'const ownerWorkflowStates = new Map<string, OwnerWorkflowState>();'
    need(text.count(anchor) == 1, 'OBSERVER_INSERTION')
    text = text.replace(anchor, TS_OBSERVER + '\n' + anchor)
    start, end = text.index('async function reconcileUnconfigured('), text.index('async function runRemoteForFence')
    body = text[start:end]
    entry = '  const ownerUserId = fence.ownerUserId;'
    need(body.count(entry) == 1, 'UNCONFIGURED_ENTRY')
    body = body.replace(entry, entry + "\n  c47Trace04('unconfigured-enter', previous);")
    catch = '    } catch (error) {\n      rethrowStaleWorkflow(error, fence);'
    need(body.count(catch) == 4, 'FOUR_EXACT_UNCONFIGURED_CATCHES')
    for operation, record in [('withdrawal-cleanup-error', 'previous'),
                              ('verification-cleanup-error', 'previous'),
                              ('active-consent-cleanup-error', 'paused'),
                              ('initial-consent-cleanup-error', 'paused')]:
        body = body.replace(catch, "    } catch (error) {\n      c47Trace04('" + operation + "', " + record + ", error);\n      rethrowStaleWorkflow(error, fence);", 1)
    initial = '  if (!consented && (previous === null || !previous.localCleanupComplete)) {'
    need(body.count(initial) == 1, 'INITIAL_CLEANUP_ORIGIN')
    body = body.replace(initial, initial + "\n    c47Trace04('initial-unconsented-cleanup-start', previous);")
    text = text[:start] + body + text[end:]
    read = '    previous = await readLocal(fence);'
    need(text.count(read) == 1, 'RECONCILE_READ')
    text = text.replace(read, read + "\n    c47Trace04('reconcile-read', previous);")
    outer = '  } catch (error) {\n    if (isAccountGenerationLeaseError(error)) throw error;\n    assertOwnerWorkflowFence(fence);\n    const code = error instanceof Error ? error.message : \'\';'
    need(text.count(outer) == 1, 'RECONCILE_CATCH')
    text = text.replace(outer, "  } catch (error) {\n    c47Trace04('reconcile-error', previous, error);" + outer[len('  } catch (error) {'):])
    return text.encode('utf8')


ENTRY = r'''import * as FileSystem from 'expo-file-system/legacy';
import { AppState } from 'react-native';
import { subscribeToHealthDataLifecycle } from '../src/features/healthConsent/lifecycleStore';
import { subscribeActiveHealthProcessingLeaseChanges, activeHealthProcessingLeaseSnapshot } from '../src/lib/consent/healthProcessingEpoch';
import { AGE_POLICY_STATUS_QUERY_KEY } from '../src/features/onboarding/ageGateStore';
import { queryClient } from '../src/lib/query/queryClient';
import { isSupabaseConfigured } from '../src/lib/env';
const marker = 'C47_SEPARATE_CONSENT_DIAGNOSTIC_04';
const rows = [];
let overflow = false, ageStatus = null, lastRecord = null;
let serial = Promise.resolve();
const directory = FileSystem.documentDirectory;
const launch = FileSystem.readAsStringAsync(directory + 'C47ConsentLaunch04.json').then(JSON.parse);
function emit(event) {
  try {
    if (rows.length >= 256) overflow = true;
    else rows.push({...event, sequence:rows.length + 1, ageStatus, backendConfigured:isSupabaseConfigured});
    const observed = rows.slice();
    serial = serial.then(async () => {
      const identity = await launch;
      const raw = JSON.stringify({schema:1, marker, ...identity, overflow, events:observed});
      if (raw.length > 262144) throw new Error('C47_TRACE_BOUND');
      await FileSystem.writeAsStringAsync(directory + 'C47ConsentTrace04-' + identity.pid + '.json', raw);
    }).catch(() => { console.error('C47_CONSENT_TRACE_WRITE_FAILED'); });
  } catch { console.error('C47_CONSENT_TRACE_OBSERVER_FAILED'); }
}
function observedRecord(operation, record) {
  const lease = activeHealthProcessingLeaseSnapshot();
  emit({operation, state:record?.state ?? null, reason:record?.verificationReason ?? null,
    resumeState:record?.verificationResumeState ?? null, cleanupComplete:record?.localCleanupComplete ?? null,
    activationRoutePending:record?.activationRoutePending ?? null,
    epochZero:record === null ? null : record.processingEpoch === 0, leasePresent:lease !== null,
    leaseOwnerMatches:record === null || lease === null ? null : lease.ownerUserId === record.ownerUserId,
    leaseEpochMatches:record === null || lease === null ? null : lease.epoch === record.processingEpoch,
    errorClass:null, errorCode:null});
}
globalThis.__C47_CONSENT_TRACE04__ = emit;
subscribeToHealthDataLifecycle(record => { try { lastRecord = record; observedRecord('lifecycle-published', record); } catch { console.error('C47_CONSENT_TRACE_OBSERVER_FAILED'); } });
subscribeActiveHealthProcessingLeaseChanges(() => { try { observedRecord('lease-change', lastRecord); } catch { console.error('C47_CONSENT_TRACE_OBSERVER_FAILED'); } });
queryClient.getQueryCache().subscribe(event => {
  try {
    if (event.type !== 'updated' || event.action.type !== 'success' ||
        JSON.stringify(event.query.queryKey) !== JSON.stringify(AGE_POLICY_STATUS_QUERY_KEY)) return;
    ageStatus = event.query.state.data;
    emit({operation:'age-query'});
  } catch { console.error('C47_CONSENT_TRACE_OBSERVER_FAILED'); }
});
AppState.addEventListener('change', state => { emit({operation:'app-state', appState:state}); });
emit({operation:'startup', appState:AppState.currentState});
// Observers above are registered before application mounting; no authority is changed.
require('expo-router/entry');
'''

SWIFT_HOOK = r'''
    // Generated C04 read-only diagnostic identity; removed before ordinary rebuild.
    let c47Launch: [String: Any] = ["head": "HEAD47", "bundle": Bundle.main.bundleIdentifier ?? "", "pid": Int(ProcessInfo.processInfo.processIdentifier)]
    let c47Documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    do {
      let c47Data = try JSONSerialization.data(withJSONObject: c47Launch, options: [.sortedKeys])
      try c47Data.write(to: c47Documents.appendingPathComponent("C47ConsentLaunch04.json"), options: .atomic)
    } catch { fatalError("C47 consent diagnostic identity unavailable") }
'''


@contextmanager
def diagnostic_inputs(root, ios, evidence, head):
    need(re.fullmatch('[a-f0-9]{40}', head), 'HEAD')
    lifecycle = root / SOURCE
    delegate = ios / 'LayerwellStaging/AppDelegate.swift'
    entry = root / 'apps/mobile/.expo/C47ConsentDiagnostic04.js'
    original, delegate_original = lifecycle.read_bytes(), delegate.read_bytes()
    generated = transformed_source(original)
    anchor = b'    let delegate = ReactNativeDelegate()'
    need(delegate_original.count(anchor) == 1 and b'C47' not in delegate_original, 'EXACT_DELEGATE_INSERTION')
    need(not entry.exists(), 'NO_EXISTING_ENTRY')
    delegate_generated = delegate_original.replace(anchor, SWIFT_HOOK.replace('HEAD47', head).encode() + anchor)
    evidence.mkdir(parents=True, exist_ok=False)
    for name, raw in [('lifecycle.original.ts', original), ('lifecycle.diagnostic.ts', generated),
                      ('AppDelegate.original.swift', delegate_original), ('AppDelegate.diagnostic.swift', delegate_generated),
                      ('diagnostic-entry.js', ENTRY.encode())]:
        (evidence / name).write_bytes(raw)
    document(evidence / 'TRANSFORM.json', {'authorization':AUTH, 'source_head':head,
        'source_path':SOURCE, 'source_original_sha256':digest(original), 'source_generated_sha256':digest(generated),
        'delegate_original_sha256':digest(delegate_original), 'delegate_generated_sha256':digest(delegate_generated),
        'entry_sha256':digest(ENTRY.encode()), 'projection':'EXACT_READ_ONLY_DIAGNOSTIC_INSERTIONS_ONLY',
        'no_authority_calls_added':True, 'ordinary_admitted':False})
    try:
        entry.parent.mkdir(exist_ok=True)
        entry.write_bytes(ENTRY.encode('utf8'))
        lifecycle.write_bytes(generated)
        delegate.write_bytes(delegate_generated)
        yield entry
    finally:
        lifecycle.write_bytes(original)
        delegate.write_bytes(delegate_original)
        if entry.exists():
            entry.unlink()
        restored = lifecycle.read_bytes() == original and delegate.read_bytes() == delegate_original and not entry.exists()
        document(evidence / 'RESTORED.json', {'source_original_sha256':digest(original),
            'source_restored_sha256':digest(lifecycle.read_bytes()),
            'delegate_original_sha256':digest(delegate_original), 'delegate_restored_sha256':digest(delegate.read_bytes()),
            'entry_removed':not entry.exists(), 'exact_restore':restored,
            'ordinary_product_rebuild_required':True, 'ordinary_admitted':False})
        need(restored, 'EXACT_RESTORE')


def validate_trace(raw, head, bundle, pid):
    need(0 < len(raw) <= MAX_TRACE, 'FILE_BOUND')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            need(key not in result, 'DUPLICATE_KEY')
            result[key] = value
        return result
    value = json.loads(raw, object_pairs_hook=unique)
    need(set(value) == {'schema','marker','head','bundle','pid','overflow','events'} and
         type(value['schema']) is int and value['schema'] == 1 and value['marker'] == MARKER and value['head'] == head and
         value['bundle'] == bundle and type(value['pid']) is int and value['pid'] == pid and pid > 0 and
         value['overflow'] is False, 'IDENTITY_OR_OVERFLOW')
    rows = value['events']
    need(isinstance(rows, list) and 0 < len(rows) <= MAX_EVENTS, 'EVENT_BOUND')
    optional = {'state','reason','resumeState','cleanupComplete','activationRoutePending','epochZero',
                'leasePresent','leaseOwnerMatches','leaseEpochMatches','errorClass','errorCode','appState'}
    for sequence, row in enumerate(rows, 1):
        need(isinstance(row, dict) and {'operation','sequence','ageStatus','backendConfigured'} <= set(row)
             and set(row) <= optional | {'operation','sequence','ageStatus','backendConfigured'}, 'EVENT_FIELDS')
        need(row['sequence'] == sequence and type(row['sequence']) is int and row['operation'] in OPERATIONS
             and row['ageStatus'] in AGE | {None} and type(row['backendConfigured']) is bool, 'EVENT_IDENTITY')
        for key, allowed in [('state',STATES), ('reason',REASONS), ('resumeState',STATES - {'verification_required'}),
                             ('errorClass',ERROR_NAMES), ('errorCode',ERROR_CODES),
                             ('appState',{'active','inactive','background','unknown','extension'})]:
            if key in row:
                need(row[key] in allowed | {None}, 'ENUM:' + key)
        for key in ['cleanupComplete','activationRoutePending','epochZero','leasePresent','leaseOwnerMatches','leaseEpochMatches']:
            if key in row:
                need(row[key] is None or type(row[key]) is bool, 'BOOLEAN:' + key)
    return value


def verify_diagnostic_install(r, n, container, app, bundle, inventory_path):
    """Bind this diagnostic's own inventory; no ordinary compiled stage exists."""
    installed = Path(container).resolve(strict=True)
    original_info = plistlib.loads(n.read_native_file(app / 'Info.plist'))
    installed_info = plistlib.loads(n.read_native_file(installed / 'Info.plist'))
    need(original_info.get('CFBundleIdentifier') == installed_info.get('CFBundleIdentifier') == bundle and
         original_info.get('CFBundleExecutable') == installed_info.get('CFBundleExecutable') == 'LayerwellStaging',
         'INSTALLED_DIAGNOSTIC_IDENTITY')
    inventory_raw = n.read_native_file(inventory_path)
    inventory = json.loads(inventory_raw)
    need(inventory['source'] == r.receipt['source'] and
         inventory['lane'] == 'SEPARATE_RELEASE_CONSENT_DIAGNOSTIC_04' and
         inventory['product']['bundle'] == bundle and inventory['product']['executable'] == 'LayerwellStaging',
         'DIAGNOSTIC_OWN_INVENTORY')
    authenticated = n.app_executable_identity(inventory['files'], 'LayerwellStaging')
    expected = n.stage_file_digest(app / 'LayerwellStaging', n.MAX_APP)
    observed = n.stage_file_digest(installed / 'LayerwellStaging', n.MAX_APP)
    need(observed == expected == authenticated, 'INSTALLED_DIAGNOSTIC_BYTES')
    detail = {'source':r.receipt['source'], 'bundle':bundle, 'installed_executable':observed,
              'diagnostic_inventory_sha256':digest(inventory_raw), 'ordinary_admitted':False}
    r.passed('consent-diagnostic-installed', detail)
    return detail


def run_trace(r, n, ios, argv, products, bundle, head):
    """Build and execute only the diagnostic predecessor; never admit ordinary/internal."""
    signing = n.simulator_signing()
    signing.validate_app_command(argv, bundle)
    need(bundle == 'com.layerwell.app.staging' and 'ENTRY_FILE' not in r.env, 'STAGING_ONLY')
    need(digest(n.read_native_file(r.root / 'scripts/release/full-app-j01/native_ui47.swift')) == OLD_SWIFT_SHA,
         'EXACT_NATIVE25_ORDINARY_SOURCE')
    evidence = r.output / 'consent-trace04'
    r.receipt.update(lane='SEPARATE_RELEASE_CONSENT_DIAGNOSTIC_04', ordinary_admitted=False,
                     internal_supported_owner='NOT_RUN')
    r.persist()
    with diagnostic_inputs(r.root, ios, evidence, head) as entry:
        r.run('consent-trace-build', argv + ['-resultBundlePath', products / 'consent-trace-build.xcresult', 'build'],
              env={**r.env, 'ENTRY_FILE':str(entry)}, timeout=3000)
        app = products / 'derived/Build/Products/Release-iphonesimulator/LayerwellStaging.app'
        js = n.read_native_file(app / 'main.jsbundle')
        need(MARKER.encode() in js and b'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03' not in js, 'EXACT_DIAGNOSTIC_MARKER')
        product = signing.inspect_product(r, n, app, bundle, 'consent-trace-product')
        files = n.bundle_inventory(app)
        document(evidence / 'app-inventory.json', {'source':r.receipt['source'], 'files':files,
            'configuration':'Release', 'lane':'SEPARATE_RELEASE_CONSENT_DIAGNOSTIC_04', 'product':product})
        archive = evidence / 'signed-consent-diagnostic-app.tar.gz'
        with tarfile.open(archive, 'w:gz') as out:
            out.add(app, arcname=app.name)
        document(evidence / 'app-artifact.json', {'file':archive.name, 'bytes':archive.stat().st_size,
            'sha256':n.sha(archive), 'inventory_sha256':n.sha(evidence / 'app-inventory.json'),
            'javascript_sha256':digest(js), 'product':product, 'head':head,
            'qualification':'DIAGNOSTIC_ONLY_NOT_AN_ORDINARY_OR_INTERNAL_PRODUCER'})
        device = n.prepare_simulator(r, 'normal')
        installed = n.install_simulator_app(r, device, app, bundle)
        verify_diagnostic_install(r, n, installed, app, bundle, evidence / 'app-inventory.json')
        first_pid = n.launch_and_verify(r, device, bundle)
        data = Path(r.text('consent-trace-data-container',
            ['xcrun','simctl','get_app_container',device,bundle,'data'], timeout=300))
        ui = r.output / 'ui'
        ui.mkdir()
        env = {**r.env, 'C47_BUNDLE_ID':bundle, 'C47_UI_PHASE':'normal-staging', 'C47_RUNTIME_LANE':'normal-staging'}
        r.run('generate-consent-trace-old-ui', ['ruby',r.root / 'scripts/release/full-app-j01/native_ui47.rb',ios,ui],
              env=env, timeout=120)
        receipt = json.loads((ui / 'runner.json').read_bytes())
        expected_case = 'C47NativeUI/C47NativeUI/testNormalStagingAgeConsentAndUnavailableAccount'
        need(receipt['tests'] == [expected_case] and receipt['lane'] == 'normal-staging' and
             receipt['bundle_id'] == bundle, 'OLD_UI_IDENTITY')
        try:
            r.run('consent-trace-old-ordinary-ui', ['xcodebuild','test','-project',receipt['project'],
                '-scheme',receipt['scheme'],'-destination','id=' + device, '-only-testing:' + expected_case,
                '-parallel-testing-enabled','NO','-maximum-concurrent-test-simulator-destinations','1',
                '-test-timeouts-enabled','YES','-default-test-execution-time-allowance','600',
                '-maximum-test-execution-time-allowance','600','-resultBundlePath',products / 'ui.xcresult',
                *n.SIMULATOR_BUILD_FLAGS], env=env, timeout=900, required=False)
        finally:
            trace_paths = sorted((data / 'Documents').glob('C47ConsentTrace04-*.json'))
            need(0 < len(trace_paths) <= 8, 'ACTUAL_PROCESS_TRACES_REQUIRED')
            traces = []
            for path in trace_paths:
                match = re.fullmatch(r'C47ConsentTrace04-([1-9][0-9]*)\.json', path.name)
                need(match, 'TRACE_FILENAME')
                raw = n.read_native_file(path)
                value = validate_trace(raw, head, bundle, int(match.group(1)))
                (evidence / path.name).write_bytes(raw)
                traces.append({'pid':value['pid'], 'bytes':len(raw), 'sha256':digest(raw),
                    'events':len(value['events']), 'file':path.name})
            need(first_pid in [row['pid'] for row in traces], 'VERIFIED_LAUNCH_PID_TRACE_REQUIRED')
            n.retain_result_bundles(r)
            result = {'authorization':AUTH, 'source':r.receipt['source'], 'simulator':device,
                'first_verified_launch_pid':first_pid, 'processes':traces, 'ordinary_admitted':False,
                'internal_admitted':False, 'ui_command':'consent-trace-old-ordinary-ui',
                'qualification':'ACTUAL_DIAGNOSTIC_OBSERVATIONS_ONLY; OLD_XCTEST_RESULT_RETAINED_WITHOUT_ADMISSION'}
            document(evidence / 'TRACE_RECEIPT.json', result)
        r.receipt.update(status='CONSENT_TRACE_ONLY_ORDINARY_NOT_ADMITTED', ordinary_admitted=False,
                         internal_supported_owner='NOT_RUN')
        r.passed('consent-transition-diagnostic-observation', result)
    # Source proof after exact restoration belongs to the coordinator.
    return result
