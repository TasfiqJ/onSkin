"""Direct C05 observer/actual-transform/restoration controls; never native proof."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

PATH = Path(__file__).with_name('storage_trace47.py')
spec = importlib.util.spec_from_file_location('storage_trace47', PATH)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
ROOT = PATH.resolve().parents[3]

def stabilize_owned_fixture09(path, owned_root):
    """Only finalize metadata of a synthetic file created by this test.

    CPython Windows path-stat reports creation time while fstat may report
    change time (#157671). Set both on the owned fixture; do not normalize,
    retry or weaken any production observation of an untrusted file.
    """
    import os, stat
    path=Path(path);owned_root=Path(owned_root)
    assert path.resolve()==path and path.is_relative_to(owned_root.resolve())
    before=path.lstat();assert stat.S_ISREG(before.st_mode) and before.st_nlink==1
    if os.name!='nt':return
    import ctypes,msvcrt
    from ctypes import wintypes
    class Basic(ctypes.Structure):
        _fields_=[('CreationTime',ctypes.c_longlong),('LastAccessTime',ctypes.c_longlong),
            ('LastWriteTime',ctypes.c_longlong),('ChangeTime',ctypes.c_longlong),('FileAttributes',wintypes.DWORD)]
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    get=kernel.GetFileInformationByHandleEx;put=kernel.SetFileInformationByHandle
    for operation in (get,put):
        operation.argtypes=[wintypes.HANDLE,ctypes.c_int,ctypes.c_void_p,wintypes.DWORD]
        operation.restype=wintypes.BOOL
    with path.open('r+b')as stream:
        value=Basic();handle=msvcrt.get_osfhandle(stream.fileno())
        if not get(handle,0,ctypes.byref(value),ctypes.sizeof(value)):raise ctypes.WinError(ctypes.get_last_error())
        value.CreationTime=value.ChangeTime
        if not put(handle,0,ctypes.byref(value),ctypes.sizeof(value)):raise ctypes.WinError(ctypes.get_last_error())
    after=path.lstat()
    assert (before.st_dev,before.st_ino,before.st_mode,before.st_nlink,before.st_size,before.st_mtime_ns)==(
        after.st_dev,after.st_ino,after.st_mode,after.st_nlink,after.st_size,after.st_mtime_ns)

CLASSIFIER_TEST = 'const test = require(\'node:test\');\nconst assert = require(\'node:assert/strict\');\nconst fs = require(\'node:fs\');\nconst path = require(\'node:path\');\nconst vm = require(\'node:vm\');\nconst source = fs.readFileSync(path.join(__dirname, \'storage_origin05.entry.js\'), \'utf8\');\nconst HEAD = \'a\'.repeat(40);\n\nfunction harness(options = {}) {\n  const timers = [], writes = [], imports = [];\n  const identity = { schema: 1, pid: 321, sourceHead: HEAD,\n    bundle: options.bundle || \'com.layerwell.app.staging\' };\n  const native = {\n    documentDirectory: \'file:///diagnostic/\',\n    getInfoAsync: async () => ({ exists: true, isDirectory: false, size: 150 }),\n    readAsStringAsync: async () => JSON.stringify(identity),\n    writeAsStringAsync: async (file, value) => {\n      if (options.writeFails) throw new Error(\'private native flush failure\');\n      writes.push({ file, value });\n    },\n  };\n  const context = vm.createContext({\n    setTimeout: (callback) => { timers.push(callback); return timers.length; },\n    require: (name) => {\n      imports.push(name);\n      if (name === \'expo-file-system/legacy\') {\n        if (options.fsRequireFails) throw new Error(\'diagnostic filesystem import failed\');\n        return native;\n      }\n      assert.equal(name, \'expo-router/entry\');\n      if (!options.fsRequireFails && !options.hookInstallFails)\n        assert.equal(typeof context.__C47_STORAGE_ORIGIN05__, \'function\');\n      if (options.routerError) throw options.routerError;\n      return {};\n    },\n  });\n  if (options.hookInstallFails) Object.defineProperty(context, \'__C47_STORAGE_ORIGIN05__\',\n    { set() { throw new Error(\'diagnostic hook install failed\'); } });\n  vm.runInContext(source.replace(\'__C47_SOURCE_HEAD05__\', HEAD), context);\n  return { hook: context.__C47_STORAGE_ORIGIN05__, imports, writes,\n    drain: async () => { for (let n = 0; timers.length && n < 100; n += 1) await timers.shift()(); },\n    latest: () => JSON.parse(writes.at(-1).value) };\n}\nconst event = (overrides = {}) => ({ site: \'private-kv\', operation: \'getPrivateItem\',\n  phase: \'failure\', attempt: 1, sourceLine: 463, stage: \'AsyncStorage.getItem\',\n  disposition: \'propagate\', error: new Error(\'PRIVATE_KV_CONTENT_KEY_MISSING\'), ...overrides });\n\ntest(\'entry installs synchronous hook before router and flushes only on separate timer\', async () => {\n  const h = harness();\n  assert.deepEqual(h.imports, [\'expo-file-system/legacy\', \'expo-router/entry\']);\n  const attempt = h.hook(event({ phase: \'begin\', attempt: 0 }));\n  assert.equal(attempt, 1); assert.equal(h.writes.length, 0);\n  h.hook(event({ attempt })); await h.drain();\n  const out = h.latest();\n  assert.equal(out.pid, 321); assert.equal(out.sourceHead, HEAD);\n  assert.equal(out.bundle, \'com.layerwell.app.staging\');\n  assert.equal(out.diagnosticMarker, \'C47_STORAGE_ORIGIN_DIAGNOSTIC_05\');\n  assert.equal(out.events[1].attempt, attempt);\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, \'PRIVATE_KV_CONTENT_KEY_MISSING\');\n  assert.equal(h.writes[0].file, \'file:///diagnostic/C47StorageOrigin05-321.json\');\n});\n\ntest(\'actual omitted privateKV/C46/history/account codes survive each tagged observer boundary\', async () => {\n  const rows = [\n    [\'availability\', \'verifyPrivateStorage\', \'PRIVATE_KV_DECRYPTION_FAILED\'],\n    [\'age-store\', \'getAgePolicyReceiptStatus\', \'PRIVATE_KV_CONTENT_KEY_INVALID\'],\n    [\'content-key\', \'getStoredPrivateKVContentKey\', \'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\'],\n    [\'mutation\', \'assertPrivateMutationReadGeneration46\', \'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\'],\n    [\'mutation\', \'decodeHistoryIntentMarker45\', \'LOCAL_DATA_HISTORY_RECOVERY_REQUIRED\'],\n    [\'account-generation\', \'assertAccountGenerationLease\', \'ACCOUNT_GENERATION_CHANGED\'],\n    [\'owner-proof\', \'readLocalDataOwnerProof\', \'LOCAL_DATA_OWNER_PROOF_INVALID\'],\n    [\'lifecycle\', \'readLocal\', \'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE\'],\n  ];\n  for (const [site, operation, code] of rows) {\n    const h = harness(), original = new Error(code), descriptors = Object.getOwnPropertyDescriptors(original);\n    h.hook(event({ site, operation, error: original }));\n    h.hook(event({ site: \'age-store\', operation: \'getAgePolicyReceiptStatus\',\n      phase: \'caught\', disposition: \'ui_conversion\', error: original }));\n    await h.drain(); const out = h.latest();\n    assert.equal(out.firstFailure.site, site);\n    assert.equal(out.firstFailure.error.chain[0].recognizedCode, code);\n    assert.equal(out.firstUIFailure.error.chain[0].errorId, out.firstFailure.error.chain[0].errorId);\n    assert.deepEqual(Object.getOwnPropertyDescriptors(original), descriptors);\n  }\n});\n\ntest(\'plain native code and actual numeric cause fields survive, with bounded causal identities\', async () => {\n  const h = harness();\n  const native = { code: \'ERR_KEY_CHAIN\', message: \'private owner secret\', cause: { osStatus: -25308 } };\n  const wrapper = new Error(\'PRIVATE_KV_WRITE_ROLLBACK_FAILED\'); wrapper.cause = native;\n  h.hook(event({ error: wrapper })); await h.drain();\n  const chain = h.latest().firstFailure.error.chain;\n  assert.equal(chain.length, 3); assert.equal(chain[1].recognizedCode, \'ERR_KEY_CHAIN\');\n  assert.deepEqual(chain[2].numericFields, [{ field: \'osStatus\', value: -25308 }]);\n  assert.equal(chain[1].arbitraryMessageStackAndObjectOmitted, true);\n  assert.ok(!JSON.stringify(h.latest()).includes(\'private owner secret\'));\n});\n\ntest(\'unknown message/code/name/stack/owner metadata are omitted, not prefix-whitelisted\', async () => {\n  const h = harness(), secret = \'DOB_AND_OWNER_SECRET_1970_private\';\n  h.hook(event({ error: { name: secret, code: secret, message: \'PRIVATE_KV_DECRYPTION_FAILED:\' + secret,\n    stack: secret, ownerId: secret }, meta: { rawKey: secret, ownerId: secret, ownerHash: secret,\n    revisionChanged: true, liveClaimsCount: 2, keyCategory: \'age_receipt\' } }));\n  await h.drain(); const out = h.latest();\n  assert.ok(!JSON.stringify(out).includes(secret));\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, \'UNCLASSIFIED\');\n  assert.deepEqual(out.firstFailure.meta, { revisionChanged: true, liveClaimsCount: 2, keyCategory: \'age_receipt\' });\n});\n\ntest(\'no error or metadata getter, toJSON, coercion, or stack accessor executes\', async () => {\n  const h = harness(); let called = 0;\n  const error = Object.create(Error.prototype);\n  for (const name of [\'message\', \'code\', \'cause\', \'stack\']) Object.defineProperty(error, name,\n    { get() { called += 1; throw new Error(\'must not execute\'); } });\n  error.toJSON = () => { called += 1; throw 0; };\n  error.toString = () => { called += 1; throw 0; };\n  const meta = {}; Object.defineProperty(meta, \'keyCategory\', { get() { called += 1; throw 0; } });\n  h.hook(event({ error, meta })); await h.drain();\n  assert.equal(called, 0); assert.equal(h.latest().firstFailure.error.chain[0].errorClass, \'Error\');\n});\n\ntest(\'bounded prototype names handle cross-realm and inherited Error names without instanceof\', async () => {\n  const h = harness(); const foreign = vm.runInNewContext(\'new TypeError("PRIVATE_KV_ENVELOPE_INVALID")\');\n  h.hook(event({ error: foreign })); await h.drain();\n  assert.equal(h.latest().firstFailure.error.chain[0].errorClass, \'TypeError\');\n  assert.equal(h.latest().firstFailure.error.chain[0].recognizedCode, \'PRIVATE_KV_ENVELOPE_INVALID\');\n});\n\ntest(\'cause cycles/depth and supplied numeric fields remain bounded and do not infer an OSStatus\', async () => {\n  const h = harness(); const e = { code: \'ERR_KEY_CHAIN\', nativeCode: -50, errno: NaN,\n    nativeErrorCode: 2147483648, osStatus: \'-25308\' }; e.cause = e;\n  h.hook(event({ error: e })); await h.drain(); const out = h.latest().firstFailure.error;\n  assert.equal(out.chain.length, 1); assert.equal(out.causeEnding, \'cycle\');\n  assert.deepEqual(out.chain[0].numericFields, [{ field: \'nativeCode\', value: -50 }]);\n  assert.match(out.chain[0].numericQualification, /NOT_INFERRED_OSSTATUS/);\n  const other = harness(); other.hook(event({ error: { cause: { cause: { cause: { code: \'ERR_KEY_CHAIN\' } } } } }));\n  await other.drain(); assert.equal(other.latest().firstFailure.error.chain.length, 3);\n  assert.equal(other.latest().firstFailure.error.causeEnding, \'depth_limit\');\n});\n\ntest(\'primitive and thrownundefined rejections retain their actual kind and source site\', async () => {\n  for (const value of [undefined, null, 9, \'PRIVATE_KV_RECOVERY_REQUIRED\', \'private secret\']) {\n    const h = harness(); h.hook(event({ error: value })); await h.drain();\n    const actual = h.latest().firstFailure;\n    assert.equal(actual.site, \'private-kv\');\n    assert.equal(actual.error.chain[0].kind, value === null ? \'null\' : typeof value);\n    assert.equal(actual.error.chain[0].recognizedCode, value === \'PRIVATE_KV_RECOVERY_REQUIRED\' ? value : \'UNCLASSIFIED\');\n  }\n});\n\ntest(\'descriptor/prototype traps and failed flush cannot replace the application rejection\', async () => {\n  const h = harness({ writeFails: true });\n  const original = new Proxy({}, { getOwnPropertyDescriptor() { throw 1; }, getPrototypeOf() { throw 2; } });\n  const run = () => { try { throw original; } catch (error) { h.hook(event({ error })); throw error; } };\n  assert.throws(run, (error) => error === original); await h.drain(); assert.equal(h.writes.length, 0);\n  const good = harness(); good.hook(event({ error: original })); await good.drain();\n  assert.equal(good.latest().firstFailure.site, \'private-kv\');\n});\n\ntest(\'first observed probe and later UI failure stay distinct and immutable\', async () => {\n  const h = harness(), probe = new Error(\'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\');\n  h.hook(event({ error: probe, disposition: \'probe\' })); probe.message = \'private changed secret\';\n  h.hook(event({ error: new Error(\'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\'),\n    site: \'age-store\', operation: \'getAgePolicyReceiptStatus\', phase: \'caught\', disposition: \'ui_conversion\' }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, \'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\');\n  assert.equal(out.firstUIFailure.error.chain[0].recognizedCode, \'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\');\n  assert.notEqual(out.firstFailure.error.chain[0].errorId, out.firstUIFailure.error.chain[0].errorId);\n  assert.match(out.firstFailureQualification, /NOT_CAUSAL_DIAGNOSIS/);\n});\n\ntest(\'512-event limit reserves first failure and retains later UI failure separately with explicit drops\', async () => {\n  const h = harness();\n  for (let i = 0; i < 600; i += 1) h.hook(event({ phase: \'pass\', error: undefined }));\n  h.hook(event()); h.hook(event({ phase: \'caught\', disposition: \'ui_conversion\' }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.events.length, 512); assert.equal(out.droppedEvents, 90);\n  assert.equal(out.firstFailure.sequence, 601); assert.equal(out.firstUIFailure.sequence, 602);\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, \'PRIVATE_KV_CONTENT_KEY_MISSING\');\n});\n\ntest(\'invalid site/stage/metadata never leaks and wrong bundle cannot create a falsely bound trace\', async () => {\n  const h = harness(); h.hook(event({ site: \'private-owner-secret\' }));\n  h.hook(event({ stage: \'private-stage-secret\', meta: { keyCategory: \'private-key-secret\' } }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.droppedEvents, 1); assert.equal(out.events[0].stage, undefined);\n  assert.ok(!JSON.stringify(out).includes(\'private-stage-secret\'));\n  const wrong = harness({ bundle: \'foreign.app\' }); wrong.hook(event()); await wrong.drain();\n  assert.equal(wrong.writes.length, 0);\n});\n\ntest(\'filesystem import or hook-install failure still mounts router, whose original rejection propagates\', () => {\n  for (const options of [{ fsRequireFails: true }, { hookInstallFails: true }]) {\n    const h = harness(options);\n    assert.deepEqual(h.imports, [\'expo-file-system/legacy\', \'expo-router/entry\']);\n    const original = new Error(\'original router rejection\');\n    assert.throws(() => harness({ ...options, routerError: original }), (error) => error === original);\n  }\n});\n\ntest(\'actual counted clear family is normalized only for its bounded source outcomes\', async () => {\n  for (const [suffix, code, count] of [[\'1\', \'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED\', 1],\n    [\'2\', \'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED\', 2], [\'999-secret\', \'UNCLASSIFIED\', null]]) {\n    const h = harness(); h.hook(event({ error: new Error(\'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:\' + suffix),\n      meta: { ageStatus: \'unavailable\', parentAttempt: 7 } }));\n    await h.drain(); const out = h.latest();\n    assert.equal(out.firstFailure.error.chain[0].recognizedCode, code);\n    assert.equal(out.firstFailure.error.chain[0].recognizedCount, count);\n    assert.deepEqual(out.firstFailure.meta, { parentAttempt: 7, ageStatus: \'unavailable\' });\n  }\n});\n\n// Appended to the 14 byte-preserved historical control bodies; fixtures are VM-only.\nfunction saveFixture(name, value) {\n  if (process.env.C47_FIXTURE_OUTPUT05) {\n    fs.mkdirSync(process.env.C47_FIXTURE_OUTPUT05, { recursive: true });\n    fs.writeFileSync(path.join(process.env.C47_FIXTURE_OUTPUT05, name + \'.json\'), JSON.stringify(value));\n  }\n}\n\ntest(\'error window retains synthetic ID3 origin at sequence785 after routine cap, freezes at first UI786\', async () => {\n  const h = harness(); let sequence = 0;\n  const emit = (value) => { sequence += 1; return h.hook(value); };\n  const fillTo = (value) => { while (sequence < value) emit(event({ phase: \'pass\' })); };\n  fillTo(323);\n  emit(event({ site: \'mutation\', operation: \'invalidPrivateMutation46\',\n    error: new Error(\'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\'), disposition: \'probe\' }));\n  fillTo(699); emit(event({ error: new Error(\'unknown private rejection\') }));\n  fillTo(784);\n  const original = new Error(\'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY\');\n  const descriptors = Object.getOwnPropertyDescriptors(original);\n  emit(event({ operation: \'runAccountScopedPrivateOperation\', stage: \'entry\', disposition: \'throw\',\n    attempt: 440, error: original, meta: { boundaryBlocked: true, keyCategory: \'age_receipt\' } }));\n  emit(event({ site: \'age-store\', operation: \'getAgePolicyReceiptStatus\', phase: \'caught\',\n    disposition: \'ui_conversion\', attempt: 442, sourceLine: 90, stage: \'getPrivateItem\',\n    error: original, meta: { ageStatus: \'unavailable\' } }));\n  fillTo(917); await h.drain(); const first = h.latest();\n  assert.equal(first.traceFormatVersion, 2); assert.equal(first.events.length, 512);\n  assert.equal(first.droppedEvents, 405); assert.equal(first.firstFailure.sequence, 324);\n  assert.equal(first.firstUIFailure.sequence, 786); assert.equal(first.failureWindowLimit, 64);\n  assert.equal(first.failureWindowEvicted, 0); assert.equal(first.failureWindowFrozenAtFirstUI, true);\n  assert.deepEqual(first.failureWindow.map(row => row.sequence), [324, 700, 785, 786]);\n  assert.equal(first.failureWindow[2].error.chain[0].errorId, 3);\n  assert.equal(first.firstUIFailure.error.chain[0].errorId, 3);\n  assert.deepEqual(Object.getOwnPropertyDescriptors(original), descriptors);\n  h.hook(event({ error: new Error(\'PRIVATE_KV_ENVELOPE_INVALID\'), phase: \'caught\', disposition: \'ui_conversion\' }));\n  await h.drain(); const later = h.latest();\n  assert.deepEqual(later.firstFailure, first.firstFailure);\n  assert.deepEqual(later.firstUIFailure, first.firstUIFailure);\n  assert.deepEqual(later.failureWindow, first.failureWindow);\n  saveFixture(\'cap-account\', first);\n});\n\ntest(\'error window evicts only bounded oldest errors and never changes original first snapshots\', async () => {\n  const h = harness();\n  for (let i = 0; i < 65; i += 1) h.hook(event({ error: new Error(\'unknown\'), attempt: i + 1 }));\n  h.hook(event({ error: new Error(\'unknown UI\'), site: \'age-store\', operation: \'getAgePolicyReceiptStatus\',\n    phase: \'caught\', disposition: \'ui_conversion\', attempt: 66 }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.firstFailure.sequence, 1); assert.equal(out.firstUIFailure.sequence, 66);\n  assert.equal(out.failureWindow.length, 64); assert.equal(out.failureWindowEvicted, 2);\n  assert.equal(out.failureWindow[0].sequence, 3); assert.equal(out.failureWindow.at(-1).sequence, 66);\n  saveFixture(\'ring-eviction\', out);\n});\n\ntest(\'post-cap unknown rejection remains redacted without executing getters or acquiring an invented code\', async () => {\n  const h = harness(), secret = \'PRIVATE_OWNER_DOB_SECRET_05\'; let getters = 0;\n  for (let i = 0; i < 650; i += 1) h.hook(event({ phase: \'pass\' }));\n  const original = { code: secret, message: secret, stack: secret, ownerId: secret };\n  Object.defineProperty(original, \'cause\', { get() { getters += 1; throw secret; } });\n  h.hook(event({ error: original, meta: { ownerId: secret, rawKey: secret } }));\n  h.hook(event({ site: \'age-store\', operation: \'getAgePolicyReceiptStatus\', phase: \'caught\',\n    disposition: \'ui_conversion\', error: original }));\n  await h.drain(); const out = h.latest();\n  assert.equal(getters, 0); assert.ok(!JSON.stringify(out).includes(secret));\n  assert.equal(out.failureWindow.length, 2);\n  assert.equal(out.failureWindow[0].error.chain[0].recognizedCode, \'UNCLASSIFIED\');\n  saveFixture(\'cap-unknown\', out);\n});\n\ntest(\'new channel preserves caught native and distinct wrapper IDs but does not invent missing PASS history\', async () => {\n  for (const kind of [\'adjacent\', \'gap\', \'pass\']) {\n    const h = harness();\n    for (let i = 0; i < 650; i += 1) h.hook(event({ phase: \'pass\' }));\n    const native = { code: \'ERR_KEY_CHAIN\', message: \'omitted native secret\' };\n    const wrapper = new Error(\'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\');\n    h.hook(event({ site: \'content-key\', operation: \'getStoredPrivateKVContentKey\', phase: \'caught\',\n      disposition: \'caught\', stage: \'SecureStore.getItemAsync\', error: native, attempt: 23 }));\n    if (kind !== \'adjacent\') h.hook(event({ phase: kind === \'pass\' ? \'pass\' : \'state\', attempt: 23 }));\n    h.hook(event({ site: \'content-key\', operation: \'getStoredPrivateKVContentKey\',\n      phase: \'failure\', disposition: \'throw\', error: wrapper, attempt: 23 }));\n    h.hook(event({ site: \'age-store\', operation: \'getAgePolicyReceiptStatus\', phase: \'caught\',\n      disposition: \'ui_conversion\', error: wrapper }));\n    await h.drain(); const out = h.latest();\n    assert.notEqual(out.failureWindow[0].error.chain[0].errorId, out.failureWindow[1].error.chain[0].errorId);\n    assert.ok(!JSON.stringify(out).includes(\'omitted native secret\'));\n    saveFixture(\'native-wrap-\' + kind, out);\n  }\n});\n\ntest(\'no failure leaves an empty unfrozen bounded channel\', async () => {\n  const h = harness();\n  for (let i = 0; i < 700; i += 1) h.hook(event({ phase: \'pass\' }));\n  await h.drain(); const out = h.latest();\n  assert.deepEqual(out.failureWindow, []); assert.equal(out.failureWindowEvicted, 0);\n  assert.equal(out.failureWindowFrozenAtFirstUI, false); assert.equal(out.firstFailure, null);\n  assert.equal(out.firstUIFailure, null); assert.equal(out.events.length, 511);\n  saveFixture(\'no-failure\', out);\n});\n'


class StorageOrigin05Tests(unittest.TestCase):
    def test_classifier_actual_native_cause_redaction_getter_bounds_and_failure_containment(self):
        with tempfile.TemporaryDirectory(prefix='c47-origin05-observer-') as temporary:
            p = Path(temporary).resolve()
            (p/'storage_origin05.entry.js').write_text(s.ENTRY_TEMPLATE,encoding='utf8')
            (p/'storage_origin05.test.cjs').write_text(CLASSIFIER_TEST,encoding='utf8')
            result = subprocess.run(['node','--test',str(p/'storage_origin05.test.cjs')],
                cwd=ROOT,capture_output=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
            self.assertIn(b'# fail 0',result.stdout)
            self.assertIn(b'# skipped 0',result.stdout)

    def test_actual_ten_source_transform_parses_recovers_and_preserves_original_errors(self):
        result=subprocess.run(['node',str(ROOT/'scripts/release/full-app-j01/storage_origin47.mjs'),'--self-test'],
            cwd=ROOT,capture_output=True,timeout=60)
        self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))

    def test_diagnostic_input_context_restores_every_original_after_build_failure(self):
        with tempfile.TemporaryDirectory(prefix='c47-origin05-restore-') as temporary:
            root=Path(temporary).resolve()/'source';root.mkdir();originals={}
            for relative in s.SOURCE_PREIMAGES:
                original=historical_diagnostic_source05(relative);originals[relative]=original
                target=root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(original)
            script='scripts/release/full-app-j01/storage_origin47.mjs'
            target=root/script;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/script).read_bytes())
            ios=root/'apps/mobile/ios';delegate=ios/'LayerwellStaging/AppDelegate.swift'
            delegate.parent.mkdir(parents=True);delegate_original=b'import Expo\n    let delegate = ReactNativeDelegate()\n'
            delegate.write_bytes(delegate_original)
            def run(label,argv,**kwargs):
                result=subprocess.run(list(map(str,argv)),cwd=ROOT,capture_output=True,timeout=60)
                self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
            evidence=Path(temporary).resolve()/'evidence'
            with self.assertRaisesRegex(RuntimeError,'original-build-failure'):
                with s.diagnostic_inputs(root,ios,evidence,'a'*40,run) as entry:
                    self.assertTrue(entry.is_file())
                    self.assertIn(b'C47_STORAGE_ORIGIN_DIAGNOSTIC_05',entry.read_bytes())
                    self.assertIn(b'C47StorageOrigin05Identity.json',delegate.read_bytes())
                    for relative,original in originals.items():self.assertNotEqual((root/relative).read_bytes(),original)
                    raise RuntimeError('original-build-failure')
            for relative,original in originals.items():self.assertEqual((root/relative).read_bytes(),original)
            self.assertEqual(delegate.read_bytes(),delegate_original)
            self.assertFalse((root/'apps/mobile/.expo/C47StorageOrigin05.js').exists())
            restored=json.loads((evidence/'RESTORED.json').read_bytes())
            self.assertTrue(restored['exact_restore'])
            self.assertFalse(restored['ordinary_admitted'])
            self.assertEqual(restored['restored_sources'],10)

    def _context_fixture(self, temporary):
        root=Path(temporary).resolve()/'source';root.mkdir();originals={}
        for relative in s.SOURCE_PREIMAGES:
            original=historical_diagnostic_source05(relative);originals[relative]=original
            target=root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(original)
        script='scripts/release/full-app-j01/storage_origin47.mjs'
        target=root/script;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/script).read_bytes())
        ios=root/'apps/mobile/ios';delegate=ios/'LayerwellStaging/AppDelegate.swift'
        delegate.parent.mkdir(parents=True);delegate_original=b'import Expo\n    let delegate = ReactNativeDelegate()\n'
        delegate.write_bytes(delegate_original)
        def run(label,argv,**kwargs):
            result=subprocess.run(list(map(str,argv)),cwd=ROOT,capture_output=True,timeout=60)
            self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
        return root,ios,delegate,delegate_original,originals,run

    def test_partial_entry_write_preserves_original_error_and_cleans_only_owned_prefix(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory(prefix='c47-origin05-partial-entry-') as temporary:
            root,ios,delegate,delegate_original,originals,run=self._context_fixture(temporary)
            entry=root/'apps/mobile/.expo/C47StorageOrigin05.js'
            evidence=Path(temporary).resolve()/'evidence'
            original_error=OSError('controlled partial diagnostic entry write')
            original_open=Path.open
            class PartialWrite:
                def __init__(self,stream):self.stream=stream
                def __enter__(self):return self
                def __exit__(self,*args):return self.stream.__exit__(*args)
                def fileno(self):return self.stream.fileno()
                def write(self,raw):
                    self.stream.write(raw[:37]);self.stream.flush()
                    raise original_error
            def open_partial(path,mode='r',*args,**kwargs):
                stream=original_open(path,mode,*args,**kwargs)
                return PartialWrite(stream) if path==entry and mode=='xb' else stream
            with patch.object(Path,'open',open_partial):
                with self.assertRaises(OSError) as caught:
                    with s.diagnostic_inputs(root,ios,evidence,'a'*40,run):
                        self.fail('a partial entry write must never reach application mutation')
            self.assertIs(caught.exception,original_error)
            self.assertFalse(entry.exists())
            for relative,original in originals.items():self.assertEqual((root/relative).read_bytes(),original)
            self.assertEqual(delegate.read_bytes(),delegate_original)
            restored=json.loads((evidence/'RESTORED.json').read_bytes())
            self.assertTrue(restored['exact_restore'])
            self.assertTrue(restored['entry_absent'])
            self.assertTrue(restored['entry_owned_created'])
            self.assertTrue(restored['entry_cleaned_owned'])
            self.assertEqual(restored['restored_sources'],0)
            self.assertFalse(restored['delegate_attempted'])

    def test_transform_time_foreign_source_change_is_refused_without_overwriting_it(self):
        with tempfile.TemporaryDirectory(prefix='c47-origin05-input-guard-') as temporary:
            root,ios,delegate,delegate_original,originals,run=self._context_fixture(temporary)
            changed=next(iter(originals));unexpected=b'controlled unexpected external source bytes'
            def changing_run(label,argv,**kwargs):
                run(label,argv,**kwargs)
                (root/changed).write_bytes(unexpected)
            evidence=Path(temporary).resolve()/'evidence'
            with self.assertRaisesRegex(ValueError,'SOURCE_CHANGED_BEFORE_TRANSFORM'):
                with s.diagnostic_inputs(root,ios,evidence,'a'*40,changing_run):
                    self.fail('an unowned input change must stop before diagnostic writes')
            self.assertEqual((root/changed).read_bytes(),unexpected)
            for relative,original in originals.items():
                if relative!=changed:self.assertEqual((root/relative).read_bytes(),original)
            self.assertEqual(delegate.read_bytes(),delegate_original)
            self.assertFalse((root/'apps/mobile/.expo/C47StorageOrigin05.js').exists())
            self.assertFalse((evidence/'RESTORED.json').exists())

    def test_replaced_entry_is_preserved_and_cannot_claim_exact_restoration(self):
        with tempfile.TemporaryDirectory(prefix='c47-origin05-entry-replaced-') as temporary:
            root,ios,delegate,delegate_original,originals,run=self._context_fixture(temporary)
            evidence=Path(temporary).resolve()/'evidence';replacement=Path(temporary).resolve()/'foreign.js'
            replacement.write_bytes(b'controlled foreign diagnostic entry replacement')
            with self.assertRaisesRegex(ValueError,'EXACT_DIAGNOSTIC_RESTORATION_FAILED'):
                with s.diagnostic_inputs(root,ios,evidence,'a'*40,run) as entry:
                    expected=entry.read_bytes()
                    self.assertNotEqual((entry.stat().st_dev,entry.stat().st_ino),
                                        (replacement.stat().st_dev,replacement.stat().st_ino))
                    replacement.write_bytes(expected)
                    replacement.replace(entry)
            self.assertEqual(entry.read_bytes(),expected)
            for relative,original in originals.items():self.assertEqual((root/relative).read_bytes(),original)
            self.assertEqual(delegate.read_bytes(),delegate_original)
            restored=json.loads((evidence/'RESTORED.json').read_bytes())
            self.assertFalse(restored['exact_restore'])
            self.assertFalse(restored['entry_absent'])
            self.assertFalse(restored['entry_cleaned_owned'])
            self.assertIn('GENERATED_ENTRY',restored['restore_failures'])

    def test_identity_failure_is_observation_failure_and_not_an_app_crash_or_ordinary_pass(self):
        self.assertNotIn('fatalError(',s.SWIFT_HOOK)
        self.assertIn('NSLog("C47_STORAGE_ORIGIN05_IDENTITY_WRITE_FAILED")',s.SWIFT_HOOK)
        self.assertEqual(s.AUTH,'BRAIN-C47-STORAGE-ROOT-CAUSE-RUNTIME-05')
        self.assertEqual(len(s.SOURCE_PREIMAGES),10)


# Pure closed trace/actual-origin discriminator tests are appended below.
VALIDATOR_FIXTURES05 = json.loads("{\"c46\":{\"schema\":1,\"role\":\"STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY\",\"diagnosticMarker\":\"C47_STORAGE_ORIGIN_DIAGNOSTIC_05\",\"sourceHead\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"pid\":321,\"bundle\":\"com.layerwell.app.staging\",\"eventLimit\":512,\"events\":[{\"sequence\":1,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"begin\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\"},{\"sequence\":2,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{\"revisionEqual\":false,\"liveClaims\":0,\"failedClaims\":0},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},{\"sequence\":3,\"site\":\"age-store\",\"operation\":\"getAgePolicyReceiptStatus\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{\"ageStatus\":\"unavailable\"},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}}],\"firstFailure\":{\"sequence\":2,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{\"revisionEqual\":false,\"liveClaims\":0,\"failedClaims\":0},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstUIFailure\":{\"sequence\":3,\"site\":\"age-store\",\"operation\":\"getAgePolicyReceiptStatus\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{\"ageStatus\":\"unavailable\"},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstFailureQualification\":\"FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION\",\"droppedEvents\":0,\"flushFailures\":0,\"errorIdentityLimit\":1024,\"ordinaryAdmitted\":false,\"acceptanceGranted\":false,\"release\":\"NO_GO\"},\"known-only\":{\"schema\":1,\"role\":\"STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY\",\"diagnosticMarker\":\"C47_STORAGE_ORIGIN_DIAGNOSTIC_05\",\"sourceHead\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"pid\":321,\"bundle\":\"com.layerwell.app.staging\",\"eventLimit\":512,\"events\":[{\"sequence\":1,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"begin\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\"},{\"sequence\":2,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},{\"sequence\":3,\"site\":\"age-store\",\"operation\":\"getAgePolicyReceiptStatus\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}}],\"firstFailure\":{\"sequence\":2,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstUIFailure\":{\"sequence\":3,\"site\":\"age-store\",\"operation\":\"getAgePolicyReceiptStatus\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstFailureQualification\":\"FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION\",\"droppedEvents\":0,\"flushFailures\":0,\"errorIdentityLimit\":1024,\"ordinaryAdmitted\":false,\"acceptanceGranted\":false,\"release\":\"NO_GO\"},\"native-wrap\":{\"schema\":1,\"role\":\"STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY\",\"diagnosticMarker\":\"C47_STORAGE_ORIGIN_DIAGNOSTIC_05\",\"sourceHead\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"pid\":321,\"bundle\":\"com.layerwell.app.staging\",\"eventLimit\":512,\"events\":[{\"sequence\":1,\"site\":\"content-key\",\"operation\":\"getStoredPrivateKVContentKey\",\"phase\":\"begin\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\"},{\"sequence\":2,\"site\":\"content-key\",\"operation\":\"getStoredPrivateKVContentKey\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"SecureStore.getItemAsync\",\"disposition\":\"caught\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"UNCLASSIFIED\",\"recognizedCode\":\"ERR_KEY_CHAIN\",\"recognizedCount\":null,\"recognizedCodeField\":\"code\",\"numericFields\":[{\"field\":\"nativeCode\",\"value\":-25308}],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},{\"sequence\":3,\"site\":\"content-key\",\"operation\":\"getStoredPrivateKVContentKey\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{},\"sourceLine\":43,\"stage\":\"entry\",\"disposition\":\"propagate\",\"error\":{\"chain\":[{\"errorId\":2,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},{\"sequence\":4,\"site\":\"availability\",\"operation\":\"check\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":2,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}}],\"firstFailure\":{\"sequence\":2,\"site\":\"content-key\",\"operation\":\"getStoredPrivateKVContentKey\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"SecureStore.getItemAsync\",\"disposition\":\"caught\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"UNCLASSIFIED\",\"recognizedCode\":\"ERR_KEY_CHAIN\",\"recognizedCount\":null,\"recognizedCodeField\":\"code\",\"numericFields\":[{\"field\":\"nativeCode\",\"value\":-25308}],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstUIFailure\":{\"sequence\":4,\"site\":\"availability\",\"operation\":\"check\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":2,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\",\"recognizedCount\":null,\"recognizedCodeField\":\"message\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstFailureQualification\":\"FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION\",\"droppedEvents\":0,\"flushFailures\":0,\"errorIdentityLimit\":1024,\"ordinaryAdmitted\":false,\"acceptanceGranted\":false,\"release\":\"NO_GO\"},\"unknown\":{\"schema\":1,\"role\":\"STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY\",\"diagnosticMarker\":\"C47_STORAGE_ORIGIN_DIAGNOSTIC_05\",\"sourceHead\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"pid\":321,\"bundle\":\"com.layerwell.app.staging\",\"eventLimit\":512,\"events\":[{\"sequence\":1,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"begin\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\"},{\"sequence\":2,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"UNCLASSIFIED\",\"recognizedCount\":null,\"recognizedCodeField\":\"none\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},{\"sequence\":3,\"site\":\"age-store\",\"operation\":\"getAgePolicyReceiptStatus\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"UNCLASSIFIED\",\"recognizedCount\":null,\"recognizedCodeField\":\"none\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}}],\"firstFailure\":{\"sequence\":2,\"site\":\"mutation\",\"operation\":\"assertPrivateMutationReadGeneration46\",\"phase\":\"failure\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"throw\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"UNCLASSIFIED\",\"recognizedCount\":null,\"recognizedCodeField\":\"none\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstUIFailure\":{\"sequence\":3,\"site\":\"age-store\",\"operation\":\"getAgePolicyReceiptStatus\",\"phase\":\"caught\",\"attempt\":1,\"meta\":{},\"sourceLine\":84,\"stage\":\"entry\",\"disposition\":\"ui_conversion\",\"error\":{\"chain\":[{\"errorId\":1,\"kind\":\"object\",\"errorClass\":\"Error\",\"recognizedCode\":\"UNCLASSIFIED\",\"recognizedCount\":null,\"recognizedCodeField\":\"none\",\"numericFields\":[],\"numericQualification\":\"SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\",\"arbitraryMessageStackAndObjectOmitted\":true}],\"causeEnding\":\"not_supplied\"}},\"firstFailureQualification\":\"FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION\",\"droppedEvents\":0,\"flushFailures\":0,\"errorIdentityLimit\":1024,\"ordinaryAdmitted\":false,\"acceptanceGranted\":false,\"release\":\"NO_GO\"}}")

"""Pure local controls over actual VM-produced observer fixtures; no native result."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

# Historical schema-one fixtures are checked by their exact Native38 validator.
# Current ENTRY, transformation, context ownership and restoration always use s.
import hashlib
import types
HISTORICAL_TRACE05_HEAD = '5e6acffc9d8d06b163bc3f3d20b6895a6ad03707'
_historical_trace05_bytes = subprocess.check_output([
    'git', 'show', HISTORICAL_TRACE05_HEAD + ':scripts/release/full-app-j01/storage_trace47.py'], cwd=ROOT)
if len(_historical_trace05_bytes) != 69571 or hashlib.sha256(_historical_trace05_bytes).hexdigest() != '52f6ff9b6636b5fc75c1201268df00423eecb03d331fc2624a7f0db529c119c2':
    raise ValueError('C47_STORAGE_ORIGIN05_HISTORICAL_V1_VALIDATOR_IDENTITY')
historical_validator05 = types.ModuleType('historical_native38_trace_schema_one')
exec(compile(_historical_trace05_bytes, '<immutable5e6-storage_trace47.py>', 'exec'), historical_validator05.__dict__)
validator = historical_validator05
HEAD = 'a' * 40
BUNDLE = 'com.layerwell.app.staging'


def fixture(name):
    return copy.deepcopy(VALIDATOR_FIXTURES05[name])


def validate(value):
    return validator.validate_trace05((json.dumps(value) + '\n').encode(), HEAD, BUNDLE, 321)


def change_event(value, sequence, update):
    for row in value['events'] + [value['firstFailure'], value['firstUIFailure']]:
        if row is not None and row['sequence'] == sequence:
            update(row)


class TraceControls(unittest.TestCase):
    def test_actual_vm_c46_predicate_and_ui_link_qualify_without_an_invented_predicate_enum(self):
        value = validate(fixture('c46'))
        proof = validator.qualifying_origin05(value)
        self.assertEqual(proof['kind'], 'C46_RETIRED_READ_PREDICATE')
        self.assertEqual(proof['origin']['meta']['revisionEqual'], False)
        self.assertEqual(proof['origin']['error']['chain'][0]['errorId'], proof['ui']['error']['chain'][0]['errorId'])

    def test_actual_vm_native_caught_then_distinct_wrapper_id_then_ui_same_attempt_qualifies(self):
        proof = validator.qualifying_origin05(validate(fixture('native-wrap')))
        self.assertEqual(proof['kind'], 'CONTENT_KEY_NATIVE_REJECTION_BEFORE_STORAGE_UNAVAILABLE_WRAP')
        self.assertNotEqual(proof['origin']['error']['chain'][0]['errorId'], proof['wrapper']['error']['chain'][0]['errorId'])
        self.assertEqual(proof['origin']['attempt'], proof['wrapper']['attempt'])
        self.assertEqual(proof['wrapper']['error']['chain'][0]['errorId'], proof['ui']['error']['chain'][0]['errorId'])

    def test_known_code_alone_unknown_code_false_predicate_probe_and_wrong_ui_never_qualify(self):
        for name in ('known-only', 'unknown'):
            self.assertIsNone(validator.qualifying_origin05(validate(fixture(name))))
        for update in [lambda row: row['meta'].update(revisionEqual=True),
                       lambda row: row.update(disposition='probe')]:
            value = fixture('c46'); change_event(value, 2, update)
            self.assertIsNone(validator.qualifying_origin05(validate(value)))
        value = fixture('c46'); change_event(value, 3, lambda row: row.update(site='lifecycle', operation='readLocal'))
        self.assertIsNone(validator.qualifying_origin05(validate(value)))

    def test_native_join_refuses_different_attempt_passed_function_and_non_native_stage(self):
        value = fixture('native-wrap'); change_event(value, 2, lambda row: row.update(phase='failure'))
        self.assertIsNone(validator.qualifying_origin05(validate(value)))
        value = fixture('native-wrap'); change_event(value, 3, lambda row: row.update(attempt=9))
        self.assertIsNone(validator.qualifying_origin05(validate(value)))
        value = fixture('native-wrap'); change_event(value, 2, lambda row: row.update(stage='entry'))
        self.assertIsNone(validator.qualifying_origin05(validate(value)))
        value = fixture('native-wrap')
        for row in value['events'] + [value['firstUIFailure']]:
            if row['sequence'] >= 3: row['sequence'] += 1
        value['events'].insert(2, {'sequence': 3, 'site': 'content-key', 'operation': 'getStoredPrivateKVContentKey', 'phase': 'pass', 'attempt': 1, 'meta': {}})
        self.assertIsNone(validator.qualifying_origin05(validate(value)))

    def test_schema_identity_privacy_admission_duplicate_json_and_bounds_refuse(self):
        baseline = fixture('c46')
        changes = [lambda v: v.update(ownerId='SECRET'), lambda v: v.update(sourceHead='b' * 40),
                   lambda v: v.update(bundle='foreign.bundle'), lambda v: v.update(pid=999),
                   lambda v: v.update(diagnosticMarker='wrong'), lambda v: v.update(ordinaryAdmitted=True),
                   lambda v: v['events'][1]['meta'].update(rawKey='SECRET'),
                   lambda v: v['events'][1]['error']['chain'][0].update(message='SECRET'),
                   lambda v: v['events'][1]['error']['chain'][0].update(recognizedCode='SECRET'),
                   lambda v: v['events'][1]['error']['chain'][0].update(numericFields=[{'field': 'ownerId', 'value': 1}]),
                   lambda v: v.update(eventLimit=1024), lambda v: v['events'].extend([v['events'][0]] * 513)]
        for update in changes:
            value = copy.deepcopy(baseline); update(value)
            with self.assertRaises(ValueError): validate(value)
        raw = json.dumps(baseline).encode()
        with self.assertRaises(ValueError): validator.validate_trace05(b'{"schema":1,' + raw[1:], HEAD, BUNDLE, 321)
        with self.assertRaises(ValueError): validator.validate_trace05(b'x' * (2 * 1024 * 1024 + 1), HEAD, BUNDLE, 321)
        with self.assertRaises(ValueError): validator.validate_trace05(b'\xff', HEAD, BUNDLE, 321)

    def test_first_immutable_records_order_error_id_and_numeric_type_contradictions_refuse(self):
        changes = [lambda v: v.update(firstFailure=None), lambda v: v.update(firstUIFailure=None),
                   lambda v: v['firstFailure'].update(sourceLine=999),
                   lambda v: v['events'][1].update(sequence=1),
                   lambda v: v['firstUIFailure']['error']['chain'][0].update(recognizedCode='PRIVATE_KV_DECRYPTION_FAILED'),
                   lambda v: v['events'][1]['error']['chain'][0].update(numericFields=[{'field': 'osStatus', 'value': True}]),
                   lambda v: v['events'][1]['error']['chain'].extend([v['events'][1]['error']['chain'][0]] * 3)]
        for update in changes:
            value = fixture('c46'); update(value)
            with self.assertRaises(ValueError): validate(value)





class AccountBoundaryOrigin05Tests(unittest.TestCase):
    def case(self,site,operation,code,blocked,stage=None):
        stage=stage or ('entry' if site=='private-kv' else 'account_fence')
        value=fixture('c46')
        for row in value['events']+[value['firstFailure'],value['firstUIFailure']]:
            if row is None:continue
            if 'error' in row:
                for node in row['error']['chain']:
                    node['recognizedCode']=code;node['recognizedCodeField']='message'
            if row['sequence']==2:
                row.update(site=site,operation=operation,stage=stage,meta={'boundaryBlocked':blocked})
        return validator.qualifying_origin05(validate(value))

    def test_early_account_reject_and_local_private_boundary_need_actual_blocked_predicate(self):
        for site,op,code in [('account-generation','runAccountGenerationOperation','ACCOUNT_GENERATION_CHANGED'),
                             ('private-kv','runAccountScopedPrivateOperation','PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY')]:
            with self.subTest(op=op):
                self.assertIsNotNone(self.case(site,op,code,True))
                self.assertIsNone(self.case(site,op,code,False))
                self.assertIsNone(self.case(site,op,code,True,stage='operation'))



# Version-two controls execute against current s, independently of the historical alias.
import os
V2_FIXTURE_PROGRAM05 = (
    CLASSIFIER_TEST.split("test('entry installs synchronous hook", 1)[0].replace(
        "const test = require('node:test');",
        'const fixtureControls = []; const test = (_name, body) => fixtureControls.push(body);', 1)
    + '\n' + CLASSIFIER_TEST[CLASSIFIER_TEST.index('// Appended to the 14 byte-preserved historical control bodies;'):]
    + "\n(async () => {\n  for (const body of fixtureControls) await body();\n  console.log('5 current VM fixture controls executed');\n})().catch(error => { console.error(error); process.exitCode = 1; });\n"
)
V2_FIXTURE_NAMES05 = ('cap-account', 'ring-eviction', 'cap-unknown', 'native-wrap-adjacent', 'native-wrap-gap', 'native-wrap-pass', 'no-failure')

def v2_fixture(name):
    return FailureWindowVersion2Tests.current_vm_fixtures05[name]

def v2_encode(value):
    return json.dumps(value, separators=(',', ':')).encode()

def v2_validated(name):
    return s.validate_trace05(v2_fixture(name), HEAD, BUNDLE, 321)

class FailureWindowVersion2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with tempfile.TemporaryDirectory(prefix='c47-origin05-current-v2-') as temporary:
            p = Path(temporary).resolve()
            (p/'storage_origin05.entry.js').write_text(s.ENTRY_TEMPLATE, encoding='utf8')
            (p/'fixtures.cjs').write_text(V2_FIXTURE_PROGRAM05, encoding='utf8')
            environment = dict(os.environ, C47_FIXTURE_OUTPUT05=str(p/'fixtures'))
            result = subprocess.run(['node', str(p/'fixtures.cjs')], cwd=ROOT,
                env=environment, capture_output=True, timeout=30)
            if result.returncode != 0:
                raise AssertionError(result.stdout.decode(errors='replace') + result.stderr.decode(errors='replace'))
            if b'5 current VM fixture controls executed' not in result.stdout:
                raise AssertionError('current VM fixture controls did not finish')
            cls.current_vm_fixtures05 = {name: (p/'fixtures'/(name+'.json')).read_bytes() for name in V2_FIXTURE_NAMES05}

    def test_historical_schema_one_fixtures_stay_on_frozen_validator_and_are_not_upgraded(self):
        for name in ('c46', 'known-only', 'native-wrap', 'unknown'):
            value = fixture(name)
            self.assertNotIn('traceFormatVersion', value)
            historical = validate(value)
            self.assertEqual(historical, value)
            with self.assertRaisesRegex(ValueError, 'CLOSED_SCHEMA'):
                s.validate_trace05(v2_encode(value), HEAD, BUNDLE, 321)
        self.assertEqual(validator.ENTRY_SOURCE_SHA25605, '4bf7ec9fa0bf5daa3a7328bc47f3456d65cbe5ff30fbe66826b2512566f370a5')
        self.assertNotEqual(s.ENTRY_SOURCE_SHA25605, validator.ENTRY_SOURCE_SHA25605)

    def test_vm_post_cap_exact_predicate_same_id_qualifies_only_observed_boundary(self):
        result = v2_validated('cap-account')
        proof = s.qualifying_origin05(result)
        self.assertEqual(proof['kind'], 'PRIVATE_KV_ACCOUNT_FENCE_PREDICATE')
        self.assertEqual(proof['origin']['sequence'], 785)
        self.assertEqual(proof['ui']['sequence'], 786)
        self.assertEqual(proof['origin']['error']['chain'][0]['errorId'], 3)
        self.assertIn('NO_ORDINARY_OR_ROOT_CAUSE_ACCEPTANCE', proof['qualification'])
        with self.assertRaisesRegex(ValueError, 'CLOSED_SCHEMA'):
            validator.validate_trace05(v2_fixture('cap-account'), HEAD, BUNDLE, 321)
        for key in ('boundaryBlocked',):
            changed = copy.deepcopy(result)
            changed['failureWindow'][2]['meta'][key] = False
            self.assertIsNone(s.qualifying_origin05(s.validate_trace05(v2_encode(changed), HEAD, BUNDLE, 321)))

    def test_vm_unknown_ring_eviction_and_empty_channel_remain_unqualified(self):
        for name in ('cap-unknown', 'ring-eviction', 'no-failure'):
            self.assertIsNone(s.qualifying_origin05(v2_validated(name)))

    def test_native_wrap_requires_observed_contiguous_interval_without_pass(self):
        self.assertEqual(s.qualifying_origin05(v2_validated('native-wrap-adjacent'))['kind'], 'CONTENT_KEY_NATIVE_REJECTION_BEFORE_STORAGE_UNAVAILABLE_WRAP')
        for name in ('native-wrap-gap', 'native-wrap-pass'):
            self.assertIsNone(s.qualifying_origin05(v2_validated(name)))

    def test_finite_schema_counter_phase_sequence_snapshot_and_identity_tampering_refuse(self):
        original = v2_validated('cap-account')
        changes = [
            lambda x: x.update(traceFormatVersion=True),
            lambda x: x.update(traceFormatVersion=1),
            lambda x: x.update(failureWindowLimit=65),
            lambda x: x.update(failureWindowFrozenAtFirstUI=False),
            lambda x: x.update(failureWindowEvicted=1),
            lambda x: x.update(droppedEvents=0),
            lambda x: x.update(failureWindow=x['failureWindow'] * 20),
            lambda x: x['failureWindow'].reverse(),
            lambda x: x['failureWindow'][0].update(phase='pass'),
            lambda x: x['failureWindow'][0].update(sourceLine=99),
            lambda x: x['failureWindow'][2]['error']['chain'][0].update(recognizedCode='UNCLASSIFIED', recognizedCodeField='none'),
            lambda x: x['failureWindow'][2]['meta'].update(ownerId='secret'),
            lambda x: x['failureWindow'][2]['meta'].update(keyCategory='secret'),
            lambda x: x['failureWindow'][2].update(disposition='ui_conversion'),
            lambda x: x.update(firstUIFailure=copy.deepcopy(x['failureWindow'][2])),
            lambda x: x.update(sourceHead='b' * 40),
        ]
        for change in changes:
            changed = copy.deepcopy(original); change(changed)
            with self.assertRaises(ValueError):
                s.validate_trace05(v2_encode(changed), HEAD, BUNDLE, 321)
        with self.assertRaisesRegex(ValueError, 'DUPLICATE_JSON_KEY'):
            s.validate_trace05(v2_fixture('cap-account').replace(b'"schema":1', b'"schema":1,"schema":1'), HEAD, BUNDLE, 321)
        with self.assertRaisesRegex(ValueError, 'RAW_BOUND'):
            s.validate_trace05(b' ' * (2 * 1024 * 1024 + 1), HEAD, BUNDLE, 321)

    def test_same_code_other_error_or_wrong_stage_cannot_qualify(self):
        original = v2_validated('cap-account')
        for change in (
            lambda x: x['failureWindow'][2].update(stage='getPrivateItem'),
            lambda x: x['failureWindow'][2]['error']['chain'][0].update(errorId=4),
        ):
            changed = copy.deepcopy(original); change(changed)
            result = s.validate_trace05(v2_encode(changed), HEAD, BUNDLE, 321)
            self.assertIsNone(s.qualifying_origin05(result))

def historical_diagnostic_source05(relative):
    if relative not in s.SOURCE_PREIMAGES:
        raise ValueError('C47_STORAGE05_HISTORICAL_FIXTURE_PATH')
    result=subprocess.run(['git','--no-replace-objects','show',
        '5e6acffc9d8d06b163bc3f3d20b6895a6ad03707:'+relative],
        cwd=ROOT,capture_output=True,timeout=30)
    if result.returncode != 0 or s.digest(result.stdout) != s.SOURCE_PREIMAGES[relative]:
        raise ValueError('C47_STORAGE05_HISTORICAL_FIXTURE_BYTES')
    return result.stdout


class SourceScope59Tests(unittest.TestCase):
    def test_exact_photo07_successor_keeps_the_original44_and_admits_only_current59(self):
        import ast, hashlib, inspect
        helper = ROOT/'scripts/release/full-app-j01/source_completion47.py'
        self.assertEqual(hashlib.sha256(helper.read_bytes()).hexdigest(),
            '93658c0e190387f474427e11b821248596350a61108087a8a9bb489ccf48f932')
        spec = importlib.util.spec_from_file_location('c47_scope59_immutable44', helper)
        original = importlib.util.module_from_spec(spec); spec.loader.exec_module(original)
        self.assertEqual(len(original.PATHS), 44)
        source = inspect.getsource(s.source_scope05)
        assignment = next(node for node in ast.walk(ast.parse(source)) if isinstance(node, ast.Assign)
            and any(isinstance(target, ast.Name) and target.id == 'additions' for target in node.targets))
        additions = ast.literal_eval(assignment.value)
        expected = {
            'scripts/release/full-app-j01/storage_trace47.py',
            'scripts/release/full-app-j01/storage_trace47.test.py',
            'scripts/release/full-app-j01/storage_origin47.mjs',
            'apps/mobile/src/lib/storage/privateKV.ts',
            'apps/mobile/src/features/onboarding/ageGateStore.ts',
            'apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx',
            'apps/mobile/src/features/onboarding/ageGateStore.test.ts',
            'apps/mobile/src/lib/storage/privateDataAvailabilityGate.test.ts',
            'apps/mobile/src/lib/storage/privateKVReadPreparation05.test.ts',
            'apps/mobile/src/features/retainedRecovery/localRecovery.campaign05.test.ts',
            'apps/mobile/src/features/healthConsent/selectiveCleanup.ts',
            'apps/mobile/src/lib/storage/privateKVBoundaryRead39.test.ts',
            'apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts',
            'scripts/photo07/photo07-source-contract.mjs',
            'scripts/photo07/photo07-source-contract.test.mjs',
            'apps/mobile/src/features/onboarding/OnboardingContext.storage49.test.ts',
            'apps/mobile/src/features/onboarding/OnboardingContext.test.ts',
            'apps/mobile/src/features/onboarding/OnboardingContext.tsx',
            'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts',
            'apps/mobile/src/features/onboarding/productsFooter16.test.ts',
            'apps/mobile/src/features/onboarding/quizNavigation.test.ts',
            'apps/mobile/src/features/onboarding/quizNavigation16.test.ts',
            'apps/mobile/src/features/onboarding/onboardingOwner18.test.ts',
            'apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts',
            'apps/mobile/src/features/onboarding/onboardingRoute18.test.ts',
            'apps/mobile/src/lib/auth/localAccountIsolation.ts'}
        preflight09={'scripts/phase9/ios-privacy-lock-succession46.mjs',
            'scripts/release/full-app-j01/native_preflight09.test.mjs'}
        replay10={'scripts/release/full-app-j01/pinned_app70_replay10.py'}
        self.assertEqual(additions-preflight09-replay10, expected)
        self.assertEqual(additions, expected|preflight09|replay10)
        self.assertFalse(original.PATHS & additions)
        self.assertEqual(len(frozenset(original.PATHS)|expected),70)
        current = frozenset(original.PATHS) | additions
        self.assertEqual(len(current), 73)
        historical=subprocess.run(['git','--no-replace-objects','show',s.PRIVACY09_START+':scripts/release/full-app-j01/storage_trace47.py'],cwd=ROOT,capture_output=True,timeout=30)
        self.assertEqual(historical.returncode,0)
        self.assertIn(b"result['finite_declared_paths']!=70",historical.stdout)
        self.assertIn(b"'finite_paths':70",historical.stdout)
        self.assertIn(b'C47_STORAGE05_EXACT87_PREFIX_FINITE70',historical.stdout)
        self.assertIn("result['finite_declared_paths']!=73", source)
        self.assertIn("'finite_paths':73", source)
        self.assertIn('C47_STORAGE05_EXACT87_PREFIX_FINITE73', source)
        self.assertIn('C47_REPLAY10_EXACT153_PREFIX', source)
        prior=subprocess.check_output(['git','--no-replace-objects','show','f4fb6fb488d119d536fe189bf872512b27bfc719:scripts/release/full-app-j01/storage_trace47.py'],cwd=ROOT)
        self.assertIn(b"'finite_paths':72",prior)
        self.assertIn('C47_PREFLIGHT09_EXACT145_PREFIX', source)
        self.assertIn('C47_STORAGE05_PRESERVED_705A_CHECKPOINT', source)
        self.assertIn('C47_STORAGE05_EXACT101_ORDINARY49_PREFIX', source)
        self.assertIn('C47_STORAGE05_PRESERVED_DD21_CHECKPOINT', source)
        self.assertIn('C47_STORAGE05_EXACT103_ORDINARY_SOURCE50_PREFIX', source)
        original.PATHS = current
        original.check_scope(additions, current)
        for path in ['scripts/photo07/**', 'scripts/photo07/unrelated.mjs', 'scripts/photo07/photo07-source-contract.extra.mjs',
                     'apps/mobile/src/features/onboarding/**',
                     'apps/mobile/src/features/onboarding/OnboardingContext.storage49.extra.test.ts',
                     'apps/mobile/src/lib/auth/**', 'apps/mobile/src/lib/auth/localAccountIsolation.extra49.ts',
                     'apps/mobile/src/features/onboarding/onboardingOwner18.extra.test.ts',
                     'apps/mobile/src/features/healthConsent/healthLifecycleRoutes.extra.test.ts']:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'UNDECLARED_CHANGED_PATH'):
                original.check_scope({path}, current | {path})


