import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function source(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('account-deletion pre-Auth recovery gate', () => {
  it('loads before Auth, account vendors, private data, offline sync, and routes', () => {
    const root = source('app/_layout.tsx');
    const supabaseClient = source('lib/supabase/client.ts');
    const authProvider = source('lib/auth/AuthProvider.tsx');

    expect(root).toContain(
      "import { AccountDeletionRecoveryGate } from '@/features/settings/AccountDeletionRecoveryGate';",
    );
    expect(root.indexOf('<AccountDeletionRecoveryGate>')).toBeLessThan(
      root.indexOf('<AuthProvider>'),
    );
    expect(root.indexOf('<AccountDeletionRecoveryGate>')).toBeLessThan(
      root.indexOf('<PrivateDataAvailabilityGate>'),
    );
    expect(root.indexOf('<AccountDeletionRecoveryGate>')).toBeLessThan(
      root.indexOf('<OfflineSync />'),
    );
    expect(root.indexOf('<AccountDeletionRecoveryGate>')).toBeLessThan(
      root.indexOf('<Stack screenOptions='),
    );
    expect(supabaseClient).toContain('autoRefreshToken: false');
    expect(authProvider).toContain('supabase.auth.startAutoRefresh()');
    expect(authProvider).toContain('supabase.auth.stopAutoRefresh()');
  });

  it('keeps invalid, expired, network, and delayed outcomes closed and retryable', () => {
    const gate = source('features/settings/AccountDeletionRecoveryGate.tsx');

    expect(gate).toContain('loadPendingAccountDeletion()');
    expect(gate).toContain('fetchAccountDeletionStatus(recoveryRecord.statusCapability)');
    expect(gate).toContain('commitCompletedAccountDeletion(outcome.notice)');
    expect(gate).toContain('commitUnresolvedAccountDeletion(outcome.kind)');
    expect(gate).toContain('canRetryAccountDeletionIntake(record)');
    expect(gate).toContain('quarantineAccountDeletionSession(undefined');
    expect(gate).toContain('acceptAccountDeletionAndSignOut(recoveryRecord');
    expect(gate).toContain('completeAccountDeletionLocalSignOut(undefined, cleanupOptions)');
    expect(gate).toContain('finalizeCompletedAccountDeletion(');
    expect(gate).toContain("finalized === 'manual_notice_pending'");
    expect(gate).toContain('clearCompletedAccountDeletionState()');
    expect(gate).toContain('acknowledgeAccountDeletionNotice(notice)');
    expect(gate).toContain('Account activity paused');
    expect(gate).toContain('did not reopen the account');
    expect(gate).toContain('Retry deletion request');
    expect(gate).toContain('Check status now');
    expect(gate).toContain('Open support');
    expect(gate).toContain('Open Apple instructions');
    expect(gate).toContain('EXPO_PUBLIC_E2E_ACCOUNT_DELETION_RECOVERY');
    expect(gate).not.toContain('Alert.alert');
  });

  it('proves the retained owner before cleanup and clears foreign Auth without foreign data', () => {
    const gate = source('features/settings/AccountDeletionRecoveryGate.tsx');

    expect(gate.indexOf('resolveAccountDeletionRecoveryOwnership(record)')).toBeLessThan(
      gate.indexOf('completeAccountDeletionLocalSignOut(undefined, cleanupOptions)'),
    );
    expect(gate.indexOf('resolveAccountDeletionRecoveryOwnership(record)')).toBeLessThan(
      gate.indexOf('quarantineAccountDeletionSession(undefined'),
    );
    expect(gate.indexOf('markAccountDeletionRetryUnavailable()')).toBeLessThan(
      gate.indexOf('completeAccountDeletionLocalSignOut(undefined, cleanupOptions)'),
    );
    expect(gate).toContain("ownership.session !== 'match'");
    expect(gate).toContain('clearIsolatedState: cleanupOptions.clearIsolatedState');
  });

  it('exposes a non-destructive support-only fixture without changing retryable invalid', () => {
    const gate = source('features/settings/AccountDeletionRecoveryGate.tsx');

    expect(gate).toContain("| 'invalid_support_only'");
    expect(gate).toContain("if (fixture === 'invalid_support_only')");
    expect(gate).toContain("setView({ kind: 'invalid', retryable: false })");
    expect(gate).toContain("if (fixture === 'invalid')");
    expect(gate).toContain("setView({ kind: 'invalid', retryable: true })");
    expect(gate).toContain("view.kind === 'invalid' && view.retryable");
    expect(gate).toContain('the original authenticated retry session is no longer available');
  });

  it('mounts the product/Auth/vendor subtree only after no durable deletion remains', () => {
    const gate = source('features/settings/AccountDeletionRecoveryGate.tsx');

    expect(gate).toContain("if (view.kind === 'ready') return children;");
    expect(gate.indexOf('loadPendingAccountDeletion()')).toBeLessThan(
      gate.indexOf("if (view.kind === 'ready') return children;"),
    );
    expect(gate).toContain('Every durable record keeps the product/Auth/vendor tree unmounted.');
  });
});
