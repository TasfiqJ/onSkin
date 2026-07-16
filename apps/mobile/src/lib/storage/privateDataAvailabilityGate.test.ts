import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('global private data availability gate', () => {
  it('verifies shared private storage after app unlock and before app content mounts', () => {
    const root = readSource('app/_layout.tsx');
    const gate = readSource('lib/storage/PrivateDataAvailabilityGate.tsx');

    expect(root).toContain(
      "import { PrivateDataAvailabilityGate } from '@/lib/storage/PrivateDataAvailabilityGate';",
    );
    expect(root.indexOf('<AppLockProvider>')).toBeLessThan(
      root.indexOf('<PrivateDataAvailabilityGate>'),
    );
    expect(root.indexOf('<PrivateDataAvailabilityGate>')).toBeLessThan(
      root.indexOf('<OfflineSync />'),
    );
    expect(root.indexOf('<PrivateDataAvailabilityGate>')).toBeLessThan(
      root.indexOf('<Stack screenOptions={{ headerShown: false }} />'),
    );
    expect(gate).toContain('const { appUnlocked } = useAppLock();');
    expect(gate).toContain('await assertPrivateKVReadable();');
    expect(gate).toContain('if (!appUnlocked) return;');
    expect(gate).toContain("if (state !== 'active')");
    expect(gate).toContain("void check('foreground')");
    expect(gate).toContain('useUnstableGlobalHref');
    expect(gate).toContain('recoveryHrefRef.current = currentHrefRef.current');
    expect(gate).toContain("availability === 'ready' || availability === 'restoring'");
    expect(gate).toContain('router.replace(href as Href);');
    expect(gate).toContain(
      "importantForAccessibility={restoring ? 'no-hide-descendants' : 'auto'}",
    );
  });

  it('keeps failure recovery accessible, retryable, and development-only', () => {
    const gate = readSource('lib/storage/PrivateDataAvailabilityGate.tsx');
    const stateNotice = readSource('components/ui/StateNotice.tsx');
    const button = readSource('components/ui/Button.tsx');

    expect(gate).toContain("if (typeof __DEV__ === 'undefined' || !__DEV__) return null;");
    expect(gate).toContain('EXPO_PUBLIC_E2E_PRIVATE_STORAGE_FAILURE');
    expect(gate).toContain("fixture === 'unavailable'");
    expect(gate).toContain("fixture === 'unavailable_once'");
    expect(gate).toContain("fixture === 'foreground_once'");
    expect(gate).toContain("check('foreground')");
    expect(gate).toContain('kind="unavailable"');
    expect(stateNotice).toContain("alert ? 'alert' : undefined");
    expect(gate).toContain('disabled={retrying}');
    expect(gate).toContain('className="mt-7"');
    expect(button).toContain("'min-h-[56px]");
    expect(gate).toContain("title: 'Your private data could not open.'");
    expect(gate).not.toContain('E2E_PRIVATE_STORAGE_UNAVAILABLE}</');
  });
});