TARGET53_NODE_TESTS = '\nfunction record53(h, patch) { return h.hook(event(patch)); }\nfunction grant53(h, attempt=20) {\n  for(const phase of [\'begin\',\'pass\']) record53(h,{site:\'consent-store\',operation:\'setHealthDataCollectionConsentLocal\',phase,attempt,stage:\'entry\',disposition:\'probe\',meta:{outerOperation:true,grantRequested:true}});\n  record53(h,{site:\'lifecycle\',operation:\'completeHealthDataActivationRoute\',phase:\'pass\',attempt:attempt+1,stage:\'activation_complete\',disposition:\'probe\',meta:{outerOperation:true,activeState:true,activationPending:false}});\n}\nfunction begin53(h, attempt=30) { record53(h,{site:\'onboarding\',operation:\'revalidate\',phase:\'begin\',attempt,stage:\'entry\',disposition:\'probe\',meta:{outerOperation:true,mounted:true}}); }\nfunction deny53(h, error, attempt=31) { record53(h,{site:\'onboarding\',operation:\'revalidate\',phase:\'caught\',attempt,stage:\'hasCurrentHealthDataCollectionConsentForLease\',disposition:\'ui_conversion\',error,meta:{outerOperation:false,mounted:true,tokenCurrent:true,draftCurrent:true,atCurrentDenial:true}}); }\nfunction status53(h, stage=\'route_status\', denied=true) { record53(h,{site:\'onboarding\',operation:\'privacyStatus\',phase:\'state\',attempt:0,stage,disposition:\'probe\',meta:{privacyDenied:denied,privacyReady:!denied,privacyChecking:false,tokenCurrent:false,providerReadyState:true}}); }\nfunction save53(name,out) { fs.writeFileSync(path.join(__dirname,name+\'.json\'),JSON.stringify(out)); }\n\ntest(\'53 latest post-grant original error replaces early denial without changing legacy first UI\',async()=>{\n const h=harness(),early=new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\');deny53(h,early,1);\n for(let n=0;n<700;n++)record53(h,{phase:\'pass\'});\n grant53(h);begin53(h);const actual={code:\'ERR_KEY_CHAIN\',osStatus:-25308,message:\'PRIVATE_OWNER_SECRET53\'};\n record53(h,{site:\'content-key\',operation:\'getStoredPrivateKVContentKey\',phase:\'caught\',attempt:31,stage:\'SecureStore.getItemAsync\',disposition:\'caught\',error:actual});deny53(h,actual);status53(h);\n await h.drain();const out=h.latest();assert.equal(out.firstUIFailure.error.chain[0].recognizedCode,\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\');assert.equal(out.failureWindowFrozenAtFirstUI,true);\n assert.equal(out.onboarding53.latestDenial.error.chain[0].recognizedCode,\'ERR_KEY_CHAIN\');assert.deepEqual(out.onboarding53.denialWindow.at(-1),out.onboarding53.latestDenial);\n assert.notEqual(out.onboarding53.latestDenial.error.chain[0].errorId,out.firstUIFailure.error.chain[0].errorId);assert.ok(!JSON.stringify(out).includes(\'PRIVATE_OWNER_SECRET53\'));save53(\'postgrant-error\',out);\n});\ntest(\'53 actual false branch is a state record and does not manufacture a diagnostic Error\',async()=>{\n const h=harness();grant53(h);begin53(h);\n record53(h,{site:\'consent-store\',operation:\'hasCurrentHealthDataCollectionConsentForLease\',phase:\'state\',attempt:40,stage:\'consent_predicate\',disposition:\'probe\',meta:{parentAttempt:31,consentCurrent:false,consentPresent:true,rawPresent:true,grantCurrent:true,versionCurrent:true,disclosureCurrent:false}});\n record53(h,{site:\'onboarding\',operation:\'revalidate\',phase:\'state\',attempt:31,stage:\'consent_false\',disposition:\'probe\',meta:{parentAttempt:30,mounted:true,tokenCurrent:true,draftCurrent:true,consentCurrent:false}});\n const original=new Error(\'CURRENT_HEALTH_CONSENT_REQUIRED\');deny53(h,original);status53(h);await h.drain();const out=h.latest();\n const falseRow=out.onboarding53.denialWindow.find(r=>r.site===\'onboarding\'&&r.phase===\'state\');assert.equal(Object.hasOwn(falseRow,\'error\'),false);assert.equal(out.onboarding53.latestDenial.error.chain[0].recognizedCode,\'CURRENT_HEALTH_CONSENT_REQUIRED\');assert.equal(out.onboarding53.latestConsentResult.meta.disclosureCurrent,false);save53(\'false-return\',out);\n const noError=harness();grant53(noError);begin53(noError);\n record53(noError,{site:\'consent-store\',operation:\'hasCurrentHealthDataCollectionConsentForLease\',phase:\'state\',attempt:40,stage:\'consent_predicate\',disposition:\'probe\',meta:{parentAttempt:31,consentCurrent:false,consentPresent:false,rawPresent:false,grantCurrent:false,versionCurrent:false,disclosureCurrent:false}});\n record53(noError,{site:\'onboarding\',operation:\'revalidate\',phase:\'state\',attempt:31,stage:\'consent_false\',disposition:\'probe\',meta:{parentAttempt:30,mounted:true,tokenCurrent:true,draftCurrent:true,consentCurrent:false}});\n status53(noError);await noError.drain();assert.equal(noError.latest().onboarding53.latestDenial,null);save53(\'false-no-error\',noError.latest());\n const pending=harness();grant53(pending);begin53(pending,30);begin53(pending,99);\n record53(pending,{site:\'consent-store\',operation:\'hasCurrentHealthDataCollectionConsentForLease\',phase:\'state\',attempt:40,stage:\'consent_predicate\',disposition:\'probe\',meta:{parentAttempt:31,consentCurrent:false,consentPresent:true,rawPresent:true,grantCurrent:false,versionCurrent:true,disclosureCurrent:true}});\n record53(pending,{site:\'onboarding\',operation:\'revalidate\',phase:\'state\',attempt:31,stage:\'consent_false\',disposition:\'probe\',meta:{parentAttempt:30,mounted:true,tokenCurrent:true,draftCurrent:true,consentCurrent:false}});\n deny53(pending,new Error(\'CURRENT_HEALTH_CONSENT_REQUIRED\'));status53(pending);await pending.drain();save53(\'false-after-pending-noop\',pending.latest());\n begin53(pending,90);deny53(pending,new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\'),91);status53(pending);await pending.drain();save53(\'false-before-different-denial\',pending.latest());\n});\ntest(\'53 stale pre-grant denial and post-grant getter remain chronology, not a fabricated new rejection\',async()=>{\n const h=harness();begin53(h,1);deny53(h,new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\'),2);grant53(h,20);status53(h);await h.drain();const out=h.latest();\n assert.ok(out.onboarding53.latestDenial.sequence<out.onboarding53.latestGrantPass.sequence);assert.ok(out.onboarding53.latestRouteStatus.sequence>out.onboarding53.latestActivationPass.sequence);save53(\'stale-denial\',out);\n const pre=harness();begin53(pre,1);deny53(pre,new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\'),2);status53(pre);await pre.drain();save53(\'pregrant-only\',pre.latest());\n});\ntest(\'53 a later failed grant begin does not erase prior genuine pass or make trace invalid\',async()=>{\n const h=harness();grant53(h,20);begin53(h);record53(h,{site:\'consent-store\',operation:\'setHealthDataCollectionConsentLocal\',phase:\'begin\',attempt:90,stage:\'entry\',disposition:\'probe\',meta:{outerOperation:true,grantRequested:true}});\n deny53(h,new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\'));status53(h);await h.drain();const out=h.latest();assert.ok(out.onboarding53.latestGrantBegin.sequence>out.onboarding53.latestGrantPass.sequence);save53(\'later-failed-grant\',out);\n});\ntest(\'53 rolling and denial windows remain64 and later actual denial replaces snapshot\',async()=>{\n const h=harness();grant53(h);begin53(h);for(let n=0;n<130;n++)record53(h,{error:new Error(\'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\')});\n deny53(h,new Error(\'CURRENT_HEALTH_CONSENT_REQUIRED\'));const first=h.hook(event({phase:\'pass\'}));\n const latest=new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\');deny53(h,latest,99);status53(h);await h.drain();const out=h.latest();assert.equal(out.onboarding53.window.length,64);assert.equal(out.onboarding53.denialWindow.length,64);assert.ok(out.onboarding53.evicted>0);assert.equal(out.onboarding53.latestDenial.attempt,99);save53(\'overflow-current\',out);\n});\ntest(\'53 target metadata getters/unknown fields cannot export secrets or invoke accessors\',async()=>{\n const h=harness();let invoked=0;const meta={ownerId:\'OWNER_SECRET53\',rawKey:\'RAW_SECRET53\'};Object.defineProperty(meta,\'consentCurrent\',{get(){invoked++;return false;}});\n record53(h,{site:\'consent-store\',operation:\'hasCurrentHealthDataCollectionConsentForLease\',phase:\'state\',stage:\'consent_predicate\',meta});await h.drain();assert.equal(invoked,0);const text=JSON.stringify(h.latest());assert.ok(!text.includes(\'OWNER_SECRET53\'));assert.ok(!text.includes(\'RAW_SECRET53\'));\n});\ntest(\'53 latest provider status may be newer than route status and stays separately bound\',async()=>{\n const h=harness();grant53(h);status53(h,\'route_status\',false);status53(h,\'provider_status\',true);await h.drain();save53(\'newer-provider\',h.latest());\n});\ntest(\'53 real async denial may precede activation return, while capture refusal stays chronology only\',async()=>{\n for(const outer of [false,true]) {\n  const h=harness();for(const phase of [\'begin\',\'pass\'])record53(h,{site:\'consent-store\',operation:\'setHealthDataCollectionConsentLocal\',phase,attempt:20,stage:\'entry\',disposition:\'probe\',meta:{outerOperation:true,grantRequested:true}});\n  begin53(h);const failure=new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\');record53(h,{site:\'health-admission\',operation:outer?\'captureHealthDataWriteLease\':\'assertHealthDataWriteLease\',phase:\'failure\',attempt:31,stage:\'health_lease\',disposition:\'throw\',error:failure,meta:{leaseCurrent:false}});\n  record53(h,{site:\'onboarding\',operation:\'revalidate\',phase:\'caught\',attempt:31,stage:\'health_lease\',disposition:\'ui_conversion\',error:failure,meta:outer?{outerOperation:true,mounted:true,atCurrentDenial:true}:{outerOperation:false,mounted:true,tokenCurrent:true,draftCurrent:true,atCurrentDenial:true}});\n  record53(h,{site:\'lifecycle\',operation:\'completeHealthDataActivationRoute\',phase:\'pass\',attempt:21,stage:\'activation_complete\',disposition:\'probe\',meta:{outerOperation:true,activeState:true,activationPending:false}});\n  status53(h);await h.drain();save53(outer?\'midactivation-capture\':\'midactivation-async\',h.latest());\n }\n});\ntest(\'53 transformed own-data grant metadata does not change original accessor readcount or result\',async()=>{\n const mod=await import(require(\'node:url\').pathToFileURL(process.env.C47_TRANSFORM53).href);const ts=require(process.env.C47_TYPESCRIPT53);\n const original=\'let written; async function setHealthDataCollectionConsentLocal(params){written=params.granted;return;}\';\n const transformed=mod.transformFile(\'apps/mobile/src/features/onboarding/healthConsentStore.ts\',original,false,mod.PLAN53);\n const js=ts.transpileModule(transformed.source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;\n for(const program of [original,js]){let reads=0;const params={};Object.defineProperty(params,\'granted\',{get(){reads++;return reads===1;}});const context=vm.createContext({__C47_STORAGE_ORIGIN05__:()=>{throw new Error(\'OBSERVER_ONLY\');}});vm.runInContext(program,context);await context.setHealthDataCollectionConsentLocal(params);assert.equal(reads,1);assert.equal(vm.runInContext(\'written\',context),true);}\n});\ntest(\'53 transformed original health error identity and lease accessor count are unchanged\',async()=>{\n const mod=await import(require(\'node:url\').pathToFileURL(process.env.C47_TRANSFORM53).href);const ts=require(process.env.C47_TYPESCRIPT53);\n const original=\'const active={ownerUserId:"current-owner"};function assertHealthDataWriteLease(lease){if(active.ownerUserId!==lease.ownerUserId)throw originalFailure;}\';\n const transformed=mod.transformFile(\'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts\',original,false,mod.PLAN53);const js=ts.transpileModule(transformed.source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;\n for(const program of [original,js]){let reads=0;const lease={};Object.defineProperty(lease,\'ownerUserId\',{get(){reads++;return \'different-owner\';}});const originalFailure=new Error(\'HEALTH_DATA_WRITE_OWNER_MISMATCH\');const context=vm.createContext({originalFailure,__C47_STORAGE_ORIGIN05__:()=>{throw new Error(\'OBSERVER_ONLY\');}});vm.runInContext(program,context);assert.throws(()=>context.assertHealthDataWriteLease(lease),error=>error===originalFailure);assert.equal(reads,1);}\n const consentOriginal=\'const consent={granted:false,version:1,consentTextHash:"same"},raw="value",HEALTH_DATA_CONSENT={version:1},CURRENT_GRANT_HASH="same"; function hasCurrentHealthDataCollectionConsentForLease(lease){return consent?.granted===true && consent?.version===HEALTH_DATA_CONSENT.version && consent?.consentTextHash===CURRENT_GRANT_HASH;}\';\n const prepared=mod.transformFile(\'apps/mobile/src/features/onboarding/healthConsentStore.ts\',consentOriginal,false,mod.PLAN53);\n const compiled=ts.transpileModule(prepared.source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;\n for(const program of [consentOriginal,compiled]){const c=vm.createContext({__C47_STORAGE_ORIGIN05__:()=>{throw new Error(\'OBSERVER_ONLY\');}});vm.runInContext(program,c);assert.equal(c.hasCurrentHealthDataCollectionConsentForLease.length,1);assert.equal(c.hasCurrentHealthDataCollectionConsentForLease({}),false);}\n});\n'

