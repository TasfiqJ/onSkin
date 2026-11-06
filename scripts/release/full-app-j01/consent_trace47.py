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


# One authenticated historical diagnostic continuation. Generic successful
# build/ordinary/internal producer validators remain unchanged.
RETAINED27 = {
    'head':'eb9375b68ea90ef7d0be487e311b95d52e11bf12',
    'tree':'503d21a76f89831f3b7b03afa86947a030d9b760',
    'run_id':42246927646, 'job_id':127991461922, 'artifact_id':13524318049,
    'wire_bytes':85192778, 'payload_bytes':85129338,
    'digest':'75b115d8da0730ba431698f013444c34576c729d2b99ee6f649ca9bfdbad7119',
    'manifest_sha256':'9ba4f055ca13e1210ff72872b7d2d00862fad527a548b44c319c059dc2c4f4c1',
    'app_bytes':44035986, 'app_sha256':'ab2cc04c3d06be484160a2e57ad3ec4a01052a30004518f59b3d29938c6c52db',
    'inventory_sha256':'004105415292a989c5386517caa032ada23e73247c6e59655c293a9a2a83391f',
    'js_sha256':'98061b0b0b63719aedbf51376d120065930ca7887f8a6013219a2d2885c2ec39',
    'exe_bytes':70555760, 'exe_sha256':'d3c93421457e03497def72c90375e2397c3d018ef9e4c0431f78bae4f98d0cc3',
    'project_sha256':'a2eedea1ce1dd9a50952cf2284d1fb4937406d762beba6dffacd1b1792fbadb6',
    'ruby_sha256':'c76797b0c7d1f0d7b25e77831b5c21925cb5bc889c6b9e4db0d751aa0e9fb95f',
}


def retained27_metadata(run, job, artifact):
    p = RETAINED27
    name = 'campaign47-native-build-' + p['head'] + '-' + str(p['run_id']) + '-1'
    need(all(type(value.get(key)) is int for value,keys in
         [(run,('id','run_attempt')),(job,('id','run_id','run_attempt')),
          (artifact,('id','size_in_bytes'))] for key in keys), 'RETAINED27_METADATA_TYPES')
    need(run.get('id') == p['run_id'] and run.get('run_attempt') == 1 and
         run.get('head_sha') == p['head'] and run.get('head_branch') == 'stage/m1-native-runtime47' and
         run.get('event') == 'pull_request' and run.get('path') == '.github/workflows/campaign47-native-runtime.yml' and
         run.get('status') == 'completed' and run.get('conclusion') == 'failure' and
         run.get('repository', {}).get('full_name') == 'TasfiqJ/onSkin' and
         run.get('repository', {}).get('private') is False and
         run.get('head_repository', {}).get('full_name') == 'TasfiqJ/onSkin', 'RETAINED27_RUN')
    need(job.get('id') == p['job_id'] and job.get('run_id') == p['run_id'] and
         job.get('run_attempt') == 1 and job.get('head_sha') == p['head'] and
         job.get('name') == 'C47 build' and job.get('status') == 'completed' and
         job.get('conclusion') == 'failure' and job.get('labels') == ['macos-26-intel'], 'RETAINED27_JOB')
    owner = artifact.get('workflow_run', {})
    need(artifact.get('id') == p['artifact_id'] and artifact.get('name') == name and
         artifact.get('expired') is False and artifact.get('size_in_bytes') == p['wire_bytes'] and
         artifact.get('digest') == 'sha256:' + p['digest'] and owner.get('id') == p['run_id'] and
         owner.get('head_sha') == p['head'] and owner.get('head_branch') == 'stage/m1-native-runtime47',
         'RETAINED27_ARTIFACT')
    return {'wire_bytes':p['wire_bytes'], 'wire_sha256':p['digest'],
            'service_digest':'sha256:' + p['digest'], 'run_id':p['run_id'], 'job_id':p['job_id'],
            'artifact_id':p['artifact_id']}


