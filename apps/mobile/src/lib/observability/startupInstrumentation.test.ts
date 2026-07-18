import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('startup instrumentation ownership', () => {
  it('marks every locally observable secure-startup boundary from its owner', () => {
    expect(source('src/app/_layout.tsx')).toContain("markStartupPhase('javascript_started')");
    expect(source('src/app/_layout.tsx')).toContain(
      "markStartupPhase('font_decision_complete')",
    );
    expect(source('src/lib/auth/SessionBoundaryGate.tsx')).toContain(
      "markStartupPhase('authentication_hydration_complete')",
    );
    expect(source('src/lib/auth/SessionBoundaryGate.tsx')).toContain(
      "markStartupPhase('account_generation_complete')",
    );
    expect(source('src/lib/storage/PlaintextStagingStartupGate.tsx')).toContain(
      "markStartupPhase('plaintext_recovery_complete')",
    );
    expect(source('src/lib/applock/AppLockProvider.tsx')).toContain(
      "markStartupPhase('app_lock_decision_complete')",
    );
    expect(source('src/lib/storage/PrivateDataAvailabilityGate.tsx')).toContain(
      "markStartupPhase('vault_decision_complete')",
    );
    expect(source('src/lib/observability/StartupNavigationObserver.tsx')).toContain(
      "markStartupPhase('navigation_ready')",
    );
    expect(source('src/components/ui/Screen.tsx')).toContain(
      "markStartupPhase('first_meaningful_content')",
    );
    expect(source('src/components/ui/Screen.tsx')).toContain(
      "markStartupPhase('first_route_interaction_observed')",
    );
    expect(source('src/app/index.tsx')).toContain(
      "markStartupPhase('first_critical_data_ready')",
    );
    expect(source('src/lib/offline/OfflineSync.tsx')).toContain(
      "markStartupPhase('startup_reconciliation_complete')",
    );
  });

  it('keeps navigation instrumentation inside every blocking privacy gate', () => {
    const root = source('src/app/_layout.tsx');
    const orderedOwners = [
      '<SessionBoundaryGate>',
      '<PlaintextStagingStartupGate>',
      '<AppLockProvider>',
      '<PrivateDataAvailabilityGate>',
      '<StartupNavigationObserver />',
      '<Stack screenOptions=',
    ];
    for (let index = 1; index < orderedOwners.length; index += 1) {
      expect(root.indexOf(orderedOwners[index - 1]!)).toBeLessThan(
        root.indexOf(orderedOwners[index]!),
      );
    }
  });

  it('records app-lock and vault decisions before their gates can reveal children', () => {
    const appLock = source('src/lib/applock/AppLockProvider.tsx');
    const vault = source('src/lib/storage/PrivateDataAvailabilityGate.tsx');

    expect(appLock.indexOf("markStartupPhase('app_lock_decision_complete')")).toBeLessThan(
      appLock.indexOf('setLoaded(true)'),
    );
    expect(vault.indexOf("markStartupPhase('vault_decision_complete')")).toBeLessThan(
      vault.indexOf("setAvailability(recoveryHrefRef.current ? 'restoring' : 'ready')"),
    );
  });
});