class TargetedOnboarding53Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import os
        cls.temporary=tempfile.TemporaryDirectory(prefix='c47-target53-observer-')
        cls.fixture=Path(cls.temporary.name)
        (cls.fixture/'storage_origin05.entry.js').write_text(s.ENTRY_TEMPLATE53,encoding='utf8')
        prefix=CLASSIFIER_TEST.split('\ntest(',1)[0]
        script=cls.fixture/'target53.test.cjs';script.write_text(prefix+TARGET53_NODE_TESTS,encoding='utf8')
        env=dict(os.environ);env['C47_TRANSFORM53']=str(PATH.with_name('storage_origin47.mjs'))
        env['C47_TYPESCRIPT53']=str(ROOT/'node_modules/typescript')
        cls.node_result=subprocess.run(['node','--test',str(script)],cwd=ROOT,env=env,capture_output=True,timeout=60)
        if cls.node_result.returncode:
            raise AssertionError(cls.node_result.stdout.decode(errors='replace')+cls.node_result.stderr.decode(errors='replace'))
        cls.samples={name:s.validate_onboarding_trace53((cls.fixture/(name+'.json')).read_bytes(), 'a'*40,
            'com.layerwell.app.staging',321) for name in ('postgrant-error','false-return','false-no-error','false-after-pending-noop','false-before-different-denial','pregrant-only','stale-denial','later-failed-grant','overflow-current','newer-provider','midactivation-async','midactivation-capture')}
    @classmethod
    def tearDownClass(cls):cls.temporary.cleanup()
    def test_targeted_actual_error_false_privacy_bounds_and_accessor_noninterference_controls(self):
        self.assertIn(b'# tests 10',self.node_result.stdout)
        self.assertIn(b'# pass 10',self.node_result.stdout)
        self.assertIn(b'# fail 0',self.node_result.stdout)
        result=s.qualifying_onboarding_origin53(self.samples['postgrant-error'])
        self.assertEqual(result['kind'],'ACTUAL_SAME_ERROR_PROPAGATED_TO_ONBOARDING_DENIAL')
        self.assertIs(result['causal_origin_qualified'],True)
        self.assertEqual(result['origin']['error']['chain'][0]['recognizedCode'],'ERR_KEY_CHAIN')
        self.assertEqual(result['native_holder'],'UNOBSERVED')
        self.assertFalse(result['ordinary_admitted']);self.assertFalse(result['internal_admitted'])
        result=s.qualifying_onboarding_origin53(self.samples['false-return'])
        self.assertEqual(result['kind'],'ACTUAL_ONBOARDING_FALSE_CONSENT_BEFORE_EXISTING_ERROR')
        self.assertNotIn('error',result['origin']);self.assertIs(result['causal_origin_qualified'],True)
        no_error=s.qualifying_onboarding_origin53(self.samples['false-no-error'])
        self.assertIs(no_error['causal_origin_qualified'],True);self.assertEqual(no_error['predicate'],'CONSENT_ABSENT')
        self.assertIsNone(no_error['original_caught_error']);self.assertNotIn('error',no_error['origin'])
        self.assertIsNone(s.qualifying_onboarding_origin53(self.samples['pregrant-only']))
        pending=s.qualifying_onboarding_origin53(self.samples['false-after-pending-noop'])
        self.assertIs(pending['causal_origin_qualified'],True);self.assertEqual(pending['predicate'],'CONSENT_NOT_GRANTED')
        self.assertNotEqual(pending['branch']['meta']['parentAttempt'],pending['chronology']['latestRevalidateBegin']['attempt'])
        replaced=s.qualifying_onboarding_origin53(self.samples['false-before-different-denial'])
        self.assertIs(replaced['causal_origin_qualified'],False)
        self.assertEqual(replaced['kind'],'ONBOARDING_CURRENT_DENIAL_ORIGINAL_ERROR_NO_LOWER_ORIGIN_OBSERVED')
        self.assertIs(s.qualifying_onboarding_origin53(self.samples['stale-denial'])['causal_origin_qualified'],False)
        self.assertIs(s.qualifying_onboarding_origin53(self.samples['later-failed-grant'])['causal_origin_qualified'],False)
        self.assertEqual(s.qualifying_onboarding_origin53(self.samples['stale-denial'])['kind'],
            'POST_GRANT_DENIED_RENDER_CHRONOLOGY_ONLY_ORIGINAL_ERROR_UNOBSERVED')
        self.assertIsNotNone(self.samples['later-failed-grant'])
        self.assertIsNotNone(s.qualifying_onboarding_origin53(self.samples['newer-provider']))
        self.assertEqual(s.qualifying_onboarding_origin53(self.samples['midactivation-async'])['kind'],'ACTUAL_SAME_ERROR_PROPAGATED_TO_ONBOARDING_DENIAL')
        self.assertEqual(s.qualifying_onboarding_origin53(self.samples['midactivation-capture'])['kind'],'POST_GRANT_DENIED_RENDER_CHRONOLOGY_ONLY_ORIGINAL_ERROR_UNOBSERVED')
        from types import SimpleNamespace
        from unittest import mock
        import uuid
        with tempfile.TemporaryDirectory(prefix='c47-target53-collector-') as temporary:
            home=Path(temporary).resolve().resolve(strict=True);device=str(uuid.uuid4());data=home/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'/str(uuid.uuid4())
            docs=data/'Documents';docs.mkdir(parents=True)
            (docs/'C47StorageOrigin05Identity.json').write_text(json.dumps({'schema':1,'pid':321,'sourceHead':'a'*40,'bundle':'com.layerwell.app.staging'}))
            def require(ok,name):
                if not ok:raise ValueError(name)
            def write_json(path,value):path.write_text(json.dumps(value))
            def run(name,argv,**kw):
                if name.endswith('-screenshot'):Path(argv[-1]).write_bytes(b'SYNTHETIC_SCREEN_PORT')
                return 0
            n=SimpleNamespace(require=require,stage_json=json.loads,read_native_file=lambda path:path.read_bytes(),write_json=write_json)
            r=SimpleNamespace(run=run,text=lambda *a,**kw:str(data),receipt={})
            for sample,expected in [('stale-denial',False),('postgrant-error',True),('false-no-error',True)]:
                (docs/'C47StorageOrigin05-321.json').write_text(json.dumps(self.samples[sample]))
                with mock.patch.object(Path,'home',return_value=home):
                    actual=s.collect_native_origin05(r,n,device,'com.layerwell.app.staging','a'*40,home,sample,321,targeted_onboarding53=True)
                self.assertEqual(len(actual['qualifying_origins']),int(expected))
                self.assertEqual(len(actual['targeted_observations']),1)
                self.assertIs(actual['targeted_observations'][0]['origin']['causal_origin_qualified'],expected)

    def test_target53_closed_privacy_identity_and_no_legacy_reinterpretation(self):
        import copy
        original=self.samples['postgrant-error']
        def encode(value):return json.dumps(value,separators=(',',':')).encode('utf8')
        with self.assertRaises(ValueError):s.validate_trace05(encode(original),'a'*40,'com.layerwell.app.staging',321)
        for mutate in (lambda x:x['onboarding53'].update(ownerId='SECRET53'),
            lambda x:x['onboarding53']['latestDenial']['meta'].update(rawKey='SECRET53'),
            lambda x:x['onboarding53'].update(windowLimit=65),
            lambda x:x.update(pid=322),
            lambda x:x['onboarding53']['latestDenial']['meta'].update(tokenCurrent=False)):
            changed=copy.deepcopy(original);mutate(changed)
            with self.assertRaises(ValueError):s.validate_onboarding_trace53(encode(changed),'a'*40,'com.layerwell.app.staging',321)
        changed=copy.deepcopy(original);del changed['onboarding53']
        with self.assertRaises(ValueError):s.validate_onboarding_trace53(encode(changed),'a'*40,'com.layerwell.app.staging',321)
    def test_exact_current_eight_transform_recovers_source_without_new_await_or_unregistered_stages(self):
        with tempfile.TemporaryDirectory(prefix='c47-target53-transform-') as temporary:
            p=Path(temporary).resolve();request=p/'request.json';manifest=p/'manifest.json'
            request.write_text(json.dumps({'root':str(ROOT),'output':str(p/'generated'),'manifest':str(manifest),
                'expected':s.ONBOARDING53_SOURCE_PREIMAGES,'profile':'ONBOARDING53_CURRENT105','source_head':'a'*40}),encoding='utf8')
            result=subprocess.run(['node',str(PATH.with_name('storage_origin47.mjs')),str(request)],cwd=ROOT,capture_output=True,timeout=60)
            self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
            proof=json.loads(manifest.read_bytes());self.assertEqual(len(proof['files']),8)
            self.assertEqual({row['path'] for row in proof['files']},set(s.ONBOARDING53_SOURCE_PREIMAGES))
            self.assertFalse(set(proof['all_stages'])-s.ENUMS53['STAGES'])
            for row in proof['files']:
                self.assertTrue(row['original_bytes_retained_exactly']);self.assertEqual(row['awaits_before'],row['awaits_after'])
    def test_current_targeted_context_restores_exact_eight_inputs_and_refuses_wrong_preimage(self):
        with tempfile.TemporaryDirectory(prefix='c47-target53-context-') as temporary:
            p=Path(temporary).resolve();root=p/'source';root.mkdir();originals={}
            for relative,sha in s.ONBOARDING53_SOURCE_PREIMAGES.items():
                raw=(ROOT/relative).read_bytes();self.assertEqual(s.digest(raw),sha);originals[relative]=raw
                target=root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            script=root/'scripts/release/full-app-j01/storage_origin47.mjs';script.parent.mkdir(parents=True,exist_ok=True)
            script.write_bytes(PATH.with_name('storage_origin47.mjs').read_bytes())
            ios=root/'apps/mobile/ios';delegate=ios/'LayerwellStaging/AppDelegate.swift';delegate.parent.mkdir(parents=True)
            original_delegate=b'import Expo\n    let delegate = ReactNativeDelegate()\n';delegate.write_bytes(original_delegate)
            def run(label,argv,**kwargs):
                result=subprocess.run(list(map(str,argv)),cwd=ROOT,capture_output=True,timeout=60)
                self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
            with self.assertRaisesRegex(RuntimeError,'ORIGINAL_TARGET53_BUILD_FAILURE'):
                with s.diagnostic_inputs(root,ios,p/'evidence','a'*40,run,targeted_onboarding53=True) as entry:
                    self.assertIn(b'ONBOARDING_DENIAL_ORIGIN53_ONLY',entry.read_bytes())
                    for relative,raw in originals.items():self.assertNotEqual((root/relative).read_bytes(),raw)
                    raise RuntimeError('ORIGINAL_TARGET53_BUILD_FAILURE')
            self.assertEqual(delegate.read_bytes(),original_delegate)
            for relative,raw in originals.items():self.assertEqual((root/relative).read_bytes(),raw)
            restored=json.loads((p/'evidence/RESTORED.json').read_bytes());self.assertTrue(restored['exact_restore']);self.assertEqual(restored['restored_sources'],8)
            path=root/next(iter(originals));path.write_bytes(path.read_bytes()+b'\n')
            with self.assertRaisesRegex(ValueError,'EXACT_SOURCE_PREIMAGE'):
                with s.diagnostic_inputs(root,ios,p/'refused','a'*40,run,targeted_onboarding53=True):self.fail('not reached')

