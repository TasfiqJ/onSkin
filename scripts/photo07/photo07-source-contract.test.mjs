import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPhoto07Sources, photo07Source } from './photo07-source-contract.mjs';

test('repository satisfies aggregate PHOTO-07 disclosure/lifecycle contract', () => {
  assert.deepEqual(auditPhoto07Sources(), { checks: 6, status: 'pass' });
});

test('rejects absolute welcome no-egress copy that omits explicit sharing', () => {
  assert.throws(() => auditPhoto07Sources({ welcome: photo07Source('welcome').replace(/Photos stay encrypted on your\s+phone unless you choose to share one\./u, 'Photos that never leave\n                your phone.') }), /sharing exception|absolute no-egress/u);
});

test('rejects capture disclosure without device-loss risk', () => {
  assert.throws(() => auditPhoto07Sources({ consentCopy: photo07Source('consentCopy').replace('A lost phone can mean lost photos.', 'Your photos are always recoverable.') }), /key\/device loss/u);
});

test('rejects capture disclosure without the explicit-share exception', () => {
  assert.throws(() => auditPhoto07Sources({ consentCopy: photo07Source('consentCopy').replace('You can choose to share a photo.', '') }), /upload, sharing, backup/u);
});

test('rejects enabling Trend while no validated engine ships', () => {
  assert.throws(() => auditPhoto07Sources({ phase7: photo07Source('phase7').replace('trend: false,', 'trend: true,') }), /Trend must remain literally disabled/u);
});

test('rejects photo bytes being included in local export', () => {
  assert.throws(() => auditPhoto07Sources({ export: photo07Source('export').replace('photo_files_included: false', 'photo_files_included: true') }), /separate metadata\/notes/u);
});

test('rejects omission of encrypted photo cleanup', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace('    await attempt(clearEncryptedPhotoStorage);', '') }), /clear encrypted photos/u);
});

test('rejects deletion that hides partial cleanup failure', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace("  if (firstFailure) throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');", '') }), /partial local deletion failure/u);
});

test('rejects contradictory visible automatic-upload copy appended to welcome', () => {
  assert.throws(
    () => auditPhoto07Sources({ welcome: `${photo07Source('welcome')}\nconst contradiction = <Text>Photos upload automatically.</Text>;` }),
    /contradictory automatic-upload/u,
  );
});

test('rejects visible automatic-backup copy with an intervening also', () => {
  assert.throws(
    () => auditPhoto07Sources({ welcome: `${photo07Source('welcome')}\nconst contradiction = <Text>Photos are also uploaded automatically for backup.</Text>;` }),
    /contradictory automatic-upload/u,
  );
});

test('rejects a spread overriding the literal disabled Trend flag', () => {
  assert.throws(
    () => auditPhoto07Sources({ phase7: photo07Source('phase7').replace(
      '  trend: false,',
      '  trend: false,\n  ...{ trend: true },',
    ) }),
    /Trend must remain literally disabled/u,
  );
});

test('rejects local cleanup returning immediately at function entry', () => {
  assert.throws(
    () => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
      'export async function clearHealthPurposeLocalData(ownerUserId: string): Promise<void> {',
      'export async function clearHealthPurposeLocalData(ownerUserId: string): Promise<void> {\n  return;',
    ) }),
    /cleanup must remain reachable from entry/u,
  );
});

test('rejects returning immediately before terminal partial-failure propagation', () => {
  assert.throws(
    () => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
      '  if (firstFailure) throw',
      '  return;\n  if (firstFailure) throw',
    ) }),
    /cleanup must remain reachable from entry/u,
  );
});

test('retains the legacy terminal-if cleanup shape', () => {
  const cleanup = `export async function clearHealthPurposeLocalData(ownerUserId: string): Promise<void> {
    const firstFailure = null;
    beginEncryptedPhotoAccountBoundary();
    await waitForEncryptedPhotoWritesToSettle();
    await purgeSensitiveImageMemory();
    await clearGeneratedPrivateCacheFiles();
    await AsyncStorage.multiRemove([]);
    await clearEncryptedPhotoStorage();
    if (firstFailure) throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');
  }`;
  assert.deepEqual(auditPhoto07Sources({ cleanup }), { checks: 6, status: 'pass' });
});

test('rejects an owned settlement flag initialized as already complete', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
    'let readSettlementComplete = false;', 'let readSettlementComplete = true;',
  ) }), /partial local deletion failure/u);
});

test('rejects owned settlement success before partial failure propagates', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
    "    if (firstFailure) throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');\n    readSettlementComplete = true;",
    "    readSettlementComplete = true;\n    if (firstFailure) throw new Error('HEALTH_PURPOSE_LOCAL_CLEAR_FAILED');",
  ) }), /partial local deletion failure/u);
});

test('rejects omission of the owned cleanup settlement finalizer', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
    '    settleReadBoundary(readSettlementComplete);', '',
  ) }), /partial local deletion failure/u);
});

test('rejects a wrapper catch that swallows the cleanup failure', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
    '  } finally {\n    settleReadBoundary(readSettlementComplete);',
    '  } catch {} finally {\n    settleReadBoundary(readSettlementComplete);',
  ) }), /partial local deletion failure/u);
});

test('rejects reporting an unconditional successful owned settlement', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
    'settleReadBoundary(readSettlementComplete);', 'settleReadBoundary(true);',
  ) }), /partial local deletion failure/u);
});

test('rejects an extra early write to the owned settlement flag', () => {
  assert.throws(() => auditPhoto07Sources({ cleanup: photo07Source('cleanup').replace(
    '  try {\n    beginEncryptedPhotoAccountBoundary();',
    '  try {\n    readSettlementComplete = true;\n    beginEncryptedPhotoAccountBoundary();',
  ) }), /partial local deletion failure/u);
});
