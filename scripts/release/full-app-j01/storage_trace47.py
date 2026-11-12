"""C05 finite staging-only storage-origin observation. Never ordinary admission."""
from contextlib import contextmanager
import difflib
import hashlib
import json
from pathlib import Path
import re

AUTH = 'BRAIN-C47-STORAGE-ROOT-CAUSE-RUNTIME-05'
MARKER = 'C47_STORAGE_ORIGIN_DIAGNOSTIC_05'
CHECKPOINT = 'fa4275986b727b3e6d855b059d5688210a09e440'
CHECKPOINT_TREE = 'ce88d3d7b8a674e3fae2e9aa2ff3c594efe2ecbd'
MAX_TRACE = 2 * 1024 * 1024
SOURCE_PREIMAGES = {
  "apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx": "e29234f6af0b3be077a77aa18fd31a38a07943f50e192f4a79d2051c4889c457",
  "apps/mobile/src/features/onboarding/ageGateStore.ts": "bd83d5dd65228d054778c9a919a0378313881cd467049f38bd91dcda49bad162",
  "apps/mobile/src/lib/storage/privateKV.ts": "267de879f0a249c396fd6c43889a5117139d9d4e5dc44b6f548d104c4378e8c5",
  "apps/mobile/src/lib/storage/privateKVContentKey.ts": "076ef0751f98c1fb9cb970f14d5ee76755f9999a40fc46055ba20d4956167734",
  "apps/mobile/src/lib/auth/localAccountIsolation.ts": "2445dbe674449c0fd8b0b28e2e280c553c7c38c475396abc1c74a76972d7a84c",
  "apps/mobile/src/lib/auth/accountGeneration.ts": "67e0112149e11a883795ad60d27cf9c8b9dfe079dfa6328bcf29c3997540eb1a",
  "apps/mobile/src/features/healthConsent/lifecycle.ts": "8ee8efd825a5be6fb8691cb74d96fbc4d7dd9c339a690194b52f67053abb549b",
  "apps/mobile/src/features/photos/consent.ts": "a45ef22356ec2352568bd4ed847c88d96a4565357233054021d0a5d9c3422042",
  "apps/mobile/src/lib/auth/sessionOwner.ts": "a3f61f6729f592dfd6f44b7716cd0dec0db9b715c3ab948e908e27d7a0f932eb",
  "apps/mobile/src/features/onboarding/AgePolicyGate.tsx": "fdcdac6ae1c15254a82d25b57a9eef628c39f20c16c65d88b20f9dd7850ab272"
}
ENTRY_TEMPLATE = "/* Diagnostic entry only. Replace the one source-head token before installation. */\ntry { (() => {\n  const FS = require('expo-file-system/legacy');\n  const SOURCE_HEAD = '__C47_SOURCE_HEAD05__';\n  const IDENTITY_FILE = 'C47StorageOrigin05Identity.json';\n  const SITES = new Set(['availability', 'age-store', 'age-gate', 'private-kv', 'content-key',\n    'mutation', 'account-generation', 'lifecycle', 'cloud-preference', 'owner-proof']);\n  const OPERATIONS = new Set(['verifyPrivateStorage', 'check', 'getAgePolicyReceiptStatus',\n    'setAgeVerified', 'classifyAgePolicyReceipt', 'getPrivateItem', 'readPrivateItems',\n    'assertPrivateKVReadable', 'getExistingContentKey', 'getOrCreateContentKey',\n    'classifyEnvelope', 'decryptEnvelope', 'validateEnvelopeAuthentication',\n    'assertPrivateReadAllowed', 'privateMutationReadGuard46', 'runAccountScopedPrivateOperation',\n    'assertAccountScopedPrivateOperationAllowed', 'getStoredPrivateKVContentKey',\n    'setStoredPrivateKVContentKey', 'clearStoredPrivateKVContentKey',\n    'assertPrivateMutationReadGeneration46', 'assertPrivateMutationReadable46',\n    'waitForPrivateMutationReadWindow46', 'decodePrivateMutationMarker46',\n    'decodeHistoryIntentMarker45', 'invalidPrivateMutation46', 'livePrivateMutationMarker46',\n    'armPrivateMutation46', 'finishPrivateMutation46', 'abandonPrivateMutation46',\n    'assertAccountGenerationLease', 'assertAccountIdentityGeneration',\n    'captureOwnerWorkflowFence', 'assertOwnerWorkflowFence', 'readLocal',\n    'readLocalDataOwnerProof', 'assertLocalDataOwnership', 'removePrivateItem',\n    'setPrivateItem', 'updatePrivateItemWithGuard', 'getCloudBackupEnabled',\n    'setCloudBackupEnabled', 'validatePrivateItemsWithoutRetainingPlaintext',\n    'commitPrivateMutation46', 'clearPrivateMutationAfterRemoval46',\n    'assertPrivateMutationWritable46', 'assertPlanHistoryReadable45', 'storageUnavailable',\n    'readActiveReceipt', 'runAccountGenerationOperation', 'runOwnerBoundLocalOperation',\n    'reconcileHealthDataLifecycle', 'reconcileUnconfigured', 'readLocalDataOwnership',\n    'claimLocalDataOwnership', 'localDataOwnerBinding', 'clearUnavailableCloudBackupPreference']);\n  const PHASES = new Set(['begin', 'failure', 'caught', 'pass', 'state']);\n  const STAGES = new Set([...OPERATIONS, 'entry', 'native_read', 'native_write', 'native_remove',\n    'native_availability', 'content_key', 'envelope_classify', 'envelope_authenticate',\n    'marker_read', 'marker_decode', 'mutation_generation', 'mutation_admission',\n    'history_admission', 'account_fence', 'owner_fence', 'health_lease', 'revision_check',\n    'age_classify', 'ui_conversion', 'unknown', 'AsyncStorage.getItem', 'AsyncStorage.setItem',\n    'AsyncStorage.removeItem', 'AsyncStorage.getAllKeys', 'AsyncStorage.multiGet',\n    'AsyncStorage.multiSet', 'AsyncStorage.multiRemove', 'SecureStore.isAvailableAsync',\n    'SecureStore.getItemAsync', 'SecureStore.setItemAsync', 'SecureStore.deleteItemAsync',\n    'JSON.parse', 'JSON.stringify', 'assertPlanHistoryReadable45',\n    'captureHealthPurposePrivateDataWriteLease', 'assertHealthDataWriteLease',\n    'assertHistoryKeysReadable45', 'assertPrivateMutationWritable46', 'Promise.all',\n    'accountLease.assertCurrent', 'applyProcessingEpoch', 'assertBeforeNativeWrite',\n    'assertCurrent', 'assertHealthReadCurrent', 'assertHistoryBatchShape45',\n    'assertMutationCurrent', 'assertMutationReadCurrent46', 'assertNoFailedReadRewrite',\n    'assertOriginalPreparation46', 'assertPreparationCurrent', 'assertPrivateDataKey',\n    'clearDependentWithdrawalRecoveryAfterTerminal', 'clearHealthPurposeLocalDataForFence',\n    'hasOrphanedPrivateCiphertext', 'lease.assertCurrent', 'maybeRejectConflictChoiceWrite',\n    'mutate', 'operation', 'owner.localDataOwnerBinding', 'owner.readLocalDataOwnerProof',\n    'pauseForVerification', 'readHealthDataLifecycle', 'recordLocalWithdrawalChoice',\n    'restoreExactRawAfterAmbiguousMutation', 'restoreRequiredCleanupMarker',\n    'rethrowStaleWorkflow', 'withOperationTiming', 'writeLocal']);\n  const PREDICATES = new Set(['revision_changed', 'live_claim_present', 'failed_claim_present',\n    'orphan_marker', 'marker_invalid', 'history_marker_invalid', 'account_changed',\n    'account_boundary_active', 'owner_changed', 'owner_invalid', 'health_lease_closed',\n    'key_missing', 'key_invalid', 'ciphertext_invalid', 'ciphertext_unsupported',\n    'authentication_failed', 'native_rejected', 'unclassified', 'not_applicable']);\n  const KEY_CATEGORIES = new Set(['age_receipt', 'content_key', 'cleanup_marker',\n    'health_lifecycle', 'health_consent', 'cloud_preference', 'history', 'other_private',\n    'foreign', 'reserved', 'unclassified']);\n  const ENVELOPE_KINDS = new Set(['absent', 'legacy', 'current', 'malformed', 'unsupported']);\n  const AGE_STATUSES = new Set(['current', 'reverification_required', 'missing', 'legacy',\n    'invalid', 'unsupported', 'policy_mismatch', 'unavailable']);\n  const DISPOSITIONS = new Set(['throw', 'propagate', 'caught', 'ui_conversion', 'probe']);\n  const ERROR_CLASSES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError',\n    'ReferenceError', 'URIError', 'EvalError', 'AggregateError', 'AccountGenerationLeaseError',\n    'KeyChainException', 'InvalidKeyException', 'MissingPlistKeyException', 'SecAccessControlError']);\n  // Exact literals from the current first-party files and installed Expo sources.\n  // No prefix, substring, NSError-description or arbitrary-message admission.\n  const CODES = new Set(['PRIVATE_KV_CONTENT_KEY_MISSING', 'PRIVATE_KV_CONTENT_KEY_INVALID',\n    'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE', 'PRIVATE_KV_DECRYPTION_FAILED',\n    'PRIVATE_KV_ENVELOPE_INVALID', 'PRIVATE_KV_ENVELOPE_UNSUPPORTED',\n    'PRIVATE_KV_ENVELOPE_FOREIGN', 'PRIVATE_KV_RESERVED_KEY', 'PRIVATE_KV_WRITE_CONFLICT',\n    'PRIVATE_KV_RECOVERY_REQUIRED', 'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE',\n    'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY', 'PRIVATE_KV_WRITE_ROLLBACK_FAILED',\n    'PRIVATE_KV_SOURCE_UNAUTHENTICATED', 'PRIVATE_KV_SOURCE_TRANSFORM_INVALID',\n    'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED', 'LOCAL_DATA_HISTORY_RECOVERY_REQUIRED',\n    'LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID', 'LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED',\n    'LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED', 'LOCAL_DATA_OWNER_PROOF_INVALID',\n    'LOCAL_DATA_CLEANUP_REQUIRED', 'LOCAL_DATA_UNCLAIMED_QUARANTINED',\n    'LOCAL_DATA_OWNER_MISMATCH', 'LOCAL_DATA_RETAINED_OWNER_INVALID',\n    'LOCAL_DATA_UNCLAIMED_QUARANTINE_INVALID', 'ACCOUNT_GENERATION_CHANGED',\n    'HEALTH_DATA_WRITE_ADMISSION_CLOSED', 'HEALTH_DATA_WRITE_OWNER_MISMATCH',\n    'HEALTH_DATA_LIFECYCLE_OWNER_INVALID', 'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH',\n    'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE', 'ERR_KEY_CHAIN', 'ERR_INVALID_KEY',\n    'ERR_MISSING_PLIST_KEY', 'ERR_SEC_ACCESS_CONTROL']);\n  const MISSING = Symbol('missing-data-descriptor');\n  const errorIds = new WeakMap();\n  const events = [];\n  const failureWindow = [];\n  let failureWindowEvicted = 0;\n  let nextErrorId = 0, nextAttempt = 0, sequence = 0, dropped = 0;\n  let firstFailure = null, firstUIFailure = null;\n  let dirty = false, scheduled = false, writing = false, flushFailures = 0;\n\n  function own(value, key) {\n    if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return MISSING;\n    try {\n      const descriptor = Object.getOwnPropertyDescriptor(value, key);\n      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')\n        ? descriptor.value : MISSING;\n    } catch { return MISSING; }\n  }\n  function integer(value, maximum = 1000000) {\n    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;\n  }\n  function literal(value, allowed) {\n    return typeof value === 'string' && value.length <= 96 && allowed.has(value) ? value : null;\n  }\n  function knownCode(value) {\n    const exact = literal(value, CODES);\n    if (exact) return { code: exact, count: null };\n    if (typeof value !== 'string' || value.length > 96) return null;\n    const counted = /^PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:([12])$/.exec(value);\n    return counted ? { code: 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED', count: Number(counted[1]) } : null;\n  }\n  function errorId(value) {\n    if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return 0;\n    let id = errorIds.get(value);\n    if (!id && nextErrorId < 1024) { id = ++nextErrorId; errorIds.set(value, id); }\n    return id || 0;\n  }\n  function errorClass(value) {\n    let cursor = value;\n    for (let depth = 0; depth < 4 && cursor !== null; depth += 1) {\n      const name = literal(own(cursor, 'name'), ERROR_CLASSES);\n      if (name) return name;\n      if ((typeof cursor !== 'object' || cursor === null) && typeof cursor !== 'function') break;\n      try { cursor = Object.getPrototypeOf(cursor); } catch { break; }\n    }\n    return 'UNCLASSIFIED';\n  }\n  function classify(error) {\n    const chain = [], seen = new Set();\n    let value = error, ending = 'not_supplied';\n    for (let depth = 0; depth < 3; depth += 1) {\n      if (seen.has(value)) { ending = 'cycle'; break; }\n      seen.add(value);\n      const kind = value === null ? 'null' : typeof value;\n      const code = knownCode(own(value, 'code'));\n      const messageCode = knownCode(own(value, 'message'));\n      const primitiveCode = knownCode(value);\n      const recognized = code || messageCode || primitiveCode;\n      const numericFields = [];\n      for (const key of ['code', 'nativeCode', 'nativeErrorCode', 'osStatus', 'errno']) {\n        const number = own(value, key);\n        if (typeof number === 'number' && Number.isInteger(number) && number >= -2147483648 && number <= 2147483647)\n          numericFields.push(Object.freeze({ field: key, value: number }));\n      }\n      chain.push(Object.freeze({ errorId: errorId(value), kind, errorClass: errorClass(value),\n        recognizedCode: recognized ? recognized.code : 'UNCLASSIFIED',\n        recognizedCount: recognized ? recognized.count : null,\n        recognizedCodeField: code ? 'code' : messageCode ? 'message' : primitiveCode ? 'primitive' : 'none',\n        numericFields: Object.freeze(numericFields),\n        numericQualification: 'SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS',\n        arbitraryMessageStackAndObjectOmitted: true }));\n      const cause = own(value, 'cause');\n      if (cause === MISSING) break;\n      if (depth === 2) { ending = 'depth_limit'; break; }\n      value = cause;\n    }\n    return Object.freeze({ chain: Object.freeze(chain), causeEnding: ending });\n  }\n  function metadata(value) {\n    const output = {};\n    for (const name of ['revisionChanged', 'accountBoundaryActive', 'accountGenerationChanged',\n      'revisionEqual', 'accountGenerationEqual', 'boundaryBlocked',\n      'ownerCurrent', 'leaseCurrent', 'keyPresent', 'rawPresent', 'markerPresent']) {\n      const item = own(value, name); if (typeof item === 'boolean') output[name] = item;\n    }\n    for (const name of ['liveClaimsCount', 'failedClaimsCount', 'liveClaims', 'failedClaims',\n      'keyCount', 'encryptedCount']) {\n      const item = own(value, name); if (integer(item, 65535)) output[name] = item;\n    }\n    const parent = own(value, 'parentAttempt');\n    if (integer(parent)) output.parentAttempt = parent;\n    for (const [name, allowed] of [['keyCategory', KEY_CATEGORIES], ['envelopeKind', ENVELOPE_KINDS],\n      ['ageStatus', AGE_STATUSES],\n      ['stage', STAGES], ['predicate', PREDICATES], ['disposition', DISPOSITIONS]]) {\n      const item = literal(own(value, name), allowed); if (item) output[name] = item;\n    }\n    return Object.freeze(output);\n  }\n  async function flush() {\n    scheduled = false;\n    if (writing || !dirty) return;\n    writing = true; dirty = false;\n    try {\n      if (!/^[a-f0-9]{40}$/.test(SOURCE_HEAD) || typeof FS.documentDirectory !== 'string') throw 0;\n      const identityPath = FS.documentDirectory + IDENTITY_FILE;\n      const info = await FS.getInfoAsync(identityPath);\n      if (!info.exists || info.isDirectory || !integer(info.size, 1024)) throw 0;\n      const identity = JSON.parse(await FS.readAsStringAsync(identityPath));\n      if (own(identity, 'schema') !== 1 || own(identity, 'sourceHead') !== SOURCE_HEAD ||\n          own(identity, 'bundle') !== 'com.layerwell.app.staging' ||\n          !integer(own(identity, 'pid'), 2147483647) || own(identity, 'pid') < 1) throw 0;\n      const payload = { schema: 1, role: 'STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY',\n        diagnosticMarker: 'C47_STORAGE_ORIGIN_DIAGNOSTIC_05',\n        sourceHead: SOURCE_HEAD, pid: own(identity, 'pid'),\n        bundle: 'com.layerwell.app.staging', eventLimit: 512,\n        events: events.slice(), firstFailure, firstUIFailure,\n        traceFormatVersion: 2, failureWindowLimit: 64, failureWindow: failureWindow.slice(),\n        failureWindowEvicted, failureWindowFrozenAtFirstUI: firstUIFailure !== null,\n        firstFailureQualification: 'FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION',\n        droppedEvents: dropped, flushFailures, errorIdentityLimit: 1024,\n        ordinaryAdmitted: false, acceptanceGranted: false, release: 'NO_GO' };\n      await FS.writeAsStringAsync(FS.documentDirectory + 'C47StorageOrigin05-' + payload.pid + '.json', JSON.stringify(payload));\n    } catch { flushFailures = Math.min(flushFailures + 1, 65535); }\n    finally { writing = false; if (dirty) schedule(); }\n  }\n  function schedule() {\n    dirty = true;\n    if (!scheduled && !writing) { scheduled = true; setTimeout(flush, 0); }\n  }\n  globalThis.__C47_STORAGE_ORIGIN05__ = function observe(input) {\n    let attempt = 0;\n    try {\n      const supplied = own(input, 'attempt'); if (integer(supplied)) attempt = supplied;\n      const site = literal(own(input, 'site'), SITES);\n      const operation = literal(own(input, 'operation'), OPERATIONS);\n      const phase = literal(own(input, 'phase'), PHASES);\n      if (!site || !operation || !phase || sequence === Number.MAX_SAFE_INTEGER) {\n        dropped = Math.min(dropped + 1, 2147483647); return attempt;\n      }\n      if (phase === 'begin' && attempt === 0 && nextAttempt < 1000000) attempt = ++nextAttempt;\n      const meta = metadata(own(input, 'meta'));\n      const line = own(input, 'sourceLine');\n      const stage = literal(own(input, 'stage'), STAGES);\n      const disposition = literal(own(input, 'disposition'), DISPOSITIONS);\n      const failure = phase === 'failure' || phase === 'caught';\n      const record = { sequence: ++sequence, site, operation, phase, attempt, meta };\n      if (integer(line) && line > 0) record.sourceLine = line;\n      if (stage) record.stage = stage;\n      if (disposition) record.disposition = disposition;\n      if (failure) record.error = classify(own(input, 'error'));\n      Object.freeze(record);\n      if (failure && firstFailure === null) firstFailure = record;\n      // Bounded error history freezes with the original first UI conversion.\n      // Routine event overflow must not erase a later propagated rejection.\n      if (failure && firstUIFailure === null) {\n        if (failureWindow.length === 64) {\n          failureWindow.shift();\n          failureWindowEvicted = Math.min(failureWindowEvicted + 1, 2147483647);\n        }\n        failureWindow.push(record);\n      }\n      if (failure && (disposition === 'ui_conversion' || meta.disposition === 'ui_conversion') && firstUIFailure === null)\n        firstUIFailure = record;\n      // Reserve the last slot until the first observed failure; never evict it.\n      const limit = firstFailure === null ? 511 : 512;\n      if (events.length < limit) events.push(record);\n      else dropped = Math.min(dropped + 1, 2147483647);\n      schedule();\n    } catch { /* Reflection/proxy/observer failure must not escape into authority. */ }\n    return attempt;\n  };\n})(); } catch { /* Diagnostic setup failure cannot prevent the original router mount. */ }\nrequire('expo-router/entry');\n"


def need(value, code):
    if not value:
        raise ValueError('C47_STORAGE_ORIGIN05_' + code)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def document(path, value):
    path.write_bytes((json.dumps(value, indent=2, sort_keys=True) + '\n').encode('utf8'))


SWIFT_HOOK = r'''
    // C47_STORAGE_ORIGIN_DIAGNOSTIC_05; diagnostic identity only, exact restored.
    do {
      let c47Identity: [String: Any] = ["schema": 1, "sourceHead": "HEAD05", "bundle": Bundle.main.bundleIdentifier ?? "", "pid": Int(ProcessInfo.processInfo.processIdentifier)]
      let c47Documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let c47Bytes = try JSONSerialization.data(withJSONObject: c47Identity, options: [.sortedKeys])
      try c47Bytes.write(to: c47Documents.appendingPathComponent("C47StorageOrigin05Identity.json"), options: .atomic)
    } catch {
      NSLog("C47_STORAGE_ORIGIN05_IDENTITY_WRITE_FAILED")
    }
'''