class TargetedOnboarding53CoordinatorTests(unittest.TestCase):
    def runtime(self):
        import sys
        path=ROOT/'scripts/release/full-app-j01/native_runtime47.py'
        spec=importlib.util.spec_from_file_location('c47_target53_runtime_controls',path)
        value=importlib.util.module_from_spec(spec);sys.modules[spec.name]=value;spec.loader.exec_module(value)
        return value

    def source_fixture(self,directory):
        import hashlib,re
        from types import SimpleNamespace
        n=self.runtime();source={'head':'a'*40,'tree':'b'*40}
        # Synthetic source/TAP fixture port only: Windows creation-stamp races are not this control's subject.
        # Production native observation guards and the current runtime source remain untouched.
        n.read_native_file=lambda path:Path(path).read_bytes()
        n.write_json(directory/'source-before.json',source)
        n.write_json(directory/'source-after-install.json',source)
        n.write_json(directory/'toolchain.json',{'build_environment':n.ENVIRONMENT,'architecture':'x86_64',
            'node':'v22.22.2','npm':'11.20.0','xcode':'Xcode 26.4\nBuild version test',
            'simulator_build_flags':n.SIMULATOR_BUILD_FLAGS,'app_simulator_build_flags':n.APP_SIMULATOR_BUILD_FLAGS})
        n.write_json(directory/'current-generated47-source.json',{'phase':'SOURCE','sourceHead':source['head'],
            'sourceTree':source['tree'],'profiles':['development','staging'],
            'descriptorSHA256':n.sha(ROOT/'docs/phase-9/ios-generated-input-succession47.v1.json'),
            'currentNative47':{'verifiedInputCount':202,'committedCriticalInputs':172}})
        current=(ROOT/'scripts/release/full-app-j01/native_generated47.test.mjs').read_text(encoding='utf8')
        names=re.findall(r"^test\('([^'\n]+)',",current,re.M);self.assertEqual(len(names),30)
        # Explicitly synthetic TAP/events exercise the real strict parser, never native evidence.
        lines=[]
        for index,name in enumerate(names,1):
            lines += [json.dumps({'event':'C47_SOURCE_CASE_BEGIN','name':name},separators=(',',':')),
                json.dumps({'event':'C47_SOURCE_CASE_END','name':name},separators=(',',':')),'ok %d - %s'%(index,name)]
        lines+=['1..30','# tests 30','# pass 30','# fail 0','# skipped 0','# cancelled 0','# todo 0']
        commands=[];(directory/'logs').mkdir()
        for index,name in enumerate(n.SOURCE_COMMANDS04,1):
            row={'name':name,'state':'PASS','exit_code':0,'required':True,'capture_complete':True,'timed_out':False,
                'argv':['node','--test','scripts/release/full-app-j01/native_generated47.test.mjs'] if name=='generated47-controls' else ['synthetic-control',name]}
            for which in ('stdout','stderr'):
                raw=('\n'.join(lines)+'\n').encode() if name=='generated47-controls' and which=='stdout' else b''
                row[which]='logs/%03d-%s.%s'%(index,name,which);(directory/row[which]).write_bytes(raw)
                row[which+'_bytes']=len(raw);row[which+'_sha256']=hashlib.sha256(raw).hexdigest()
            commands.append(row)
        for path in directory.rglob('*'):
            if path.is_file():stabilize_owned_fixture09(path,directory)
        return n,SimpleNamespace(root=ROOT,output=directory,receipt={'source':source,'commands':commands})

    def test_target53_own_source_requires_full30_and_all60_events_before_compile(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary).resolve();n,r=self.source_fixture(directory)
            proof=s._native05_full_source_controls53(r,n)
            self.assertEqual(proof['case_events'],60)
            self.assertEqual(proof['source_after_file'],'source-after-install.json')
            import inspect
            prepare_source=inspect.getsource(n.prepare)
            self.assertLess(prepare_source.index("'generated47-controls'"),prepare_source.index("'current-generated47-source'"))
            self.assertLess(prepare_source.index("'current-generated47-source'"),prepare_source.index("'dependency-graph'"))
            self.assertLess(prepare_source.index("'dependency-graph'"),prepare_source.index("'source-after-install'"))
            self.assertTrue(proof['controls_complete_before_generation_and_compile'])
            self.assertFalse(proof['ordinary_admitted']);self.assertFalse(proof['internal_admitted'])
            self.assertNotIn('local_source05',r.receipt)
            from unittest import mock
            import os
            owned=directory/'owned-reader09';owned.write_bytes(b'synthetic fixture')
            stabilize_owned_fixture09(owned,directory)
            self.assertEqual(n.stage_file_digest(owned)['bytes'],17)
            fields=('st_dev','st_ino','st_mode','st_nlink','st_size','st_mtime_ns','st_ctime_ns')
            before=owned.lstat()
            with owned.open('rb')as stream:
                opened=os.fstat(stream.fileno())
                self.assertEqual([field for field in fields if getattr(before,field)!=getattr(opened,field)],[])
            original_open=os.open
            def mutate_during_open(path,flags):
                fd=original_open(path,flags)
                with Path(path).open('ab')as stream:stream.write(b'!')
                return fd
            with mock.patch.object(n.os,'open',side_effect=mutate_during_open):
                with self.assertRaisesRegex(ValueError,'^C47_STAGE_FILE_RACE$'):n.stage_file_digest(owned)
            row=next(x for x in r.receipt['commands'] if x['name']=='generated47-controls')
            original=(directory/row['stdout']).read_bytes()
            for replacement in (original.replace(b'# tests 30',b'# tests 29'),
                    b'\n'.join(original.splitlines()[1:])+b'\n'):
                (directory/row['stdout']).write_bytes(replacement)
                stabilize_owned_fixture09(directory/row['stdout'],directory)
                row['stdout_bytes']=len(replacement);row['stdout_sha256']=n.sha(directory/row['stdout'])
                with self.assertRaises(ValueError):s._native05_full_source_controls53(r,n)
            (directory/'source-after-install.json').unlink()
            with self.assertRaises((OSError,ValueError)):s._native05_full_source_controls53(r,n)

    def test_target53_source_refuses_incomplete_failed_or_changed_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory=Path(temporary).resolve();n,r=self.source_fixture(directory)
            row=r.receipt['commands'][0]
            for key,value in [('capture_complete',False),('state','FAIL'),('exit_code',1),('timed_out',True)]:
                original=row[key];row[key]=value
                with self.assertRaises(ValueError):s._native05_full_source_controls53(r,n)
                row[key]=original
            n.write_json(directory/'source-after-install.json',{'head':'c'*40,'tree':'b'*40})
            with self.assertRaisesRegex(ValueError,'UNPROJECTED_SOURCE_BEFORE_COMPILE'):
                s._native05_full_source_controls53(r,n)

    def test_target53_control_refusal_stops_before_prebuild_and_default_prepare_stays_false(self):
        from types import SimpleNamespace
        from unittest import mock
        calls=[]
        def prepare(r,source_controls=True):calls.append(source_controls);return 'a'*40,{},Path('source.json')
        r=SimpleNamespace(root=ROOT,output=Path('unused'),receipt={},persist=lambda:None,
            source_proof=lambda *a,**kw:None,passed=lambda *a:None,run=lambda *a,**kw:self.fail('native command before proof'))
        n=SimpleNamespace(prepare=prepare)
        with mock.patch.object(s,'_native05_full_source_controls53',side_effect=ValueError('synthetic-full30-refusal')):
            with self.assertRaisesRegex(ValueError,'synthetic-full30-refusal'):
                s.run_native_origin05(r,n,onboarding_denial53=True)
        self.assertEqual(calls,[True])
        def stop(r,source_controls=True):calls.append(source_controls);raise ValueError('synthetic-stop-before-tooling')
        n.prepare=stop
        with self.assertRaisesRegex(ValueError,'synthetic-stop-before-tooling'):s.run_native_origin05(r,n)
        self.assertEqual(calls,[True,False])

        # Only the targeted normal-return path may reuse the already completed scan.
        with tempfile.TemporaryDirectory() as temporary:
            n=self.runtime();n.read_native_file=lambda path:Path(path).read_bytes()
            directory=Path(temporary).resolve();calls=[];current={'head':'a'*40,'tree':'b'*40}
            r=SimpleNamespace(output=directory,receipt={},
                source_proof=lambda *a,**kw:calls.append((a,kw)) or current)
            self.assertEqual(s._native05_final_source53(r,n,current,None),current)
            self.assertEqual(calls[0][0],('source-after-storage05-finally','a'*40))
            result={'source':current};path=directory/'source-after-storage-origin05-exact-restoration.json'
            n.write_json(path,current)
            marker={'file':path.name,'sha256':n.sha(path),'head':current['head'],'tree':current['tree']}
            r.receipt.update(storage_origin05=result,storage53_completed_restoration_source=marker)
            self.assertEqual(s._native05_final_source53(r,n,current,result),current)
            self.assertEqual(len(calls),1)
            self.assertFalse(r.receipt['storage53_final_source_boundary']['duplicate_finally_scan_performed'])
            r.receipt['storage53_completed_restoration_source']={**marker,'sha256':'0'*64}
            with self.assertRaisesRegex(ValueError,'COMPLETED_CURRENT_RESTORATION_SOURCE'):
                s._native05_final_source53(r,n,current,result)
            r.receipt.pop('storage53_completed_restoration_source')
            s._native05_final_source53(r,n,current,result)
            self.assertEqual(len(calls),2)


    def test_target53_selects_exact_third_case_and_preserves_original_first_case_default(self):
        n=self.runtime()
        self.assertEqual(s._native05_selected_method(n,False),n.NORMAL_UI_CASES04[0])
        self.assertEqual(s._native05_selected_method(n,True),'testV04ExplicitWithdrawalReviewCancelAndFreshReconsent')
        from types import SimpleNamespace
        with self.assertRaisesRegex(ValueError,'EXACT_EXISTING_THIRD_CASE'):
            s._native05_selected_method(SimpleNamespace(NORMAL_UI_CASES04=('a','b','other'),require=n.require),True)

    def test_target53_one_shot_actual_git_context_refuses_other_count_parent_event_or_attempt(self):
        from types import SimpleNamespace
        n=self.runtime();observed=[]
        context={'head':'a'*40,'tree':'b'*40,'run_attempt':1}
        answers={'storage53-append-only-commit-count':'107','storage53-preserved105-parent':s.TARGETED53_PRIOR_HEAD}
        r=SimpleNamespace(env={'GITHUB_EVENT_NAME':'pull_request'},receipt={},
            text=lambda name,*a,**kw:answers[name],passed=lambda name,value:observed.append((name,value)))
        proof=s._native05_target53_context(r,n,context)
        self.assertEqual(proof['actual_append_only_commits'],107)
        self.assertFalse(proof['ordinary_admitted']);self.assertFalse(proof['internal_admitted'])
        for key,value in [('storage53-append-only-commit-count','109'),('storage53-preserved105-parent','c'*40)]:
            old=answers[key];answers[key]=value
            with self.assertRaises(ValueError):s._native05_target53_context(r,n,context)
            answers[key]=old
        for attempt in (2,True):
            with self.assertRaises(ValueError):s._native05_target53_context(r,n,{**context,'run_attempt':attempt})
        r.env['GITHUB_EVENT_NAME']='push'
        with self.assertRaises(ValueError):s._native05_target53_context(r,n,context)

    def test_target53_runs_case03_even_when_first_launch_already_has_another_qualified_origin(self):
        import os
        from contextlib import contextmanager
        from types import SimpleNamespace
        from unittest import mock
        n=self.runtime();selected=[];captures=[];context_flags=[]
        with tempfile.TemporaryDirectory() as temporary:
            p=Path(temporary).resolve();root=p/'source';out=p/'out';out.mkdir();ios=root/'apps/mobile/ios';ios.mkdir(parents=True)
            (ios/'LayerwellStaging.xcworkspace').mkdir();(ios/'Podfile.lock').write_text('  - NativeLabelOcr (1.0.0)\n')
            r=SimpleNamespace(root=root,output=out,env={},receipt={'source':{'head':'a'*40,'tree':'b'*40}},
                persist=lambda:None,source_proof=lambda name,*a,**kw:(n.write_json(out/(name+'.json'),r.receipt['source']),r.receipt['source'])[1],
                run=lambda *a,**kw:None,passed=lambda name,value:None)
            @contextmanager
            def inputs(*a,**kw):
                context_flags.append(kw);Path(a[2]).mkdir(exist_ok=False);yield p/'diagnostic-entry.js'
            def capture(*a,**kw):
                captures.append((a[6],kw));return {'qualifying_origins':[{'synthetic':True}]}
            def case(*a,**kw):selected.append(a[3]);return {'outcome':'ASSERTION_FAILED','synthetic':True}
            signing=SimpleNamespace(configure_app=lambda *a:None,check_effective_app=lambda *a:None)
            with mock.patch.dict(os.environ,{'RUNNER_TEMP':str(p)}), \
                    mock.patch.object(n,'prepare',return_value=('a'*40,{},p/'source.json')), \
                    mock.patch.object(s,'_native05_full_source_controls53',return_value={'synthetic':True}), \
                    mock.patch.object(s,'diagnostic_inputs',inputs), \
                    mock.patch.object(s,'_native05_product',return_value={}), \
                    mock.patch.object(s,'_native05_installed'), \
                    mock.patch.object(s,'_native05_launch',return_value=123), \
                    mock.patch.object(s,'collect_native_origin05',side_effect=capture), \
                    mock.patch.object(n,'retain_pod_inventory'),mock.patch.object(n,'retain_generated_native'), \
                    mock.patch.object(n,'simulator_signing',return_value=signing), \
                    mock.patch.object(n,'prepare_simulator',return_value='synthetic-uuid'), \
                    mock.patch.object(n,'install_simulator_app',return_value=p/'installed'), \
                    mock.patch.object(n,'normal_runner04',return_value={'project':'synthetic.xcodeproj'}), \
                    mock.patch.object(n,'normal_case_execution04',side_effect=case), \
                    mock.patch.object(n,'retain_result_bundles'), \
                    mock.patch.object(n,'normal_xctest_gate',side_effect=AssertionError('ordinary aggregate forbidden')):
                result=s.run_native_origin05(r,n,onboarding_denial53=True)
            self.assertEqual(selected,['testV04ExplicitWithdrawalReviewCancelAndFreshReconsent'])
            self.assertEqual([x[0] for x in captures],['first-launch','after-one-ui'])
            self.assertTrue(all(x[1]['targeted_onboarding53'] for x in captures))
            self.assertEqual(context_flags,[{'targeted_onboarding53':True}])
            self.assertFalse(result['ordinary_admitted']);self.assertFalse(result['internal_admitted'])
            self.assertTrue(result['targeted_onboarding53']);self.assertFalse(result['retry_attempted'])

