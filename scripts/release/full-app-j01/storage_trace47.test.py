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
CLASSIFIER_TEST = "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\nconst path = require('node:path');\nconst vm = require('node:vm');\nconst source = fs.readFileSync(path.join(__dirname, 'storage_origin05.entry.js'), 'utf8');\nconst HEAD = 'a'.repeat(40);\n\nfunction harness(options = {}) {\n  const timers = [], writes = [], imports = [];\n  const identity = { schema: 1, pid: 321, sourceHead: HEAD,\n    bundle: options.bundle || 'com.layerwell.app.staging' };\n  const native = {\n    documentDirectory: 'file:///diagnostic/',\n    getInfoAsync: async () => ({ exists: true, isDirectory: false, size: 150 }),\n    readAsStringAsync: async () => JSON.stringify(identity),\n    writeAsStringAsync: async (file, value) => {\n      if (options.writeFails) throw new Error('private native flush failure');\n      writes.push({ file, value });\n    },\n  };\n  const context = vm.createContext({\n    setTimeout: (callback) => { timers.push(callback); return timers.length; },\n    require: (name) => {\n      imports.push(name);\n      if (name === 'expo-file-system/legacy') {\n        if (options.fsRequireFails) throw new Error('diagnostic filesystem import failed');\n        return native;\n      }\n      assert.equal(name, 'expo-router/entry');\n      if (!options.fsRequireFails && !options.hookInstallFails)\n        assert.equal(typeof context.__C47_STORAGE_ORIGIN05__, 'function');\n      if (options.routerError) throw options.routerError;\n      return {};\n    },\n  });\n  if (options.hookInstallFails) Object.defineProperty(context, '__C47_STORAGE_ORIGIN05__',\n    { set() { throw new Error('diagnostic hook install failed'); } });\n  vm.runInContext(source.replace('__C47_SOURCE_HEAD05__', HEAD), context);\n  return { hook: context.__C47_STORAGE_ORIGIN05__, imports, writes,\n    drain: async () => { for (let n = 0; timers.length && n < 100; n += 1) await timers.shift()(); },\n    latest: () => JSON.parse(writes.at(-1).value) };\n}\nconst event = (overrides = {}) => ({ site: 'private-kv', operation: 'getPrivateItem',\n  phase: 'failure', attempt: 1, sourceLine: 463, stage: 'AsyncStorage.getItem',\n  disposition: 'propagate', error: new Error('PRIVATE_KV_CONTENT_KEY_MISSING'), ...overrides });\n\ntest('entry installs synchronous hook before router and flushes only on separate timer', async () => {\n  const h = harness();\n  assert.deepEqual(h.imports, ['expo-file-system/legacy', 'expo-router/entry']);\n  const attempt = h.hook(event({ phase: 'begin', attempt: 0 }));\n  assert.equal(attempt, 1); assert.equal(h.writes.length, 0);\n  h.hook(event({ attempt })); await h.drain();\n  const out = h.latest();\n  assert.equal(out.pid, 321); assert.equal(out.sourceHead, HEAD);\n  assert.equal(out.bundle, 'com.layerwell.app.staging');\n  assert.equal(out.diagnosticMarker, 'C47_STORAGE_ORIGIN_DIAGNOSTIC_05');\n  assert.equal(out.events[1].attempt, attempt);\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, 'PRIVATE_KV_CONTENT_KEY_MISSING');\n  assert.equal(h.writes[0].file, 'file:///diagnostic/C47StorageOrigin05-321.json');\n});\n\ntest('actual omitted privateKV/C46/history/account codes survive each tagged observer boundary', async () => {\n  const rows = [\n    ['availability', 'verifyPrivateStorage', 'PRIVATE_KV_DECRYPTION_FAILED'],\n    ['age-store', 'getAgePolicyReceiptStatus', 'PRIVATE_KV_CONTENT_KEY_INVALID'],\n    ['content-key', 'getStoredPrivateKVContentKey', 'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE'],\n    ['mutation', 'assertPrivateMutationReadGeneration46', 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED'],\n    ['mutation', 'decodeHistoryIntentMarker45', 'LOCAL_DATA_HISTORY_RECOVERY_REQUIRED'],\n    ['account-generation', 'assertAccountGenerationLease', 'ACCOUNT_GENERATION_CHANGED'],\n    ['owner-proof', 'readLocalDataOwnerProof', 'LOCAL_DATA_OWNER_PROOF_INVALID'],\n    ['lifecycle', 'readLocal', 'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE'],\n  ];\n  for (const [site, operation, code] of rows) {\n    const h = harness(), original = new Error(code), descriptors = Object.getOwnPropertyDescriptors(original);\n    h.hook(event({ site, operation, error: original }));\n    h.hook(event({ site: 'age-store', operation: 'getAgePolicyReceiptStatus',\n      phase: 'caught', disposition: 'ui_conversion', error: original }));\n    await h.drain(); const out = h.latest();\n    assert.equal(out.firstFailure.site, site);\n    assert.equal(out.firstFailure.error.chain[0].recognizedCode, code);\n    assert.equal(out.firstUIFailure.error.chain[0].errorId, out.firstFailure.error.chain[0].errorId);\n    assert.deepEqual(Object.getOwnPropertyDescriptors(original), descriptors);\n  }\n});\n\ntest('plain native code and actual numeric cause fields survive, with bounded causal identities', async () => {\n  const h = harness();\n  const native = { code: 'ERR_KEY_CHAIN', message: 'private owner secret', cause: { osStatus: -25308 } };\n  const wrapper = new Error('PRIVATE_KV_WRITE_ROLLBACK_FAILED'); wrapper.cause = native;\n  h.hook(event({ error: wrapper })); await h.drain();\n  const chain = h.latest().firstFailure.error.chain;\n  assert.equal(chain.length, 3); assert.equal(chain[1].recognizedCode, 'ERR_KEY_CHAIN');\n  assert.deepEqual(chain[2].numericFields, [{ field: 'osStatus', value: -25308 }]);\n  assert.equal(chain[1].arbitraryMessageStackAndObjectOmitted, true);\n  assert.ok(!JSON.stringify(h.latest()).includes('private owner secret'));\n});\n\ntest('unknown message/code/name/stack/owner metadata are omitted, not prefix-whitelisted', async () => {\n  const h = harness(), secret = 'DOB_AND_OWNER_SECRET_1970_private';\n  h.hook(event({ error: { name: secret, code: secret, message: 'PRIVATE_KV_DECRYPTION_FAILED:' + secret,\n    stack: secret, ownerId: secret }, meta: { rawKey: secret, ownerId: secret, ownerHash: secret,\n    revisionChanged: true, liveClaimsCount: 2, keyCategory: 'age_receipt' } }));\n  await h.drain(); const out = h.latest();\n  assert.ok(!JSON.stringify(out).includes(secret));\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, 'UNCLASSIFIED');\n  assert.deepEqual(out.firstFailure.meta, { revisionChanged: true, liveClaimsCount: 2, keyCategory: 'age_receipt' });\n});\n\ntest('no error or metadata getter, toJSON, coercion, or stack accessor executes', async () => {\n  const h = harness(); let called = 0;\n  const error = Object.create(Error.prototype);\n  for (const name of ['message', 'code', 'cause', 'stack']) Object.defineProperty(error, name,\n    { get() { called += 1; throw new Error('must not execute'); } });\n  error.toJSON = () => { called += 1; throw 0; };\n  error.toString = () => { called += 1; throw 0; };\n  const meta = {}; Object.defineProperty(meta, 'keyCategory', { get() { called += 1; throw 0; } });\n  h.hook(event({ error, meta })); await h.drain();\n  assert.equal(called, 0); assert.equal(h.latest().firstFailure.error.chain[0].errorClass, 'Error');\n});\n\ntest('bounded prototype names handle cross-realm and inherited Error names without instanceof', async () => {\n  const h = harness(); const foreign = vm.runInNewContext('new TypeError(\"PRIVATE_KV_ENVELOPE_INVALID\")');\n  h.hook(event({ error: foreign })); await h.drain();\n  assert.equal(h.latest().firstFailure.error.chain[0].errorClass, 'TypeError');\n  assert.equal(h.latest().firstFailure.error.chain[0].recognizedCode, 'PRIVATE_KV_ENVELOPE_INVALID');\n});\n\ntest('cause cycles/depth and supplied numeric fields remain bounded and do not infer an OSStatus', async () => {\n  const h = harness(); const e = { code: 'ERR_KEY_CHAIN', nativeCode: -50, errno: NaN,\n    nativeErrorCode: 2147483648, osStatus: '-25308' }; e.cause = e;\n  h.hook(event({ error: e })); await h.drain(); const out = h.latest().firstFailure.error;\n  assert.equal(out.chain.length, 1); assert.equal(out.causeEnding, 'cycle');\n  assert.deepEqual(out.chain[0].numericFields, [{ field: 'nativeCode', value: -50 }]);\n  assert.match(out.chain[0].numericQualification, /NOT_INFERRED_OSSTATUS/);\n  const other = harness(); other.hook(event({ error: { cause: { cause: { cause: { code: 'ERR_KEY_CHAIN' } } } } }));\n  await other.drain(); assert.equal(other.latest().firstFailure.error.chain.length, 3);\n  assert.equal(other.latest().firstFailure.error.causeEnding, 'depth_limit');\n});\n\ntest('primitive and thrownundefined rejections retain their actual kind and source site', async () => {\n  for (const value of [undefined, null, 9, 'PRIVATE_KV_RECOVERY_REQUIRED', 'private secret']) {\n    const h = harness(); h.hook(event({ error: value })); await h.drain();\n    const actual = h.latest().firstFailure;\n    assert.equal(actual.site, 'private-kv');\n    assert.equal(actual.error.chain[0].kind, value === null ? 'null' : typeof value);\n    assert.equal(actual.error.chain[0].recognizedCode, value === 'PRIVATE_KV_RECOVERY_REQUIRED' ? value : 'UNCLASSIFIED');\n  }\n});\n\ntest('descriptor/prototype traps and failed flush cannot replace the application rejection', async () => {\n  const h = harness({ writeFails: true });\n  const original = new Proxy({}, { getOwnPropertyDescriptor() { throw 1; }, getPrototypeOf() { throw 2; } });\n  const run = () => { try { throw original; } catch (error) { h.hook(event({ error })); throw error; } };\n  assert.throws(run, (error) => error === original); await h.drain(); assert.equal(h.writes.length, 0);\n  const good = harness(); good.hook(event({ error: original })); await good.drain();\n  assert.equal(good.latest().firstFailure.site, 'private-kv');\n});\n\ntest('first observed probe and later UI failure stay distinct and immutable', async () => {\n  const h = harness(), probe = new Error('LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');\n  h.hook(event({ error: probe, disposition: 'probe' })); probe.message = 'private changed secret';\n  h.hook(event({ error: new Error('PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE'),\n    site: 'age-store', operation: 'getAgePolicyReceiptStatus', phase: 'caught', disposition: 'ui_conversion' }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED');\n  assert.equal(out.firstUIFailure.error.chain[0].recognizedCode, 'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE');\n  assert.notEqual(out.firstFailure.error.chain[0].errorId, out.firstUIFailure.error.chain[0].errorId);\n  assert.match(out.firstFailureQualification, /NOT_CAUSAL_DIAGNOSIS/);\n});\n\ntest('512-event limit reserves first failure and retains later UI failure separately with explicit drops', async () => {\n  const h = harness();\n  for (let i = 0; i < 600; i += 1) h.hook(event({ phase: 'pass', error: undefined }));\n  h.hook(event()); h.hook(event({ phase: 'caught', disposition: 'ui_conversion' }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.events.length, 512); assert.equal(out.droppedEvents, 90);\n  assert.equal(out.firstFailure.sequence, 601); assert.equal(out.firstUIFailure.sequence, 602);\n  assert.equal(out.firstFailure.error.chain[0].recognizedCode, 'PRIVATE_KV_CONTENT_KEY_MISSING');\n});\n\ntest('invalid site/stage/metadata never leaks and wrong bundle cannot create a falsely bound trace', async () => {\n  const h = harness(); h.hook(event({ site: 'private-owner-secret' }));\n  h.hook(event({ stage: 'private-stage-secret', meta: { keyCategory: 'private-key-secret' } }));\n  await h.drain(); const out = h.latest();\n  assert.equal(out.droppedEvents, 1); assert.equal(out.events[0].stage, undefined);\n  assert.ok(!JSON.stringify(out).includes('private-stage-secret'));\n  const wrong = harness({ bundle: 'foreign.app' }); wrong.hook(event()); await wrong.drain();\n  assert.equal(wrong.writes.length, 0);\n});\n\ntest('filesystem import or hook-install failure still mounts router, whose original rejection propagates', () => {\n  for (const options of [{ fsRequireFails: true }, { hookInstallFails: true }]) {\n    const h = harness(options);\n    assert.deepEqual(h.imports, ['expo-file-system/legacy', 'expo-router/entry']);\n    const original = new Error('original router rejection');\n    assert.throws(() => harness({ ...options, routerError: original }), (error) => error === original);\n  }\n});\n\ntest('actual counted clear family is normalized only for its bounded source outcomes', async () => {\n  for (const [suffix, code, count] of [['1', 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED', 1],\n    ['2', 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED', 2], ['999-secret', 'UNCLASSIFIED', null]]) {\n    const h = harness(); h.hook(event({ error: new Error('PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:' + suffix),\n      meta: { ageStatus: 'unavailable', parentAttempt: 7 } }));\n    await h.drain(); const out = h.latest();\n    assert.equal(out.firstFailure.error.chain[0].recognizedCode, code);\n    assert.equal(out.firstFailure.error.chain[0].recognizedCount, count);\n    assert.deepEqual(out.firstFailure.meta, { parentAttempt: 7, ageStatus: 'unavailable' });\n  }\n});\n"