# Finite105 diagnostic successor; no product repair and no legacy observer alteration.
ONBOARDING53_SOURCE_PREIMAGES = {'apps/mobile/src/features/onboarding/OnboardingContext.tsx': '92dd830e2c37a5eda80ab376ec66a2c811e947a493a74be3d87800fbfab97074', 'apps/mobile/src/features/onboarding/healthConsentStore.ts': '1b0dd6ccfc33bbe955ee1cedfd43040b24a230f2bc3a0a0cbdf1d35e4884c080', 'apps/mobile/src/lib/consent/healthDataWriteAdmission.ts': '4479481bf7050df877d699105b41b132181c6dc3d1f27eb15fdb666b376515d6', 'apps/mobile/src/lib/storage/privateKV.ts': 'f21bfd6bd3830c48530643d88c359da9ecfd97654cc3dd8f21866059c40127ee', 'apps/mobile/src/lib/storage/privateKVContentKey.ts': '076ef0751f98c1fb9cb970f14d5ee76755f9999a40fc46055ba20d4956167734', 'apps/mobile/src/lib/auth/localAccountIsolation.ts': 'd7f165e0a8e581264eb713b6b1d92486bfac1b16d81a7430f00b4bc660425139', 'apps/mobile/src/lib/auth/accountGeneration.ts': '67e0112149e11a883795ad60d27cf9c8b9dfe079dfa6328bcf29c3997540eb1a', 'apps/mobile/src/features/healthConsent/lifecycle.ts': '8ee8efd825a5be6fb8691cb74d96fbc4d7dd9c339a690194b52f67053abb549b'}
ENTRY_TEMPLATE53 = '/* Diagnostic entry only. Replace the one source-head token before installation. */\ntry { (() => {\n  const FS = require(\'expo-file-system/legacy\');\n  const SOURCE_HEAD = \'__C47_SOURCE_HEAD05__\';\n  const IDENTITY_FILE = \'C47StorageOrigin05Identity.json\';\n  const SITES = new Set(["onboarding", "consent-store", "health-admission", \'availability\', \'age-store\', \'age-gate\', \'private-kv\', \'content-key\',\n    \'mutation\', \'account-generation\', \'lifecycle\', \'cloud-preference\', \'owner-proof\']);\n  const OPERATIONS = new Set(["revalidate", "privacyStatus", "setHealthDataCollectionConsentLocal", "hasCurrentHealthDataCollectionConsentStrict", "hasCurrentHealthDataCollectionConsentForLease", "captureHealthDataWriteLease", "assertHealthDataWriteLease", "assertOriginalHealthDataWriteLease", "completeHealthDataActivationRoute", "getPrivateItemWhenReady", "runPreparedPrivateRead46", "getPrivateItemOnOriginalLease39", "runOwnedPrivateGateRead39", "assertPrivateGateAccountLease39", "waitForWidgetCapabilityClears49", \'verifyPrivateStorage\', \'check\', \'getAgePolicyReceiptStatus\',\n    \'setAgeVerified\', \'classifyAgePolicyReceipt\', \'getPrivateItem\', \'readPrivateItems\',\n    \'assertPrivateKVReadable\', \'getExistingContentKey\', \'getOrCreateContentKey\',\n    \'classifyEnvelope\', \'decryptEnvelope\', \'validateEnvelopeAuthentication\',\n    \'assertPrivateReadAllowed\', \'privateMutationReadGuard46\', \'runAccountScopedPrivateOperation\',\n    \'assertAccountScopedPrivateOperationAllowed\', \'getStoredPrivateKVContentKey\',\n    \'setStoredPrivateKVContentKey\', \'clearStoredPrivateKVContentKey\',\n    \'assertPrivateMutationReadGeneration46\', \'assertPrivateMutationReadable46\',\n    \'waitForPrivateMutationReadWindow46\', \'decodePrivateMutationMarker46\',\n    \'decodeHistoryIntentMarker45\', \'invalidPrivateMutation46\', \'livePrivateMutationMarker46\',\n    \'armPrivateMutation46\', \'finishPrivateMutation46\', \'abandonPrivateMutation46\',\n    \'assertAccountGenerationLease\', \'assertAccountIdentityGeneration\',\n    \'captureOwnerWorkflowFence\', \'assertOwnerWorkflowFence\', \'readLocal\',\n    \'readLocalDataOwnerProof\', \'assertLocalDataOwnership\', \'removePrivateItem\',\n    \'setPrivateItem\', \'updatePrivateItemWithGuard\', \'getCloudBackupEnabled\',\n    \'setCloudBackupEnabled\', \'validatePrivateItemsWithoutRetainingPlaintext\',\n    \'commitPrivateMutation46\', \'clearPrivateMutationAfterRemoval46\',\n    \'assertPrivateMutationWritable46\', \'assertPlanHistoryReadable45\', \'storageUnavailable\',\n    \'readActiveReceipt\', \'runAccountGenerationOperation\', \'runOwnerBoundLocalOperation\',\n    \'reconcileHealthDataLifecycle\', \'reconcileUnconfigured\', \'readLocalDataOwnership\',\n    \'claimLocalDataOwnership\', \'localDataOwnerBinding\', \'clearUnavailableCloudBackupPreference\']);\n  const PHASES = new Set([\'begin\', \'failure\', \'caught\', \'pass\', \'state\']);\n  const STAGES = new Set([\'Crypto.digestStringAsync\', \'assertConsentMutationCurrent\', \'attempt\', \'closeProcessingEpochImmediately\', \'operation.assertCurrent\', \'runHealthDataWriteOperation\', \'updatePrivateItem\', "consent_false", "consent_predicate", "admitted", "provider_status", "route_status", "activation_complete", "captureHealthDataWriteLease", "assertOriginalHealthDataWriteLease", "getPrivateItemWhenReady", "hasCurrentHealthDataCollectionConsentForLease", "hasCurrentHealthDataCollectionConsentStrict", "waitForWidgetCapabilityClears49", "runPreparedPrivateRead46", "getPrivateItemOnOriginalLease39", "runOwnedPrivateGateRead39", "assertPrivateGateAccountLease39", "read", "assertPurpose", "assertOriginal", "join", ...OPERATIONS, \'entry\', \'native_read\', \'native_write\', \'native_remove\',\n    \'native_availability\', \'content_key\', \'envelope_classify\', \'envelope_authenticate\',\n    \'marker_read\', \'marker_decode\', \'mutation_generation\', \'mutation_admission\',\n    \'history_admission\', \'account_fence\', \'owner_fence\', \'health_lease\', \'revision_check\',\n    \'age_classify\', \'ui_conversion\', \'unknown\', \'AsyncStorage.getItem\', \'AsyncStorage.setItem\',\n    \'AsyncStorage.removeItem\', \'AsyncStorage.getAllKeys\', \'AsyncStorage.multiGet\',\n    \'AsyncStorage.multiSet\', \'AsyncStorage.multiRemove\', \'SecureStore.isAvailableAsync\',\n    \'SecureStore.getItemAsync\', \'SecureStore.setItemAsync\', \'SecureStore.deleteItemAsync\',\n    \'JSON.parse\', \'JSON.stringify\', \'assertPlanHistoryReadable45\',\n    \'captureHealthPurposePrivateDataWriteLease\', \'assertHealthDataWriteLease\',\n    \'assertHistoryKeysReadable45\', \'assertPrivateMutationWritable46\', \'Promise.all\',\n    \'accountLease.assertCurrent\', \'applyProcessingEpoch\', \'assertBeforeNativeWrite\',\n    \'assertCurrent\', \'assertHealthReadCurrent\', \'assertHistoryBatchShape45\',\n    \'assertMutationCurrent\', \'assertMutationReadCurrent46\', \'assertNoFailedReadRewrite\',\n    \'assertOriginalPreparation46\', \'assertPreparationCurrent\', \'assertPrivateDataKey\',\n    \'clearDependentWithdrawalRecoveryAfterTerminal\', \'clearHealthPurposeLocalDataForFence\',\n    \'hasOrphanedPrivateCiphertext\', \'lease.assertCurrent\', \'maybeRejectConflictChoiceWrite\',\n    \'mutate\', \'operation\', \'owner.localDataOwnerBinding\', \'owner.readLocalDataOwnerProof\',\n    \'pauseForVerification\', \'readHealthDataLifecycle\', \'recordLocalWithdrawalChoice\',\n    \'restoreExactRawAfterAmbiguousMutation\', \'restoreRequiredCleanupMarker\',\n    \'rethrowStaleWorkflow\', \'withOperationTiming\', \'writeLocal\']);\n  const PREDICATES = new Set([\'revision_changed\', \'live_claim_present\', \'failed_claim_present\',\n    \'orphan_marker\', \'marker_invalid\', \'history_marker_invalid\', \'account_changed\',\n    \'account_boundary_active\', \'owner_changed\', \'owner_invalid\', \'health_lease_closed\',\n    \'key_missing\', \'key_invalid\', \'ciphertext_invalid\', \'ciphertext_unsupported\',\n    \'authentication_failed\', \'native_rejected\', \'unclassified\', \'not_applicable\']);\n  const KEY_CATEGORIES = new Set([\'age_receipt\', \'content_key\', \'cleanup_marker\',\n    \'health_lifecycle\', \'health_consent\', \'cloud_preference\', \'history\', \'other_private\',\n    \'foreign\', \'reserved\', \'unclassified\']);\n  const ENVELOPE_KINDS = new Set([\'absent\', \'legacy\', \'current\', \'malformed\', \'unsupported\']);\n  const AGE_STATUSES = new Set([\'current\', \'reverification_required\', \'missing\', \'legacy\',\n    \'invalid\', \'unsupported\', \'policy_mismatch\', \'unavailable\']);\n  const DISPOSITIONS = new Set([\'throw\', \'propagate\', \'caught\', \'ui_conversion\', \'probe\']);\n  const ERROR_CLASSES = new Set([\'Error\', \'TypeError\', \'RangeError\', \'SyntaxError\',\n    \'ReferenceError\', \'URIError\', \'EvalError\', \'AggregateError\', \'AccountGenerationLeaseError\',\n    \'KeyChainException\', \'InvalidKeyException\', \'MissingPlistKeyException\', \'SecAccessControlError\']);\n  // Exact literals from the current first-party files and installed Expo sources.\n  // No prefix, substring, NSError-description or arbitrary-message admission.\n  const CODES = new Set(["CURRENT_HEALTH_CONSENT_REQUIRED", "HEALTH_CONSENT_INVALID", "HEALTH_CONSENT_UNSUPPORTED_VERSION", "HEALTH_CONSENT_MUTATION_SUPERSEDED", \'PRIVATE_KV_CONTENT_KEY_MISSING\', \'PRIVATE_KV_CONTENT_KEY_INVALID\',\n    \'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE\', \'PRIVATE_KV_DECRYPTION_FAILED\',\n    \'PRIVATE_KV_ENVELOPE_INVALID\', \'PRIVATE_KV_ENVELOPE_UNSUPPORTED\',\n    \'PRIVATE_KV_ENVELOPE_FOREIGN\', \'PRIVATE_KV_RESERVED_KEY\', \'PRIVATE_KV_WRITE_CONFLICT\',\n    \'PRIVATE_KV_RECOVERY_REQUIRED\', \'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE\',\n    \'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY\', \'PRIVATE_KV_WRITE_ROLLBACK_FAILED\',\n    \'PRIVATE_KV_SOURCE_UNAUTHENTICATED\', \'PRIVATE_KV_SOURCE_TRANSFORM_INVALID\',\n    \'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED\', \'LOCAL_DATA_HISTORY_RECOVERY_REQUIRED\',\n    \'LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID\', \'LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED\',\n    \'LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED\', \'LOCAL_DATA_OWNER_PROOF_INVALID\',\n    \'LOCAL_DATA_CLEANUP_REQUIRED\', \'LOCAL_DATA_UNCLAIMED_QUARANTINED\',\n    \'LOCAL_DATA_OWNER_MISMATCH\', \'LOCAL_DATA_RETAINED_OWNER_INVALID\',\n    \'LOCAL_DATA_UNCLAIMED_QUARANTINE_INVALID\', \'ACCOUNT_GENERATION_CHANGED\',\n    \'HEALTH_DATA_WRITE_ADMISSION_CLOSED\', \'HEALTH_DATA_WRITE_OWNER_MISMATCH\',\n    \'HEALTH_DATA_LIFECYCLE_OWNER_INVALID\', \'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH\',\n    \'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE\', \'ERR_KEY_CHAIN\', \'ERR_INVALID_KEY\',\n    \'ERR_MISSING_PLIST_KEY\', \'ERR_SEC_ACCESS_CONTROL\']);\n  const MISSING = Symbol(\'missing-data-descriptor\');\n  const errorIds = new WeakMap();\n  const events = [];\n  const failureWindow = [];\n  const onboardingWindow53 = [];\n  let onboardingEvicted53 = 0, denialWindow53 = [], denialEvicted53 = 0;\n  let latestDenial53 = null, latestGrantBegin53 = null, latestGrantPass53 = null, latestGrantPassBegin53 = null;\n  let latestActivationPass53 = null, latestRevalidateBegin53 = null, latestRevalidateOutcome53 = null;\n  let latestConsentResult53 = null, latestProviderStatus53 = null, latestRouteStatus53 = null;\n\n  let failureWindowEvicted = 0;\n  let nextErrorId = 0, nextAttempt = 0, sequence = 0, dropped = 0;\n  let firstFailure = null, firstUIFailure = null;\n  let dirty = false, scheduled = false, writing = false, flushFailures = 0;\n\n  function own(value, key) {\n    if ((typeof value !== \'object\' || value === null) && typeof value !== \'function\') return MISSING;\n    try {\n      const descriptor = Object.getOwnPropertyDescriptor(value, key);\n      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, \'value\')\n        ? descriptor.value : MISSING;\n    } catch { return MISSING; }\n  }\n  function integer(value, maximum = 1000000) {\n    return typeof value === \'number\' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;\n  }\n  function literal(value, allowed) {\n    return typeof value === \'string\' && value.length <= 96 && allowed.has(value) ? value : null;\n  }\n  function knownCode(value) {\n    const exact = literal(value, CODES);\n    if (exact) return { code: exact, count: null };\n    if (typeof value !== \'string\' || value.length > 96) return null;\n    const counted = /^PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED:([12])$/.exec(value);\n    return counted ? { code: \'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED\', count: Number(counted[1]) } : null;\n  }\n  function errorId(value) {\n    if ((typeof value !== \'object\' || value === null) && typeof value !== \'function\') return 0;\n    let id = errorIds.get(value);\n    if (!id && nextErrorId < 1024) { id = ++nextErrorId; errorIds.set(value, id); }\n    return id || 0;\n  }\n  function errorClass(value) {\n    let cursor = value;\n    for (let depth = 0; depth < 4 && cursor !== null; depth += 1) {\n      const name = literal(own(cursor, \'name\'), ERROR_CLASSES);\n      if (name) return name;\n      if ((typeof cursor !== \'object\' || cursor === null) && typeof cursor !== \'function\') break;\n      try { cursor = Object.getPrototypeOf(cursor); } catch { break; }\n    }\n    return \'UNCLASSIFIED\';\n  }\n  function classify(error) {\n    const chain = [], seen = new Set();\n    let value = error, ending = \'not_supplied\';\n    for (let depth = 0; depth < 3; depth += 1) {\n      if (seen.has(value)) { ending = \'cycle\'; break; }\n      seen.add(value);\n      const kind = value === null ? \'null\' : typeof value;\n      const code = knownCode(own(value, \'code\'));\n      const messageCode = knownCode(own(value, \'message\'));\n      const primitiveCode = knownCode(value);\n      const recognized = code || messageCode || primitiveCode;\n      const numericFields = [];\n      for (const key of [\'code\', \'nativeCode\', \'nativeErrorCode\', \'osStatus\', \'errno\']) {\n        const number = own(value, key);\n        if (typeof number === \'number\' && Number.isInteger(number) && number >= -2147483648 && number <= 2147483647)\n          numericFields.push(Object.freeze({ field: key, value: number }));\n      }\n      chain.push(Object.freeze({ errorId: errorId(value), kind, errorClass: errorClass(value),\n        recognizedCode: recognized ? recognized.code : \'UNCLASSIFIED\',\n        recognizedCount: recognized ? recognized.count : null,\n        recognizedCodeField: code ? \'code\' : messageCode ? \'message\' : primitiveCode ? \'primitive\' : \'none\',\n        numericFields: Object.freeze(numericFields),\n        numericQualification: \'SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS\',\n        arbitraryMessageStackAndObjectOmitted: true }));\n      const cause = own(value, \'cause\');\n      if (cause === MISSING) break;\n      if (depth === 2) { ending = \'depth_limit\'; break; }\n      value = cause;\n    }\n    return Object.freeze({ chain: Object.freeze(chain), causeEnding: ending });\n  }\n  function metadata(value) {\n    const output = {};\n    for (const name of ["outerOperation", "mounted", "tokenCurrent", "draftCurrent", "consentCurrent", "consentPresent", "grantCurrent", "versionCurrent", "disclosureCurrent", "atCurrentDenial", "grantRequested", "activeState", "activationPending", "privacyReady", "privacyChecking", "privacyDenied", "healthOwnerCurrent", "healthGenerationEqual", "healthEpochEqual", "healthAccountGenerationEqual", "originalCapabilityCurrent", "providerReadyState", "hasDraft", "routeTokenCurrent", "routeReady", "hasRouteLease", "hasNavigation", \'revisionChanged\', \'accountBoundaryActive\', \'accountGenerationChanged\',\n      \'revisionEqual\', \'accountGenerationEqual\', \'boundaryBlocked\',\n      \'ownerCurrent\', \'leaseCurrent\', \'keyPresent\', \'rawPresent\', \'markerPresent\']) {\n      const item = own(value, name); if (typeof item === \'boolean\') output[name] = item;\n    }\n    for (const name of [\'liveClaimsCount\', \'failedClaimsCount\', \'liveClaims\', \'failedClaims\',\n      \'keyCount\', \'encryptedCount\']) {\n      const item = own(value, name); if (integer(item, 65535)) output[name] = item;\n    }\n    const parent = own(value, \'parentAttempt\');\n    if (integer(parent)) output.parentAttempt = parent;\n    for (const [name, allowed] of [[\'keyCategory\', KEY_CATEGORIES], [\'envelopeKind\', ENVELOPE_KINDS],\n      [\'ageStatus\', AGE_STATUSES],\n      [\'stage\', STAGES], [\'predicate\', PREDICATES], [\'disposition\', DISPOSITIONS]]) {\n      const item = literal(own(value, name), allowed); if (item) output[name] = item;\n    }\n    return Object.freeze(output);\n  }\n  async function flush() {\n    scheduled = false;\n    if (writing || !dirty) return;\n    writing = true; dirty = false;\n    try {\n      if (!/^[a-f0-9]{40}$/.test(SOURCE_HEAD) || typeof FS.documentDirectory !== \'string\') throw 0;\n      const identityPath = FS.documentDirectory + IDENTITY_FILE;\n      const info = await FS.getInfoAsync(identityPath);\n      if (!info.exists || info.isDirectory || !integer(info.size, 1024)) throw 0;\n      const identity = JSON.parse(await FS.readAsStringAsync(identityPath));\n      if (own(identity, \'schema\') !== 1 || own(identity, \'sourceHead\') !== SOURCE_HEAD ||\n          own(identity, \'bundle\') !== \'com.layerwell.app.staging\' ||\n          !integer(own(identity, \'pid\'), 2147483647) || own(identity, \'pid\') < 1) throw 0;\n      const payload = { schema: 1, role: \'STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY\',\n        diagnosticMarker: \'C47_STORAGE_ORIGIN_DIAGNOSTIC_05\',\n        sourceHead: SOURCE_HEAD, pid: own(identity, \'pid\'),\n        bundle: \'com.layerwell.app.staging\', eventLimit: 512,\n        events: events.slice(), firstFailure, firstUIFailure,\n        traceFormatVersion: 2, failureWindowLimit: 64, failureWindow: failureWindow.slice(),\n        onboarding53: { profile: \'ONBOARDING_DENIAL_ORIGIN53_ONLY\', windowLimit: 64,\n          window: onboardingWindow53.slice(), evicted: onboardingEvicted53,\n          latestDenial: latestDenial53, denialWindow: denialWindow53.slice(), denialWindowEvicted: denialEvicted53,\n          latestGrantBegin: latestGrantBegin53, latestGrantPass: latestGrantPass53, latestGrantPassBegin: latestGrantPassBegin53,\n          latestActivationPass: latestActivationPass53, latestRevalidateBegin: latestRevalidateBegin53,\n          latestRevalidateOutcome: latestRevalidateOutcome53, latestConsentResult: latestConsentResult53,\n          latestProviderStatus: latestProviderStatus53, latestRouteStatus: latestRouteStatus53 },\n        failureWindowEvicted, failureWindowFrozenAtFirstUI: firstUIFailure !== null,\n        firstFailureQualification: \'FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION\',\n        droppedEvents: dropped, flushFailures, errorIdentityLimit: 1024,\n        ordinaryAdmitted: false, acceptanceGranted: false, release: \'NO_GO\' };\n      await FS.writeAsStringAsync(FS.documentDirectory + \'C47StorageOrigin05-\' + payload.pid + \'.json\', JSON.stringify(payload));\n    } catch { flushFailures = Math.min(flushFailures + 1, 65535); }\n    finally { writing = false; if (dirty) schedule(); }\n  }\n  function schedule() {\n    dirty = true;\n    if (!scheduled && !writing) { scheduled = true; setTimeout(flush, 0); }\n  }\n  globalThis.__C47_STORAGE_ORIGIN05__ = function observe(input) {\n    let attempt = 0;\n    try {\n      const supplied = own(input, \'attempt\'); if (integer(supplied)) attempt = supplied;\n      const site = literal(own(input, \'site\'), SITES);\n      const operation = literal(own(input, \'operation\'), OPERATIONS);\n      const phase = literal(own(input, \'phase\'), PHASES);\n      if (!site || !operation || !phase || sequence === Number.MAX_SAFE_INTEGER) {\n        dropped = Math.min(dropped + 1, 2147483647); return attempt;\n      }\n      if (phase === \'begin\' && attempt === 0 && nextAttempt < 1000000) attempt = ++nextAttempt;\n      const meta = metadata(own(input, \'meta\'));\n      const line = own(input, \'sourceLine\');\n      const stage = literal(own(input, \'stage\'), STAGES);\n      const disposition = literal(own(input, \'disposition\'), DISPOSITIONS);\n      const failure = phase === \'failure\' || phase === \'caught\';\n      const record = { sequence: ++sequence, site, operation, phase, attempt, meta };\n      if (integer(line) && line > 0) record.sourceLine = line;\n      if (stage) record.stage = stage;\n      if (disposition) record.disposition = disposition;\n      if (failure) record.error = classify(own(input, \'error\'));\n      Object.freeze(record);\n      // Independent finite current-denial channel: pre-grant denials never freeze later observations.\n      if (site === \'consent-store\' && operation === \'setHealthDataCollectionConsentLocal\' && meta.outerOperation === true && meta.grantRequested === true) {\n        if (phase === \'begin\') latestGrantBegin53 = record;\n        if (phase === \'pass\') { latestGrantPass53 = record; latestGrantPassBegin53 = latestGrantBegin53?.attempt === record.attempt ? latestGrantBegin53 : null; }\n      }\n      if (site === \'lifecycle\' && operation === \'completeHealthDataActivationRoute\' && phase === \'pass\' &&\n          stage === \'activation_complete\' && meta.activeState === true && meta.activationPending === false)\n        latestActivationPass53 = record;\n      if (site === \'onboarding\' && operation === \'revalidate\' && phase === \'begin\' && meta.outerOperation === true)\n        latestRevalidateBegin53 = record;\n      if (site === \'onboarding\' && operation === \'revalidate\' && phase === \'state\' && stage === \'admitted\')\n        latestRevalidateOutcome53 = record;\n      if (site === \'consent-store\' && phase === \'state\' && stage === \'consent_predicate\') latestConsentResult53 = record;\n      if (site === \'onboarding\' && operation === \'privacyStatus\' && phase === \'state\') {\n        if (stage === \'provider_status\') latestProviderStatus53 = record;\n        if (stage === \'route_status\') latestRouteStatus53 = record;\n      }\n      const actualFalse53 = phase === \'state\' && meta.consentCurrent === false &&\n        ((site === \'onboarding\' && operation === \'revalidate\' && stage === \'consent_false\') ||\n         (site === \'consent-store\' && stage === \'consent_predicate\'));\n      if (failure || actualFalse53) {\n        if (onboardingWindow53.length === 64) {\n          onboardingWindow53.shift(); onboardingEvicted53 = Math.min(onboardingEvicted53 + 1, 2147483647);\n        }\n        onboardingWindow53.push(record);\n      }\n      if (site === \'onboarding\' && operation === \'revalidate\' && phase === \'caught\' &&\n          disposition === \'ui_conversion\' && meta.atCurrentDenial === true) {\n        latestDenial53 = record; latestRevalidateOutcome53 = record;\n        denialWindow53 = onboardingWindow53.slice(); denialEvicted53 = onboardingEvicted53;\n      }\n\n      if (failure && firstFailure === null) firstFailure = record;\n      // Bounded error history freezes with the original first UI conversion.\n      // Routine event overflow must not erase a later propagated rejection.\n      if (failure && firstUIFailure === null) {\n        if (failureWindow.length === 64) {\n          failureWindow.shift();\n          failureWindowEvicted = Math.min(failureWindowEvicted + 1, 2147483647);\n        }\n        failureWindow.push(record);\n      }\n      if (failure && (disposition === \'ui_conversion\' || meta.disposition === \'ui_conversion\') && firstUIFailure === null)\n        firstUIFailure = record;\n      // Reserve the last slot until the first observed failure; never evict it.\n      const limit = firstFailure === null ? 511 : 512;\n      if (events.length < limit) events.push(record);\n      else dropped = Math.min(dropped + 1, 2147483647);\n      schedule();\n    } catch { /* Reflection/proxy/observer failure must not escape into authority. */ }\n    return attempt;\n  };\n})(); } catch { /* Diagnostic setup failure cannot prevent the original router mount. */ }\nrequire(\'expo-router/entry\');\n'