class CurrentConsentOrigin62Tests(unittest.TestCase):
    def test_current62_context_preserves107_guard_and_rejects_other_source_event_attempt(self):
        from types import SimpleNamespace
        n=TargetedOnboarding53CoordinatorTests().runtime()
        answers={'storage62-append-only-commit-count':'130','storage62-preserved128-parent':s.TARGETED62_PRIOR_HEAD}
        stages={};r=SimpleNamespace(env={'GITHUB_EVENT_NAME':'pull_request'},receipt={'stages':stages},
            text=lambda name,*args,**kw:answers[name],passed=lambda name,value:stages.update({name:{'status':'PASS','details':value}}))
        context={'head':'a'*40,'tree':'b'*40,'run_attempt':1}
        proof=s._native05_target62_context(r,n,context)
        self.assertEqual(proof['actual_append_only_commits'],130);self.assertFalse(proof['ordinary_admitted']);self.assertFalse(proof['internal_admitted'])
        for key,value in [('storage62-append-only-commit-count','128'),('storage62-preserved128-parent','c'*40)]:
            old=answers[key];answers[key]=value
            with self.assertRaises(ValueError):s._native05_target62_context(r,n,context)
            answers[key]=old
        for attempt in (2,True):
            with self.assertRaises(ValueError):s._native05_target62_context(r,n,{**context,'run_attempt':attempt})
        r.env['GITHUB_EVENT_NAME']='push'
        with self.assertRaises(ValueError):s._native05_target62_context(r,n,context)
        r.env['GITHUB_EVENT_NAME']='pull_request'
        from unittest import mock
        with mock.patch.object(s,'_native05_full_source_controls53',return_value={'strict_unchanged_proof':True})as original:
            actual=s._native05_full_source_controls62(r,n);original.assert_called_once_with(r,n)
            self.assertTrue(actual['strict_unchanged_proof']);self.assertEqual(actual['profile'],s.TARGETED62_PROFILE)
            r.receipt['storage62_profile']={}
            with self.assertRaises(ValueError):s._native05_full_source_controls62(r,n)
            self.assertEqual(original.call_count,1)

    def test_current62_pid_uses_owned_native_identity_exact_installed_bytes_and_targeted_ps(self):
        from types import SimpleNamespace
        from unittest import mock
        import hashlib
        n=TargetedOnboarding53CoordinatorTests().runtime()
        with tempfile.TemporaryDirectory(prefix='c47-pid62-')as temporary:
            home=Path(temporary).resolve().resolve();device='11111111-1111-1111-1111-111111111111';uuid='22222222-2222-2222-2222-222222222222'
            base=home/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers'
            data=base/'Data/Application'/uuid;docs=data/'Documents';docs.mkdir(parents=True)
            app=base/'Bundle/Application'/uuid/'LayerwellStaging.app';app.mkdir(parents=True);binary=app/'LayerwellStaging';binary.write_bytes(b'owned-native-binary')
            stabilize_owned_fixture09(binary,home)
            row={'path':'LayerwellStaging','type':'file','bytes':binary.stat().st_size,'sha256':hashlib.sha256(binary.read_bytes()).hexdigest()};inventory={'files':[row]};bundle='com.layerwell.app.staging';head='a'*40
            identity={'schema':1,'pid':321,'sourceHead':head,'bundle':bundle};path=docs/'C47StorageOrigin05Identity.json';path.write_text(json.dumps(identity),encoding='utf8')
            stabilize_owned_fixture09(path,home)
            r=SimpleNamespace(env={},_storage05_first_data_container=data)
            response=SimpleNamespace(returncode=0,stdout=(str(binary)+'\n').encode(),stderr=b'')
            with mock.patch.object(s.Path,'home',return_value=home),mock.patch('subprocess.run',return_value=response)as run:
                self.assertEqual(s._native05_observed_pid62(r,n,device,bundle,head,app,inventory),321)
                run.assert_called_once_with(['/bin/ps','-p','321','-o','comm='],capture_output=True,env={},timeout=3)
                for key,value in [('bundle','foreign'),('sourceHead','b'*40),('pid',True),('schema',2)]:
                    path.write_text(json.dumps({**identity,key:value}),encoding='utf8');run.reset_mock()
                    stabilize_owned_fixture09(path,home)
                    with self.assertRaises(ValueError):s._native05_observed_pid62(r,n,device,bundle,head,app,inventory)
                    run.assert_not_called()
                path.write_text(json.dumps(identity),encoding='utf8');binary.write_bytes(b'changed');run.reset_mock()
                stabilize_owned_fixture09(path,home);stabilize_owned_fixture09(binary,home)
                with self.assertRaises(ValueError):s._native05_observed_pid62(r,n,device,bundle,head,app,inventory)
                run.assert_not_called();binary.write_bytes(b'owned-native-binary');response.stdout=b'/foreign/executable\n'
                stabilize_owned_fixture09(binary,home)
                with self.assertRaises(ValueError):s._native05_observed_pid62(r,n,device,bundle,head,app,inventory)