class StorageOrigin05Tests(unittest.TestCase):
    def test_classifier_actual_native_cause_redaction_getter_bounds_and_failure_containment(self):
        with tempfile.TemporaryDirectory(prefix='c47-origin05-observer-') as temporary:
            p = Path(temporary)
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
            root=Path(temporary)/'source';root.mkdir();originals={}
            for relative in s.SOURCE_PREIMAGES:
                original=(ROOT/relative).read_bytes();originals[relative]=original
                target=root/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(original)
            script='scripts/release/full-app-j01/storage_origin47.mjs'
            target=root/script;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((ROOT/script).read_bytes())
            ios=root/'apps/mobile/ios';delegate=ios/'LayerwellStaging/AppDelegate.swift'
            delegate.parent.mkdir(parents=True);delegate_original=b'import Expo\n    let delegate = ReactNativeDelegate()\n'
            delegate.write_bytes(delegate_original)
            def run(label,argv,**kwargs):
                result=subprocess.run(list(map(str,argv)),cwd=ROOT,capture_output=True,timeout=60)
                self.assertEqual(result.returncode,0,result.stdout.decode(errors='replace')+result.stderr.decode(errors='replace'))
            evidence=Path(temporary)/'evidence'
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
        root=Path(temporary)/'source';root.mkdir();originals={}
        for relative in s.SOURCE_PREIMAGES:
            original=(ROOT/relative).read_bytes();originals[relative]=original
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
            evidence=Path(temporary)/'evidence'
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
            evidence=Path(temporary)/'evidence'
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
            evidence=Path(temporary)/'evidence';replacement=Path(temporary)/'foreign.js'
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

validator = s
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
    def case(self,site,operation,code,blocked):
        value=fixture('c46')
        for row in value['events']+[value['firstFailure'],value['firstUIFailure']]:
            if row is None:continue
            if 'error' in row:
                for node in row['error']['chain']:
                    node['recognizedCode']=code;node['recognizedCodeField']='message'
            if row['sequence']==2:
                row.update(site=site,operation=operation,stage='account_fence',meta={'boundaryBlocked':blocked})
        return validator.qualifying_origin05(validate(value))

    def test_early_account_reject_and_local_private_boundary_need_actual_blocked_predicate(self):
        for site,op,code in [('account-generation','runAccountGenerationOperation','ACCOUNT_GENERATION_CHANGED'),
                             ('private-kv','runAccountScopedPrivateOperation','PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY')]:
            with self.subTest(op=op):
                self.assertIsNotNone(self.case(site,op,code,True))
                self.assertIsNone(self.case(site,op,code,False))

if __name__=='__main__':unittest.main()