@contextmanager
def diagnostic_inputs(root, ios, evidence, head, run, *, targeted_onboarding53=False):
    """Generate separate afterimages, snapshot all inputs, then restore exactly.

    The compiler command is recorded by the existing Runner, not hidden in a
    subprocess. No new authority await/call, storage operation or key is added.
    """
    import os
    import stat
    root, ios, evidence = Path(root), Path(ios), Path(evidence)
    need(re.fullmatch('[a-f0-9]{40}', head), 'SOURCE_HEAD')
    need(not evidence.exists(), 'NEW_DIAGNOSTIC_EVIDENCE')
    evidence.mkdir(parents=True)
    originals = {}
    expected_preimages = ONBOARDING53_SOURCE_PREIMAGES if targeted_onboarding53 else SOURCE_PREIMAGES
    for relative, expected in expected_preimages.items():
        path = root / relative
        need(path.is_file() and not path.is_symlink(), 'REGULAR_SOURCE')
        raw = path.read_bytes()
        need(digest(raw) == expected, 'EXACT_SOURCE_PREIMAGE:' + relative)
        originals[relative] = raw
    delegate = ios / 'LayerwellStaging/AppDelegate.swift'
    delegate_original = delegate.read_bytes()
    anchor = b'    let delegate = ReactNativeDelegate()'
    need(delegate_original.count(anchor) == 1 and MARKER.encode() not in delegate_original,
         'EXACT_DELEGATE_ANCHOR')
    entry = root / 'apps/mobile/.expo/C47StorageOrigin05.js'
    need(not entry.exists() and not entry.is_symlink(), 'NO_EXISTING_DIAGNOSTIC_ENTRY')
    entry_template = ENTRY_TEMPLATE53 if targeted_onboarding53 else ENTRY_TEMPLATE
    entry_raw = entry_template.replace('__C47_SOURCE_HEAD05__', head).encode('utf8')
    need(entry_raw.count(head.encode()) == 1 and MARKER.encode() in entry_raw,
         'DIAGNOSTIC_ENTRY_SOURCE_BINDING')
    delegate_generated = delegate_original.replace(anchor,
        SWIFT_HOOK.replace('HEAD05', head).encode('utf8') + anchor)
    request = evidence / 'REQUEST.json'
    manifest = evidence / 'TRANSFORMED_SOURCES.json'
    generated = evidence / 'generated'
    request_value = {'root':str(root), 'output':str(generated), 'manifest':str(manifest),
        'source_head':head, 'expected':expected_preimages}
    if targeted_onboarding53: request_value['profile'] = 'ONBOARDING53_CURRENT105'
    document(request, request_value)
    run('storage05-transform', ['node', root / 'scripts/release/full-app-j01/storage_origin47.mjs', request], timeout=60)
    value = json.loads(manifest.read_bytes())
    rows = value.get('files')
    need(isinstance(rows, list) and len(rows) == len(originals) and
         {row.get('path') for row in rows} == set(originals), 'EXACT_TRANSFORM_INVENTORY')
    afterimages = {}
    snapshot = evidence / 'original'
    snapshot.mkdir()
    for row in rows:
        relative = row['path']
        raw = (generated / relative).read_bytes()
        before = originals[relative]
        need(row['before'] == {'bytes':len(before), 'sha256':digest(before)} and
             row['after'] == {'bytes':len(raw), 'sha256':digest(raw)}, 'TRANSFORM_BYTE_BINDING')
        afterimages[relative] = raw
        saved = snapshot / relative
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_bytes(before)
        patch = ''.join(difflib.unified_diff(before.decode('utf8').splitlines(keepends=True),
            raw.decode('utf8').splitlines(keepends=True), fromfile='original/' + relative,
            tofile='diagnostic/' + relative)).encode('utf8')
        (evidence / (relative.replace('/', '__') + '.diff')).write_bytes(patch)
    (evidence / 'AppDelegate.original.swift').write_bytes(delegate_original)
    (evidence / 'AppDelegate.diagnostic.swift').write_bytes(delegate_generated)
    (evidence / 'diagnostic-entry.js').write_bytes(entry_raw)
    document(evidence / 'TRANSFORM.json', {'authorization':AUTH, 'source_head':head,
        'marker':MARKER, 'source_inputs':rows, 'compiler_manifest_sha256':digest(manifest.read_bytes()),
        'delegate_original_sha256':digest(delegate_original),
        'delegate_generated_sha256':digest(delegate_generated), 'entry_sha256':digest(entry_raw),
        'scope':'FINITE_DIAGNOSTIC_ONLY_SYNCHRONOUS_OBSERVER; ORIGINAL_ERROR_VALUES_RETHROWN',
        'ordinary_admitted':False, 'internal_admitted':False,
        'no_new_authority_await_or_storage_operation':True,
        **({'targeted_onboarding53':True} if targeted_onboarding53 else {})})
    # These guards precede restoration ownership: rejected foreign changes are
    # never replaced by an original snapshot that this context did not write.
    for relative, raw in originals.items():
        need((root / relative).read_bytes() == raw, 'SOURCE_CHANGED_BEFORE_TRANSFORM')
    need(delegate.read_bytes() == delegate_original, 'DELEGATE_CHANGED_BEFORE_TRANSFORM')
    mutated = set()
    delegate_attempted = False
    entry_identity = None
    cleaned_owned_entry = False
    primary_error = None
    try:
        entry.parent.mkdir(exist_ok=True)
        with entry.open('xb') as stream:
            owned = os.fstat(stream.fileno())
            need(stat.S_ISREG(owned.st_mode), 'REGULAR_CREATED_ENTRY')
            entry_identity = (owned.st_dev, owned.st_ino)
            need(stream.write(entry_raw) == len(entry_raw), 'COMPLETE_ENTRY_WRITE')
        for relative, raw in afterimages.items():
            target = root / relative
            need(target.read_bytes() == originals[relative], 'SOURCE_CHANGED_BEFORE_WRITE')
            mutated.add(relative)
            target.write_bytes(raw)
        need(delegate.read_bytes() == delegate_original, 'DELEGATE_CHANGED_BEFORE_WRITE')
        delegate_attempted = True
        delegate.write_bytes(delegate_generated)
        yield entry
    except BaseException as error:
        primary_error = error
        raise
    finally:
        failures = []
        for relative, raw in originals.items():
            try:
                if relative in mutated:
                    (root / relative).write_bytes(raw)
                need((root / relative).read_bytes() == raw, 'RESTORE_SOURCE_BYTES')
            except Exception:
                failures.append(relative)
        try:
            if delegate_attempted:
                delegate.write_bytes(delegate_original)
            need(delegate.read_bytes() == delegate_original, 'RESTORE_DELEGATE_BYTES')
        except Exception:
            failures.append('AppDelegate.swift')
        if entry_identity is not None:
            try:
                observed = entry.lstat()
                need(stat.S_ISREG(observed.st_mode) and
                     (observed.st_dev, observed.st_ino) == entry_identity, 'GENERATED_ENTRY_OWNERSHIP_CHANGED')
                with entry.open('rb') as stream:
                    observed = os.fstat(stream.fileno())
                    need(stat.S_ISREG(observed.st_mode) and
                         (observed.st_dev, observed.st_ino) == entry_identity, 'GENERATED_ENTRY_OWNERSHIP_CHANGED')
                    current = stream.read(len(entry_raw) + 1)
                need(entry_raw.startswith(current), 'GENERATED_ENTRY_CHANGED')
                observed = entry.lstat()
                need(stat.S_ISREG(observed.st_mode) and
                     (observed.st_dev, observed.st_ino) == entry_identity, 'GENERATED_ENTRY_OWNERSHIP_CHANGED')
                entry.unlink()
                cleaned_owned_entry = True
            except Exception:
                failures.append('GENERATED_ENTRY')
        entry_absent = not entry.exists() and not entry.is_symlink()
        if not entry_absent and 'GENERATED_ENTRY' not in failures:
            failures.append('GENERATED_ENTRY')
        exact_restore = not failures and entry_absent
        document(evidence / 'RESTORED.json', {'source_head':head,
            'exact_restore':exact_restore, 'restored_sources':len(mutated),
            'entry_absent':entry_absent, 'restore_failures':failures,
            'entry_owned_created':entry_identity is not None,
            'entry_cleaned_owned':cleaned_owned_entry, 'delegate_attempted':delegate_attempted,
            'ordinary_rebuild_not_yet_proven':True, 'ordinary_admitted':False,
            'internal_admitted':False, 'release':'NO_GO'})
        if primary_error is None:
            need(exact_restore, 'EXACT_DIAGNOSTIC_RESTORATION_FAILED')

"""Finite C05 diagnostic byte validator and UI-linked origin qualifier; no I/O or runtime admission."""
import json
import re

ENTRY_SOURCE_SHA25605 = '72a7eee2604e740ce1a027fde97cee9832dff1efe51dac2d3bf030128f6fd1a8'
ENUMS05 = {
    'SITES': frozenset(['account-generation', 'age-gate', 'age-store', 'availability', 'cloud-preference', 'content-key', 'lifecycle', 'mutation', 'owner-proof', 'private-kv']),
    'OPERATIONS': frozenset(['abandonPrivateMutation46', 'armPrivateMutation46', 'assertAccountGenerationLease', 'assertAccountIdentityGeneration', 'assertAccountScopedPrivateOperationAllowed', 'assertLocalDataOwnership', 'assertOwnerWorkflowFence', 'assertPlanHistoryReadable45', 'assertPrivateKVReadable', 'assertPrivateMutationReadGeneration46', 'assertPrivateMutationReadable46', 'assertPrivateMutationWritable46', 'assertPrivateReadAllowed', 'captureOwnerWorkflowFence', 'check', 'claimLocalDataOwnership', 'classifyAgePolicyReceipt', 'classifyEnvelope', 'clearPrivateMutationAfterRemoval46', 'clearStoredPrivateKVContentKey', 'clearUnavailableCloudBackupPreference', 'commitPrivateMutation46', 'decodeHistoryIntentMarker45', 'decodePrivateMutationMarker46', 'decryptEnvelope', 'finishPrivateMutation46', 'getAgePolicyReceiptStatus', 'getCloudBackupEnabled', 'getExistingContentKey', 'getOrCreateContentKey', 'getPrivateItem', 'getStoredPrivateKVContentKey', 'invalidPrivateMutation46', 'livePrivateMutationMarker46', 'localDataOwnerBinding', 'privateMutationReadGuard46', 'readActiveReceipt', 'readLocal', 'readLocalDataOwnerProof', 'readLocalDataOwnership', 'readPrivateItems', 'reconcileHealthDataLifecycle', 'reconcileUnconfigured', 'removePrivateItem', 'runAccountGenerationOperation', 'runAccountScopedPrivateOperation', 'runOwnerBoundLocalOperation', 'setAgeVerified', 'setCloudBackupEnabled', 'setPrivateItem', 'setStoredPrivateKVContentKey', 'storageUnavailable', 'updatePrivateItemWithGuard', 'validateEnvelopeAuthentication', 'validatePrivateItemsWithoutRetainingPlaintext', 'verifyPrivateStorage', 'waitForPrivateMutationReadWindow46']),
    'PHASES': frozenset(['begin', 'caught', 'failure', 'pass', 'state']),
    'STAGES': frozenset(['AsyncStorage.getAllKeys', 'AsyncStorage.getItem', 'AsyncStorage.multiGet', 'AsyncStorage.multiRemove', 'AsyncStorage.multiSet', 'AsyncStorage.removeItem', 'AsyncStorage.setItem', 'JSON.parse', 'JSON.stringify', 'Promise.all', 'SecureStore.deleteItemAsync', 'SecureStore.getItemAsync', 'SecureStore.isAvailableAsync', 'SecureStore.setItemAsync', 'abandonPrivateMutation46', 'accountLease.assertCurrent', 'account_fence', 'age_classify', 'applyProcessingEpoch', 'armPrivateMutation46', 'assertAccountGenerationLease', 'assertAccountIdentityGeneration', 'assertAccountScopedPrivateOperationAllowed', 'assertBeforeNativeWrite', 'assertCurrent', 'assertHealthDataWriteLease', 'assertHealthReadCurrent', 'assertHistoryBatchShape45', 'assertHistoryKeysReadable45', 'assertLocalDataOwnership', 'assertMutationCurrent', 'assertMutationReadCurrent46', 'assertNoFailedReadRewrite', 'assertOriginalPreparation46', 'assertOwnerWorkflowFence', 'assertPlanHistoryReadable45', 'assertPreparationCurrent', 'assertPrivateDataKey', 'assertPrivateKVReadable', 'assertPrivateMutationReadGeneration46', 'assertPrivateMutationReadable46', 'assertPrivateMutationWritable46', 'assertPrivateReadAllowed', 'captureHealthPurposePrivateDataWriteLease', 'captureOwnerWorkflowFence', 'check', 'claimLocalDataOwnership', 'classifyAgePolicyReceipt', 'classifyEnvelope', 'clearDependentWithdrawalRecoveryAfterTerminal', 'clearHealthPurposeLocalDataForFence', 'clearPrivateMutationAfterRemoval46', 'clearStoredPrivateKVContentKey', 'clearUnavailableCloudBackupPreference', 'commitPrivateMutation46', 'content_key', 'decodeHistoryIntentMarker45', 'decodePrivateMutationMarker46', 'decryptEnvelope', 'entry', 'envelope_authenticate', 'envelope_classify', 'finishPrivateMutation46', 'getAgePolicyReceiptStatus', 'getCloudBackupEnabled', 'getExistingContentKey', 'getOrCreateContentKey', 'getPrivateItem', 'getStoredPrivateKVContentKey', 'hasOrphanedPrivateCiphertext', 'health_lease', 'history_admission', 'invalidPrivateMutation46', 'lease.assertCurrent', 'livePrivateMutationMarker46', 'localDataOwnerBinding', 'marker_decode', 'marker_read', 'maybeRejectConflictChoiceWrite', 'mutate', 'mutation_admission', 'mutation_generation', 'native_availability', 'native_read', 'native_remove', 'native_write', 'operation', 'owner.localDataOwnerBinding', 'owner.readLocalDataOwnerProof', 'owner_fence', 'pauseForVerification', 'privateMutationReadGuard46', 'readActiveReceipt', 'readHealthDataLifecycle', 'readLocal', 'readLocalDataOwnerProof', 'readLocalDataOwnership', 'readPrivateItems', 'reconcileHealthDataLifecycle', 'reconcileUnconfigured', 'recordLocalWithdrawalChoice', 'removePrivateItem', 'restoreExactRawAfterAmbiguousMutation', 'restoreRequiredCleanupMarker', 'rethrowStaleWorkflow', 'revision_check', 'runAccountGenerationOperation', 'runAccountScopedPrivateOperation', 'runOwnerBoundLocalOperation', 'setAgeVerified', 'setCloudBackupEnabled', 'setPrivateItem', 'setStoredPrivateKVContentKey', 'storageUnavailable', 'ui_conversion', 'unknown', 'updatePrivateItemWithGuard', 'validateEnvelopeAuthentication', 'validatePrivateItemsWithoutRetainingPlaintext', 'verifyPrivateStorage', 'waitForPrivateMutationReadWindow46', 'withOperationTiming', 'writeLocal']),
    'PREDICATES': frozenset(['account_boundary_active', 'account_changed', 'authentication_failed', 'ciphertext_invalid', 'ciphertext_unsupported', 'failed_claim_present', 'health_lease_closed', 'history_marker_invalid', 'key_invalid', 'key_missing', 'live_claim_present', 'marker_invalid', 'native_rejected', 'not_applicable', 'orphan_marker', 'owner_changed', 'owner_invalid', 'revision_changed', 'unclassified']),
    'KEY_CATEGORIES': frozenset(['age_receipt', 'cleanup_marker', 'cloud_preference', 'content_key', 'foreign', 'health_consent', 'health_lifecycle', 'history', 'other_private', 'reserved', 'unclassified']),
    'ENVELOPE_KINDS': frozenset(['absent', 'current', 'legacy', 'malformed', 'unsupported']),
    'AGE_STATUSES': frozenset(['current', 'invalid', 'legacy', 'missing', 'policy_mismatch', 'reverification_required', 'unavailable', 'unsupported']),
    'DISPOSITIONS': frozenset(['caught', 'probe', 'propagate', 'throw', 'ui_conversion']),
    'ERROR_CLASSES': frozenset(['AccountGenerationLeaseError', 'AggregateError', 'Error', 'EvalError', 'InvalidKeyException', 'KeyChainException', 'MissingPlistKeyException', 'RangeError', 'ReferenceError', 'SecAccessControlError', 'SyntaxError', 'TypeError', 'URIError']),
    'CODES': frozenset(['ACCOUNT_GENERATION_CHANGED', 'ERR_INVALID_KEY', 'ERR_KEY_CHAIN', 'ERR_MISSING_PLIST_KEY', 'ERR_SEC_ACCESS_CONTROL', 'HEALTH_DATA_LIFECYCLE_LOCAL_OWNER_UNAVAILABLE', 'HEALTH_DATA_LIFECYCLE_OWNER_INVALID', 'HEALTH_DATA_LIFECYCLE_OWNER_MISMATCH', 'HEALTH_DATA_WRITE_ADMISSION_CLOSED', 'HEALTH_DATA_WRITE_OWNER_MISMATCH', 'LOCAL_DATA_CLEANUP_MARKER_RESTORE_FAILED', 'LOCAL_DATA_CLEANUP_MARKER_SCOPE_INVALID', 'LOCAL_DATA_CLEANUP_MARKER_UNCONFIRMED', 'LOCAL_DATA_CLEANUP_REQUIRED', 'LOCAL_DATA_HISTORY_RECOVERY_REQUIRED', 'LOCAL_DATA_OWNER_MISMATCH', 'LOCAL_DATA_OWNER_PROOF_INVALID', 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED', 'LOCAL_DATA_RETAINED_OWNER_INVALID', 'LOCAL_DATA_UNCLAIMED_QUARANTINED', 'LOCAL_DATA_UNCLAIMED_QUARANTINE_INVALID', 'PRIVATE_KV_CONTENT_KEY_INVALID', 'PRIVATE_KV_CONTENT_KEY_MISSING', 'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE', 'PRIVATE_KV_DECRYPTION_FAILED', 'PRIVATE_KV_ENVELOPE_FOREIGN', 'PRIVATE_KV_ENVELOPE_INVALID', 'PRIVATE_KV_ENVELOPE_UNSUPPORTED', 'PRIVATE_KV_RECOVERY_REQUIRED', 'PRIVATE_KV_RESERVED_KEY', 'PRIVATE_KV_SOURCE_TRANSFORM_INVALID', 'PRIVATE_KV_SOURCE_UNAUTHENTICATED', 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY', 'PRIVATE_KV_WRITE_BLOCKED_AFTER_READ_FAILURE', 'PRIVATE_KV_WRITE_CONFLICT', 'PRIVATE_KV_WRITE_ROLLBACK_FAILED']),
}

def require05(value, code):
    if not value:
        raise ValueError('C47_STORAGE_ORIGIN05_' + code)