PRIVACY08_TEST = 'import test from \'node:test\';\nimport assert from \'node:assert/strict\';\nimport fs from \'node:fs\';\nimport path from \'node:path\';\nimport vm from \'node:vm\';\nimport {createRequire} from \'node:module\';\nimport {pathToFileURL} from \'node:url\';\nconst root=process.env.C47_PRIVACY08_ROOT;\nconst ts=createRequire(path.join(root,\'package.json\'))(\'typescript\');\nconst mod=await import(pathToFileURL(path.join(root,\'scripts/release/full-app-j01/storage_origin47.mjs\')));\nconst relative=\'apps/mobile/src/features/onboarding/OnboardingContext.tsx\';\nconst original=fs.readFileSync(path.join(root,relative),\'utf8\');\nconst extra=mod.privacySource08(relative,original);\nconst instrumented=mod.transformFile(relative,extra.source,true,mod.PLAN53).source;\nfunction observer(){const snapshots=[];const context=vm.createContext({require:()=>({documentDirectory:\'owned/\',readAsStringAsync:async()=>JSON.stringify({sourceHead:\'a\'.repeat(40),bundle:\'com.layerwell.app.staging\',pid:123}),writeAsStringAsync:async(p,s)=>snapshots.push(JSON.parse(s))})});vm.runInContext(mod.ENTRY08.replaceAll(\'__C47_SOURCE_HEAD05__\',\'a\'.repeat(40)),context);return {hook:context.__C47_PRIVACY_ORIGIN08__,snapshots,async drain(){for(let n=0;n<16;n++)await Promise.resolve();},latest(){return snapshots.at(-1);}};}\nfunction session(source,state,hook){const lease={generation:1};const calls={capture:0,operation:0,consent:0,assert:0};const imports={createContext:()=>({}),captureHealthDataWriteLease(){calls.capture++;if(state.captureError)throw state.captureError;return lease;},assertHealthDataWriteLease(){calls.assert++;if(state.assertError)throw state.assertError;},async runHealthDataWriteOperation(owner,fn){calls.operation++;if(state.operationError)throw state.operationError;return fn({assertCurrent(){if(state.currentError)throw state.currentError;}});},async hasCurrentHealthDataCollectionConsentForLease(){calls.consent++;if(state.consentError)throw state.consentError;return state.read?state.read():state.consent!==false;},activeHealthProcessingLeaseSnapshot:()=>({...lease,expiresAt:null}),subscribeActiveHealthProcessingLeaseChanges:fn=>(state.subscription=fn,()=>{}),HEALTH_DATA_WRITE_ADMISSION_CLOSED:\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\'};const context=vm.createContext({exports:{},require:()=>imports,setTimeout,clearTimeout,__C47_PRIVACY_ORIGIN08__:hook});const program=ts.transpileModule(source+\'\\nglobalThis.c08API={createOnboardingSession,createRouteAdmission};\',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInContext(program,context);const s=context.c08API.createOnboardingSession({});return {s,context,calls,lease};}\ntest(\'08 exact actual sources parse and legacy insertions recover extended original bytes\',()=>{assert.equal(extra.edits.length,26);for(const rel of [...Object.keys(mod.PLAN53),\'apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx\']){const before=fs.readFileSync(path.join(root,rel),\'utf8\');const e=mod.privacySource08(rel,before);const t=Object.hasOwn(mod.PLAN53,rel)?mod.transformFile(rel,e.source,true,mod.PLAN53):{source:e.source,proof:{original_bytes_retained_exactly:true}};assert.ok(t.source.length>=e.source.length);const sf=ts.createSourceFile(rel,t.source,ts.ScriptTarget.Latest,true,rel.endsWith(\'tsx\')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(sf.parseDiagnostics.length,0,rel);assert.equal(t.proof.original_bytes_retained_exactly,true);let recovered=e.edits.length?e.source.slice(mod.PRIVACY08_HELPER.length+1):e.source;for(const edit of [...e.edits].reverse()){assert.equal(recovered.split(edit.after).length-1,1);recovered=recovered.replace(edit.after,edit.before);}assert.equal(recovered,before);assert.equal(before.includes(\'__C47_PRIVACY_ORIGIN08__\'),false);}});\ntest(\'08 each original rejecting boundary retains site/code and unmodified closed result\',async()=>{for(const [field,site,stage]of [[\'captureError\',\'CAPTURE_REJECT\',null],[\'operationError\',\'CHECK_REJECT\',\'PREFLIGHT\'],[\'assertError\',\'CHECK_REJECT\',\'PREFLIGHT_LEASE\'],[\'currentError\',\'CHECK_REJECT\',\'OPERATION_CURRENT\'],[\'consentError\',\'CHECK_REJECT\',\'CONSENT_READ\']]){const error=new Error(field===\'consentError\'?\'HEALTH_CONSENT_INVALID\':\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\');const o=observer();o.hook(\'beginGrant\',{site:\'GRANT_BEGIN\'});const state={[field]:error};const a=session(original,{...state});const b=session(instrumented,{...state},o.hook);assert.equal(await a.s.revalidate(),null);assert.equal(await b.s.revalidate(),null);assert.deepEqual(a.calls,b.calls);await o.drain();const row=o.latest().events.find(e=>e.site===site);assert.ok(row,field);assert.equal(row.error[0].code,error.message);if(stage)assert.equal(row.stage,stage);assert.equal(row.grant,1);}});\ntest(\'08 strict authenticated false differs from exception; valid transition unchanged\',async()=>{for(const consent of [false,true]){const o=observer();const a=session(original,{consent}),b=session(instrumented,{consent},o.hook);assert.equal(await a.s.revalidate()===a.lease,consent);assert.equal(await b.s.revalidate()===b.lease,consent);assert.deepEqual(a.calls,b.calls);assert.equal(a.s.view(0).privacyStatus,b.s.view(0).privacyStatus);await o.drain();const events=o.latest().events;assert.equal(events.find(e=>e.site===\'CONSENT_RESULT\').consentCurrent,consent);assert.equal(events.some(e=>e.site===\'CONSENT_FALSE\'),!consent);assert.equal(events.some(e=>e.site===\'CHECK_READY_PUBLISHED\'),consent);}});\ntest(\'08 superseded awaited success is distinguished from newest complete current read\',async()=>{for(const source of [original,instrumented]){const pending=[];const o=observer();const x=session(source,{read:()=>new Promise(resolve=>pending.push(resolve))},o.hook);const first=x.s.revalidate();for(let i=0;i<4;i++)await Promise.resolve();const second=x.s.revalidate(true);for(let i=0;i<4;i++)await Promise.resolve();assert.equal(pending.length,2);pending[1](true);assert.equal(await second,x.lease);pending[0](true);assert.equal(await first,null);assert.equal(x.s.view(0).privacyStatus,\'ready\');if(source===instrumented){await o.drain();const stale=o.latest().events.find(e=>e.site===\'CHECK_SUPERSEDED\');assert.equal(stale.tokenCurrent,false);assert.equal(stale.mounted,true);}}});\ntest(\'08 route focus/token retirement retains original calls and rejects old window\',async()=>{for(const source of [original,instrumented]){const o=observer(),x=session(source,{},o.hook);await x.s.revalidate();const route=x.context.c08API.createRouteAdmission();const listeners={};let focused=true,focusCalls=0;const nav={isFocused(){focusCalls++;return focused;},addListener:(k,v)=>(listeners[k]=v,()=>{})};route.start(nav,x.s.revalidate);for(let i=0;i<12;i++)await Promise.resolve();const ctx=x.s.view(0);const v=route.view(ctx,nav,route.snapshot());assert.equal(v.isCurrent(),true);focused=false;listeners.blur();assert.equal(v.isCurrent(),false);const last=route.view(x.s.view(0),nav,route.snapshot());assert.equal(last.isCurrent(),false);assert.equal(focusCalls,2);if(source===instrumented){await o.drain();assert.ok(o.latest().events.some(e=>e.site===\'ROUTE_WINDOW_REJECT\'&&e.routeTokenCurrent===false));}}});\ntest(\'08 observer failure leaves valid/denied behavior and original exception identity unchanged\',async()=>{for(const state of [{},{consent:false},{operationError:new Error(\'HEALTH_DATA_WRITE_ADMISSION_CLOSED\')}]){const a=session(original,{...state}),b=session(instrumented,{...state},()=>{throw new Error(\'OBSERVER_SECRET\');});assert.equal((await a.s.revalidate())===a.lease,(await b.s.revalidate())===b.lease);assert.deepEqual(a.calls,b.calls);}const leaseError=new Error(\'HEALTH_DATA_WRITE_OWNER_MISMATCH\');const rel=\'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts\';const raw=fs.readFileSync(path.join(root,rel),\'utf8\');assert.ok(raw.includes("throw new Error(HEALTH_DATA_WRITE_OWNER_MISMATCH)"));});\ntest(\'08 original recognized native cause retained; secrets/getters/proxies never exported\',async()=>{const o=observer();let getters=0;const original=new Error(\'PERSONAL_SECRET_DOB_OWNER\');original.cause={code:\'ERR_KEY_CHAIN\',osStatus:-34018};Object.defineProperty(original,\'nativeCode\',{get(){getters++;return \'SECRET\';}});const meta={site:\'CHECK_REJECT\',error:original,ownerId:\'OWNER_SECRET\',token:\'TOKEN_SECRET\',stage:\'CONSENT_READ\'};Object.defineProperty(meta,\'mounted\',{get(){getters++;return true;}});o.hook(\'event\',meta);o.hook(\'event\',{site:\'CHECK_REJECT\',error:new Proxy({}, {getOwnPropertyDescriptor(){throw Error(\'SECRET\');}})});await o.drain();const wire=JSON.stringify(o.latest());assert.equal(getters,0);for(const text of [\'PERSONAL_SECRET\',\'OWNER_SECRET\',\'TOKEN_SECRET\'])assert.equal(wire.includes(text),false);const e=o.latest().events.find(row=>row.site===\'CHECK_REJECT\').error;assert.equal(e[0].code,\'UNCLASSIFIED\');assert.equal(e[1].code,\'ERR_KEY_CHAIN\');assert.equal(e[1].numeric.osStatus,-34018);});\ntest(\'08 bounded monotonic window and diagnostic ID/grant correlation cannot export arbitrary input\',async()=>{const o=observer();assert.equal(o.hook(\'id\',{}),1);assert.equal(o.hook(\'grant\',{}),0);o.hook(\'beginGrant\',{site:\'GRANT_BEGIN\'});for(let i=0;i<800;i++)o.hook(\'event\',{site:\'ROUTE_PRIVACY_STATUS\',privacyDenied:true,route:2,grant:1,secret:\'OMIT\'});o.hook(\'event\',{site:\'UNTRUSTED_SECRET\'});await o.drain();const s=o.latest();assert.equal(s.events.length,512);assert.ok(s.dropped>0);assert.equal(s.events.at(-1).sequence,802);assert.ok(s.denialWindow.length<=128);assert.equal(s.ordinaryAdmitted,false);assert.equal(s.pid,123);assert.equal(s.release,\'NO_GO\');assert.equal(JSON.stringify(s).includes(\'OMIT\'),false);});\n'

class Privacy08Tests(unittest.TestCase):
    def test_actual_source_parity_current_and_superseded_predicates_redaction_and_bounded_observation(self):
        with tempfile.TemporaryDirectory(prefix="c47-privacy08-tests-") as tmp:
            path=Path(tmp).resolve()/"privacy08.test.mjs";path.write_text(PRIVACY08_TEST,encoding="utf8")
            import os
            env=os.environ.copy();env["C47_PRIVACY08_ROOT"]=str(ROOT)
            result=subprocess.run(["node","--test",str(path)],cwd=ROOT,env=env,capture_output=True,timeout=60)
            self.assertEqual(result.returncode,0,result.stdout.decode(errors="replace")+result.stderr.decode(errors="replace"))
            self.assertIn(b"# pass 8",result.stdout);self.assertIn(b"# fail 0",result.stdout);self.assertIn(b"# skipped 0",result.stdout)

