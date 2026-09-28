import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function source(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('root Store transaction notice contracts', () => {
  it('mounts above routes but behind the app-lock/privacy boundary', () => {
    const root = source('app/_layout.tsx');
    const appLockOpen = root.indexOf('<AppLockProvider>');
    const noticeHost = root.indexOf('<StoreTransactionNoticeHost />');
    const privateDataGate = root.indexOf('<PrivateDataAvailabilityGate>');

    expect(root).toContain(
      "import { StoreTransactionNoticeHost } from '@/features/subscription/StoreTransactionNoticeHost';",
    );
    expect(appLockOpen).toBeGreaterThan(-1);
    expect(noticeHost).toBeGreaterThan(appLockOpen);
    expect(noticeHost).toBeLessThan(privateDataGate);
  });

  it('funnels every purchase, win-back, and restore mutation through one owner-aware coordinator', () => {
    const entitlement = source('features/subscription/useEntitlement.ts');
    expect(entitlement.match(/runOwnedStoreTransaction\(\{/g)).toHaveLength(5);
    expect(entitlement.match(/action: 'purchase'/g)).toHaveLength(4);
    expect(entitlement.match(/action: 'restore'/g)).toHaveLength(1);
    expect(entitlement.match(/const ownerUserId = user\?\.id;/g)).toHaveLength(5);
    expect(entitlement.match(/ownerUserId,/g)).toHaveLength(5);
    expect(entitlement).toContain('publishCustomerInfoEvidence({');
    expect(entitlement).toContain('ENTITLEMENT_EVIDENCE_COMMIT_BLOCKED');
    expect(entitlement).toContain('isDurablyAdmissibleStoreResult(');
    expect(entitlement).toContain(
      'nativeCall.markProviderResultPersisted(persisted.providerResultPersisted)',
    );
    expect(entitlement).not.toContain(
      'nativeCall.markProviderResultPersisted(entitlement?.isActive === true)',
    );
  });

  it('keeps the durable fence outside destructive account cleanup registries', () => {
    const keys = source('features/settings/localPrivateDataKeys.ts');
    const cleanup = source('features/settings/localPrivateData.ts');
    const isolation = source('lib/auth/localAccountIsolation.ts');
    const deletionRecovery = source('features/settings/accountDeletionRecovery.ts');
    const dataSection = keys.slice(
      keys.indexOf('export const LOCAL_PRIVATE_DATA_KEYS'),
      keys.indexOf('export const LOCAL_PRIVATE_SECURE_STORE_KEYS'),
    );
    const metadataSection = keys.slice(
      keys.indexOf('export const LOCAL_PRIVATE_METADATA_KEYS'),
      keys.indexOf('export const LOCAL_PRIVATE_CONTROL_KEYS'),
    );
    const controlSection = keys.slice(
      keys.indexOf('export const LOCAL_PRIVATE_CONTROL_KEYS'),
      keys.indexOf('export const LOCAL_PRIVATE_CACHE_FILENAMES'),
    );

    expect(controlSection).toContain('layerwell.store_transaction_notice.v2');
    expect(dataSection).not.toContain('layerwell.store_transaction_notice.v2');
    expect(metadataSection).not.toContain('layerwell.store_transaction_notice.v2');
    expect(cleanup).not.toContain('LOCAL_PRIVATE_CONTROL_KEYS');
    expect(isolation).toContain('clearPersistedPrivateData: clearLocalPrivateData');
    expect(deletionRecovery).toContain('clearIsolatedState: clearAccountIsolatedState');
  });

  it('keeps warning copy explicit and the web fixture development-only', () => {
    const host = source('features/subscription/StoreTransactionNoticeHost.tsx');
    const coordinator = source('lib/iap/storeTransactionNotice.ts');
    expect(host).toContain('Store transaction completion unconfirmed');
    expect(host).toContain('Do not buy again until Restore purchases checks the status.');
    expect(host).toContain('Not now — keep purchase blocked');
    expect(host).not.toContain('acknowledgeStoreTransactionNotice');
    expect(host).toContain('setSuppressedForForeground(true)');
    expect(coordinator).not.toContain('acknowledgedAt');
    expect(host).toContain("AppState.addEventListener('change'");
    expect(host.match(/void refresh\(\);/g)?.length).toBeGreaterThanOrEqual(4);
    expect(host).toContain('loadGeneration.current += 1;');
    expect(host).not.toContain('void readStoreTransactionNotice(ownerUserId).then(');
    expect(host).toContain("appState !== 'active'");
    expect(host).toContain('!appUnlocked');
    expect(host).toContain('<ScrollView');
    expect(host).toContain('{canRestore ? (');
    expect(host).toContain('Manage store subscription');
    expect(host).toContain('Contact support');
    expect(host).toContain('accessibilityRole="header"');
    expect(host).toContain('accessibilityLiveRegion="assertive"');
    expect(host).toContain('accessibilityLiveRegion="polite"');
    expect(host).toContain(
      'accessibilityHint="Reminds you again when the app returns to the foreground."',
    );
    expect(host).not.toContain('accessibilityLabel="I understand. Remind me');
    expect(host).toContain('colors.mutedStrong');
    expect(host).toContain('colors.clayDeep');
    expect(host).toContain('The store check completed, but approval is still unresolved.');
    expect(host).toContain('the deleted-account safety block remains.');
    expect(coordinator).toContain('readBack !== serialized');
    expect(coordinator).not.toContain('removeExpiredPaymentPending');
    expect(coordinator).not.toContain('removeExpiredDeletedOwnerSafety');
    expect(coordinator).toContain('EXPO_PUBLIC_E2E_STORE_TRANSACTION_NOTICE');
    expect(coordinator).toContain("appEnvironment === 'development'");
    expect(coordinator).toContain("normalizedFixture === 'purchase_unconfirmed'");
    expect(coordinator).toContain("normalizedFixture === 'payment_pending'");
    expect(coordinator).toContain("normalizedFixture === 'deleted_account_pending'");
    expect(coordinator).toContain("normalizedFixture === 'foreign_pending'");
  });

  it('gives the no-new-charge cancellation state a visible Restore recovery path', () => {
    const feedback = source('features/subscription/PaywallFeedback.tsx');
    expect(feedback).toContain('purchaseCancelled');
    expect(feedback).toContain('No new charge was made.');
    expect(feedback).toContain('use Restore purchases');

    for (const route of [
      'app/onboarding/paywall.tsx',
      'app/paywall/upsell.tsx',
      'app/paywall/reoffer.tsx',
      'app/paywall/downgrade.tsx',
      'app/paywall/winback.tsx',
      'features/subscription/ProGate.tsx',
    ]) {
      expect(source(route), route).toContain('PAYWALL_FEEDBACK.purchaseCancelled');
    }
  });
});