def validate_trace05(raw, head, bundle, pid):
    """Validate content-free diagnostic bytes only; no ordinary/runtime admission."""
    error_snapshots = {}
    def pairs(rows):
        result = {}
        for key, value in rows:
            require05(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    def number(text):
        require05(len(text) <= 17, 'NUMBER_BOUND')
        return int(text)
    def reject_number(_text):
        raise ValueError('C47_STORAGE_ORIGIN05_NONINTEGER_JSON_NUMBER')
    def closed(value, required, optional=()):
        require05(type(value) is dict and set(required) <= set(value) <= set(required) | set(optional), 'CLOSED_SCHEMA')
    def integer(value, low=0, high=1000000):
        return type(value) is int and low <= value <= high
    def member(value, name):
        return type(value) is str and value in ENUMS05[name]
    def error(value):
        closed(value, ('chain', 'causeEnding'))
        chain = value['chain']
        require05(type(chain) is list and 1 <= len(chain) <= 3 and value['causeEnding'] in ('not_supplied', 'cycle', 'depth_limit'), 'CAUSE_BOUND')
        require05(value['causeEnding'] != 'depth_limit' or len(chain) == 3, 'CAUSE_DEPTH')
        ids = []
        for node in chain:
            closed(node, ('errorId', 'kind', 'errorClass', 'recognizedCode', 'recognizedCount', 'recognizedCodeField', 'numericFields', 'numericQualification', 'arbitraryMessageStackAndObjectOmitted'))
            require05(integer(node['errorId'], 0, 1024) and node['kind'] in ('undefined', 'null', 'boolean', 'number', 'bigint', 'string', 'symbol', 'object', 'function'), 'ERROR_KIND_ID')
            require05(member(node['errorClass'], 'ERROR_CLASSES') or node['errorClass'] == 'UNCLASSIFIED', 'ERROR_CLASS')
            code = node['recognizedCode']
            require05(member(code, 'CODES') or code in ('UNCLASSIFIED', 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED'), 'ERROR_CODE')
            require05(node['recognizedCodeField'] in ('none', 'primitive', 'code', 'message') and ((code == 'UNCLASSIFIED') == (node['recognizedCodeField'] == 'none')), 'ERROR_CODE_FIELD')
            require05((integer(node['recognizedCount'], 1, 2) if code == 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED' else node['recognizedCount'] is None), 'CODE_COUNT')
            require05(node['arbitraryMessageStackAndObjectOmitted'] is True and node['numericQualification'] == 'SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS', 'ERROR_PRIVACY')
            fields = node['numericFields']
            require05(type(fields) is list and len(fields) <= 5, 'NUMERIC_BOUND')
            names = set()
            for field in fields:
                closed(field, ('field', 'value'))
                require05(field['field'] in ('code', 'nativeCode', 'nativeErrorCode', 'osStatus', 'errno') and field['field'] not in names and integer(field['value'], -2147483648, 2147483647), 'NUMERIC_FIELD')
                names.add(field['field'])
            if node['kind'] not in ('object', 'function'):
                require05(node['errorId'] == 0 and not fields and node['errorClass'] == 'UNCLASSIFIED' and node['recognizedCodeField'] in ('none', 'primitive'), 'PRIMITIVE_ERROR')
            if node['errorId']:
                require05(node['errorId'] not in ids, 'CAUSE_ID_CYCLE')
                require05(error_snapshots.setdefault(node['errorId'], node) == node, 'ERROR_ID_CLASSIFICATION_CHANGED')
                ids.append(node['errorId'])
    bools = {'revisionChanged', 'accountBoundaryActive', 'accountGenerationChanged', 'revisionEqual', 'accountGenerationEqual', 'boundaryBlocked', 'ownerCurrent', 'leaseCurrent', 'keyPresent', 'rawPresent', 'markerPresent'}
    counts = {'liveClaimsCount', 'failedClaimsCount', 'liveClaims', 'failedClaims', 'keyCount', 'encryptedCount'}
    meta_enums = {'keyCategory': 'KEY_CATEGORIES', 'envelopeKind': 'ENVELOPE_KINDS', 'ageStatus': 'AGE_STATUSES', 'stage': 'STAGES', 'predicate': 'PREDICATES', 'disposition': 'DISPOSITIONS'}
    def record(value):
        closed(value, ('sequence', 'site', 'operation', 'phase', 'attempt', 'meta'), ('sourceLine', 'stage', 'disposition', 'error'))
        require05(integer(value['sequence'], 1, 9007199254740991) and integer(value['attempt']) and member(value['site'], 'SITES') and member(value['operation'], 'OPERATIONS') and member(value['phase'], 'PHASES'), 'RECORD_ENUM_ID')
        require05(('error' in value) == (value['phase'] in ('failure', 'caught')), 'ERROR_PHASE')
        for key, enum in [('stage', 'STAGES'), ('disposition', 'DISPOSITIONS')]:
            if key in value: require05(member(value[key], enum), 'RECORD_OPTIONAL_ENUM')
        if 'sourceLine' in value: require05(integer(value['sourceLine'], 1), 'SOURCE_LINE')
        meta = value['meta']; closed(meta, (), bools | counts | set(meta_enums) | {'parentAttempt'})
        for key, item in meta.items():
            require05(type(item) is bool if key in bools else integer(item, 0, 65535) if key in counts else integer(item) if key == 'parentAttempt' else member(item, meta_enums[key]), 'META_TYPE_ENUM')
        if 'error' in value: error(value['error'])
    require05(type(raw) is bytes and 0 < len(raw) <= 2 * 1024 * 1024, 'RAW_BOUND')
    require05(type(head) is str and re.fullmatch('[a-f0-9]{40}', head) and bundle == 'com.layerwell.app.staging' and integer(pid, 1, 2147483647), 'EXPECTED_IDENTITY')
    try: result = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_int=number, parse_float=reject_number, parse_constant=reject_number)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError): raise ValueError('C47_STORAGE_ORIGIN05_JSON_FORMAT') from None
    closed(result, ('schema', 'role', 'diagnosticMarker', 'sourceHead', 'pid', 'bundle', 'eventLimit', 'events', 'firstFailure', 'firstUIFailure', 'firstFailureQualification', 'droppedEvents', 'flushFailures', 'errorIdentityLimit', 'ordinaryAdmitted', 'acceptanceGranted', 'release', 'traceFormatVersion', 'failureWindowLimit', 'failureWindow', 'failureWindowEvicted', 'failureWindowFrozenAtFirstUI'))
    require05(type(result['schema']) is int and result['schema'] == 1 and result['sourceHead'] == head and type(result['pid']) is int and result['pid'] == pid and result['bundle'] == bundle, 'IDENTITY')
    require05(result['role'] == 'STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY' and result['diagnosticMarker'] == 'C47_STORAGE_ORIGIN_DIAGNOSTIC_05' and type(result['eventLimit']) is int and result['eventLimit'] == 512 and type(result['errorIdentityLimit']) is int and result['errorIdentityLimit'] == 1024 and result['ordinaryAdmitted'] is False and result['acceptanceGranted'] is False and result['release'] == 'NO_GO', 'DIAGNOSTIC_ONLY')
    require05(result['firstFailureQualification'] == 'FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION' and integer(result['droppedEvents'], 0, 2147483647) and integer(result['flushFailures'], 0, 65535), 'COUNTERS_QUALIFICATION')
    events = result['events']; require05(type(events) is list and len(events) <= 512, 'EVENT_BOUND')
    for event in events: record(event)
    sequences = [event['sequence'] for event in events]
    require05(sequences == sorted(set(sequences)), 'MONOTONIC_SEQUENCE')
    if result['droppedEvents'] == 0: require05(sequences == list(range(1, len(events) + 1)), 'COMPLETE_SEQUENCE')
    failures = [event for event in events if 'error' in event]
    first = result['firstFailure']; ui = result['firstUIFailure']
    ui_events = [event for event in failures if (event.get('disposition') or event['meta'].get('disposition')) == 'ui_conversion']
    require05((first is None) == (not failures), 'FIRST_FAILURE_PRESENCE')
    if first is not None: record(first); require05(first == failures[0], 'FIRST_FAILURE_IMMUTABLE')
    if ui is not None:
        record(ui); require05('error' in ui and (ui.get('disposition') or ui['meta'].get('disposition')) == 'ui_conversion' and first is not None and ui['sequence'] >= first['sequence'], 'FIRST_UI_FAILURE')
        same = [event for event in events if event['sequence'] == ui['sequence']]
        require05(same == [ui] if same else result['droppedEvents'] > 0, 'UI_IMMUTABLE_OR_DECLARED_DROP')
        if ui_events: require05(ui == ui_events[0], 'FIRST_UI_IMMUTABLE')
    else: require05(not ui_events, 'FIRST_UI_PRESENCE')
    require05(type(result['traceFormatVersion']) is int and result['traceFormatVersion'] == 2 and type(result['failureWindowLimit']) is int and result['failureWindowLimit'] == 64, 'FAILURE_WINDOW_VERSION')
    window = result['failureWindow']; evicted = result['failureWindowEvicted']
    require05(type(window) is list and len(window) <= 64 and integer(evicted, 0, 2147483647) and type(result['failureWindowFrozenAtFirstUI']) is bool, 'FAILURE_WINDOW_BOUND')
    for event in window:
        record(event)
        require05('error' in event, 'FAILURE_WINDOW_ERROR_ONLY')
    window_sequences = [event['sequence'] for event in window]
    require05(window_sequences == sorted(set(window_sequences)), 'FAILURE_WINDOW_SEQUENCE')
    require05(max(sequences + window_sequences + [0]) <= len(events) + result['droppedEvents'], 'OBSERVED_SEQUENCE_COUNTER')
    require05((first is None) == (not window) and (not evicted or len(window) == 64), 'FAILURE_WINDOW_PRESENCE')
    require05(not window or len(window) + evicted <= window[-1]['sequence'], 'FAILURE_WINDOW_EVICTION_COUNTER')
    by_sequence = {event['sequence']: event for event in events}
    for event in window:
        require05(by_sequence.get(event['sequence'], event) == event, 'FAILURE_WINDOW_SHARED_RECORD_CHANGED')
    if first is not None:
        require05(window[0]['sequence'] >= first['sequence'], 'FAILURE_WINDOW_AFTER_FIRST')
        require05(window[0] == first if evicted == 0 else window[0]['sequence'] > first['sequence'], 'FAILURE_WINDOW_EVICTION')
        for event in failures:
            if window[0]['sequence'] <= event['sequence'] <= window[-1]['sequence']:
                require05(event in window, 'FAILURE_WINDOW_MISSING_RETAINED_ERROR')
    require05(result['failureWindowFrozenAtFirstUI'] == (ui is not None), 'FAILURE_WINDOW_FROZEN')
    if ui is not None:
        require05(window and window[-1] == ui, 'FAILURE_WINDOW_FIRST_UI_LAST')
        require05([event for event in window if (event.get('disposition') or event['meta'].get('disposition')) == 'ui_conversion'] == [ui], 'FAILURE_WINDOW_FIRST_UI_ONLY')
    else:
        require05(not any((event.get('disposition') or event['meta'].get('disposition')) == 'ui_conversion' for event in window), 'FAILURE_WINDOW_NO_UNDECLARED_UI')
    return result


def _qualifying_origin05_v1(validated):
    """A finite UI-linked observation, never a guessed storage root cause."""
    ui = validated['firstUIFailure']
    if ui is None: return None
    if (ui['site'], ui['operation']) not in {('availability', 'check'), ('age-store', 'getAgePolicyReceiptStatus'), ('age-gate', 'readActiveReceipt')}: return None
    def ids(event): return {node['errorId'] for node in event['error']['chain'] if node['errorId']}
    def codes(event): return {node['recognizedCode'] for node in event['error']['chain']}
    def disposition(event): return event.get('disposition') or event['meta'].get('disposition')
    def count(meta, a, b): return meta.get(a, meta.get(b, 0))
    native_stages = {'SecureStore.isAvailableAsync', 'SecureStore.getItemAsync', 'SecureStore.setItemAsync', 'SecureStore.deleteItemAsync', 'AsyncStorage.getItem', 'AsyncStorage.multiGet', 'AsyncStorage.getAllKeys', 'AsyncStorage.setItem', 'AsyncStorage.removeItem'}
    def native(event):
        return event['site'] in ('content-key', 'private-kv', 'mutation', 'owner-proof') and event.get('stage', event['meta'].get('stage')) in native_stages and disposition(event) != 'probe' and any(node['numericFields'] or (node['recognizedCodeField'] == 'code' and node['recognizedCode'] in {'ERR_KEY_CHAIN', 'ERR_INVALID_KEY', 'ERR_MISSING_PLIST_KEY', 'ERR_SEC_ACCESS_CONTROL'}) for node in event['error']['chain'])
    earlier = [event for event in validated['events'] if 'error' in event and event['sequence'] < ui['sequence'] and disposition(event) not in ('probe', 'ui_conversion') and event['attempt'] > 0 and 'sourceLine' in event]
    for event in earlier:
        if not ids(event) & ids(ui): continue
        m = event['meta']; predicate = m.get('predicate'); code = codes(event); operation = event['operation']; kind = None
        if native(event): kind = 'ACTUAL_NATIVE_CALL_REJECTION_WITH_SUPPLIED_CODE'
        elif event['site'] == 'mutation' and 'LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED' in code:
            if operation == 'assertPrivateMutationReadGeneration46' and predicate in (None, 'revision_changed') and (m.get('revisionChanged') is True or m.get('revisionEqual') is False): kind = 'C46_RETIRED_READ_PREDICATE'
            elif operation == 'assertPrivateMutationReadable46' and predicate in (None, 'live_claim_present') and count(m, 'liveClaimsCount', 'liveClaims') > 0: kind = 'C46_LIVE_CLAIM_READ_REFUSAL'
            elif operation == 'waitForPrivateMutationReadWindow46' and predicate in (None, 'failed_claim_present') and count(m, 'failedClaimsCount', 'failedClaims') > 0: kind = 'C46_FAILED_CLAIM_QUARANTINE'
        elif event['site'] == 'private-kv' and operation in ('assertAccountScopedPrivateOperationAllowed', 'runAccountScopedPrivateOperation') and (operation != 'runAccountScopedPrivateOperation' or event.get('stage') == 'entry') and 'PRIVATE_KV_WRITE_BLOCKED_ACCOUNT_BOUNDARY' in code and ((predicate in (None, 'account_boundary_active') and (m.get('accountBoundaryActive') is True or m.get('boundaryBlocked') is True)) or (predicate in (None, 'account_changed') and (m.get('accountGenerationChanged') is True or m.get('accountGenerationEqual') is False))): kind = 'PRIVATE_KV_ACCOUNT_FENCE_PREDICATE'
        elif event['site'] == 'account-generation' and operation in ('assertAccountGenerationLease', 'assertAccountIdentityGeneration', 'runAccountGenerationOperation') and (operation != 'runAccountGenerationOperation' or event.get('stage') == 'account_fence') and 'ACCOUNT_GENERATION_CHANGED' in code and predicate in (None, 'account_changed', 'account_boundary_active') and (m.get('accountGenerationEqual') is False or m.get('accountGenerationChanged') is True or (operation in ('assertAccountGenerationLease', 'runAccountGenerationOperation') and m.get('boundaryBlocked') is True)): kind = 'ACCOUNT_GENERATION_FENCE_PREDICATE'
        elif operation == 'assertOwnerWorkflowFence' and 'ACCOUNT_GENERATION_CHANGED' in code and predicate in (None, 'owner_changed') and m.get('ownerCurrent') is False: kind = 'OWNER_WORKFLOW_FENCE_PREDICATE'
        if kind: return {'kind': kind, 'relation': 'SAME_ERROR_ID_OR_CAUSE_PROPAGATED_TO_UI', 'origin': event, 'ui': ui, 'qualification': 'OBSERVED_REJECTION_BOUNDARY_ONLY; NO_ORDINARY_OR_ROOT_CAUSE_ACCEPTANCE'}
    for wrapper in earlier:
        if not ids(wrapper) & ids(ui) or 'PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE' not in codes(wrapper): continue
        for event in earlier:
            if wrapper['phase'] != 'failure' or event['phase'] != 'caught' or disposition(event) != 'caught' or event['operation'] not in ('getStoredPrivateKVContentKey', 'setStoredPrivateKVContentKey'): continue
            if event['sequence'] >= wrapper['sequence'] or event['site'] != 'content-key' or wrapper['site'] != 'content-key' or event['attempt'] != wrapper['attempt'] or event['operation'] != wrapper['operation'] or not native(event): continue
            if any(row['attempt'] == event['attempt'] and row['phase'] == 'pass' and event['sequence'] < row['sequence'] < wrapper['sequence'] for row in validated['events']): continue
            return {'kind': 'CONTENT_KEY_NATIVE_REJECTION_BEFORE_STORAGE_UNAVAILABLE_WRAP', 'relation': 'SAME_ATTEMPT_NATIVE_CAUGHT_THEN_NEW_WRAPPER_ERROR_ID_PROPAGATED_TO_UI', 'origin': event, 'wrapper': wrapper, 'ui': ui, 'qualification': 'EXPLICIT_SEQUENCE_AND_ATTEMPT_JOIN; DISTINCT_ERROR_IDS_RETAINED; NO_OSSTATUS_OR_ROOT_CAUSE_INFERRED'}
    return None


def qualifying_origin05(validated):
    """Only actual schema-two rows form the view; missing rows never prove a pass absent."""
    require05(validated.get('traceFormatVersion') == 2, 'QUALIFIER_VERSION')
    rows = {event['sequence']: event for event in validated['events']}
    rows.update({event['sequence']: event for event in validated['failureWindow']})
    view = dict(validated)
    view['events'] = [rows[key] for key in sorted(rows)]
    result = _qualifying_origin05_v1(view)
    if result and result['kind'] == 'CONTENT_KEY_NATIVE_REJECTION_BEFORE_STORAGE_UNAVAILABLE_WRAP':
        start, end = result['origin']['sequence'], result['wrapper']['sequence']
        # A dropped PASS could otherwise make the old no-intervening-PASS check vacuous.
        if sum(start < sequence < end for sequence in rows) != end - start - 1:
            return None
    return result


need(digest(ENTRY_TEMPLATE.encode('utf8')) == ENTRY_SOURCE_SHA25605, 'EXACT_ENTRY_TEMPLATE')


# Append to storage_trace47.py after the exact transform/observer/context helpers.
# Prefix contracts: diagnostic_inputs(root,ios,evidence,head,run),
# validate_trace05(raw,head,bundle,pid), qualifying_origin05(validated)->dict|None.
# Every legacy native_runtime47 / consent_trace47 function remains unchanged.

def source_scope05(phase, root):
    import hashlib, importlib.util, subprocess
    from pathlib import Path
    root=Path(root).resolve(strict=True)
    path=root/'scripts/release/full-app-j01/source_completion47.py'
    original=path.read_bytes()
    if hashlib.sha256(original).hexdigest() != '93658c0e190387f474427e11b821248596350a61108087a8a9bb489ccf48f932':
        raise ValueError('C47_STORAGE05_IMMUTABLE_SCOPE47_PREDECESSOR')
    spec=importlib.util.spec_from_file_location('c47_exact_scope05_predecessor',path)
    verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
    if len(verifier.PATHS)!=44:
        raise ValueError('C47_STORAGE05_EXACT_PREDECESSOR44')
    additions={'scripts/release/full-app-j01/storage_trace47.py',
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
               'apps/mobile/src/lib/auth/localAccountIsolation.ts',
               'scripts/phase9/ios-privacy-lock-succession46.mjs',
               'scripts/release/full-app-j01/native_preflight09.test.mjs',
               'scripts/release/full-app-j01/pinned_app70_replay10.py'}
    if verifier.PATHS & additions:
        raise ValueError('C47_STORAGE05_NEW_PATH_PREDECESSOR_COLLISION')
    verifier.PATHS=frozenset(verifier.PATHS)|additions
    result=verifier.validate(phase,root=root)
    g=lambda *args:subprocess.check_output(['git','--no-replace-objects',*args],cwd=root).decode().strip()
    checkpoint='fa4275986b727b3e6d855b059d5688210a09e440'
    if g('rev-parse',checkpoint+'^{tree}')!='ce88d3d7b8a674e3fae2e9aa2ff3c594efe2ecbd' or g('merge-base',checkpoint,result['head'])!=checkpoint:
        raise ValueError('C47_STORAGE05_PRESERVED_FA_CHECKPOINT')
    prefix=g('rev-list','--reverse',verifier.BASE+'..'+checkpoint).splitlines()
    diagnostic_checkpoint='5e6acffc9d8d06b163bc3f3d20b6895a6ad03707'
    if g('rev-parse',diagnostic_checkpoint+'^{tree}')!='28b35bf021e8a83ad3a979a99810c818fd5c69e0' or g('merge-base',diagnostic_checkpoint,result['head'])!=diagnostic_checkpoint:
        raise ValueError('C47_STORAGE05_PRESERVED_DIAGNOSTIC38_CHECKPOINT')
    diagnostic_prefix=g('rev-list','--reverse',verifier.BASE+'..'+diagnostic_checkpoint).splitlines()
    if len(diagnostic_prefix)!=92 or result['commits'][:92]!=diagnostic_prefix:
        raise ValueError('C47_STORAGE05_EXACT92_DIAGNOSTIC_PREFIX')
    capture_checkpoint='0d1e9dd7a5488c395ba51b88c796a2b6870a8f5a'
    if g('rev-parse',capture_checkpoint+'^{tree}')!='2fd127c4eaf558926117be5c227764e5324c26d3' or g('merge-base',capture_checkpoint,result['head'])!=capture_checkpoint:
        raise ValueError('C47_STORAGE05_PRESERVED_CAPTURE39_CHECKPOINT')
    capture_prefix=g('rev-list','--reverse',verifier.BASE+'..'+capture_checkpoint).splitlines()
    if len(capture_prefix)!=94 or result['commits'][:94]!=capture_prefix:
        raise ValueError('C47_STORAGE05_EXACT94_CAPTURE_PREFIX')
    ordinary49_checkpoint='705a552506e931154ebb173384cc90777e1e166d'
    if g('rev-parse',ordinary49_checkpoint+'^{tree}')!='3950cb746e7bfcf8144663a3f50a7d1c652a4ea8' or g('merge-base',ordinary49_checkpoint,result['head'])!=ordinary49_checkpoint:
        raise ValueError('C47_STORAGE05_PRESERVED_705A_CHECKPOINT')
    ordinary49_prefix=g('rev-list','--reverse',verifier.BASE+'..'+ordinary49_checkpoint).splitlines()
    if len(ordinary49_prefix)!=101 or result['commits'][:101]!=ordinary49_prefix:
        raise ValueError('C47_STORAGE05_EXACT101_ORDINARY49_PREFIX')
    sealed_checkpoint='dd21cd52b108cb4e860db8b4d4a6c0112bd06d83'
    if g('rev-parse',sealed_checkpoint+'^{tree}')!='a4004d3c538d26cae52fa42cc0bc79c46bfdc3fc' or g('merge-base',sealed_checkpoint,result['head'])!=sealed_checkpoint:
        raise ValueError('C47_STORAGE05_PRESERVED_DD21_CHECKPOINT')
    sealed_prefix=g('rev-list','--reverse',verifier.BASE+'..'+sealed_checkpoint).splitlines()
    if len(sealed_prefix)!=103 or result['commits'][:103]!=sealed_prefix:
        raise ValueError('C47_STORAGE05_EXACT103_ORDINARY_SOURCE50_PREFIX')
    if len(prefix)!=87 or result['commits'][:87]!=prefix or result['finite_declared_paths']!=73:
        raise ValueError('C47_STORAGE05_EXACT87_PREFIX_FINITE73')
    preflight09_checkpoint='2b35b7399ffa8727f3166a0c35fb93e20f33611b'
    if g('rev-parse',preflight09_checkpoint+'^{tree}')!='87d82877d1810141edbc9d25ed4ed51929e1f736' or g('merge-base',preflight09_checkpoint,result['head'])!=preflight09_checkpoint:
        raise ValueError('C47_PREFLIGHT09_PRESERVED145_CHECKPOINT')
    preflight09_prefix=g('rev-list','--reverse',verifier.BASE+'..'+preflight09_checkpoint).splitlines()
    if len(preflight09_prefix)!=145 or result['commits'][:145]!=preflight09_prefix:
        raise ValueError('C47_PREFLIGHT09_EXACT145_PREFIX')
    replay10_checkpoint='f4fb6fb488d119d536fe189bf872512b27bfc719'
    if g('rev-parse',replay10_checkpoint+'^{tree}')!='8502b8c779df62c1050b4aeff55aedc35f123df6' or g('merge-base',replay10_checkpoint,result['head'])!=replay10_checkpoint:
        raise ValueError('C47_REPLAY10_PRESERVED153_CHECKPOINT')
    replay10_prefix=g('rev-list','--reverse',verifier.BASE+'..'+replay10_checkpoint).splitlines()
    if len(replay10_prefix)!=153 or result['commits'][:153]!=replay10_prefix:
        raise ValueError('C47_REPLAY10_EXACT153_PREFIX')
    same_process11_checkpoint='a50628e009c69ee00bf532e1335fde6ed9d3f51e'
    if g('rev-parse',same_process11_checkpoint+'^{tree}')!='29aecf8abf97d5a0c9d4f4df242d9230f35c42f1' or g('merge-base',same_process11_checkpoint,result['head'])!=same_process11_checkpoint:
        raise ValueError('C47_PROCESS11_PRESERVED157_CHECKPOINT')
    same_process11_prefix=g('rev-list','--reverse',verifier.BASE+'..'+same_process11_checkpoint).splitlines()
    if len(same_process11_prefix)!=157 or result['commits'][:157]!=same_process11_prefix:
        raise ValueError('C47_PROCESS11_EXACT157_PREFIX')
    host_first12_checkpoint='6b1e1b3adfd048e6a5e90a654721cf950fbafdf7'
    if g('rev-parse',host_first12_checkpoint+'^{tree}')!='5d89e7d7b1e414f9a6975dd4143697f8bc8fb2e0' or g('merge-base',host_first12_checkpoint,result['head'])!=host_first12_checkpoint:
        raise ValueError('C47_HOST12_PRESERVED161_CHECKPOINT')
    host_first12_prefix=g('rev-list','--reverse',verifier.BASE+'..'+host_first12_checkpoint).splitlines()
    if len(host_first12_prefix)!=161 or result['commits'][:161]!=host_first12_prefix:
        raise ValueError('C47_HOST12_EXACT161_PREFIX')
    lifecycle13_checkpoint='6f6f9733a0551b26809057bae1d510c96349c371'
    if g('rev-parse',lifecycle13_checkpoint+'^{tree}')!='b2ffabddbac73c64f195917e65d817fdfbf7444f' or g('merge-base',lifecycle13_checkpoint,result['head'])!=lifecycle13_checkpoint:
        raise ValueError('C47_LIFECYCLE13_PRESERVED165_CHECKPOINT')
    lifecycle13_prefix=g('rev-list','--reverse',verifier.BASE+'..'+lifecycle13_checkpoint).splitlines()
    if len(lifecycle13_prefix)!=165 or result['commits'][:165]!=lifecycle13_prefix:
        raise ValueError('C47_LIFECYCLE13_EXACT165_PREFIX')
    platform14_checkpoint='ca3229765a9a1b2519c481e78e9b2be78a29e58f'
    if g('rev-parse',platform14_checkpoint+'^{tree}')!='79352a203f0d59b5873669a24eb95e2d33ff3d4f' or g('merge-base',platform14_checkpoint,result['head'])!=platform14_checkpoint:
        raise ValueError('C47_PLATFORM14_PRESERVED170_CHECKPOINT')
    platform14_prefix=g('rev-list','--reverse',verifier.BASE+'..'+platform14_checkpoint).splitlines()
    if len(platform14_prefix)!=170 or result['commits'][:170]!=platform14_prefix:
        raise ValueError('C47_PLATFORM14_EXACT170_PREFIX')
    correction77_checkpoint='629e2a2cccd3661d14d34a2121b8667932c906d8'
    if g('rev-parse',correction77_checkpoint+'^{tree}')!='20388be05f91c697b14256ccbab5619087cc21d6' or g('merge-base',correction77_checkpoint,result['head'])!=correction77_checkpoint:
        raise ValueError('C47_CORRECTION77_PRESERVED172_CHECKPOINT')
    correction77_prefix=g('rev-list','--reverse',verifier.BASE+'..'+correction77_checkpoint).splitlines()
    if len(correction77_prefix)!=172 or result['commits'][:172]!=correction77_prefix:
        raise ValueError('C47_CORRECTION77_EXACT172_PREFIX')
    inventory15_checkpoint='c331d14cbce7cd7f4a797734bbc140c41676274f'
    if g('rev-parse',inventory15_checkpoint+'^{tree}')!='e33df884e00a4e31cd0b80f954c89c7b4cc056f3' or g('merge-base',inventory15_checkpoint,result['head'])!=inventory15_checkpoint:
        raise ValueError('C47_INVENTORY15_PRESERVED177_CHECKPOINT')
    inventory15_prefix=g('rev-list','--reverse',verifier.BASE+'..'+inventory15_checkpoint).splitlines()
    if len(inventory15_prefix)!=177 or result['commits'][:177]!=inventory15_prefix:
        raise ValueError('C47_INVENTORY15_EXACT177_PREFIX')
    return {**result,'scope_successor05':{'predecessor_sha256':'93658c0e190387f474427e11b821248596350a61108087a8a9bb489ccf48f932',
        'preserved_predecessor_paths':44,'exact_added_paths':sorted(additions),'finite_paths':73,
        'historical_validator_file_modified':False,'diagnostic_only':False,
        'qualification':'SOURCE_SCOPE_ONLY_APPLICATION_REPAIR_AND_PRESERVED_DIAGNOSTIC73_NO_NATIVE_ADMISSION'}}


def collect_native_origin05(r,n,device,bundle,head,evidence,label,expected_pid=None,*,targeted_onboarding53=False):
    """Immutable first/post-UI copies while the same Simulator is alive."""
    import hashlib,json,re,uuid
    from pathlib import Path
    target=evidence/label;target.mkdir(exist_ok=False)
    # Screen/process evidence survives missing identity, flush or trace validation.
    for suffix,argv,timeout in [('screenshot',['xcrun','simctl','io',device,'screenshot',target/'screen.png'],30),
                                ('processes',['xcrun','simctl','spawn',device,'launchctl','list'],60)]:
        try:r.run('storage05-'+label+'-'+suffix,argv,timeout=timeout,required=False,diagnostic=True)
        except Exception as secondary:
            r.receipt.setdefault('storage05_capture_secondary_types',[]).append(type(secondary).__name__)
    data=Path(r.text('storage05-'+label+'-data-container',
        ['xcrun','simctl','get_app_container',device,bundle,'data'],timeout=300)).resolve(strict=True)
    parent=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
    n.require(data.parent==parent and str(uuid.UUID(data.name)).lower()==data.name.lower(),'STORAGE05_OWN_FRESH_DATA_CONTAINER')
    first_data=getattr(r,'_storage05_first_data_container',None)
    n.require(first_data is None or data==first_data,'STORAGE05_SAME_CONTAINER_NO_REINSTALL')
    r._storage05_first_data_container=data
    identity_path=data/'Documents/C47StorageOrigin05Identity.json'
    n.require(identity_path.stat().st_size<=4096,'STORAGE05_NATIVE_IDENTITY_SIZE')
    raw=n.read_native_file(identity_path)
    try:
        identity=n.stage_json(raw)
        n.require(set(identity)=={'schema','pid','sourceHead','bundle'} and type(identity['schema']) is int and identity['schema']==1 and
            type(identity['pid']) is int and 0<identity['pid']<=2147483647 and identity['sourceHead']==head and
            identity['bundle']==bundle,'STORAGE05_ACTUAL_NATIVE_IDENTITY')
        if expected_pid is not None:
            n.require(identity['pid']==expected_pid,'STORAGE05_FIRST_LAUNCH_IDENTITY_PID')
    except Exception as validation_error:
        n.write_json(target/'CONTENT_FREE_VALIDATION_FAILURE.json',{'stage':'NATIVE_IDENTITY',
            'error_type':type(validation_error).__name__,'raw_bytes':len(raw),
            'raw_sha256':hashlib.sha256(raw).hexdigest()})
        raise ValueError('C47_STORAGE05_NATIVE_IDENTITY_VALIDATION_REFUSED') from None
    (target/'native-identity.json').write_bytes(raw)
    paths=sorted((data/'Documents').glob('C47StorageOrigin05-*.json'))
    n.require(0<len(paths)<=8,'STORAGE05_BOUNDED_ACTUAL_TRACE_FILES')
    rows=[];origins=[];targeted_observations=[]
    for path in paths:
        match=re.fullmatch(r'C47StorageOrigin05-([1-9][0-9]*)\.json',path.name)
        n.require(match is not None,'STORAGE05_ACTUAL_TRACE_FILENAME')
        n.require(path.stat().st_size<=2*1024**2,'STORAGE05_TRACE_FILE_SIZE')
        raw=n.read_native_file(path);pid=int(match.group(1))
        try:value=(validate_onboarding_trace53 if targeted_onboarding53 else validate_trace05)(raw,head,bundle,pid)
        except Exception as validation_error:
            n.write_json(target/'CONTENT_FREE_VALIDATION_FAILURE.json',{'stage':'TRACE_SCHEMA',
                'error_type':type(validation_error).__name__,'raw_bytes':len(raw),
                'raw_sha256':hashlib.sha256(raw).hexdigest()})
            raise ValueError('C47_STORAGE05_TRACE_VALIDATION_REFUSED') from None
        (target/path.name).write_bytes(raw)
        origin=(qualifying_onboarding_origin53 if targeted_onboarding53 else qualifying_origin05)(value)
        if origin is not None:
            observation={'pid':pid,'origin':origin,'file':path.name}
            if targeted_onboarding53:targeted_observations.append(observation)
            if not targeted_onboarding53 or origin.get('causal_origin_qualified') is True:origins.append(observation)
        rows.append({'file':path.name,'pid':pid,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
    n.require(identity['pid'] in [row['pid'] for row in rows],'STORAGE05_CURRENT_PID_TRACE_REQUIRED')
    result={'source_head':head,'bundle':bundle,'simulator':device,'native_identity':identity,
        'native_identity_sha256':hashlib.sha256((target/'native-identity.json').read_bytes()).hexdigest(),
        'same_data_container_as_first_capture':True,'processes':rows,'qualifying_origins':origins,'screen_captured':(target/'screen.png').is_file(),
        'ordinary_admitted':False,'internal_admitted':False,
        'qualification':'ACTUAL_DIAGNOSTIC_FIRST_ERROR_CAPTURE_ONLY; NO_ORDINARY_OR_INTERNAL_PASS'}
    if targeted_onboarding53:result['targeted_observations']=targeted_observations
    n.write_json(target/'CAPTURE.json',result)
    return result



def _native05_file_has_marker(n,path,marker):
    import os,stat
    before=n.stage_file_digest(path,n.MAX_APP)
    flags=os.O_RDONLY|getattr(os,'O_NOFOLLOW',0)|getattr(os,'O_BINARY',0)
    descriptor=os.open(path,flags)
    try:
        opened=os.fstat(descriptor)
        n.require(stat.S_ISREG(opened.st_mode) and opened.st_nlink==1 and opened.st_size==before['bytes'],
            'STORAGE05_REGULAR_BOUNDED_NATIVE_FILE')
        found=False;tail=b'';size=0
        while True:
            block=os.read(descriptor,1024**2)
            if not block:break
            size+=len(block);n.require(size<=n.MAX_APP,'STORAGE05_NATIVE_FILE_BOUND')
            combined=tail+block;found=found or marker in combined;tail=combined[-max(0,len(marker)-1):]
        closed=os.fstat(descriptor)
        n.require((opened.st_dev,opened.st_ino,opened.st_size,opened.st_mtime_ns,opened.st_ctime_ns)==
            (closed.st_dev,closed.st_ino,closed.st_size,closed.st_mtime_ns,closed.st_ctime_ns),
            'STORAGE05_NATIVE_FILE_READ_STABILITY')
    finally:os.close(descriptor)
    n.require(n.stage_file_digest(path,n.MAX_APP)==before,'STORAGE05_NATIVE_FILE_HASH_STABILITY')
    return found


def _native05_product(r,n,app,products,bundle,head,evidence):
    import hashlib,plistlib,tarfile
    signing=n.simulator_signing()
    info=plistlib.loads(n.read_native_file(app/'Info.plist'))
    n.require(info.get('CFBundleIdentifier')==bundle and info.get('CFBundleExecutable')=='LayerwellStaging','STORAGE05_APP_INFO')
    js=n.read_native_file(app/'main.jsbundle')
    n.require(b'C47_STORAGE_ORIGIN_DIAGNOSTIC_05' in js and
        b'C47_SEPARATE_SECURESTORE_DIAGNOSTIC_03' not in js and
        b'C47_SEPARATE_CONSENT_DIAGNOSTIC_04' not in js,'STORAGE05_SEPARATE_JS_MARKER')
    n.require(_native05_file_has_marker(n,app/'LayerwellStaging',b'C47StorageOrigin05Identity.json'),
        'STORAGE05_NATIVE_IDENTITY_HOOK_MARKER')
    product=signing.inspect_product(r,n,app,bundle,'storage05-signed-product')
    files=n.bundle_inventory(app)
    inventory={'source':r.receipt['source'],'lane':'SEPARATE_RELEASE_STORAGE_ORIGIN_DIAGNOSTIC_05',
        'configuration':'Release','files':files,'product':product,
        'diagnostic_transform_sha256':n.sha(evidence/'TRANSFORM.json')}
    n.write_json(evidence/'app-inventory.json',inventory)
    archive=evidence/'signed-storage-origin05-app.tar.gz'
    with tarfile.open(archive,'w:gz',dereference=False) as target:target.add(app,arcname=app.name)
    n.require(archive.stat().st_size<=n.MAX_APP,'STORAGE05_APP_ARCHIVE_BOUND')
    artifact={'file':archive.name,'bytes':archive.stat().st_size,'sha256':n.sha(archive),
        'inventory_sha256':n.sha(evidence/'app-inventory.json'),'source_head':head,
        'source_tree':r.receipt['source']['tree'],'product':product,
        'javascript':{'bytes':len(js),'sha256':hashlib.sha256(js).hexdigest()},
        'diagnostic_source_transform_sha256':inventory['diagnostic_transform_sha256'],
        'storage_origin05_native_hook_present':True,'storage_origin05_js_marker_present':True,
        'not_an_ordinary_or_internal_producer':True,'ordinary_admitted':False,'internal_admitted':False}
    n.write_json(evidence/'app-artifact.json',artifact)
    r.passed('storage-origin05-compiled',artifact)
    return inventory


def _native05_installed(r,n,installed,app,bundle,inventory,evidence):
    import plistlib
    from pathlib import Path
    installed=Path(installed).resolve(strict=True)
    target=evidence/'installed';target.mkdir(exist_ok=False)
    rows={}
    for label,path in (('source',app),('installed',installed)):
        rows[label]=n.bundle_inventory(path)
        n.write_json(target/('observed-'+label+'-inventory.json'),rows[label])
    n.write_json(target/'exact-inventory-differences.json',{label:n.installed_app_inventory_diff(inventory['files'],row) for label,row in rows.items()})
    proof={label:n.installed_app_inventory_proof(inventory['files'],row,'LayerwellStaging') for label,row in rows.items()}
    info=plistlib.loads(n.read_native_file(installed/'Info.plist'))
    n.require(info.get('CFBundleIdentifier')==bundle and info.get('CFBundleExecutable')=='LayerwellStaging','STORAGE05_INSTALLED_APP_INFO')
    product=n.simulator_signing().inspect_product(r,n,installed,bundle,'storage05-installed-signed-product')
    n.require(product==inventory['product'],'STORAGE05_EXACT_INSTALLED_MACHO_SIGNATURE_ENTITLEMENTS')
    n.require(n.stage_file_digest(installed/'main.jsbundle')==n.stage_file_digest(app/'main.jsbundle'),'STORAGE05_EXACT_INSTALLED_JS')
    n.write_json(target/'VERIFIED.json',proof)
    r.passed('storage-origin05-installed',{'full_inventory':proof,'source_head':r.receipt['source']['head'],
        'ordinary_admitted':False,'internal_admitted':False})



def _native05_launch(r,n,device,bundle,head,evidence,*,targeted_onboarding53=False):
    try:
        n.platform_bootstrap36(r,device)
        return n.launch_and_verify(r,device,bundle)
    except Exception:
        try:collect_native_origin05(r,n,device,bundle,head,evidence,'launch-failure',targeted_onboarding53=targeted_onboarding53)
        except Exception as secondary:
            r.receipt['storage05_launch_capture_secondary_type']=type(secondary).__name__
        raise


def run_native_origin05(r,n,*,onboarding_denial53=False):
    import importlib.util,re,shutil
    from pathlib import Path
    head,tools,source47=n.prepare(r,source_controls=onboarding_denial53)
    if onboarding_denial53:
        proof=(_native05_full_source_controls62(r,n) if r.receipt.get('storage62_profile') else _native05_full_source_controls53(r,n))
        r.receipt['storage53_source_controls']=proof
        r.passed('storage53-own-full30-before-prebuild',proof)
    r.receipt.update(stage='build',lane='SEPARATE_RELEASE_STORAGE_ORIGIN_DIAGNOSTIC_05',
        ordinary_admitted=False,internal_supported_owner='NOT_RUN',diagnostic_only=True)
    r.persist()
    mobile=r.root/'apps/mobile'
    r.run('resolved-expo-config',['npx','--no-install','expo','config','--json'],cwd=mobile,timeout=120)
    r.run('prebuild',['npx','--no-install','expo','prebuild','--platform','ios','--clean','--no-install',
        '--template','../../node_modules/expo/template.tgz'],cwd=mobile,timeout=300)
    r.run('generated-source-diff',['git','--no-replace-objects','diff','--binary','HEAD'],timeout=60)
    r.source_proof('source-after-prebuild',head,allow_generation=True)
    ios=mobile/'ios';compat=r.output/'generated-compat47'
    r.run('generated47-exact-properties',['python3','-I','-B','scripts/release/full-app-j01/pods_compat47.py',
        '--ios-directory',ios,'--source-proof',source47,'--output',compat],timeout=120)
    r.run('current-generated47-native',['node','scripts/release/full-app-j01/native_generated47.mjs',
        '--phase','GENERATED','--source-proof',source47,'--receipt',compat/'receipt.json',
        '--output',r.output/'current-generated47.json'],timeout=600)
    r.source_proof('source-after-generated47',head,allow_generation=True)
    r.run('pods',['pod','install'],cwd=ios,timeout=1200)
    n.retain_pod_inventory(ios,r.output)
    r.run('current-generated47-resolved',['node','scripts/release/full-app-j01/native_generated47.mjs',
        '--phase','RESOLVED','--source-proof',source47,'--receipt',compat/'receipt.json',
        '--output',r.output/'current-generated47-resolved.json'],timeout=600)
    r.source_proof('source-after-pods',head,allow_generation=True)
    n.retain_generated_native(ios,r.output)
    n.require(re.search(r'^  - NativeLabelOcr \(1\.0\.0\)',(ios/'Podfile.lock').read_text(),re.M),'STORAGE05_REAL_OCR_AUTOLINK')
    workspaces=list(ios.glob('*.xcworkspace'));n.require(len(workspaces)==1,'STORAGE05_WORKSPACE_COUNT')
    workspace=workspaces[0];scheme=workspace.stem;bundle='com.layerwell.app.staging';signing=n.simulator_signing()
    ent=signing.configure_app(r,n,ios,bundle)
    signing.check_effective_app(r,n,['xcodebuild','-workspace',workspace,'-scheme',scheme,'-configuration',
        'Release','-sdk','iphonesimulator',*n.APP_SIMULATOR_BUILD_FLAGS],bundle,ent,'native-build-settings')
    products=Path(__import__('os').environ['RUNNER_TEMP'])/'c47-native-products';products.mkdir(exist_ok=False)
    r.receipt['products_directory']=str(products);r.persist()
    argv=['xcodebuild','-workspace',workspace,'-scheme',scheme,'-configuration','Release','-sdk',
        'iphonesimulator','-destination','generic/platform=iOS Simulator','-derivedDataPath',products/'derived',
        *n.APP_SIMULATOR_BUILD_FLAGS]
    evidence=r.output/'storage-origin05';result=None
    inputs=(diagnostic_inputs(r.root,ios,evidence,head,r.run,targeted_onboarding53=True) if onboarding_denial53
        else diagnostic_inputs(r.root,ios,evidence,head,r.run))
    with inputs as entry:
        r.run('storage-origin05-build',argv+['-resultBundlePath',products/'build.xcresult','build'],
            env={**r.env,'ENTRY_FILE':str(entry)},timeout=3000)
        app=products/'derived/Build/Products/Release-iphonesimulator/LayerwellStaging.app'
        inventory=_native05_product(r,n,app,products,bundle,head,evidence)
        device=n.prepare_simulator(r,'normal')
        installed=n.install_simulator_app(r,device,app,bundle)
        _native05_installed(r,n,installed,app,bundle,inventory,evidence)
        first_pid=_native05_launch(r,n,device,bundle,head,evidence,targeted_onboarding53=onboarding_denial53)
        first=collect_native_origin05(r,n,device,bundle,head,evidence,'first-launch',first_pid,targeted_onboarding53=onboarding_denial53)
        ui_result=None;post=None
        try:
            if onboarding_denial53 or not first['qualifying_origins']:
                ui=r.output/'ui';ui.mkdir()
                env={**r.env,'C47_BUNDLE_ID':bundle,'C47_RUNTIME_LANE':'normal-staging',
                    'C47_UI_PHASE':'normal-staging','C47_SOURCE_HEAD':head}
                r.run('generate-native-ui-runner',['ruby',r.root/'scripts/release/full-app-j01/native_ui47.rb',ios,ui],env=env,timeout=120)
                baseline=n.normal_runner04(r)
                method=_native05_selected_method(n,onboarding_denial53)
                from contextlib import nullcontext
                with (_native05_observe62(r,n,device,bundle,head,installed,inventory) if r.receipt.get('storage62_profile') else nullcontext()):
                    ui_result=n.normal_case_execution04(r,Path(baseline['project']),products,method,device,env)
                # Even a positive single current case is diagnostic-only; no aggregate/gate executes.
        finally:
            # No shutdown/retry/reset/reinstall precedes immutable first/post-UI capture.
            if onboarding_denial53 or ui_result is not None or not first['qualifying_origins']:
                try:post=collect_native_origin05(r,n,device,bundle,head,evidence,'after-one-ui',targeted_onboarding53=onboarding_denial53)
                except Exception as capture_error:
                    r.receipt['storage05_post_ui_capture_error_type']=type(capture_error).__name__
            try:n.retain_result_bundles(r)
            except Exception as secondary:
                r.receipt['storage05_result_collection_secondary_type']=type(secondary).__name__
        observations=[first]+([post] if post else [])
        qualified=any(value['qualifying_origins'] for value in observations)
        result={'source':r.receipt['source'],'first_verified_native_pid':first_pid,
            'observations':observations,'selected_current_case':_native05_selected_method(n,onboarding_denial53) if ui_result is not None else None,
            'targeted_onboarding53':onboarding_denial53,
            'single_case_result':ui_result,'qualified_origin_observed':qualified,'ordinary_admitted':False,
            'internal_admitted':False,'retry_attempted':False,
            'qualification':'ONE_DIAGNOSTIC_SEQUENCE_ONLY; FIRST_ERROR_RAW_CAPTURE_REQUIRES_INDEPENDENT_CAUSAL_REVIEW'}
        n.write_json(evidence/'ORIGIN_RECEIPT.json',result)
        r.receipt['storage_origin05']=result;r.persist()
    restored=r.source_proof('source-after-storage-origin05-exact-restoration',head,allow_generation=True)
    if onboarding_denial53:
        r.receipt['storage53_completed_restoration_source']={'file':'source-after-storage-origin05-exact-restoration.json',
            'sha256':n.sha(r.output/'source-after-storage-origin05-exact-restoration.json'),
            'head':restored['head'],'tree':restored['tree']}
    r.receipt.update(status=('STORAGE_ORIGIN05_DIAGNOSTIC_OBSERVED_REVIEW_REQUIRED' if result['qualified_origin_observed']
        else 'STORAGE_ORIGIN05_CAPTURED_WITHOUT_QUALIFIED_ORIGIN'),ordinary_admitted=False,
        internal_supported_owner='NOT_RUN',stage_complete=bool(result['qualified_origin_observed']),finished_utc=n.utc())
    r.persist()
    return result




def _native05_final_source53(r,n,context,result):
    """A normal return already completed the exact restoration source scan.

    Receipt/evidence writes are the only intervening operations. Failed runs keep
    the original finally scan; no proof is copied or relabeled as a fresh scan.
    """
    marker=r.receipt.get('storage53_completed_restoration_source')
    if result is None or marker is None:
        return r.source_proof('source-after-storage05-finally',context['head'],allow_generation=True)
    path=r.output/'source-after-storage-origin05-exact-restoration.json'
    raw=n.read_native_file(path);proof=n.stage_json(raw)
    n.require(result is r.receipt.get('storage_origin05') and type(marker) is dict and
        marker=={'file':path.name,'sha256':digest(raw),'head':context['head'],'tree':context['tree']} and
        proof.get('head')==context['head'] and proof.get('tree')==context['tree'],
        'STORAGE53_COMPLETED_CURRENT_RESTORATION_SOURCE_REQUIRED')
    detail={**marker,'duplicate_finally_scan_performed':False,
        'qualification':'ACTUAL_COMPLETED_RESTORATION_SCAN; NO_SOURCE_OPERATION_BEFORE_FINALLY; NO_FRESH_SCAN_CLAIM'}
    r.receipt['storage53_final_source_boundary']=detail
    return proof


def main_origin05():
    import argparse,importlib.util,os,sys
    from pathlib import Path
    parser=argparse.ArgumentParser(description='C47 one-sequence storage-origin diagnostic; no ordinary/internal admission')
    parser.add_argument('--output',type=Path)
    parser.add_argument('--onboarding-denial53',action='store_true',help='one-shot107/a1 current-source diagnostic case03; no ordinary/internal admission')
    parser.add_argument('--onboarding-denial62',action='store_true',help='one-shot130/a1 native62 initial-consent first-reject diagnostic; no admission')
    parser.add_argument('--source-phase',choices=['SOURCE_PENDING','SOURCE_FROZEN'])
    args=parser.parse_args();root=Path(__file__).resolve().parents[3]
    if args.onboarding_denial53 and args.onboarding_denial62:parser.error('select exactly one diagnostic profile')
    targeted=args.onboarding_denial53 or args.onboarding_denial62
    if args.source_phase and targeted:parser.error('targeted onboarding denial requires hosted diagnostic execution')
    if args.source_phase:
        import json
        print(json.dumps(source_scope05(args.source_phase,root),sort_keys=True));return 0
    if args.output is None:parser.error('--output required for hosted diagnostic')
    token=os.environ.pop('C47_ARTIFACT_READ_TOKEN','')
    if token:raise ValueError('C47_STORAGE05_NO_ARTIFACT_IMPORT_OR_OLD_PRODUCT_TOKEN')
    path=root/'scripts/release/full-app-j01/native_runtime47.py'
    spec=importlib.util.spec_from_file_location('c47_storage_origin05_native_runtime',path)
    n=importlib.util.module_from_spec(spec);sys.modules[spec.name]=n;spec.loader.exec_module(n)
    output=args.output.absolute();n.require(not output.resolve().is_relative_to(root),'STORAGE05_OUTPUT_OUTSIDE_SOURCE')
    n.require(not output.exists() or output.is_dir() and not any(output.iterdir()),'STORAGE05_EMPTY_OUTPUT')
    output.mkdir(parents=True,exist_ok=True);r=n.Runner(root,output,seconds=84*60)
    r.receipt.update(stage='build',lane='SEPARATE_RELEASE_STORAGE_ORIGIN_DIAGNOSTIC_05',ordinary_admitted=False,diagnostic_only=True);r.persist()
    context=None;result=None;code=1
    try:
        context=n.hosted_stage_context(r,'build')
        if args.onboarding_denial62:_native05_target62_context(r,n,context)
        elif args.onboarding_denial53:_native05_target53_context(r,n,context)
        result=run_native_origin05(r,n,onboarding_denial53=targeted)
        code=0 if result['qualified_origin_observed'] else 1
    except Exception as error:
        r.receipt.update(status='PARTIAL_BLOCKED',stage_complete=False,
            failure={'type':type(error).__name__,'detail':str(error)},finished_utc=n.utc());r.persist()
    finally:
        if context is not None and r.receipt.get('source'):
            try:
                if targeted:_native05_final_source53(r,n,context,result)
                else:r.source_proof('source-after-storage05-finally',context['head'],allow_generation=True)
            except Exception as source_error:
                code=1;r.receipt['final_source_failure_type']=type(source_error).__name__
                if not r.receipt.get('failure'):
                    r.receipt['failure']={'type':type(source_error).__name__,'detail':'C47_STORAGE05_FINAL_SOURCE_PROOF_FAILED'}
        try:n.collect(r)
        except Exception as error:
            code=1;r.receipt['collection_failure']={'type':type(error).__name__}
        if not r.receipt.get('artifact_policy',{}).get('upload_within_limit'):code=1
        r.receipt['stage_complete']=bool(code==0 and r.receipt.get('stage_complete'))
        r.receipt['finished_utc']=n.utc();r.persist()
    manifest=None
    if context is not None:
        try:manifest=n.write_stage_provenance(output,'build',context)
        except Exception:code=1
    import json
    print(json.dumps({'status':r.receipt['status'],'stage':'build','stage_complete':code==0,
        'ordinary_admitted':False,'internal_admitted':False,'manifest':manifest,'release':'NO_GO'}))
    return code


# Root appends: if __name__ == '__main__': raise SystemExit(main_origin05())



ONBOARDING53_BOOLS = frozenset(['outerOperation', 'mounted', 'tokenCurrent', 'draftCurrent', 'consentCurrent', 'consentPresent', 'grantCurrent', 'versionCurrent', 'disclosureCurrent', 'atCurrentDenial', 'grantRequested', 'activeState', 'activationPending', 'privacyReady', 'privacyChecking', 'privacyDenied', 'healthOwnerCurrent', 'healthGenerationEqual', 'healthEpochEqual', 'healthAccountGenerationEqual', 'originalCapabilityCurrent', 'providerReadyState', 'hasDraft', 'routeTokenCurrent', 'routeReady', 'hasRouteLease', 'hasNavigation'])
ENUMS53 = dict(ENUMS05)
ENUMS53['SITES'] = ENUMS05['SITES'] | frozenset(['onboarding', 'consent-store', 'health-admission'])
ENUMS53['OPERATIONS'] = ENUMS05['OPERATIONS'] | frozenset(['revalidate', 'privacyStatus', 'setHealthDataCollectionConsentLocal', 'hasCurrentHealthDataCollectionConsentStrict', 'hasCurrentHealthDataCollectionConsentForLease', 'captureHealthDataWriteLease', 'assertHealthDataWriteLease', 'assertOriginalHealthDataWriteLease', 'completeHealthDataActivationRoute', 'getPrivateItemWhenReady', 'runPreparedPrivateRead46', 'getPrivateItemOnOriginalLease39', 'runOwnedPrivateGateRead39', 'assertPrivateGateAccountLease39', 'waitForWidgetCapabilityClears49'])
ENUMS53['STAGES'] = ENUMS05['STAGES'] | frozenset(['consent_false', 'consent_predicate', 'admitted', 'provider_status', 'route_status', 'activation_complete', 'captureHealthDataWriteLease', 'assertOriginalHealthDataWriteLease', 'getPrivateItemWhenReady', 'hasCurrentHealthDataCollectionConsentForLease', 'hasCurrentHealthDataCollectionConsentStrict', 'waitForWidgetCapabilityClears49', 'runPreparedPrivateRead46', 'getPrivateItemOnOriginalLease39', 'runOwnedPrivateGateRead39', 'assertPrivateGateAccountLease39', 'read', 'assertPurpose', 'assertOriginal', 'join', 'Crypto.digestStringAsync', 'assertConsentMutationCurrent', 'attempt', 'closeProcessingEpochImmediately', 'operation.assertCurrent', 'runHealthDataWriteOperation', 'updatePrivateItem'])
ENUMS53['CODES'] = ENUMS05['CODES'] | frozenset(['CURRENT_HEALTH_CONSENT_REQUIRED', 'HEALTH_CONSENT_INVALID', 'HEALTH_CONSENT_UNSUPPORTED_VERSION', 'HEALTH_CONSENT_MUTATION_SUPERSEDED'])

def validate_onboarding_trace53(raw, head, bundle, pid):
    """Validate content-free diagnostic bytes only; no ordinary/runtime admission."""
    error_snapshots = {}
    def pairs(rows):
        result = {}
        for key, value in rows:
            require05(key not in result, 'DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    def number(text):
        require05(len(text) <= 17, 'NUMBER_BOUND')
        return int(text)
    def reject_number(_text):
        raise ValueError('C47_STORAGE_ORIGIN05_NONINTEGER_JSON_NUMBER')
    def closed(value, required, optional=()):
        require05(type(value) is dict and set(required) <= set(value) <= set(required) | set(optional), 'CLOSED_SCHEMA')
    def integer(value, low=0, high=1000000):
        return type(value) is int and low <= value <= high
    def member(value, name):
        return type(value) is str and value in ENUMS53[name]
    def error(value):
        closed(value, ('chain', 'causeEnding'))
        chain = value['chain']
        require05(type(chain) is list and 1 <= len(chain) <= 3 and value['causeEnding'] in ('not_supplied', 'cycle', 'depth_limit'), 'CAUSE_BOUND')
        require05(value['causeEnding'] != 'depth_limit' or len(chain) == 3, 'CAUSE_DEPTH')
        ids = []
        for node in chain:
            closed(node, ('errorId', 'kind', 'errorClass', 'recognizedCode', 'recognizedCount', 'recognizedCodeField', 'numericFields', 'numericQualification', 'arbitraryMessageStackAndObjectOmitted'))
            require05(integer(node['errorId'], 0, 1024) and node['kind'] in ('undefined', 'null', 'boolean', 'number', 'bigint', 'string', 'symbol', 'object', 'function'), 'ERROR_KIND_ID')
            require05(member(node['errorClass'], 'ERROR_CLASSES') or node['errorClass'] == 'UNCLASSIFIED', 'ERROR_CLASS')
            code = node['recognizedCode']
            require05(member(code, 'CODES') or code in ('UNCLASSIFIED', 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED'), 'ERROR_CODE')
            require05(node['recognizedCodeField'] in ('none', 'primitive', 'code', 'message') and ((code == 'UNCLASSIFIED') == (node['recognizedCodeField'] == 'none')), 'ERROR_CODE_FIELD')
            require05((integer(node['recognizedCount'], 1, 2) if code == 'PRIVATE_KV_CONTENT_KEY_CLEAR_FAILED' else node['recognizedCount'] is None), 'CODE_COUNT')
            require05(node['arbitraryMessageStackAndObjectOmitted'] is True and node['numericQualification'] == 'SUPPLIED_OWN_DATA_FIELD_ONLY_NOT_INFERRED_OSSTATUS', 'ERROR_PRIVACY')
            fields = node['numericFields']
            require05(type(fields) is list and len(fields) <= 5, 'NUMERIC_BOUND')
            names = set()
            for field in fields:
                closed(field, ('field', 'value'))
                require05(field['field'] in ('code', 'nativeCode', 'nativeErrorCode', 'osStatus', 'errno') and field['field'] not in names and integer(field['value'], -2147483648, 2147483647), 'NUMERIC_FIELD')
                names.add(field['field'])
            if node['kind'] not in ('object', 'function'):
                require05(node['errorId'] == 0 and not fields and node['errorClass'] == 'UNCLASSIFIED' and node['recognizedCodeField'] in ('none', 'primitive'), 'PRIMITIVE_ERROR')
            if node['errorId']:
                require05(node['errorId'] not in ids, 'CAUSE_ID_CYCLE')
                require05(error_snapshots.setdefault(node['errorId'], node) == node, 'ERROR_ID_CLASSIFICATION_CHANGED')
                ids.append(node['errorId'])
    bools = set(ONBOARDING53_BOOLS) | {'revisionChanged', 'accountBoundaryActive', 'accountGenerationChanged', 'revisionEqual', 'accountGenerationEqual', 'boundaryBlocked', 'ownerCurrent', 'leaseCurrent', 'keyPresent', 'rawPresent', 'markerPresent'}
    counts = {'liveClaimsCount', 'failedClaimsCount', 'liveClaims', 'failedClaims', 'keyCount', 'encryptedCount'}
    meta_enums = {'keyCategory': 'KEY_CATEGORIES', 'envelopeKind': 'ENVELOPE_KINDS', 'ageStatus': 'AGE_STATUSES', 'stage': 'STAGES', 'predicate': 'PREDICATES', 'disposition': 'DISPOSITIONS'}
    def record(value):
        closed(value, ('sequence', 'site', 'operation', 'phase', 'attempt', 'meta'), ('sourceLine', 'stage', 'disposition', 'error'))
        require05(integer(value['sequence'], 1, 9007199254740991) and integer(value['attempt']) and member(value['site'], 'SITES') and member(value['operation'], 'OPERATIONS') and member(value['phase'], 'PHASES'), 'RECORD_ENUM_ID')
        require05(('error' in value) == (value['phase'] in ('failure', 'caught')), 'ERROR_PHASE')
        for key, enum in [('stage', 'STAGES'), ('disposition', 'DISPOSITIONS')]:
            if key in value: require05(member(value[key], enum), 'RECORD_OPTIONAL_ENUM')
        if 'sourceLine' in value: require05(integer(value['sourceLine'], 1), 'SOURCE_LINE')
        meta = value['meta']; closed(meta, (), bools | counts | set(meta_enums) | {'parentAttempt'})
        for key, item in meta.items():
            require05(type(item) is bool if key in bools else integer(item, 0, 65535) if key in counts else integer(item) if key == 'parentAttempt' else member(item, meta_enums[key]), 'META_TYPE_ENUM')
        if 'error' in value: error(value['error'])
    require05(type(raw) is bytes and 0 < len(raw) <= 2 * 1024 * 1024, 'RAW_BOUND')
    require05(type(head) is str and re.fullmatch('[a-f0-9]{40}', head) and bundle == 'com.layerwell.app.staging' and integer(pid, 1, 2147483647), 'EXPECTED_IDENTITY')
    try: result = json.loads(raw.decode('utf-8'), object_pairs_hook=pairs, parse_int=number, parse_float=reject_number, parse_constant=reject_number)
    except (UnicodeDecodeError, json.JSONDecodeError, RecursionError): raise ValueError('C47_STORAGE_ORIGIN05_JSON_FORMAT') from None
    closed(result, ('schema', 'role', 'diagnosticMarker', 'sourceHead', 'pid', 'bundle', 'eventLimit', 'events', 'firstFailure', 'firstUIFailure', 'firstFailureQualification', 'droppedEvents', 'flushFailures', 'errorIdentityLimit', 'ordinaryAdmitted', 'acceptanceGranted', 'release', 'traceFormatVersion', 'failureWindowLimit', 'failureWindow', 'failureWindowEvicted', 'failureWindowFrozenAtFirstUI', 'onboarding53'))
    require05(type(result['schema']) is int and result['schema'] == 1 and result['sourceHead'] == head and type(result['pid']) is int and result['pid'] == pid and result['bundle'] == bundle, 'IDENTITY')
    require05(result['role'] == 'STAGING_STORAGE_ORIGIN05_DIAGNOSTIC_ONLY' and result['diagnosticMarker'] == 'C47_STORAGE_ORIGIN_DIAGNOSTIC_05' and type(result['eventLimit']) is int and result['eventLimit'] == 512 and type(result['errorIdentityLimit']) is int and result['errorIdentityLimit'] == 1024 and result['ordinaryAdmitted'] is False and result['acceptanceGranted'] is False and result['release'] == 'NO_GO', 'DIAGNOSTIC_ONLY')
    require05(result['firstFailureQualification'] == 'FIRST_OBSERVED_FAILURE_NOT_CAUSAL_DIAGNOSIS; CORRELATE_PROPAGATED_ERROR_IDS_TO_UI_CONVERSION' and integer(result['droppedEvents'], 0, 2147483647) and integer(result['flushFailures'], 0, 65535), 'COUNTERS_QUALIFICATION')
    events = result['events']; require05(type(events) is list and len(events) <= 512, 'EVENT_BOUND')
    for event in events: record(event)
    sequences = [event['sequence'] for event in events]
    require05(sequences == sorted(set(sequences)), 'MONOTONIC_SEQUENCE')
    if result['droppedEvents'] == 0: require05(sequences == list(range(1, len(events) + 1)), 'COMPLETE_SEQUENCE')
    failures = [event for event in events if 'error' in event]
    first = result['firstFailure']; ui = result['firstUIFailure']
    ui_events = [event for event in failures if (event.get('disposition') or event['meta'].get('disposition')) == 'ui_conversion']
    require05((first is None) == (not failures), 'FIRST_FAILURE_PRESENCE')
    if first is not None: record(first); require05(first == failures[0], 'FIRST_FAILURE_IMMUTABLE')
    if ui is not None:
        record(ui); require05('error' in ui and (ui.get('disposition') or ui['meta'].get('disposition')) == 'ui_conversion' and first is not None and ui['sequence'] >= first['sequence'], 'FIRST_UI_FAILURE')
        same = [event for event in events if event['sequence'] == ui['sequence']]
        require05(same == [ui] if same else result['droppedEvents'] > 0, 'UI_IMMUTABLE_OR_DECLARED_DROP')
        if ui_events: require05(ui == ui_events[0], 'FIRST_UI_IMMUTABLE')
    else: require05(not ui_events, 'FIRST_UI_PRESENCE')
    require05(type(result['traceFormatVersion']) is int and result['traceFormatVersion'] == 2 and type(result['failureWindowLimit']) is int and result['failureWindowLimit'] == 64, 'FAILURE_WINDOW_VERSION')
    window = result['failureWindow']; evicted = result['failureWindowEvicted']
    require05(type(window) is list and len(window) <= 64 and integer(evicted, 0, 2147483647) and type(result['failureWindowFrozenAtFirstUI']) is bool, 'FAILURE_WINDOW_BOUND')
    for event in window:
        record(event)
        require05('error' in event, 'FAILURE_WINDOW_ERROR_ONLY')
    window_sequences = [event['sequence'] for event in window]
    require05(window_sequences == sorted(set(window_sequences)), 'FAILURE_WINDOW_SEQUENCE')
    require05(max(sequences + window_sequences + [0]) <= len(events) + result['droppedEvents'], 'OBSERVED_SEQUENCE_COUNTER')
    require05((first is None) == (not window) and (not evicted or len(window) == 64), 'FAILURE_WINDOW_PRESENCE')
    require05(not window or len(window) + evicted <= window[-1]['sequence'], 'FAILURE_WINDOW_EVICTION_COUNTER')
    by_sequence = {event['sequence']: event for event in events}
    for event in window:
        require05(by_sequence.get(event['sequence'], event) == event, 'FAILURE_WINDOW_SHARED_RECORD_CHANGED')
    if first is not None:
        require05(window[0]['sequence'] >= first['sequence'], 'FAILURE_WINDOW_AFTER_FIRST')
        require05(window[0] == first if evicted == 0 else window[0]['sequence'] > first['sequence'], 'FAILURE_WINDOW_EVICTION')
        for event in failures:
            if window[0]['sequence'] <= event['sequence'] <= window[-1]['sequence']:
                require05(event in window, 'FAILURE_WINDOW_MISSING_RETAINED_ERROR')
    require05(result['failureWindowFrozenAtFirstUI'] == (ui is not None), 'FAILURE_WINDOW_FROZEN')
    if ui is not None:
        require05(window and window[-1] == ui, 'FAILURE_WINDOW_FIRST_UI_LAST')
        require05([event for event in window if (event.get('disposition') or event['meta'].get('disposition')) == 'ui_conversion'] == [ui], 'FAILURE_WINDOW_FIRST_UI_ONLY')
    else:
        require05(not any((event.get('disposition') or event['meta'].get('disposition')) == 'ui_conversion' for event in window), 'FAILURE_WINDOW_NO_UNDECLARED_UI')

    target = result['onboarding53']
    closed(target, ('profile','windowLimit','window','evicted','latestDenial','denialWindow','denialWindowEvicted',
        'latestGrantBegin','latestGrantPass','latestGrantPassBegin','latestActivationPass','latestRevalidateBegin','latestRevalidateOutcome',
        'latestConsentResult','latestProviderStatus','latestRouteStatus'))
    require05(target['profile'] == 'ONBOARDING_DENIAL_ORIGIN53_ONLY' and type(target['windowLimit']) is int and target['windowLimit'] == 64, 'TARGET53_PROFILE')
    observed = {event['sequence']: event for event in events + window}
    def target_record(event):
        record(event)
        require05(event['sequence'] <= len(events) + result['droppedEvents'], 'TARGET53_SEQUENCE_COUNTER')
        require05(observed.setdefault(event['sequence'], event) == event, 'TARGET53_SHARED_RECORD_CHANGED')
    def actual_false(event):
        return event['phase'] == 'state' and event['meta'].get('consentCurrent') is False and (
            event['site'] == 'onboarding' and event['operation'] == 'revalidate' and event.get('stage') == 'consent_false' or
            event['site'] == 'consent-store' and event.get('stage') == 'consent_predicate')
    for name, counter in [('window','evicted'),('denialWindow','denialWindowEvicted')]:
        records = target[name]
        require05(type(records) is list and len(records) <= 64 and integer(target[counter],0,2147483647), 'TARGET53_WINDOW_BOUND')
        require05(not target[counter] or len(records) == 64, 'TARGET53_WINDOW_EVICTION')
        for event in records:
            target_record(event)
            require05('error' in event or actual_false(event), 'TARGET53_ERROR_OR_ACTUAL_FALSE_ONLY')
        numbers=[event['sequence'] for event in records]
        require05(numbers == sorted(set(numbers)), 'TARGET53_WINDOW_SEQUENCE')
    snapshots = ('latestDenial','latestGrantBegin','latestGrantPass','latestGrantPassBegin','latestActivationPass','latestRevalidateBegin',
        'latestRevalidateOutcome','latestConsentResult','latestProviderStatus','latestRouteStatus')
    for name in snapshots:
        if target[name] is not None: target_record(target[name])
    denial = target['latestDenial']
    if denial is None:
        require05(not target['denialWindow'] and target['denialWindowEvicted'] == 0, 'TARGET53_NO_FAKE_DENIAL_WINDOW')
    else:
        require05(denial['site']=='onboarding' and denial['operation']=='revalidate' and denial['phase']=='caught' and
            denial.get('disposition')=='ui_conversion' and denial['meta'].get('atCurrentDenial') is True and
            denial['meta'].get('mounted') is True and target['denialWindow'] and target['denialWindow'][-1]==denial, 'TARGET53_CURRENT_DENIAL')
        if 'tokenCurrent' in denial['meta']: require05(denial['meta']['tokenCurrent'] is True,'TARGET53_NOT_SUPERSEDED')
    for name,phase in [('latestGrantBegin','begin'),('latestGrantPass','pass'),('latestGrantPassBegin','begin')]:
        event=target[name]
        if event is not None: require05(event['site']=='consent-store' and event['operation']=='setHealthDataCollectionConsentLocal' and
            event['phase']==phase and event['meta'].get('outerOperation') is True and event['meta'].get('grantRequested') is True,'TARGET53_REAL_GRANT_PHASE')
    grant=target['latestGrantPass']; begin=target['latestGrantBegin']
    paired=target['latestGrantPassBegin']
    if paired is not None: require05(grant is not None and paired['attempt']==grant['attempt'] and paired['sequence']<grant['sequence'],'TARGET53_ACTUAL_PAIRED_GRANT')
    if grant is not None and begin is not None and grant['attempt']==begin['attempt']: require05(begin['sequence']<grant['sequence'],'TARGET53_GRANT_CHRONOLOGY')
    activation=target['latestActivationPass']
    if activation is not None: require05(activation['site']=='lifecycle' and activation['operation']=='completeHealthDataActivationRoute' and
        activation['phase']=='pass' and activation.get('stage')=='activation_complete' and activation['meta'].get('activeState') is True and
        activation['meta'].get('activationPending') is False,'TARGET53_REAL_ACTIVATION')
    check=target['latestRevalidateBegin']
    if check is not None: require05(check['site']=='onboarding' and check['operation']=='revalidate' and check['phase']=='begin' and
        check['meta'].get('outerOperation') is True,'TARGET53_REVALIDATE_BEGIN')
    outcome=target['latestRevalidateOutcome']
    if outcome is not None: require05(outcome==denial or outcome['site']=='onboarding' and outcome['operation']=='revalidate' and
        outcome['phase']=='state' and outcome.get('stage')=='admitted' and outcome['meta'].get('privacyReady') is True,'TARGET53_REVALIDATE_OUTCOME')
    consent=target['latestConsentResult']
    if consent is not None: require05(consent['site']=='consent-store' and consent['operation'] in (
        'hasCurrentHealthDataCollectionConsentStrict','hasCurrentHealthDataCollectionConsentForLease') and consent['phase']=='state' and
        consent.get('stage')=='consent_predicate' and type(consent['meta'].get('consentCurrent')) is bool,'TARGET53_ACTUAL_CONSENT_RESULT')
    for name,stage in [('latestProviderStatus','provider_status'),('latestRouteStatus','route_status')]:
        event=target[name]
        if event is not None:
            require05(event['site']=='onboarding' and event['operation']=='privacyStatus' and event['phase']=='state' and
                event.get('stage')==stage and sum(event['meta'].get(k) is True for k in ('privacyReady','privacyChecking','privacyDenied'))==1,
                'TARGET53_ACTUAL_STATUS_RETURN')
    return result


def qualifying_onboarding_origin53(validated):
    """Causal qualification requires observed post-grant predicates; other evidence stays separate."""
    target=validated['onboarding53']
    denial=target['latestDenial']; grant=target['latestGrantPass']; grant_begin=target['latestGrantPassBegin']
    activation=target['latestActivationPass']; route=target['latestRouteStatus']; provider=target['latestProviderStatus']
    latest_status=max((event for event in (route,provider) if event is not None), key=lambda event:event['sequence'], default=None)
    chronology={name:target[name] for name in ('latestGrantBegin','latestGrantPass','latestGrantPassBegin','latestActivationPass',
        'latestRevalidateBegin','latestRevalidateOutcome','latestConsentResult','latestProviderStatus','latestRouteStatus')}
    base={'ordinary_admitted':False,'internal_admitted':False,'acceptance_granted':False,'release':'NO_GO',
        'causal_origin_qualified':False,'native_holder':'UNOBSERVED','chronology':chronology,
        'qualification':'ACTUAL_DIAGNOSTIC_OBSERVATION_ONLY; NO_ABSENT_PASS_OR_NATIVE_HOLDER_OR_ORDINARY_ADMISSION'}
    after=max((event['sequence'] for event in (grant,activation) if event is not None),default=0)
    denied_render=latest_status is not None and latest_status['meta'].get('privacyDenied') is True and latest_status['sequence']>after
    if not grant or not grant_begin or grant_begin['attempt']!=grant['attempt'] or not denied_render:
        return None
    rows={event['sequence']:event for event in target['window']+target['denialWindow']}
    check=target['latestRevalidateBegin']; outcome=target['latestRevalidateOutcome']
    false_branches=[event for event in rows.values() if event['sequence']>grant['sequence'] and event['sequence']<latest_status['sequence'] and
        event['site']=='onboarding' and event['operation']=='revalidate' and event['phase']=='state' and event.get('stage')=='consent_false' and
        event['meta'].get('consentCurrent') is False and event['meta'].get('mounted') is True and event['meta'].get('tokenCurrent') is True and
        event['attempt']>0 and (denial is None or denial['sequence']>event['sequence'] and denial['attempt']==event['attempt']) and
        not (outcome is not None and outcome['sequence']>event['sequence'] and outcome.get('stage')=='admitted')]
    for branch in sorted(false_branches,key=lambda event:event['sequence'],reverse=True):
        returns=[event for event in rows.values() if grant['sequence']<event['sequence']<branch['sequence'] and event['site']=='consent-store' and
            event['operation']=='hasCurrentHealthDataCollectionConsentForLease' and event['phase']=='state' and event.get('stage')=='consent_predicate' and
            event['meta'].get('parentAttempt')==branch['attempt'] and event['meta'].get('consentCurrent') is False and
            all(type(event['meta'].get(key)) is bool for key in ('consentPresent','grantCurrent','versionCurrent','disclosureCurrent'))]
        if returns:
            actual=max(returns,key=lambda event:event['sequence']);meta=actual['meta']
            predicate=next((label for key,label in [('consentPresent','CONSENT_ABSENT'),('grantCurrent','CONSENT_NOT_GRANTED'),
                ('versionCurrent','CONSENT_VERSION_NOT_CURRENT'),('disclosureCurrent','CONSENT_HASH_NOT_CURRENT')] if meta[key] is False),None)
            if predicate is not None:
                return dict(base,causal_origin_qualified=True,kind='ACTUAL_ONBOARDING_FALSE_CONSENT_BEFORE_EXISTING_ERROR',
                    predicate=predicate,origin=actual,branch=branch,ui=latest_status,original_caught_error=denial)
    async_admitted_check = denial is not None and denial['meta'].get('outerOperation') is False and denial['meta'].get('tokenCurrent') is True
    if denial is not None and denial['sequence']>grant['sequence'] and (denial['sequence']>after or async_admitted_check):
        ids={node['errorId'] for node in denial['error']['chain'] if node['errorId']}
        earlier=[event for event in target['denialWindow'] if event['sequence']<denial['sequence'] and 'error' in event and
            event['site']!='onboarding' and event.get('disposition')!='probe' and 'sourceLine' in event and
            ids.intersection(node['errorId'] for node in event['error']['chain'] if node['errorId'])]
        if earlier:
            return dict(base,causal_origin_qualified=True,kind='ACTUAL_SAME_ERROR_PROPAGATED_TO_ONBOARDING_DENIAL',origin=earlier[0],ui=denial)
        return dict(base,kind='ONBOARDING_CURRENT_DENIAL_ORIGINAL_ERROR_NO_LOWER_ORIGIN_OBSERVED',ui=denial,origin=None)
    return dict(base,kind='POST_GRANT_DENIED_RENDER_CHRONOLOGY_ONLY_ORIGINAL_ERROR_UNOBSERVED',origin=None,ui=latest_status,
        latest_denial_is_not_claimed_post_grant=denial)

TARGETED53_PRIOR_HEAD = '50cdfb2e40412746a5e38776fafc475946a4db6a'


TARGETED53_PROFILE = {'profile':'TARGETED_INITIAL_ONBOARDING_DENIAL53','append_only_commits':107,
    'run_attempt':1,'selected_case':'testV04ExplicitWithdrawalReviewCancelAndFreshReconsent',
    'own_full_thirty_source_controls':True,'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}


def _native05_target53_context(r,n,context):
    n.require(type(context.get('run_attempt')) is int and context['run_attempt']==1 and
        r.env.get('GITHUB_EVENT_NAME')=='pull_request','STORAGE53_ONE_SHOT_EVENT_AND_ATTEMPT')
    count=r.text('storage53-append-only-commit-count',['git','--no-replace-objects','rev-list','--count',
        '02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],timeout=60)
    parent=r.text('storage53-preserved105-parent',['git','--no-replace-objects','rev-parse','HEAD~2'],timeout=60)
    n.require(count=='107' and parent==TARGETED53_PRIOR_HEAD,'STORAGE53_EXACT107_AND_TWO_APPEND_ONLY_SUCCESSORS')
    proof={'source_head':context['head'],'source_tree':context['tree'],'run_attempt':1,
        'actual_append_only_commits':107,'two_commits_before_actual_head':parent,
        'profile':dict(TARGETED53_PROFILE),'ordinary_admitted':False,'internal_admitted':False}
    r.receipt['storage53_profile']=dict(TARGETED53_PROFILE)
    r.passed('storage53-one-shot-context',proof)
    return proof


def _native05_full_source_controls53(r,n):
    directory=r.output;receipt=r.receipt
    n.producer_source_matches(r,receipt,directory)
    tools=n.stage_json(n.read_native_file(directory/'toolchain.json'))
    n.require(tools.get('build_environment')==n.ENVIRONMENT and tools.get('architecture')=='x86_64' and
        tools.get('node')=='v22.22.2' and tools.get('npm')=='11.20.0' and
        tools.get('xcode','').startswith('Xcode 26.4') and
        tools.get('simulator_build_flags')==n.SIMULATOR_BUILD_FLAGS and
        tools.get('app_simulator_build_flags')==n.APP_SIMULATOR_BUILD_FLAGS,'STORAGE53_CURRENT_TOOLCHAIN')
    n.require(n.stage_json(n.read_native_file(directory/'source-before.json'))==receipt['source']==
        n.stage_json(n.read_native_file(directory/'source-after-install.json')),
        'STORAGE53_UNPROJECTED_SOURCE_BEFORE_COMPILE')
    n.require(all(row.get('state')=='PASS' and row.get('exit_code')==0 and
        row.get('capture_complete') is True and not row.get('timed_out')
        for row in receipt.get('commands',[]) if row.get('required')),'STORAGE53_COMPLETE_REQUIRED_CONTROL_CAPTURES')
    for name in n.SOURCE_COMMANDS04:
        row,_=n.executed_producer_command(receipt,directory,name)
        n.require(row.get('required') is True,'STORAGE53_REQUIRED_SOURCE_COMMAND')
    control,streams=n.executed_producer_command(receipt,directory,'generated47-controls',read_output=True)
    raw=b'\n'.join(streams)
    source=n.read_native_file(r.root/'scripts/release/full-app-j01/native_generated47.test.mjs').decode('utf8')
    n.full_generated_control_proof(control['argv'],raw,source)
    names=re.findall(r"^test\('([^'\n]+)'",source,re.M)
    events=[n.stage_json(event.encode()) for event in re.findall(
        r'^(?:#\s*)?(\{"event":"C47_SOURCE_CASE_(?:BEGIN|END)"[^\n]+\})$',raw.decode('utf8'),re.M)]
    n.require(len(events)==60 and all([event.get('name') for event in events if
        event.get('event')=='C47_SOURCE_CASE_'+phase]==names for phase in ('BEGIN','END')),
        'STORAGE53_ALL_THIRTY_CASE_EVENTS')
    return {'profile':dict(TARGETED53_PROFILE),'source_before_sha256':n.sha(directory/'source-before.json'),
        'source_after_sha256':n.sha(directory/'source-after-install.json'),
        'source_after_file':'source-after-install.json','source_after_boundary':'ACTUAL_PREPARE_RETURN_AFTER_ALL_SOURCE_COMMANDS_AND_DEPENDENCY_GRAPH',
        'toolchain_sha256':n.sha(directory/'toolchain.json'),'current_source_sha256':n.sha(directory/'current-generated47-source.json'),
        'full_thirty_stdout_sha256':control['stdout_sha256'],'full_thirty_stderr_sha256':control['stderr_sha256'],
        'case_events':60,'controls_complete_before_generation_and_compile':True,'ordinary_admitted':False,'internal_admitted':False}


def _native05_selected_method(n,onboarding_denial53):
    method=n.NORMAL_UI_CASES04[2 if onboarding_denial53 else 0]
    if onboarding_denial53:n.require(method==TARGETED53_PROFILE['selected_case'],'STORAGE53_EXACT_EXISTING_THIRD_CASE')
    return method


TARGETED62_PRIOR_HEAD = '39ce16cdcadca2cbde1ba64ae7dea0f9c99de280'
TARGETED62_PROFILE = {**TARGETED53_PROFILE, 'profile':'CURRENT130_INITIAL_CONSENT_DENIAL62',
    'append_only_commits':130,'authorization':'BRAIN-C47-NATIVE-STALL-DEPENDENCY-RUNTIME-07',
    'trace_schema':'UNCHANGED_TARGETED53_CONTENT_FREE_FIRST_REJECT', 'native_attempt':62}


def _native05_target62_context(r,n,context):
    n.require(type(context.get('run_attempt')) is int and context['run_attempt']==1 and
        r.env.get('GITHUB_EVENT_NAME')=='pull_request','STORAGE62_ONE_SHOT_EVENT_AND_ATTEMPT')
    count=r.text('storage62-append-only-commit-count',['git','--no-replace-objects','rev-list','--count',
        '02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],timeout=60)
    parent=r.text('storage62-preserved128-parent',['git','--no-replace-objects','rev-parse','HEAD~2'],timeout=60)
    n.require(count=='130' and parent==TARGETED62_PRIOR_HEAD,'STORAGE62_EXACT130_AND_TWO_APPEND_ONLY_SUCCESSORS')
    proof={'source_head':context['head'],'source_tree':context['tree'],'run_attempt':1,
        'actual_append_only_commits':130,'two_commits_before_actual_head':parent,
        'profile':dict(TARGETED62_PROFILE),'ordinary_admitted':False,'internal_admitted':False}
    r.receipt['storage62_profile']=dict(TARGETED62_PROFILE)
    r.passed('storage62-one-shot-context',proof)
    return proof


def _native05_full_source_controls62(r,n):
    n.require(r.receipt.get('storage62_profile')==TARGETED62_PROFILE and
        r.receipt.get('stages',{}).get('storage62-one-shot-context',{}).get('status')=='PASS',
        'STORAGE62_CURRENT_CONTEXT_REQUIRED')
    # Reuse every original required command, current-source/installed-input/full30/60 proof.
    proof=_native05_full_source_controls53(r,n)
    return {**proof,'profile':dict(TARGETED62_PROFILE),'historical_schema53_not_a107_execution':True}


def _native05_observed_pid62(r,n,device,bundle,head,installed,inventory):
    import subprocess,uuid
    data=r._storage05_first_data_container
    expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Data/Application'
    n.require(data.parent==expected and str(uuid.UUID(data.name)).lower()==data.name.lower(),
        'STORAGE62_OWN_DIAGNOSTIC_DATA_CONTAINER')
    identity_path=data/'Documents/C47StorageOrigin05Identity.json'
    n.require(identity_path.stat().st_size<=4096,'STORAGE62_NATIVE_IDENTITY_SIZE')
    identity=n.stage_json(n.read_native_file(identity_path))
    n.require(set(identity)=={'schema','pid','sourceHead','bundle'} and type(identity['schema']) is int and
        identity['schema']==1 and type(identity['pid']) is int and 0<identity['pid']<=2147483647 and
        identity['sourceHead']==head and identity['bundle']==bundle=='com.layerwell.app.staging',
        'STORAGE62_CURRENT_NATIVE_IDENTITY')
    app=Path(installed);expected=Path.home()/'Library/Developer/CoreSimulator/Devices'/device/'data/Containers/Bundle/Application'
    n.require(app.parent.parent==expected and app.name=='LayerwellStaging.app' and
        str(uuid.UUID(app.parent.name)).lower()==app.parent.name.lower(),'STORAGE62_OWN_INSTALLED_CONTAINER')
    rows=[q for q in inventory['files']if q.get('path')=='LayerwellStaging'];n.require(len(rows)==1 and rows[0].get('type')=='file','STORAGE62_ONE_EXECUTABLE')
    binary=app/'LayerwellStaging';n.require(n.stage_file_digest(binary)=={k:rows[0][k]for k in ('bytes','sha256')},
        'STORAGE62_INSTALLED_EXECUTABLE_BYTES')
    p=subprocess.run(['/bin/ps','-p',str(identity['pid']),'-o','comm='],capture_output=True,env=r.env,timeout=3)
    n.require(p.returncode==0 and len(p.stdout)<=4096 and p.stdout.decode('utf8').strip()==str(binary),
        'STORAGE62_PID_EXECUTABLE_PATH')
    return identity['pid']


@contextmanager
def _native05_observe62(r,n,device,bundle,head,installed,inventory):
    """At most three own-PID native samples around the actual initial consent tap."""
    import subprocess,threading,time
    stop=threading.Event();rows=[]
    def persist():
        n.write_json(r.output/'external-consent-native-threads62.json',{'schema':1,'source':r.receipt['source'],
            'authorization':'BRAIN-C47-NATIVE-STALL-DEPENDENCY-RUNTIME-07','sampling_only':True,
            'diagnostic_product_only':True,'raw_sample_policy':'DISCARDED; WHITELISTED_MAIN_THREAD_SYMBOLS_ONLY',
            'ordinary_admitted':False,'observations':rows})
    def observe():
        try:
            n.require(Path('/usr/bin/sample').is_file(),'STORAGE62_SAMPLE_TOOL')
            started=None;pending=[]
            while not stop.wait(0.5) and time.monotonic()<r.deadline-45:
                if started is None:
                    logs=list((r.output/'logs').glob('*-native-normal-staging-ui.stdout'))
                    n.require(len(logs)<=1,'STORAGE62_ONE_OWNED_UI_STREAM')
                    if not logs or b'Tap "I agree. Continue" Button' not in n.read_live_ui06(logs[0]):continue
                    started=time.monotonic();pending=[(started+d,d)for d in (1,10,25)]
                    rows.append({'state':'GENUINE_INITIAL_CONSENT_TAP_OBSERVED','utc':n.utc()});persist()
                if not pending:return
                due,delay=pending[0]
                if time.monotonic()<due:continue
                pending.pop(0);row={'after_trigger_seconds':delay,'started_utc':n.utc(),'stage':'PID_BINDING'};rows.append(row)
                try:
                    pid=_native05_observed_pid62(r,n,device,bundle,head,installed,inventory)
                    row['stage']='SAMPLE'
                    q=subprocess.run(['/usr/bin/sample',str(pid),'3','1','-mayDie','-file','/dev/stdout'],
                        capture_output=True,env=r.env,timeout=10)
                    row['stage']='PID_RECHECK';same=_native05_observed_pid62(r,n,device,bundle,head,installed,inventory)==pid
                    frames=n.native_frames07(q.stdout)
                    row.update(pid=pid,pid_executable_rechecked=same,exit_code=q.returncode,
                        stdout_bytes=len(q.stdout),stdout_sha256=digest(q.stdout),stderr_bytes=len(q.stderr),stderr_sha256=digest(q.stderr),
                        frames=frames if same else[],state='CAPTURED_STABLE_PID'if q.returncode==0 and same else'UNAVAILABLE_OR_PID_CHANGED',
                        raw_stdout_stderr_retained=False)
                except Exception as error:
                    row.update(state='UNAVAILABLE',error_type=type(error).__name__,
                        code=str(error)if re.fullmatch('C47_STORAGE62_[A-Z_]+',str(error))else None)
                row['finished_utc']=n.utc();persist()
        except Exception as error:
            rows.append({'state':'OBSERVER_UNAVAILABLE','error_type':type(error).__name__});persist()
    thread=threading.Thread(target=observe,daemon=True);thread.start()
    try:yield
    finally:
        stop.set();thread.join(timeout=45);rows.append({'state':'OBSERVER_JOINED'if not thread.is_alive()else'OBSERVER_JOIN_TIMEOUT','utc':n.utc()});persist()



PRIVACY08_GATE_SHA = '0fc3cfe1cb14606ae3396892d942c568fd858f9e36f147233ba03d24463d3117'
# C08 additive exact-source diagnostic. Legacy source/security/installer validators remain unchanged.
PRIVACY08_AUTH='BRAIN-C47-PRIVACY-ORIGIN-RUNTIME-08'
PRIVACY08_START='691b4c5e695acbe0d4557dcdcb7ae21cf01c4e09'
PRIVACY08_GATE='apps/mobile/src/features/healthConsent/HealthDataLifecycleGate.tsx'

@contextmanager
def diagnostic_inputs08(root,ios,evidence,head,run,*,targeted_onboarding53=False):
    need(targeted_onboarding53,'PRIVACY08_TARGETED_ONLY')
    root=Path(root);gate=root/PRIVACY08_GATE;need(gate.is_file()and not gate.is_symlink()and gate.stat().st_nlink==1,'PRIVACY08_REGULAR_GATE');gate_before=gate.read_bytes()
    need(digest(gate_before)==PRIVACY08_GATE_SHA,'PRIVACY08_GATE_ORIGINAL')
    with _privacy08_original_inputs(root,ios,evidence,head,run,targeted_onboarding53=True) as entry:
        evidence=Path(evidence);entry_before=entry.read_bytes();legacy={p:(root/p).read_bytes()for p in ONBOARDING53_SOURCE_PREIMAGES}
        saved=evidence/'original'/PRIVACY08_GATE;saved.parent.mkdir(parents=True,exist_ok=True);saved.write_bytes(gate_before)
        expected={**ONBOARDING53_SOURCE_PREIMAGES,PRIVACY08_GATE:PRIVACY08_GATE_SHA}
        request=evidence/'PRIVACY08_REQUEST.json';manifest=evidence/'PRIVACY08_TRANSFORM.json';out=evidence/'privacy08-generated'
        document(request,{'profile':'PRIVACY08_EXACT137','source_head':head,'original':str(evidence/'original'),'output':str(out),'manifest':str(manifest),'expected':expected})
        run('privacy08-exact-transform',['node',root/'scripts/release/full-app-j01/storage_origin47.mjs','--privacy08',request],timeout=60)
        result=json.loads(manifest.read_bytes());need(result['source_head']==head and {r['path']for r in result['files']}==set(expected),'PRIVACY08_EXACT_NINE_SOURCES')
        applied={};entry_after=None
        try:
            for row in result['files']:
                rel=row['path'];raw=(out/rel).read_bytes();need(digest(raw)==row['after']['sha256'],'PRIVACY08_AFTERIMAGE');path=root/rel
                need(path.read_bytes()==(gate_before if rel==PRIVACY08_GATE else legacy[rel]),'PRIVACY08_NO_CONCURRENT_SOURCE')
                applied[rel]=raw;path.write_bytes(raw)
            anchor=b"require('expo-router/entry');";need(entry_before.count(anchor)==1,'PRIVACY08_ROUTER_ENTRY_ONCE')
            entry_after=entry_before.replace(anchor,(out/'privacy08-entry.js').read_bytes()+b'\n'+anchor);entry.write_bytes(entry_after)
            document(evidence/'PRIVACY08_APPLIED.json',{'authorization':PRIVACY08_AUTH,'source_head':head,'manifest_sha256':digest(manifest.read_bytes()),'entry_before':digest(entry_before),'entry_after':digest(entry_after),'nine_sources':len(applied),'ordinary_admitted':False,'release':'NO_GO'})
            yield entry
        finally:
            for rel,raw in applied.items():
                need((root/rel).read_bytes()==raw,'PRIVACY08_FOREIGN_AFTERIMAGE')
                (root/rel).write_bytes(gate_before if rel==PRIVACY08_GATE else legacy[rel])
            if entry_after is not None:
                need(entry.read_bytes()==entry_after,'PRIVACY08_FOREIGN_ENTRY');entry.write_bytes(entry_before)
            need(gate.read_bytes()==gate_before,'PRIVACY08_GATE_RESTORED')

def validate_privacy08(raw,head,pid):
    need(len(raw)<=512*1024,'PRIVACY08_BOUND');v=json.loads(raw)
    need(set(v)=={'schema','marker','sourceHead','pid','bundle','eventLimit','sequence','dropped','flushFailures','events','denialWindow','ordinaryAdmitted','release'},'PRIVACY08_CLOSED_SHAPE')
    need(v['schema']==1 and v['marker']=='C47_PRIVACY_ORIGIN_DIAGNOSTIC_08'and v['sourceHead']==head and type(v['pid'])is int and v['pid']==pid and v['bundle']=='com.layerwell.app.staging'and v['eventLimit']==512 and v['ordinaryAdmitted']is False and v['release']=='NO_GO','PRIVACY08_IDENTITY')
    sites={'OBSERVER_READY','GRANT_BEGIN','REVALIDATE_ENTRY','CAPTURE_REJECT','DRAFT_REPLACE','CHECK_BEGIN','CONSENT_RESULT','CHECK_SUPERSEDED','CONSENT_FALSE','CHECK_READY_PUBLISHED','CHECK_REJECT','LEASE_SUBSCRIPTION','LEASE_EXPIRY','PROVIDER_RETIRE','PROVIDER_UNMOUNT','PROVIDER_VIEW_REJECT','PROVIDER_VIEW_LEASE_REJECT','ROUTE_BLUR','ROUTE_ENTER','ROUTE_CAPTURE_REJECT','ROUTE_PROVIDER_REJECT','ROUTE_WINDOW_REJECT','ROUTE_VIEW_LEASE_REJECT','ROUTE_PRIVACY_STATUS','ACTIVATION_RETURN','ACTIVATION_CURRENT','ACTIVATION_REJECT','ACTIVATION_MOUNT'}
    booleans={'mounted','fresh','hasDraft','tokenCurrent','draftCurrent','consentCurrent','ready','active','hasLease','routeTokenCurrent','focused','privacyDenied','privacyReady','ownerCurrent','epochCurrent','activeState','activationPending','childrenMayMount','routeSelected'}
    codes={'UNCLASSIFIED','HEALTH_DATA_WRITE_ADMISSION_CLOSED','HEALTH_DATA_WRITE_OWNER_MISMATCH','CURRENT_HEALTH_CONSENT_REQUIRED','HEALTH_CONSENT_INVALID','HEALTH_CONSENT_UNSUPPORTED_VERSION','HEALTH_CONSENT_MUTATION_SUPERSEDED','ACCOUNT_GENERATION_CHANGED','PRIVATE_KV_CONTENT_KEY_MISSING','PRIVATE_KV_CONTENT_KEY_INVALID','PRIVATE_KV_CONTENT_KEY_STORAGE_UNAVAILABLE','PRIVATE_KV_DECRYPTION_FAILED','PRIVATE_KV_ENVELOPE_INVALID','PRIVATE_KV_ENVELOPE_UNSUPPORTED','PRIVATE_KV_RECOVERY_REQUIRED','PRIVATE_KV_WRITE_CONFLICT','LOCAL_DATA_PRIVATE_MUTATION_RECOVERY_REQUIRED','LOCAL_DATA_HISTORY_RECOVERY_REQUIRED','LOCAL_DATA_OWNER_MISMATCH','LOCAL_DATA_CLEANUP_REQUIRED','ERR_KEY_CHAIN','ERR_INVALID_KEY','ERR_MISSING_PLIST_KEY','ERR_SEC_ACCESS_CONTROL'}
    stages={'CAPTURE','PREFLIGHT','PREFLIGHT_LEASE','OPERATION_CURRENT','CONSENT_READ','FINAL_LEASE'}
    integer=lambda n,maximum:type(n)is int and 0<=n<=maximum
    for key in ['sequence','dropped','flushFailures']:need(integer(v[key],1000000),'PRIVACY08_COUNTER')
    for rows,bound in [(v['events'],512),(v['denialWindow'] or [],128)]:
        need(type(rows)is list and len(rows)<=bound,'PRIVACY08_WINDOW');previous=0
        for row in rows:
            need(type(row)is dict and set(row)<={'sequence','site','grant','provider','route','check','stage','error'}|booleans and row['site']in sites and integer(row['sequence'],v['sequence']) and row['sequence']>previous and integer(row['grant'],1000000),'PRIVACY08_EVENT');previous=row['sequence']
            for key in booleans&set(row):need(type(row[key])is bool,'PRIVACY08_BOOLEAN')
            for key in {'provider','route','check'}&set(row):need(integer(row[key],1000000) and row[key]>0,'PRIVACY08_CORRELATION')
            if 'stage'in row:need(row['stage']in stages,'PRIVACY08_STAGE')
            if 'error'in row:
                need(type(row['error'])is list and len(row['error'])<=3,'PRIVACY08_ERROR_CHAIN')
                for node in row['error']:
                    need(set(node)=={'code','numeric'}and node['code']in codes and type(node['numeric'])is dict and set(node['numeric'])<={'code','nativeCode','nativeErrorCode','osStatus','errno'},'PRIVACY08_CODE')
                    need(all(type(n)is int and -2147483648<=n<=2147483647 for n in node['numeric'].values()),'PRIVACY08_NATIVE_NUMBER')
    return v

def privacy_origin08(value):
    # Source predicates remain evidence requiring review, never ordinary admission.
    events={r['sequence']:r for r in value['events']+(value['denialWindow']or [])};events=sorted(events.values(),key=lambda r:r['sequence'])
    denied=[r for r in events if r['site']=='ROUTE_PRIVACY_STATUS'and r.get('privacyDenied')is True and r['grant']>0]
    if not denied:return None
    ui=denied[-1];grant=ui['grant'];before=[r for r in events if r['sequence']<ui['sequence']and r['grant']==grant]
    current=[r for r in before if r['site']=='CHECK_REJECT'and r.get('mounted')is True and r.get('tokenCurrent')is True and any(n['code']!='UNCLASSIFIED'or n['numeric']for n in r.get('error',[]))]
    for origin in reversed(current):
        if not any(r['site']=='CHECK_READY_PUBLISHED'and r.get('provider')==origin.get('provider')and r['sequence']>origin['sequence']for r in before):
            return {'kind':'ACTUAL_CURRENT_REVALIDATION_REJECTION','origin':origin,'ui':ui,'ordinary_admitted':False,'release':'NO_GO'}
    for origin in reversed(before):
        if origin['site']=='PROVIDER_VIEW_REJECT'and origin.get('mounted')is True and origin.get('hasDraft')is True and origin.get('ready')is True and (origin.get('tokenCurrent')is False or origin.get('draftCurrent')is False):
            return {'kind':'ACTUAL_READY_PROVIDER_VIEW_RETIRED_PREDICATE','origin':origin,'ui':ui,'ordinary_admitted':False,'release':'NO_GO'}
    return None

def _privacy08_capture(r,n,device,bundle,head,evidence,label,expected_pid=None,*,targeted_onboarding53=False):
    legacy=_privacy08_original_capture(r,n,device,bundle,head,evidence,label,expected_pid,targeted_onboarding53=True)
    target=Path(evidence)/label
    installed,inventory=r._privacy08_installed
    actual=n.stage_json(n.read_native_file(target/'native-identity.json'))
    binary=Path(installed)/'LayerwellStaging';row=next(q for q in inventory['files']if q['path']=='LayerwellStaging');n.require(n.stage_file_digest(binary)=={k:row[k]for k in ('bytes','sha256')},'PRIVACY08_CURRENT_INSTALLED_MACHO')
    data=Path(r._storage05_first_data_container);path=data/('Documents/C47PrivacyOrigin08-'+str(actual['pid'])+'.json');raw=n.read_native_file(path);value=validate_privacy08(raw,head,actual['pid']);origin=privacy_origin08(value)
    (target/path.name).write_bytes(raw);document(target/'PRIVACY08_OBSERVATION.json',{'identity':actual,'trace':{'bytes':len(raw),'sha256':digest(raw)},'origin':origin,'ordinary_admitted':False,'release':'NO_GO'})
    legacy['privacy08']={'pid':actual['pid'],'file':path.name,'origin':origin,'trace_sha256':digest(raw)}
    if origin is not None:legacy['qualifying_origins'].append({'privacy08':origin,'pid':actual['pid']})
    return legacy


@contextmanager
def privacy08_live_capture(r,n):
    """Copy the owned content-free origin during XCTest's original readiness wait.

    This external observer never injects input, reads private app records, or
    changes native admission. Final UI/result qualification remains separate.
    """
    import threading
    target=r.output/'PRIVACY08_LIVE';target.mkdir(exist_ok=False)
    stop=threading.Event();observations=[]
    def observe():
        while not stop.is_set():
            try:
                data=getattr(r,'_storage05_first_data_container',None)
                if data is not None:
                    identity=n.stage_json(n.read_native_file(data/'Documents/C47StorageOrigin05Identity.json'))
                    need(set(identity)=={'schema','pid','sourceHead','bundle'}and identity['schema']==1 and identity['sourceHead']==r.receipt['source']['head']and identity['bundle']=='com.layerwell.app.staging'and type(identity['pid'])is int and 0<identity['pid']<=2147483647,'PRIVACY08_LIVE_IDENTITY')
                    path=data/('Documents/C47PrivacyOrigin08-'+str(identity['pid'])+'.json');raw=n.read_native_file(path);value=validate_privacy08(raw,identity['sourceHead'],identity['pid']);origin=privacy_origin08(value)
                    if origin is not None:
                        (target/'first-observed-origin-candidate.json').write_bytes(raw)
                        document(target/'native-identity.json',identity)
                        observations.append({'state':'ACTUAL_ORIGIN_CANDIDATE_COPIED_WHILE_XCTEST_ACTIVE','utc':n.utc(),'pid':identity['pid'],'trace_bytes':len(raw),'trace_sha256':digest(raw),'origin':origin,'qualification':'FIRST_OBSERVED_SOURCE_PREDICATE; FINAL_CASE_SCREEN_AND_GENUINE_CURRENT_AUTHORITY_STILL_REQUIRE_REVIEW','ordinary_admitted':False});return
            except Exception as error:
                if len(observations)<8:observations.append({'state':'OBSERVER_UNAVAILABLE','error_type':type(error).__name__,'ordinary_admitted':False})
            stop.wait(1)
    thread=threading.Thread(target=observe,daemon=True);thread.start()
    try:yield
    finally:
        stop.set();thread.join(timeout=5)
        document(target/'OBSERVER.json',{'authorization':PRIVACY08_AUTH,'source_head':r.receipt['source']['head'],'observations':observations,'thread_joined':not thread.is_alive(),'ordinary_admitted':False,'release':'NO_GO'})

def _privacy08_case(child,project,products,method,device,environment):
    n=_privacy08_native;need(method==n.NORMAL_UI_CASES04[2],'PRIVACY08_CASE03_ONLY')
    path=Path(project).parent/'native_ui47.swift';before=path.read_bytes();need(before==n.read_native_file(child.root/'scripts/release/full-app-j01/native_ui47.swift').split(b'\nimport UIKit',1)[0],'PRIVACY08_EXACT_GENERATED_RUNNER')
    start=before.index(b'    func testV04ExplicitWithdrawalReviewCancelAndFreshReconsent() throws {');first=before.index(b'        requireFreshGoals(app)\n',start)+len(b'        requireFreshGoals(app)\n');end=before.index(b'\n    }\n}\n',first)
    after=before[:first]+b'        // C08 diagnostic prefix only; no full ordinary-case admission.\n'+before[end:];path.write_bytes(after)
    (child.output/'PRIVACY08_DIAGNOSTIC_RUNNER.swift').write_bytes(after)
    document(child.output/'PRIVACY08_DIAGNOSTIC_RUNNER.json',{'source_head':child.receipt['source']['head'],'selected_method':method,'baseline_before':{'bytes':len(before),'sha256':digest(before)},'actual_compiled_prefix':{'bytes':len(after),'sha256':digest(after)},'original_case03_initial_sequence_exact':True,'ends_after':'first actual requireFreshGoals','not_full_case03':True,'ordinary_admitted':False,'release':'NO_GO'})
    try:
        with privacy08_live_capture(child,n):return _privacy08_original_case(child,project,products,method,device,environment)
    finally:need(path.read_bytes()==after,'PRIVACY08_RUNNER_FOREIGN');path.write_bytes(before)

PRIVACY09_AUTH='BRAIN-C47-PREBUILD-PRIVACY-ORIGIN-RUNTIME-09'
PRIVACY09_START='2b35b7399ffa8727f3166a0c35fb93e20f33611b'

def privacy_stage09(r,context):
    need(context['run_attempt']==1 and r.env.get('GITHUB_EVENT_NAME')=='pull_request','PRIVACY09_ONE_SHOT')
    count=r.text('privacy09-exact-commit-count',['git','rev-list','--count','02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],timeout=60)
    parent=r.text('privacy09-preserved145-parent',['git','rev-parse','HEAD~4'],timeout=60)
    need(count=='149' and parent==PRIVACY09_START,'PRIVACY09_EXACT149_WITH145_PREFIX')
    return {'authorization':PRIVACY09_AUTH,'native_attempt':70,'preserved_start':PRIVACY09_START,'source_head':context['head'],'source_tree':context['tree'],'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}

def privacy_stage71_09(r,context):
    need(context['run_attempt']==1 and r.env.get('GITHUB_EVENT_NAME')=='pull_request','PRIVACY09_REMAINDER71_ONE_SHOT')
    count=r.text('privacy09-remainder71-commit-count',['git','rev-list','--count','02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],timeout=60)
    parent=r.text('privacy09-remainder71-preserved149',['git','rev-parse','HEAD~2'],timeout=60)
    need(count=='151' and parent=='9c69cd2149de6d9ca24b5fe11afcd4bde96e3fe6','PRIVACY09_REMAINDER71_EXACT151_WITH149_PREFIX')
    return {'authorization':PRIVACY09_AUTH,'native_attempt':71,'preserved_start':PRIVACY09_START,'preserved_native70_head':parent,'source_head':context['head'],'source_tree':context['tree'],'fresh_build_required':True,'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}


@contextmanager
def privacy71_coordinator09(r,n,enabled):
    """One C09 remainder: boot after full source controls, before the fresh build.

    The original runner, source gates, signing, install and XCTest remain intact.
    Progress contains static coordinator stages only, never app/exception data.
    """
    if not enabled:
        yield None
        return
    original_run=r.run;original_simulator=n.prepare_simulator;ready=None;sequence=0
    stages={'normal-install':'INSTALL','generated47-controls':'SOURCE30','privacy08-source-observer-tests':'OBSERVER_CONTROLS','privacy08-current-runtime-controls':'RUNTIME_CONTROLS','privacy08-simulator-signing-controls':'SIGNING_CONTROLS','prebuild':'GENERATE','pods':'PODS','storage-origin05-build':'COMPILE','simulator-bootstatus':'SIMULATOR_BOOT','privacy09-preboot-recheck71':'SIMULATOR_RECHECK','native-normal-staging-ui':'TARGETED_XCTEST'}
    def progress(name,state):
        nonlocal sequence
        try:
            if sequence>=256:return
            sequence+=1
            print(json.dumps({'event':'C47_NATIVE71_COORDINATOR','sequence':sequence,'stage':stages.get(name,'OTHER'),'state':state}),flush=True)
        except Exception:pass
    def run(name,argv,*args,**kwargs):
        progress(name,'BEGIN')
        try:
            if name=='storage-origin05-build':
                need(ready is not None,'PRIVACY09_BUILD71_REQUIRES_PREBOOT')
                # Actual native70 compile2767.030s +720s retained runtime/evidence reserve.
                remaining=r.deadline-__import__('time').monotonic()
                need(remaining>=3488,'PRIVACY09_BUILD71_MEASURED_RUNTIME_RESERVE')
                kwargs['timeout']=min(kwargs.get('timeout',120),remaining-720)
            return original_run(name,argv,*args,**kwargs)
        finally:progress(name,'END')
    def boot():
        nonlocal ready
        need(ready is None,'PRIVACY09_PREBOOT71_ONCE')
        proof=_native05_full_source_controls53(r,n)
        for name in ['privacy08-source-observer-tests','privacy08-current-runtime-controls','privacy08-simulator-signing-controls']:
            rows=[v for v in r.receipt['commands']if v['name']==name]
            need(len(rows)==1 and rows[0].get('state')=='PASS'and rows[0].get('exit_code')==0 and rows[0].get('capture_complete')is True,'PRIVACY09_PREBOOT71_SOURCE_CONTROLS')
        r.passed('privacy09-source-controls-before-boot71',proof)
        device=original_simulator(r,'normal')
        need(r.receipt.get('simulator',{}).get('udid')==device,'PRIVACY09_PREBOOT71_OWNED_DEVICE')
        ready=(device,r.receipt['source']['head'])
        r.passed('privacy09-simulator-ready-before-generation71',{'udid':device,'source_head':ready[1],'original_bootstatus_timeout_seconds':600,'ordinary_admitted':False,'release':'NO_GO'})
    def prepared(actual,lane):
        need(actual is r and lane=='normal'and ready is not None and r.receipt.get('simulator',{}).get('udid')==ready[0]and r.receipt['source']['head']==ready[1],'PRIVACY09_PREBOOT71_EXACT_CURRENT_DEVICE')
        r.run('privacy09-preboot-recheck71',['xcrun','simctl','bootstatus',ready[0],'-b'],timeout=600)
        return ready[0]
    r.run=run;n.prepare_simulator=prepared
    try:yield boot
    finally:r.run=original_run;n.prepare_simulator=original_simulator


def main_privacy08(continuation09=False,remainder71=False):
    import argparse,importlib.util,os,sys
    p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--privacy-origin09-remainder71' if remainder71 else '--privacy-origin09' if continuation09 else '--privacy-origin08',action='store_true',required=True);args=p.parse_args();root=Path(__file__).resolve().parents[3]
    need(not os.environ.pop('C47_ARTIFACT_READ_TOKEN',''),'PRIVACY08_NO_OLD_PRODUCT_IMPORT')
    spec=importlib.util.spec_from_file_location('c47_privacy08_native',root/'scripts/release/full-app-j01/native_runtime47.py');n=importlib.util.module_from_spec(spec);sys.modules[spec.name]=n;spec.loader.exec_module(n)
    output=args.output.absolute();need(not output.resolve().is_relative_to(root)and not output.exists(),'PRIVACY08_NEW_OUTSIDE_OUTPUT');output.mkdir(parents=True);r=n.Runner(root,output,seconds=84*60);r.receipt.update(stage='build',lane='SEPARATE_RELEASE_PRIVACY_ORIGIN08_DIAGNOSTIC',ordinary_admitted=False,diagnostic_only=True);r.persist();context=None;result=None;code=1
    global _privacy08_original_inputs,_privacy08_original_capture,_privacy08_original_case,_privacy08_native
    global diagnostic_inputs,collect_native_origin05,_native05_installed
    _privacy08_native=n;_privacy08_original_inputs=diagnostic_inputs;_privacy08_original_capture=collect_native_origin05;_privacy08_original_case=n.normal_case_execution04;original_installed=_native05_installed
    def installed(*a):
        value=original_installed(*a);a[0]._privacy08_installed=(a[2],a[5]);return value
    original_prepare=n.prepare;boot71=None
    def prepare(*a,**kw):
        result=original_prepare(*a,**kw)
        a[0].run('privacy08-source-observer-tests',['python3','-I','-B','scripts/release/full-app-j01/storage_trace47.test.py'],timeout=120)
        a[0].run('privacy08-current-runtime-controls',['python3','-I','-B','scripts/release/full-app-j01/native_runtime47.test.py'],timeout=300)
        a[0].run('privacy08-simulator-signing-controls',['python3','-I','-B','scripts/release/full-app-j01/simulator_signing47.test.py'],timeout=120)
        if remainder71:boot71()
        return result
    n.prepare=prepare
    diagnostic_inputs=diagnostic_inputs08;collect_native_origin05=_privacy08_capture;n.normal_case_execution04=_privacy08_case;_native05_installed=installed
    try:
        context=n.hosted_stage_context(r,'build');need(context['run_attempt']==1 and r.env.get('GITHUB_EVENT_NAME')=='pull_request','PRIVACY08_ONE_SHOT')
        if continuation09:
            r.receipt['continuation09']=privacy_stage71_09(r,context)if remainder71 else privacy_stage09(r,context);r.persist()
        else:
            count=r.text('privacy08-exact-commit-count',['git','rev-list','--count','02aa4ba879fb844f3ca0aa929591203ee45f4163..HEAD'],timeout=60);parent=r.text('privacy08-preserved137-parent',['git','rev-parse','HEAD~6'],timeout=60);need(count=='143'and parent==PRIVACY08_START,'PRIVACY08_EXACT143_WITH137_PREFIX')
        with privacy71_coordinator09(r,n,remainder71)as boot71:
            result=run_native_origin05(r,n,onboarding_denial53=True)
        actual=[v['privacy08']['origin']for v in result['observations']if v.get('privacy08',{}).get('origin')is not None]
        r.receipt['privacy_origin09' if continuation09 else 'privacy_origin08']={'authorization':PRIVACY09_AUTH if continuation09 else PRIVACY08_AUTH,'native_attempt':71 if remainder71 else 70 if continuation09 else 69,'source_head':context['head'],'source_tree':context['tree'],'origins':actual,'first_actual_origin_captured':bool(actual),'diagnostic_case03_prefix_only':True,'ordinary_admitted':False,'internal_admitted':False,'release':'NO_GO'}
        code=0 if actual else 1;r.receipt.update(status='PRIVACY08_ORIGIN_CAPTURED_REVIEW_REQUIRED'if actual else'PRIVACY08_ORIGIN_NOT_CAPTURED',stage_complete=bool(actual));r.persist()
    except Exception as error:r.receipt.update(status='PARTIAL_BLOCKED',stage_complete=False,failure={'type':type(error).__name__,'detail':str(error)},finished_utc=n.utc());r.persist()
    finally:
        diagnostic_inputs=_privacy08_original_inputs;collect_native_origin05=_privacy08_original_capture;n.normal_case_execution04=_privacy08_original_case;_native05_installed=original_installed;n.prepare=original_prepare
        if context is not None and r.receipt.get('source'):
            try:_native05_final_source53(r,n,context,result)
            except Exception as e:code=1;r.receipt['final_source_failure_type']=type(e).__name__
        try:n.collect(r)
        except Exception as e:code=1;r.receipt['collection_failure']={'type':type(e).__name__}
        if not r.receipt.get('artifact_policy',{}).get('upload_within_limit'):code=1
        r.receipt.update(stage_complete=bool(code==0 and r.receipt.get('stage_complete')),finished_utc=n.utc());r.persist()
    manifest=None
    if context is not None:
        try:manifest=n.write_stage_provenance(output,'build',context)
        except Exception:code=1
    print(json.dumps({'status':r.receipt['status'],'stage':'build','stage_complete':code==0,'ordinary_admitted':False,'internal_admitted':False,'manifest':manifest,'release':'NO_GO'}));return code

if __name__ == '__main__':
    import sys
    raise SystemExit(main_privacy08(True,True) if '--privacy-origin09-remainder71' in sys.argv else main_privacy08(True) if '--privacy-origin09' in sys.argv else main_privacy08() if '--privacy-origin08' in sys.argv else main_origin05())