class Privacy08NativeBoundaryTests(unittest.TestCase):
    def test_closed_trace_identity_typed_metadata_and_superseded_errors_never_claim_current_origin(self):
        base={'schema':1,'marker':'C47_PRIVACY_ORIGIN_DIAGNOSTIC_08','sourceHead':'a'*40,'pid':321,'bundle':'com.layerwell.app.staging','eventLimit':512,'sequence':3,'dropped':0,'flushFailures':0,'events':[{'sequence':1,'site':'GRANT_BEGIN','grant':1},{'sequence':2,'site':'CHECK_REJECT','grant':1,'provider':2,'check':3,'mounted':True,'tokenCurrent':True,'error':[{'code':'HEALTH_DATA_WRITE_ADMISSION_CLOSED','numeric':{}}]},{'sequence':3,'site':'ROUTE_PRIVACY_STATUS','grant':1,'route':4,'privacyDenied':True}],'denialWindow':None,'ordinaryAdmitted':False,'release':'NO_GO'}
        raw=json.dumps(base).encode();valid=s.validate_privacy08(raw,'a'*40,321);self.assertEqual(s.privacy_origin08(valid)['origin']['site'],'CHECK_REJECT')
        import copy
        for mutate in [lambda v:v.update(ownerId='SECRET'),lambda v:v['events'][1].update(tokenCurrent=1),lambda v:v['events'][1]['error'][0].update(message='SECRET'),lambda v:v['events'][1]['error'][0].update(code='ARBITRARY_SECRET'),lambda v:v.update(pid=322)]:
            other=copy.deepcopy(base);mutate(other)
            with self.assertRaises(ValueError):s.validate_privacy08(json.dumps(other).encode(),'a'*40,321)
        for mutate in [lambda v:v['events'][1].update(tokenCurrent=False),lambda v:v['events'][1].update(grant=0),lambda v:v['events'][1]['error'][0].update(code='UNCLASSIFIED')]:
            other=copy.deepcopy(base);mutate(other);self.assertIsNone(s.privacy_origin08(s.validate_privacy08(json.dumps(other).encode(),'a'*40,321)))

    def test_exact_nine_source_context_restores_originals_and_entry_on_original_failure(self):
        import shutil,os
        with tempfile.TemporaryDirectory(prefix='c47-privacy08-context-')as tmp:
            root=Path(tmp).resolve()/'source';ios=root/'apps/mobile/ios';evidence=Path(tmp).resolve()/'evidence';ios.joinpath('LayerwellStaging').mkdir(parents=True);delegate=ios/'LayerwellStaging/AppDelegate.swift';delegate.write_bytes(b'    let delegate = ReactNativeDelegate()\n')
            names=list(s.ONBOARDING53_SOURCE_PREIMAGES)+[s.PRIVACY08_GATE]
            for name in names+['scripts/release/full-app-j01/storage_origin47.mjs']:
                q=root/name;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes((ROOT/name).read_bytes())
            (root/'apps/mobile/.expo').mkdir();before={n:(root/n).read_bytes()for n in names}
            def run(name,argv,**kw):
                r=subprocess.run(list(map(str,argv)),cwd=ROOT,capture_output=True,timeout=60);self.assertEqual(r.returncode,0,r.stderr.decode(errors='replace'))
            old=getattr(s,'_privacy08_original_inputs',None);s._privacy08_original_inputs=s.diagnostic_inputs
            try:
                with self.assertRaisesRegex(RuntimeError,'CONTROLLED_BUILD_FAILURE08'):
                    with s.diagnostic_inputs08(root,ios,evidence,'a'*40,run,targeted_onboarding53=True)as entry:
                        self.assertIn(b'C47_PRIVACY_ORIGIN_DIAGNOSTIC_08',entry.read_bytes());self.assertIn(b'c08ChildrenMayMount',(root/s.PRIVACY08_GATE).read_bytes());self.assertIn(b'PROVIDER_VIEW_REJECT',(root/names[0]).read_bytes());raise RuntimeError('CONTROLLED_BUILD_FAILURE08')
                self.assertTrue(all((root/n).read_bytes()==b for n,b in before.items()));self.assertEqual(delegate.read_bytes(),b'    let delegate = ReactNativeDelegate()\n');self.assertFalse((root/'apps/mobile/.expo/C47StorageOrigin05.js').exists())
            finally:s._privacy08_original_inputs=old

    def test_diagnostic_runner_uses_exact_case03_initial_prefix_and_restores_without_ordinary_admission(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory(prefix='c47-privacy08-runner-')as tmp:
            out=Path(tmp).resolve();runner=out/'ui/runner';runner.mkdir(parents=True);swift=(ROOT/'scripts/release/full-app-j01/native_ui47.swift').read_bytes().split(b'\nimport UIKit',1)[0];path=runner/'native_ui47.swift';path.write_bytes(swift);method='testV04ExplicitWithdrawalReviewCancelAndFreshReconsent'
            n=SimpleNamespace(NORMAL_UI_CASES04=('one','two',method),read_native_file=lambda p:p.read_bytes());oldn=getattr(s,'_privacy08_native',None);oldcase=getattr(s,'_privacy08_original_case',None);s._privacy08_native=n
            def execute(*a):
                actual=path.read_bytes();self.assertIn(b'        requireFreshGoals(app)\n',actual);self.assertNotIn(b'Both actual selected goals',actual);self.assertIn(b'no full ordinary-case admission',actual);return {'outcome':'DIAGNOSTIC_PREFIX_ONLY'}
            s._privacy08_original_case=execute
            try:
                child=SimpleNamespace(output=out,root=ROOT,receipt={'source':{'head':'a'*40}});result=s._privacy08_case(child,runner/'C47NativeUI.xcodeproj',out/'products',method,'synthetic-device',{});self.assertEqual(result['outcome'],'DIAGNOSTIC_PREFIX_ONLY');self.assertEqual(path.read_bytes(),swift);self.assertFalse(json.loads((out/'PRIVACY08_DIAGNOSTIC_RUNNER.json').read_bytes())['ordinary_admitted'])
            finally:s._privacy08_native=oldn;s._privacy08_original_case=oldcase

class Preflight09SourceTests(unittest.TestCase):
    def test_actual_source_batch_controls_and_exact_one_shot_native70_admission(self):
        import hashlib
        from types import SimpleNamespace
        result=subprocess.run(['node','--test','scripts/release/full-app-j01/native_preflight09.test.mjs'],cwd=ROOT,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
        for line in [b'# tests 2',b'# pass 2',b'# fail 0',b'# skipped 0',b'# cancelled 0']:
            self.assertIn(line,result.stdout.splitlines())
        print(json.dumps({'event':'C47_PREFLIGHT09_ACTUAL_TAP','tests':2,'pass':2,'fail':0,'skipped':0,'status':result.returncode,'stdout_bytes':len(result.stdout),'stdout_sha256':hashlib.sha256(result.stdout).hexdigest(),'stderr_bytes':len(result.stderr),'stderr_sha256':hashlib.sha256(result.stderr).hexdigest()}))
        # Synthetic coordinator port only; this never starts or qualifies a native job.
        calls=[]
        def fixture(count='149',parent=s.PRIVACY09_START,event='pull_request'):
            def text(name,argv,timeout):
                calls.append((name,argv,timeout));return count if name=='privacy09-exact-commit-count' else parent
            return SimpleNamespace(env={'GITHUB_EVENT_NAME':event},text=text)
        context={'run_attempt':1,'head':'a'*40,'tree':'b'*40}
        valid=s.privacy_stage09(fixture(),context)
        self.assertEqual(valid['native_attempt'],70);self.assertEqual(valid['authorization'],'BRAIN-C47-PREBUILD-PRIVACY-ORIGIN-RUNTIME-09')
        self.assertFalse(valid['ordinary_admitted']);self.assertFalse(valid['internal_admitted'])
        self.assertEqual(calls,[('privacy09-exact-commit-count',['git','rev-list','--count','02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],60),('privacy09-preserved145-parent',['git','rev-parse','HEAD~4'],60)])
        for refused in [fixture(count='143'),fixture(count='147'),fixture(count='148'),fixture(count='150'),fixture(parent='c'*40),fixture(event='push')]:
            with self.assertRaisesRegex(ValueError,'PRIVACY09'):s.privacy_stage09(refused,context)
        with self.assertRaisesRegex(ValueError,'PRIVACY09_ONE_SHOT'):s.privacy_stage09(fixture(),{**context,'run_attempt':2})

class Remainder71Coordinator09Tests(unittest.TestCase):
    """Synthetic coordinator ports only; no native or ordinary admission."""
    def fixture(self):
        from types import SimpleNamespace
        import time
        calls=[];timeline=[];result=object()
        def run(name,argv,*args,**kwargs):
            calls.append((name,argv,kwargs))
            if name=='negative':raise self.original_error
            return result
        r=SimpleNamespace(run=run,deadline=time.monotonic()+9000,receipt={'source':{'head':'a'*40},'commands':[{'name':n,'state':'PASS','exit_code':0,'capture_complete':True}for n in ['privacy08-source-observer-tests','privacy08-current-runtime-controls','privacy08-simulator-signing-controls']]},passed=lambda name,value:timeline.append(name))
        def simulator(actual,lane):
            self.assertIs(actual,r);self.assertEqual(lane,'normal');timeline.append('ACTUAL_BOOT_PORT');actual.run('simulator-bootstatus',['original-boot'],timeout=600);actual.receipt['simulator']={'udid':'12345678-1234-1234-1234-123456789abc'};return actual.receipt['simulator']['udid']
        return r,SimpleNamespace(prepare_simulator=simulator),calls,timeline,result

    def test_exact_one_shot151_remainder_preserves149_and_refuses_wrong_context(self):
        from types import SimpleNamespace
        calls=[]
        def fixture(count='151',parent='9c69cd2149de6d9ca24b5fe11afcd4bde96e3fe6',event='pull_request'):
            def text(name,argv,timeout):calls.append((name,argv,timeout));return count if name=='privacy09-remainder71-commit-count'else parent
            return SimpleNamespace(env={'GITHUB_EVENT_NAME':event},text=text)
        context={'run_attempt':1,'head':'a'*40,'tree':'b'*40};v=s.privacy_stage71_09(fixture(),context)
        self.assertEqual(v['native_attempt'],71);self.assertTrue(v['fresh_build_required']);self.assertFalse(v['ordinary_admitted']);self.assertFalse(v['internal_admitted'])
        self.assertEqual(calls,[('privacy09-remainder71-commit-count',['git','rev-list','--count','02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],60),('privacy09-remainder71-preserved149',['git','rev-parse','HEAD~2'],60)])
        for r in [fixture(count='149'),fixture(count='150'),fixture(count='152'),fixture(parent='c'*40),fixture(event='push')]:
            with self.assertRaisesRegex(ValueError,'PRIVACY09_REMAINDER71'):s.privacy_stage71_09(r,context)
        with self.assertRaisesRegex(ValueError,'ONE_SHOT'):s.privacy_stage71_09(fixture(),{**context,'run_attempt':2})

    def test_source_controls_precede_one_fresh_boot_and_recheck_keeps_exact_device_and_source(self):
        from unittest.mock import patch
        import contextlib,io
        r,n,calls,timeline,result=self.fixture();original_run=r.run;original_simulator=n.prepare_simulator;deadline=r.deadline
        with patch.object(s,'_native05_full_source_controls53',side_effect=lambda *a:timeline.append('STRICT_SOURCE_PROOF')or{'verified':True}),contextlib.redirect_stdout(io.StringIO()):
            with s.privacy71_coordinator09(r,n,True)as boot:
                with self.assertRaisesRegex(ValueError,'EXACT_CURRENT_DEVICE'):n.prepare_simulator(r,'normal')
                boot();self.assertEqual(timeline[:3],['STRICT_SOURCE_PROOF','privacy09-source-controls-before-boot71','ACTUAL_BOOT_PORT'])
                with self.assertRaisesRegex(ValueError,'ONCE'):boot()
                device=n.prepare_simulator(r,'normal');self.assertEqual(device,r.receipt['simulator']['udid']);self.assertEqual(calls[-1],('privacy09-preboot-recheck71',['xcrun','simctl','bootstatus',device,'-b'],{'timeout':600}))
                for actual,lane in [(object(),'normal'),(r,'internal')]:
                    with self.assertRaisesRegex(ValueError,'EXACT_CURRENT_DEVICE'):n.prepare_simulator(actual,lane)
                r.receipt['source']['head']='b'*40
                with self.assertRaisesRegex(ValueError,'EXACT_CURRENT_DEVICE'):n.prepare_simulator(r,'normal')
                r.receipt['source']['head']='a'*40;r.receipt['simulator']['udid']='foreign'
                with self.assertRaisesRegex(ValueError,'EXACT_CURRENT_DEVICE'):n.prepare_simulator(r,'normal')
        self.assertIs(r.run,original_run);self.assertIs(n.prepare_simulator,original_simulator);self.assertEqual(r.deadline,deadline)
        with s.privacy71_coordinator09(r,n,False)as boot:self.assertIsNone(boot);self.assertIs(r.run,original_run)

    def test_failed_or_partial_source_control_never_boots_a_simulator(self):
        from unittest.mock import patch
        import contextlib,io
        for mutate in [lambda rows:rows.clear(),lambda rows:rows[0].update(state='FAIL'),lambda rows:rows[0].update(exit_code=1),lambda rows:rows[0].update(capture_complete=False),lambda rows:rows.append(dict(rows[0]))]:
            r,n,calls,timeline,result=self.fixture();mutate(r.receipt['commands'])
            with patch.object(s,'_native05_full_source_controls53',return_value={'verified':True}),contextlib.redirect_stdout(io.StringIO()):
                with s.privacy71_coordinator09(r,n,True)as boot:
                    with self.assertRaisesRegex(ValueError,'PREBOOT71_SOURCE_CONTROLS'):boot()
            self.assertNotIn('ACTUAL_BOOT_PORT',timeline);self.assertEqual(calls,[])

    def test_build_requires_preboot_and_measured_runtime_reserve_and_never_enlarges_timeout(self):
        from unittest.mock import patch
        import contextlib,io,time
        r,n,calls,timeline,result=self.fixture();r.deadline=13487
        with patch.object(s,'_native05_full_source_controls53',return_value={'verified':True}),patch.object(time,'monotonic',return_value=10000),contextlib.redirect_stdout(io.StringIO()):
            with s.privacy71_coordinator09(r,n,True)as boot:
                with self.assertRaisesRegex(ValueError,'REQUIRES_PREBOOT'):r.run('storage-origin05-build',['actual-build'],timeout=3000)
                boot();count=len(calls)
                with self.assertRaisesRegex(ValueError,'MEASURED_RUNTIME_RESERVE'):r.run('storage-origin05-build',['actual-build'],timeout=3000)
                self.assertEqual(len(calls),count);r.deadline=13488
                self.assertIs(r.run('storage-origin05-build',['actual-build'],timeout=3000),result);self.assertEqual(calls[-1][2]['timeout'],2768)
                self.assertIs(r.run('storage-origin05-build',['actual-build'],timeout=1000),result);self.assertEqual(calls[-1][2]['timeout'],1000)
        self.assertEqual(r.deadline,13488)

    def test_static_progress_is_bounded_redacted_and_cannot_change_original_results_or_errors(self):
        from unittest.mock import patch
        import contextlib,io
        r,n,calls,timeline,result=self.fixture();self.original_error=RuntimeError('SECRET_MESSAGE');out=io.StringIO()
        with contextlib.redirect_stdout(out):
            with s.privacy71_coordinator09(r,n,True):
                for i in range(300):self.assertIs(r.run('SECRET_NAME',['SECRET_ARGUMENT']),result)
        rows=[json.loads(l)for l in out.getvalue().splitlines()];self.assertEqual(len(rows),256);self.assertEqual([v['sequence']for v in rows],list(range(1,257)));self.assertEqual(len(calls),300);self.assertNotIn('SECRET',out.getvalue());self.assertTrue(all(set(v)=={'event','sequence','stage','state'}and v['stage']=='OTHER'for v in rows))
        with patch('builtins.print',side_effect=OSError('OBSERVER_FAILURE')):
            with s.privacy71_coordinator09(r,n,True):
                self.assertIs(r.run('positive',['SECRET_ARGUMENT']),result)
                with self.assertRaises(RuntimeError)as caught:r.run('negative',['SECRET_ARGUMENT'])
                self.assertIs(caught.exception,self.original_error)

class PinnedApp70Replay10Tests(unittest.TestCase):
    def replay(self):
        spec=importlib.util.spec_from_file_location('c47_replay10_test',PATH.with_name('pinned_app70_replay10.py'))
        value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

    def fixture(self):
        from types import SimpleNamespace
        q=self.replay();head='a'*40;tree='b'*40;device='11111111-1111-1111-1111-111111111111'
        r=SimpleNamespace(receipt={'source':{'head':head,'tree':tree},'simulator':{'udid':device},'replay_execution10':{
            'repository':'TasfiqJ/onSkin','runner_head':head,'runner_tree':tree,'run_id':123,'job_id':456,'run_attempt':1,
            'native_attempt':72,'job_name':q.JOB,'runner_id':789,'configured_labels':['macos-26-intel']}})
        envelope=q.binding(r,device,321)
        native={'schema':1,'pid':321,'sourceHead':q.PRODUCER['head'],'bundle':q.BUNDLE}
        trace={'schema':1,'marker':'C47_PRIVACY_ORIGIN_DIAGNOSTIC_08','sourceHead':q.PRODUCER['head'],'pid':321,'bundle':q.BUNDLE,
            'eventLimit':512,'sequence':3,'dropped':0,'flushFailures':0,'events':[{'sequence':1,'site':'GRANT_BEGIN','grant':1},
            {'sequence':2,'site':'CHECK_REJECT','grant':1,'provider':2,'check':3,'mounted':True,'tokenCurrent':True,
                'error':[{'code':'HEALTH_DATA_WRITE_ADMISSION_CLOSED','numeric':{}}]},
            {'sequence':3,'site':'ROUTE_PRIVACY_STATUS','grant':1,'route':4,'privacyDenied':True}],
            'denialWindow':None,'ordinaryAdmitted':False,'release':'NO_GO'}
        return q,r,envelope,native,trace

    def test_three_distinct_source_execution_identities_bind_original_trace(self):
        q,r,b,native,trace=self.fixture()
        self.assertEqual(q.trace_binding(s,json.dumps(trace).encode(),native,b),trace)
        self.assertEqual(b['producer']['head'],'9c69cd2149de6d9ca24b5fe11afcd4bde96e3fe6')
        self.assertNotEqual(b['producer']['head'],b['runner_source']['head'])
        self.assertEqual(b['execution']['native_attempt'],72);self.assertEqual(b['execution']['app_pid'],321)
        self.assertEqual(r.receipt['source']['head'],'a'*40);self.assertFalse(b['ordinary_admitted']);self.assertFalse(b['internal_admitted'])

    def test_wrong_producer_app_transform_runner_job_pid_and_admission_refused(self):
        import copy
        q,r,b,native,trace=self.fixture()
        changes=[lambda x:x['producer'].update(head='c'*40),lambda x:x['app'].update(sha256='c'*64),
            lambda x:x.update(diagnostic_transform_sha256='c'*64),lambda x:x['runner_source'].update(head='c'*40),
            lambda x:x['execution'].update(job_name='other'),lambda x:x['execution'].update(job_id=True),
            lambda x:x['execution'].update(run_attempt=2),lambda x:x['execution'].update(run_attempt=True),
            lambda x:x['execution'].update(app_pid=True),lambda x:x['execution'].update(device='foreign'),
            lambda x:x.update(ordinary_admitted=True),lambda x:x.update(internal_admitted=True)]
        for change in changes:
            other=copy.deepcopy(b);change(other)
            with self.assertRaises((ValueError,TypeError)):q.trace_binding(s,json.dumps(trace).encode(),native,other)
        for key,value in [('sourceHead','a'*40),('pid',322),('schema',True),('bundle','foreign')]:
            with self.assertRaises(ValueError):q.trace_binding(s,json.dumps(trace).encode(),{**native,key:value},b)

    def test_incomplete_dropped_failed_flush_and_unredacted_trace_refused(self):
        import copy
        q,r,b,native,trace=self.fixture()
        changes=[lambda x:x.update(dropped=1),lambda x:x.update(flushFailures=1),lambda x:x.update(sequence=4),
            lambda x:x.update(ownerId='PRIVATE'),lambda x:x['events'][1]['error'][0].update(message='PRIVATE'),
            lambda x:x.update(sourceHead='a'*40),lambda x:x.update(pid=322)]
        for change in changes:
            other=copy.deepcopy(trace);change(other)
            with self.assertRaises(ValueError):q.trace_binding(s,json.dumps(other).encode(),native,b)

    def test_original_predicate_code_retained_superseded_and_unknown_not_origins(self):
        import copy
        q,r,b,native,trace=self.fixture()
        valid=q.trace_binding(s,json.dumps(trace).encode(),native,b);origin=s.privacy_origin08(valid)
        self.assertEqual(origin['origin']['site'],'CHECK_REJECT')
        self.assertEqual(origin['origin']['error'][0]['code'],'HEALTH_DATA_WRITE_ADMISSION_CLOSED')
        for key,value in [('tokenCurrent',False),('grant',0)]:
            other=copy.deepcopy(trace);other['events'][1][key]=value
            self.assertIsNone(s.privacy_origin08(q.trace_binding(s,json.dumps(other).encode(),native,b)))
        other=copy.deepcopy(trace);other['events'][1]['error'][0]['code']='UNCLASSIFIED'
        self.assertIsNone(s.privacy_origin08(q.trace_binding(s,json.dumps(other).encode(),native,b)))

    def test_frozen_real_case03_prefix_stops_only_after_first_goals(self):
        import hashlib
        q=self.replay();full=(ROOT/'scripts/release/full-app-j01/native_ui47.swift').read_bytes()
        self.assertEqual(hashlib.sha256(full).hexdigest(),'bffe625e84a8000338de6166d6df1582b6caea524ea7d69682d15a6c75859956')
        before=full.split(b'\nimport UIKit',1)[0];after=q.prefix(before)
        start=before.index(b'    func testV04ExplicitWithdrawalReviewCancelAndFreshReconsent() throws {')
        end=before.index(b'        requireFreshGoals(app)\n',start)+len(b'        requireFreshGoals(app)\n')
        self.assertEqual(after[:end],before[:end]);self.assertNotIn(b'Both actual selected goals',after[end:])
        self.assertIn(b'diagnostic prefix; never ordinary qualification',after)
        with self.assertRaises(ValueError):q.prefix(before+b'changed')
        self.assertEqual((ROOT/'scripts/release/full-app-j01/native_ui47.swift').read_bytes(),full)

    def test_only_exact_cancelled_producer_and_published_artifact_pin_allowed(self):
        import copy
        q=self.replay();p=q.PRODUCER
        run={'id':p['run_id'],'head_sha':p['head'],'run_attempt':1,'status':'completed','conclusion':'cancelled'}
        job={'id':p['job_id'],'run_id':p['run_id'],'head_sha':p['head'],'conclusion':'cancelled'}
        artifact={'id':p['artifact_id'],'name':p['artifact_name'],'workflow_run':{'id':p['run_id'],'head_sha':p['head']},
            'size_in_bytes':q.RAW['bytes'],'digest':'sha256:'+q.RAW['sha256'],'expired':False}
        q.producer_metadata(run,job,artifact)
        for index,key,value in [(0,'head_sha','a'*40),(0,'run_attempt',2),(0,'run_attempt',True),(0,'conclusion','success'),
                (1,'id',1),(2,'id',1),(2,'digest','sha256:'+'a'*64),(2,'expired',True)]:
            values=copy.deepcopy([run,job,artifact]);values[index][key]=value
            with self.assertRaises(ValueError):q.producer_metadata(*values)

    def test_original_complete_stage_reader_still_rejects_missing_seal(self):
        import zipfile,hashlib
        q=self.replay();n=TargetedOnboarding53CoordinatorTests().runtime()
        with tempfile.TemporaryDirectory(prefix='c47-replay10-negative-')as tmp:
            root=Path(tmp).resolve();raw=root/'unsealed.zip'
            with zipfile.ZipFile(raw,'w',compression=zipfile.ZIP_STORED)as z:z.writestr('execution.json',b'{}')
            stabilize_owned_fixture09(raw,root);wire={'bytes':raw.stat().st_size,'sha256':hashlib.sha256(raw.read_bytes()).hexdigest()}
            expected={'digest':wire['sha256'],'payload_bytes':2};proof={'wire_bytes':wire['bytes'],'wire_sha256':wire['sha256'],'service_digest':'sha256:'+wire['sha256']}
            with self.assertRaisesRegex(ValueError,'STAGE_EXACT_PAYLOAD_INVENTORY'):n.verify_stage_zip(raw,expected,proof,root/'import')
            self.assertFalse((root/'import').exists())
            with self.assertRaisesRegex(ValueError,'RAW_PIN'):q.raw70(n,raw,ROOT)

    def test_one_shot_workflow_and_coordinator_never_compile_or_replace_app(self):
        import inspect,hashlib
        q=self.replay();raw=subprocess.check_output(['git','--no-replace-objects','show',
            'a50628e009c69ee00bf532e1335fde6ed9d3f51e:.github/workflows/campaign47-native-runtime.yml'],cwd=ROOT)
        self.assertEqual(hashlib.sha256(raw).hexdigest(),'4201de90184b35a6080fc0c5fad5d321440af456b51f0e9f69938d70008313db')
        workflow=raw.decode() # Exact C10 historical witness; C11 current gate is independently tested below.
        for item in ['commits == 155','github.run_attempt == 1','number == 48','runs-on: macos-26-intel',
            'timeout-minutes: 90','cancel-in-progress: false','retention-days: 3','actions: read',
            'pinned_app70_replay10.py --output','500 * 1024 * 1024']:self.assertIn(item,workflow)
        self.assertNotIn('--privacy-origin09-remainder71',workflow)
        source=inspect.getsource(q.execute)
        for item in ['n.prepare(r)','d._native05_full_source_controls53(r,n)','n.normal_runner04(r)',
            'n.normal_case_execution04','product==inventory[\'product\']','simulator-signing/project.before.pbxproj',
            "r.receipt.get('simulator',{}).get('udid')"]:self.assertIn(item,source)
        for item in ['n.build(',"'npx'",'codesign -s','r.receipt[\'source\']=','normal_suite_aggregate04']:
            self.assertNotIn(item,source)

class SameProcessReplay11Tests(unittest.TestCase):
    def fixture(self):
        from types import SimpleNamespace
        q,_,_,native,trace=PinnedApp70Replay10Tests().fixture()
        device='11111111-1111-1111-1111-111111111111';executable='/owned/LayerwellStaging.app/LayerwellStaging'
        ps=('321 Tue Nov 10 21:38:00 2026 '+executable+'\n').encode()
        warm=q.process_record11(native,ps,321,executable)
        r=SimpleNamespace(receipt={'source':{'head':'a'*40,'tree':'b'*40,'base':'c'*40,'inventory':[]},
            'simulator':{'udid':device},'warm_process11':warm,'replay_execution11':{
                'repository':'TasfiqJ/onSkin','runner_head':'a'*40,'runner_tree':'b'*40,'run_id':123,'job_id':456,
                'run_attempt':1,'native_attempt':73,'job_name':q.JOB11,'runner_id':789,'configured_labels':['macos-26-intel']}})
        return q,r,q.binding11(r,device,321),native,trace,ps

    def test_actual_frozen_restart_prefix_is_RED_and_diagnostic_attach_preserves_ordinary(self):
        import hashlib
        q,r,b,native,trace,ps=self.fixture();full=(ROOT/'scripts/release/full-app-j01/native_ui47.swift').read_bytes();before=full.split(b'\nimport UIKit',1)[0]
        self.assertEqual(hashlib.sha256(before).hexdigest(),'7687fb14aeb9091ce91b4a9d0d4065b81abbe7c9eaf4418bb9fe2b8e1e7ebacc')
        with self.assertRaisesRegex(ValueError,'DIAGNOSTIC_PREFIX_RESTART'):q.validate_prefix11(q.prefix(before),b)
        after=q.prefix11(before,b);q.validate_prefix11(after,b)
        marker=b'    func testV04ExplicitWithdrawalReviewCancelAndFreshReconsent() throws {';case=after[after.index(marker):]
        self.assertNotIn(b'launchFreshOrdinary(app)',case);self.assertNotIn(b'app.launch(',case)
        self.assertIn(b'guard attachWarm11(app) else { return }',case);self.assertEqual(after.count(b'app.activate()'),1)
        ordered=[b'attachWarm11(app)',b'tap("Begin", app)',b'enterAdultDate(app)',b'requireInitialConsent(app)',b'requireDisclosure(app)',
            b'sameProcess11("PRE_CONSENT", app)',b'tap("I agree. Continue", app)',b'sameProcess11("POST_CONSENT", app)',
            b'sameProcess11("GOALS_CHECK", app)',b'requireFreshGoals(app)',b'sameProcess11("GOALS_READY", app)']
        self.assertEqual([case.index(v)for v in ordered],sorted(case.index(v)for v in ordered))
        start=b'    private func launchFreshOrdinary(';end=b'    private func enterAdultDate('
        self.assertEqual(before[before.index(start):before.index(end)],after[after.index(start):after.index(end)])
        self.assertEqual((ROOT/'scripts/release/full-app-j01/native_ui47.swift').read_bytes(),full)
        with self.assertRaises(ValueError):q.prefix11(before+b'changed',b)

    def test_same_process_identity_rejects_absence_replacement_wrong_source_or_executable(self):
        q,r,b,native,trace,ps=self.fixture();warm=r.receipt['warm_process11'];exe=warm['executable']
        self.assertEqual(q.process_record11(native,ps,321,exe,warm),warm)
        for raw,pid,value in [(b'',321,native),(ps,322,native),(ps.replace(b'21:38:00',b'21:38:01'),321,native),
            (ps.replace(exe.encode(),b'/foreign'),321,native),(ps,321,{**native,'sourceHead':'c'*40}),
            (ps,321,{**native,'pid':322}),(ps,True,native),(ps,321,{**native,'schema':True})]:
            with self.assertRaises(ValueError):q.process_record11(value,raw,pid,exe,warm)

    def test_closed_binding_rejects_wrong_app_runner_trace_and_ordinary_admission(self):
        import copy,hashlib
        q,r,b,native,trace,ps=self.fixture();self.assertEqual(q.validate_binding11(b),321)
        changes=[lambda x:x['producer'].update(head='c'*40),lambda x:x['app'].update(sha256='c'*64),
            lambda x:x['runner_source'].update(head='c'*40),lambda x:x['execution'].update(native_attempt=72),
            lambda x:x['execution'].update(run_attempt=2),lambda x:x['execution'].update(run_attempt=True),
            lambda x:x['execution'].update(job_name=q.JOB),lambda x:x['execution'].update(runner_id=True),
            lambda x:x['execution'].update(app_pid=322),lambda x:x['warm_process'].update(pid=322),
            lambda x:x.update(diagnostic_transform_sha256='c'*64),lambda x:x.update(ordinary_admitted=True),
            lambda x:x.update(internal_admitted=True),lambda x:x.update(domain=q.DOMAIN)]
        for change in changes:
            other=copy.deepcopy(b);change(other);other.pop('binding_id');other['binding_id']=hashlib.sha256(json.dumps(other,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            with self.assertRaises(ValueError):q.validate_binding11(other)
        self.assertEqual(q.trace_binding11(s,json.dumps(trace).encode(),native,b),trace)
        for value in [{**native,'pid':322},{**native,'sourceHead':'a'*40}]:
            with self.assertRaises(ValueError):q.trace_binding11(s,json.dumps(trace).encode(),value,b)
        with self.assertRaises(ValueError):q.validate_binding(b) # C10 reader never silently admits this successor.

    def test_request_ack_requires_exact_live_stage_sequence_pid_and_non_stale_binding(self):
        q,r,b,native,trace,ps=self.fixture();checkpoints=[]
        for seq,phase in enumerate(q.PHASES11,1):
            request={'schema':1,'binding':b['binding_id'],'sequence':seq,'phase':phase,'pid':321,'state':4}
            reply=q.request11(request,b,checkpoints);self.assertTrue(reply['valid']);self.assertEqual(reply['sequence'],seq)
            for key,value in [('schema',True),('binding','c'*64),('sequence',seq-1),('sequence',True),
                ('phase','UNKNOWN'),('pid',322),('pid',True),('state',1),('state',True)]:
                with self.assertRaises(ValueError):q.request11({**request,key:value},b,checkpoints)
            if seq>1:
                with self.assertRaises(ValueError):q.request11({**request,'state':3},b,checkpoints)
            checkpoints.append(reply)
        with self.assertRaises(ValueError):q.request11(request,b,checkpoints)

    def test_origin_gate_requires_real_native_consent_and_current_process_through_goal_boundary(self):
        import copy
        q,r,b,native,trace,ps=self.fixture();state={'invalid':None,'explicit_consent_native_tap':True,'checkpoints':[{'phase':v}for v in q.PHASES11[:7]]}
        self.assertTrue(q.origin_eligible11(state,True));self.assertFalse(q.origin_eligible11(state,False))
        for change in [lambda x:x.update(invalid={'code':'C47_REPLAY11_PROCESS_REPLACED'}),
            lambda x:x.update(explicit_consent_native_tap=False),lambda x:x['checkpoints'].pop(),
            lambda x:x['checkpoints'][0].update(phase='GOALS_READY')]:
            other=copy.deepcopy(state);change(other);self.assertFalse(q.origin_eligible11(other,True))
        valid=b'    t = 2.00s Tap "Begin" Button\n    t = 5.00s Tap "I agree. Continue" Button\n'
        self.assertTrue(q.explicit_tap11(valid));self.assertFalse(q.explicit_tap11(valid.splitlines(keepends=True)[0]))
        self.assertFalse(q.explicit_tap11(valid+valid));self.assertFalse(q.explicit_tap11(b'\n'.join(reversed(valid.splitlines()))))
        q.invalidate11(state,ValueError('C47_REPLAY11_PROCESS_REPLACED'));first=copy.deepcopy(state['invalid'])
        q.invalidate11(state,RuntimeError('PRIVATE_UNKNOWN_MESSAGE'));self.assertEqual(state['invalid'],first)

    def test_original_rejection_controls_remain_closed_for_unclassified_superseded_or_pregrant(self):
        import copy
        q,r,b,native,trace,ps=self.fixture();self.assertIsNotNone(s.privacy_origin08(q.trace_binding11(s,json.dumps(trace).encode(),native,b)))
        for change in [lambda x:x['events'][1].update(grant=0),lambda x:x['events'][1].update(tokenCurrent=False),
            lambda x:x['events'][1]['error'][0].update(code='UNCLASSIFIED')]:
            other=copy.deepcopy(trace);change(other);self.assertIsNone(s.privacy_origin08(q.trace_binding11(s,json.dumps(other).encode(),native,b)))
        for change in [lambda x:x.update(dropped=1),lambda x:x.update(flushFailures=1),lambda x:x.update(pid=322),
            lambda x:x.update(sourceHead='a'*40),lambda x:x.update(ownerId='PRIVATE')]:
            other=copy.deepcopy(trace);change(other)
            with self.assertRaises(ValueError):q.trace_binding11(s,json.dumps(other).encode(),native,b)

    def test_failure_capture_keeps_original_wait_result_before_abort_and_no_readiness_relaxation(self):
        q,r,b,native,trace,ps=self.fixture();before=(ROOT/'scripts/release/full-app-j01/native_ui47.swift').read_bytes().split(b'\nimport UIKit',1)[0];after=q.prefix11(before,b)
        self.assertIn(b'let c11Exists = element.waitForExistence(timeout: deadline)',after)
        self.assertLess(after.index(b'capture("c11-at-visible-refusal"'),after.index(b'XCTAssertTrue(c11Exists, description)'))
        self.assertLess(after.index(b'capture("c11-initial-goals-decision"'),after.index(b'XCTAssertTrue(c11Goals)'))
        for item in [b'private let deadline: TimeInterval = 30',b'continueAfterFailure = false',b'executionTimeAllowance = 600',
            b'timeout: 5',b'No stale goal or completed profile may advance',b'The actual explicit disclosure must include',b'must be enabled before tapping']:
            self.assertIn(item,after)
        for item in [b'Thread.sleep',b'launchArguments =',b'launchEnvironment =',b'activate()\n        app.launch',b'getPrivateItem(']:self.assertNotIn(item,after)

    def test_current_one_shot73_and_existing_sandbox_only_observer_are_explicit(self):
        import inspect
        q,r,b,native,trace,ps=self.fixture();workflow=(ROOT/'.github/workflows/campaign47-native-runtime.yml').read_bytes().decode()
        for item in ['commits == 159','github.run_attempt == 1','number == 48','runs-on: macos-26-intel',
            'timeout-minutes: 90','cancel-in-progress: false','retention-days: 3','actions: read',
            'pinned_app70_replay10.py --same-process11 --output','500 * 1024 * 1024',q.JOB11]:self.assertIn(item,workflow)
        self.assertNotIn('workflow_dispatch',workflow);self.assertEqual(workflow.count('  native-build:'),1)
        self.assertEqual(q.SEAL_COUNT11,159);self.assertEqual(q.START11,'a50628e009c69ee00bf532e1335fde6ed9d3f51e')
        source=inspect.getsource(q.observer11)
        for item in ['process11(r,n,installed,pid,warm)','C47PrivacyOrigin08-','request11(request,envelope',"'Documents/C47Replay11'",'RUNNER_BUNDLE11',"'ORIGIN_CANDIDATE.json'"]:
            self.assertIn(item,source)
        for item in ['socket','http://','getPrivateItem','app.launch','codesign -s']:self.assertNotIn(item,source)
        self.assertEqual(q.RUNNER_BUNDLE11,'internal.c47.native-ui.xctrunner')
        # Actual observer control flow over only an owned synthetic filesystem.
        # No Simulator/process success is inferred from these deterministic fixtures.
        from types import SimpleNamespace
        from unittest.mock import patch
        import time,os
        parent=str(Path(tempfile.gettempdir()).resolve())
        # Only our new owned fixture uses native extended spelling on Windows;
        # the real Mac paths and all existing production path/race guards stay exact.
        if os.name=='nt':parent='\\\\?\\'+parent
        for failure in [None,'replacement','foreign-runner']:
            with self.subTest(observer_fixture=failure),tempfile.TemporaryDirectory(prefix='c47-process11-ipc-',dir=parent)as temp:
                root=Path(temp).resolve();self.assertEqual(root.parent,Path(parent).resolve())
                home=root/'home';device=b['execution']['device']
                base=home/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
                app_data=base/'22222222-2222-2222-2222-222222222222';runner_data=base/'33333333-3333-3333-3333-333333333333'
                (app_data/'Documents').mkdir(parents=True);runner_data.mkdir();output=root/'evidence';output.mkdir()
                r.output=output;r.env={};r.deadline=time.monotonic()+60;r._storage05_first_data_container=app_data
                (app_data/'Documents/C47StorageOrigin05Identity.json').write_bytes(json.dumps(native).encode())
                (app_data/'Documents/C47PrivacyOrigin08-321.json').write_bytes(json.dumps(trace).encode())
                ipc=runner_data/'Documents/C47Replay11'/b['binding_id'];ipc.mkdir(parents=True)
                state={'invalid':None,'checkpoints':[],'process_checks':0,'runner_data_unavailable':0};observations=[]
                class Steps:
                    number=0
                    def wait(self,seconds):
                        self.number+=1
                        if self.number>8:return True
                        request={'schema':1,'binding':b['binding_id'],'sequence':self.number,'phase':q.PHASES11[self.number-1],'pid':321,'state':4}
                        (ipc/'request.json').write_bytes(json.dumps(request).encode());return False
                steps=Steps()
                def guard(*args):
                    if failure=='replacement'and steps.number==4:raise ValueError('C47_REPLAY11_PROCESS_REPLACED')
                    return r.receipt['warm_process11']
                def write(path,value):path.write_bytes((json.dumps(value)+'\n').encode())
                n=SimpleNamespace(read_native_file=lambda p:p.read_bytes(),stage_json=json.loads,write_json=write,utc=lambda:'SYNTHETIC_UNIT_TIME')
                d=SimpleNamespace(_native05_observed_pid62=lambda *args:321,validate_privacy08=s.validate_privacy08,privacy_origin08=s.privacy_origin08)
                found=root/'foreign'if failure=='foreign-runner'else runner_data
                if failure=='foreign-runner':found.mkdir()
                with patch.object(q.Path,'home',return_value=home),patch.object(q,'process11',side_effect=guard),\
                    patch.object(q.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=str(found).encode(),stderr=b'')):
                    q.observer11(r,n,d,device,root/'LayerwellStaging.app',{},steps,observations,state)
                if failure is None:
                    self.assertIsNone(state['invalid']);self.assertEqual(len(state['checkpoints']),8)
                    for seq in range(1,9):
                        ack=json.loads((ipc/('ack-'+str(seq)+'.json')).read_bytes());self.assertTrue(ack['valid']);self.assertEqual(ack['pid'],321)
                    self.assertTrue((output/'replay-capture11/ORIGIN_CANDIDATE.json').is_file())
                    self.assertFalse(q.origin_eligible11(state,True),'Synthetic trace/handshake cannot fabricate the required real native tap')
                else:
                    self.assertIsNotNone(state['invalid']);self.assertFalse((ipc/('ack-4.json'if failure=='replacement'else'ack-1.json')).exists())
                    self.assertFalse(q.origin_eligible11(state,True))

if __name__=='__main__':unittest.main()