def retained27_sources(consumer, producer):
    need(producer.get('head') == RETAINED27['head'] and producer.get('tree') == RETAINED27['tree'],
         'RETAINED27_PRODUCER_SOURCE')
    need(isinstance(consumer, dict) and re.fullmatch('[a-f0-9]{40}', consumer.get('head', '')) and
         re.fullmatch('[a-f0-9]{40}', consumer.get('tree', '')) and
         consumer['head'] != producer['head'], 'RETAINED27_DISTINCT_CONSUMER_SOURCE')
    return {'producer_source':producer, 'consumer_source':consumer,
            'ordinary_admitted':False, 'internal_admitted':False,
            'qualification':'HISTORICAL_DIAGNOSTIC_ONLY_NOT_CURRENT_APP_CANDIDATE'}


def retained27_zip(n, archive, target):
    import zipfile
    p = RETAINED27
    need(n.stage_file_digest(archive, n.STAGE_MAX_WIRE) ==
         {'bytes':p['wire_bytes'], 'sha256':p['digest']}, 'RETAINED27_WIRE')
    need(not target.exists(), 'RETAINED27_NEW_IMPORT')
    with zipfile.ZipFile(archive) as bundle:
        members = bundle.infolist()
        names = [item.filename for item in members]
        need(len(members) == 335 and len(set(names)) == 335 and
             len({name.casefold() for name in names}) == 335 and
             sum(item.file_size for item in members) == p['payload_bytes'], 'RETAINED27_CLOSED_MEMBERS')
        raw = bundle.read('stage-provenance.json')
        need(digest(raw) == p['manifest_sha256'], 'RETAINED27_MANIFEST_DIGEST')
        manifest = n.stage_json(raw)
        need({key:manifest.get(key) for key in ('schema','repository','run_id','run_attempt','job_name','stage','source')} ==
             {'schema':1, 'repository':'TasfiqJ/onSkin', 'run_id':p['run_id'], 'run_attempt':1,
              'job_name':'C47 build', 'stage':'build', 'source':{'head':p['head'],'tree':p['tree']}},
             'RETAINED27_MANIFEST_SOURCE')
        rows = manifest.get('files')
        need(isinstance(rows, list) and len(rows) == 334 and all(isinstance(row, dict) and
             set(row) == {'path','bytes','sha256'} for row in rows), 'RETAINED27_MANIFEST_ROWS')
        inventory = {row['path']:row for row in rows}
        need(len(inventory) == 334 and set(inventory) == set(names) - {'stage-provenance.json'},
             'RETAINED27_CLOSED_INVENTORY')
        aliases = {}
        for item in members:
            parts = n.stage_name(item.filename)
            need(not item.is_dir() and not item.flag_bits & 1 and
                 n.stat.S_IFMT(item.external_attr >> 16) in (0, n.stat.S_IFREG) and
                 item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED) and
                 item.file_size <= n.STAGE_MAX_FILE and
                 item.file_size <= max(1, item.compress_size) * 2000, 'RETAINED27_MEMBER_TYPE')
            for count in range(1, len(parts) + 1):
                prefix = '/'.join(parts[:count])
                need(aliases.get(prefix.casefold(), prefix) == prefix, 'RETAINED27_PATH_ALIAS')
                aliases[prefix.casefold()] = prefix
            need(not any('/'.join(parts[:count]) in names for count in range(1,len(parts))),
                 'RETAINED27_FILE_PARENT')
            data = bundle.read(item)  # ZipFile verifies the actual CRC.
            if item.filename != 'stage-provenance.json':
                need(inventory[item.filename] == {'path':item.filename,'bytes':len(data),'sha256':digest(data)},
                     'RETAINED27_MEMBER_DIGEST')
        target.mkdir(mode=0o700)
        for item in members:
            path = target.joinpath(*n.stage_name(item.filename))
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with path.open('xb') as output:
                output.write(bundle.read(item))
    need(n.stage_file_digest(archive, n.STAGE_MAX_WIRE) ==
         {'bytes':p['wire_bytes'], 'sha256':p['digest']}, 'RETAINED27_WIRE_REREAD')
    return target


