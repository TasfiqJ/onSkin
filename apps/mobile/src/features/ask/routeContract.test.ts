import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Ask route launch contracts', () => {
  it('keeps the deterministic Ask home independent from the cloud Ask flag', () => {
    const layout = readAppRoute('ask/_layout.tsx');

    expect(layout).toContain('<Stack screenOptions={{ headerShown: false }} />');
    expect(layout).not.toContain('phase7Flags.cloudAsk');
    expect(layout).not.toContain('DeferredSurface');
  });

  it('defers only the cloud consent surface while cloud Ask is unavailable', () => {
    const consent = readAppRoute('ask/consent.tsx');

    expect(consent).toContain('phase7Flags.cloudAsk');
    expect(consent).toContain(
      '<DeferredSurface surface="cloudAsk" fallbackRoute={APP_ASK_ROUTE} />',
    );
  });

  it('saves cloud Ask consent before applying visible toggle state', () => {
    const consent = readAppRoute('ask/consent.tsx');

    expect(consent).toContain('applyAskConsentChoice');
    expect(consent).toContain('savingRef.current');
    expect(consent).toContain('disabled={saving}');
    expect(consent).toContain('ASK_COPY.privacy.saveFailedTitle');
    expect(consent).toContain('onSaved: () => {');
    expect(consent).toContain("qc.setQueryData(['ask_onskin'], enabled);");
    expect(consent).toContain('ToggleSwitch');
    expect(consent).toContain('accessibilityLabel={ASK_COPY.privacy.toggleLabel}');
    expect(consent).not.toContain("qc.setQueryData(['ask_onskin'], enabled);\n    try");
    expect(consent).not.toContain('<Switch');
  });

  it('keeps direct-entry Ask exits touchable and routed to safe surfaces', () => {
    const home = readAppRoute('ask/index.tsx');
    const consent = readAppRoute('ask/consent.tsx');

    expect(home).toContain('RouteIconButton');
    expect(home).toContain('APP_HOME_ROUTE');
    expect(home).toContain('backOrReplace(router, APP_HOME_ROUTE)');
    expect(home).not.toContain('hitSlop={8}');
    expect(consent).toContain('RouteIconButton');
    expect(consent).toContain('APP_ASK_ROUTE');
    expect(consent).toContain('backOrReplace(router, APP_ASK_ROUTE)');
    expect(consent).not.toContain('hitSlop={8}');
  });

  it('keeps Ask composer utility controls comfortably above 44px on phones', () => {
    const home = readAppRoute('ask/index.tsx');

    expect(home).toContain('mt-2 min-h-[48px] self-start justify-center py-1');
    expect(home).toContain('className="h-[48px] w-[48px] items-center justify-center');
    expect(home).toContain('minHeight: 48');
    expect(home).toContain('mt-3 min-h-[48px] self-start items-center justify-center');
  });
});