def retained27_execution(n, directory):
    value = n.stage_json(n.read_native_file(directory / 'execution.json'))
    p = RETAINED27
    need(value.get('source', {}).get('head') == p['head'] and value['source'].get('tree') == p['tree'] and
         value.get('job_context') == {'repository':'TasfiqJ/onSkin','run_id':p['run_id'],
              'run_attempt':1,'job_id':'native-build','job_name':'C47 build'} and
         value.get('status') == 'PARTIAL_BLOCKED' and value.get('stage') == 'build' and
         value.get('stage_complete') is False and value.get('ordinary_admitted') is False and
         value.get('internal_supported_owner') == 'NOT_RUN' and
         value.get('acceptance_granted') is False and value.get('campaign_candidate_complete') is False and
         value.get('release') == 'NO_GO' and
         value.get('failure') == {'detail':'C47_COMMAND_FAILED:simulator-installed-container','type':'ValueError'},
         'RETAINED27_KNOWN_PARTIAL_ONLY')
    rows = value.get('commands')
    need(isinstance(rows, list) and len(rows) == 65 and len({row.get('name') for row in rows}) == 65,
         'RETAINED27_COMMANDS')
    for row in rows:
        for stream in ('stdout','stderr'):
            path = directory.joinpath(*n.stage_name(row[stream]))
            need(n.stage_file_digest(path) == {'bytes':row[stream + '_bytes'], 'sha256':row[stream + '_sha256']},
                 'RETAINED27_COMMAND_STREAM')
        if row.get('required') and row.get('name') != 'simulator-installed-container':
            need(row.get('exit_code') == 0 and row.get('state') == 'PASS' and
                 row.get('capture_complete') is True and not row.get('timed_out'), 'RETAINED27_REQUIRED_COMMAND')
    by_name = {row['name']:row for row in rows}
    for name in ('normal-install','postinstall-check','generated47-controls','current-generated47-source',
                 'current-generated47-native','current-generated47-resolved','consent-trace-build',
                 'consent-trace-product-file','consent-trace-product-architectures','consent-trace-product-platform',
                 'consent-trace-product-signature','consent-trace-product-signature-entitlements',
                 'consent-trace-product-verify-signature','simulator-install'):
        need(name in by_name and by_name[name].get('state') == 'PASS', 'RETAINED27_REQUIRED_STAGE')
    control = n.read_native_file(directory / by_name['generated47-controls']['stdout']).decode('utf8')
    need(all(re.search(r'^# ' + key + r' ' + count + r'\s*$', control, re.M)
             for key,count in [('tests','30'),('pass','30'),('fail','0'),('skipped','0')]),
         'RETAINED27_SOURCE30')
    failed = by_name['simulator-installed-container']
    need(failed.get('required') is True and failed.get('capture_complete') is True and
         failed.get('exit_code') == 124 and failed.get('timed_out') is True and
         30 < failed.get('timeout_seconds',0) < 32 and failed.get('stdout_bytes') == failed.get('stderr_bytes') == 0,
         'RETAINED27_DEADLINE_BOUNDARY')
    before = n.stage_json(n.read_native_file(directory / 'source-before.json'))
    need(before == value['source'], 'RETAINED27_CLOSED_SOURCE')
    restored = n.stage_json(n.read_native_file(directory / 'consent-trace04/RESTORED.json'))
    transform = n.stage_json(n.read_native_file(directory / 'consent-trace04/TRANSFORM.json'))
    need(restored.get('exact_restore') is True and restored.get('entry_removed') is True and
         restored.get('ordinary_admitted') is False and
         restored.get('source_original_sha256') == restored.get('source_restored_sha256') == SOURCE_SHA and
         restored.get('delegate_original_sha256') == restored.get('delegate_restored_sha256') and
         transform.get('source_head') == p['head'] and transform.get('ordinary_admitted') is False and
         transform.get('projection') == 'EXACT_READ_ONLY_DIAGNOSTIC_INSERTIONS_ONLY' and
         transform.get('no_authority_calls_added') is True, 'RETAINED27_RESTORATION')
    return value


def retained27_inventory(n, directory):
    p = RETAINED27
    folder = directory / 'consent-trace04'
    raw = n.read_native_file(folder / 'app-inventory.json')
    need(digest(raw) == p['inventory_sha256'], 'RETAINED27_APP_INVENTORY_DIGEST')
    inventory = n.stage_json(raw)
    artifact = n.stage_json(n.read_native_file(folder / 'app-artifact.json'))
    need(artifact.get('head') == p['head'] and artifact.get('file') == 'signed-consent-diagnostic-app.tar.gz' and
         artifact.get('bytes') == p['app_bytes'] and artifact.get('sha256') == p['app_sha256'] and
         artifact.get('inventory_sha256') == p['inventory_sha256'] and artifact.get('javascript_sha256') == p['js_sha256'] and
         artifact.get('qualification') == 'DIAGNOSTIC_ONLY_NOT_AN_ORDINARY_OR_INTERNAL_PRODUCER' and
         inventory.get('source', {}).get('head') == p['head'] and inventory['source'].get('tree') == p['tree'] and
         inventory.get('lane') == 'SEPARATE_RELEASE_CONSENT_DIAGNOSTIC_04' and
         inventory.get('configuration') == 'Release' and len(inventory.get('files',[])) == 346,
         'RETAINED27_APP_DOCUMENTS')
    need(n.app_executable_identity(inventory['files'], 'LayerwellStaging') ==
         {'bytes':p['exe_bytes'],'sha256':p['exe_sha256']}, 'RETAINED27_EXE_IDENTITY')
    return inventory, artifact


def retained27_installed(r, n, installed, app, inventory):
    p = RETAINED27
    need(inventory['source']['head'] == p['head'] and inventory['source']['tree'] == p['tree'],
         'RETAINED27_INSTALLED_PRODUCER_SOURCE')
    need(n.bundle_inventory(app) == inventory['files'] == n.bundle_inventory(Path(installed)),
         'RETAINED27_ALL_INSTALLED_BYTES')
    info = plistlib.loads(n.read_native_file(Path(installed) / 'Info.plist'))
    need(info.get('CFBundleIdentifier') == 'com.layerwell.app.staging' and
         info.get('CFBundleExecutable') == 'LayerwellStaging', 'RETAINED27_INSTALLED_BUNDLE')
    detail = retained27_sources(r.receipt['source'], inventory['source'])
    detail['all_installed_inventory_rows'] = len(inventory['files'])
    r.passed('retained27-diagnostic-installed', detail)
    return detail


def run_retained_runtime27(r, n, token):
    """Launch only EB's authenticated diagnostic; never current ordinary/internal."""
    p = RETAINED27
    need(n.platform.system() == 'Darwin' and r.receipt.get('stage') == 'build' and
         n.os.environ.get('GITHUB_JOB') == 'native-build' and
         all(r.env.get(key) == value for key,value in n.ENVIRONMENT.items()) and
         r.env.get('C47_UI_PHASE') == 'normal-staging' and token and
         'C47_ARTIFACT_READ_TOKEN' not in r.env, 'RETAINED27_HOST_CONTEXT')
    consumer = r.receipt['source']
    need(consumer['head'] == n.os.environ.get('C47_EXPECTED_HEAD'), 'RETAINED27_CONSUMER_HEAD')
    r.receipt.update(lane='HISTORICAL_RETAINED_CONSENT_DIAGNOSTIC_27', ordinary_admitted=False,
                     internal_supported_owner='NOT_RUN', upstream_payload_bytes=p['payload_bytes'])
    r.persist()
    evidence = r.output / 'retained-consent27'
    evidence.mkdir()
    documents = []
    for label,path in [('run','/actions/runs/' + str(p['run_id'])),
                       ('job','/actions/jobs/' + str(p['job_id'])),
                       ('artifact','/actions/artifacts/' + str(p['artifact_id']))]:
        value, raw_sha = n._stage_api(path, token)
        documents.append(value)
        document(evidence / ('producer-' + label + '.service-decoded.json'), value)
        document(evidence / ('producer-' + label + '.raw-hash.json'), {'service_response_sha256':raw_sha})
    proof = retained27_metadata(*documents)
    imported_root = Path(n.os.environ['RUNNER_TEMP']) / 'c47-retained27-authenticated'
    imported_root.mkdir(mode=0o700)
    archive = imported_root / 'artifact.zip'
    n._stage_download(p, proof, token, archive)
    directory = retained27_zip(n, archive, imported_root / 'payload')
    execution = retained27_execution(n, directory)
    binding = retained27_sources(consumer, execution['source'])
    inventory, artifact = retained27_inventory(n, directory)
    document(evidence / 'PRODUCER_BINDING.json', {**binding, 'service_proof':proof,
             'manifest_sha256':p['manifest_sha256'], 'all_closed_payloads':334, 'all_command_streams':130})
    tools = {}
    for label,argv in [('os',['sw_vers']),('architecture',['uname','-m']),('xcode',['xcodebuild','-version']),
                       ('simulator-sdk',['xcrun','--sdk','iphonesimulator','--show-sdk-version']),
                       ('ruby',['ruby','--version']),('xcodeproj',['ruby','-rxcodeproj','-e','puts Xcodeproj::VERSION'])]:
        tools[label] = r.text('retained27-tool-' + label, argv, timeout=60)
    need(tools['architecture'] == 'x86_64' and tools['xcode'].startswith('Xcode 26.4') and
         tools['simulator-sdk'] == '26.4' and tools['ruby'] and tools['xcodeproj'], 'RETAINED27_TOOLCHAIN')
    document(r.output / 'toolchain.json', tools)
    product_root = imported_root / 'app'
    product_root.mkdir()
    app_archive = directory / 'consent-trace04' / artifact['file']
    need(n.stage_file_digest(app_archive, n.MAX_APP) == {'bytes':p['app_bytes'],'sha256':p['app_sha256']},
         'RETAINED27_TAR_DIGEST')
    with app_archive.open('rb') as stream:
        n._produced_app_tar_pass(stream, inventory['files'])
        n._produced_app_tar_pass(stream, inventory['files'], product_root)
    app = product_root / 'LayerwellStaging.app'
    need(n.bundle_inventory(app) == inventory['files'], 'RETAINED27_EXTRACTED_INVENTORY')
    js = n.read_native_file(app / 'main.jsbundle')
    need(digest(js) == p['js_sha256'] and MARKER.encode() in js and
         b'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03' not in js, 'RETAINED27_DIAGNOSTIC_MARKER')
    n.simulator_signing().inspect_product(r, n, app, 'com.layerwell.app.staging', 'retained27-product')
    products = Path(n.os.environ['RUNNER_TEMP']) / 'c47-retained27-products'
    products.mkdir()
    r.receipt['products_directory'] = str(products)
    r.persist()
    device = n.prepare_simulator(r, 'normal')
    installed = n.install_simulator_app(r, device, app, 'com.layerwell.app.staging')
    retained27_installed(r, n, installed, app, inventory)
    first_pid = n.launch_and_verify(r, device, 'com.layerwell.app.staging')
    data = Path(r.text('retained27-data-container', ['xcrun','simctl','get_app_container',device,
                       'com.layerwell.app.staging','data'], timeout=300))
    old = evidence / 'historical-runner'
    old.mkdir()
    for name,expected in [('native_ui47.rb',p['ruby_sha256']),('native_ui47.swift',OLD_SWIFT_SHA)]:
        paths = r.run('retained27-historical-' + ('ruby' if name.endswith('.rb') else 'swift'),
            ['git','--no-replace-objects','show',p['head'] + ':scripts/release/full-app-j01/' + name],timeout=30)
        raw = n.read_native_file(paths[0])
        need(digest(raw) == expected, 'RETAINED27_HISTORICAL_RUNNER')
        (old / name).write_bytes(raw)
    swift = n.read_native_file(old / 'native_ui47.swift')
    need(len(swift) == 45239 and digest(swift[:9568]) ==
         '686d434f567f4da623134279617e4b91754d4bf0497968efe07d2100d94c59c7', 'RETAINED27_F218_PREFIX')
    body = n.read_native_file(directory / 'simulator-signing/project.after.pbxproj')
    need(digest(body) == p['project_sha256'], 'RETAINED27_AUTHENTIC_PROJECT_BODY')
    (old / 'project.after.pbxproj').write_bytes(body)
    ruby = n.read_native_file(old / 'native_ui47.rb')
    guard = b"abort 'expected one generated application project' unless Dir.glob(File.join(ios_directory, '*.xcodeproj')).length == 1"
    projected = (b"abort 'retained27 authentic project body changed' unless Digest::SHA256.file(File.join(ios_directory, 'project.after.pbxproj')).hexdigest == '" +
                 p['project_sha256'].encode() + b"'")
    need(ruby.count(guard) == 1, 'RETAINED27_SINGLE_HARNESS_PROJECTION')
    (old / 'native_ui47.rb.original').write_bytes(ruby)
    changed_ruby = ruby.replace(guard, projected)
    (old / 'native_ui47.rb').write_bytes(changed_ruby)
    import difflib
    (old / 'projection.diff').write_bytes(''.join(difflib.unified_diff(
        ruby.decode('utf8').splitlines(keepends=True), changed_ruby.decode('utf8').splitlines(keepends=True),
        fromfile='historical/native_ui47.rb', tofile='retained27/native_ui47.rb')).encode('utf8'))
    document(old / 'projection.json', {'original_sha256':digest(ruby),'projected_sha256':digest(changed_ruby),
        'removed_guard':guard.decode(),'replacement_guard':projected.decode(),'swift_unchanged_sha256':digest(swift),
        'qualification':'ONE_UNUSED_APP_PROJECT_GUARD_REPLACED_WITH_AUTHENTIC_RETAINED_PROJECT_HASH'})
    ui = r.output / 'ui'
    env = {**r.env,'C47_BUNDLE_ID':'com.layerwell.app.staging','C47_RUNTIME_LANE':'normal-staging','C47_UI_PHASE':'normal-staging'}
    r.run('retained27-generate-old-ui',['ruby',old / 'native_ui47.rb',old,ui],env=env,timeout=120)
    runner = n.stage_json(n.read_native_file(ui / 'runner.json'))
    case = 'C47NativeUI/C47NativeUI/testNormalStagingAgeConsentAndUnavailableAccount'
    need(runner.get('tests') == [case] and runner.get('lane') == 'normal-staging' and
         runner.get('bundle_id') == 'com.layerwell.app.staging', 'RETAINED27_EXACT_OLD_CASE')
    result = products / 'ui.xcresult'
    try:
        r.run('retained27-old-ui',['xcodebuild','test','-project',runner['project'],'-scheme',runner['scheme'],
            '-destination','id=' + device,'-only-testing:' + case,'-parallel-testing-enabled','NO',
            '-maximum-concurrent-test-simulator-destinations','1','-test-timeouts-enabled','YES',
            '-default-test-execution-time-allowance','600','-maximum-test-execution-time-allowance','600',
            '-resultBundlePath',result,*n.SIMULATOR_BUILD_FLAGS],env=env,timeout=900,required=False)
    finally:
        if result.is_dir():
            capture_names = []
            for kind in ('summary','tests'):
                for label,args in [('help',['help','get','test-results',kind]),
                                   ('schema',['get','test-results',kind,'--schema']),
                                   ('actual',['get','test-results',kind,'--path',result,'--compact'])]:
                    # Capture every actual provider response; unsupported schema
                    # exit codes remain visible and cannot count as schema proof.
                    capture_name = 'retained27-xcresult-' + label + '-' + kind
                    capture_names.append(capture_name)
                    r.run(capture_name,
                          ['xcrun','xcresulttool',*args],timeout=30,required=False,diagnostic=True)
            need(all(row.get('capture_complete') is True for row in r.receipt['commands']
                     if row.get('name') in capture_names), 'RETAINED27_XCRESULT_CAPTURE')
        trace_paths = sorted((data / 'Documents').glob('C47ConsentTrace04-*.json'))
        need(0 < len(trace_paths) <= 8, 'RETAINED27_ACTUAL_TRACES')
        traces = []
        for path in trace_paths:
            match = re.fullmatch(r'C47ConsentTrace04-([1-9][0-9]*)\.json',path.name)
            need(match, 'RETAINED27_TRACE_NAME')
            raw = n.read_native_file(path)
            value = validate_trace(raw,p['head'],'com.layerwell.app.staging',int(match.group(1)))
            (evidence / path.name).write_bytes(raw)
            traces.append({'file':path.name,'pid':value['pid'],'bytes':len(raw),'sha256':digest(raw),
                           'events':len(value['events'])})
        need(first_pid in [row['pid'] for row in traces], 'RETAINED27_LAUNCH_PID_TRACE')
        n.retain_result_bundles(r)
        document(evidence / 'TRACE_RECEIPT.json', {**binding,'simulator':device,'first_verified_launch_pid':first_pid,
            'traces':traces,'ui_case':case,'result_bundle_present':result.is_dir(),
            'qualification':'ACTUAL_HISTORICAL_DIAGNOSTIC_ONLY; OLD_UI_RESULT_NEVER_CURRENT_ORDINARY_ADMISSION'})
    r.receipt.update(status='CONSENT_RETAINED_RUNTIME_DIAGNOSTIC_ONLY_27',ordinary_admitted=False,
                     internal_supported_owner='NOT_RUN')
    r.persist()
    return binding
