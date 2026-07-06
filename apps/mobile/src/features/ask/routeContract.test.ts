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
    expect(consent).toContain('<DeferredSurface surface="cloudAsk" />');
  });

  it('saves cloud Ask consent before applying visible toggle state', () => {
    const consent = readAppRoute('ask/consent.tsx');

    expect(consent).toContain('applyAskConsentChoice');
    expect(consent).toContain('savingRef.current');
    expect(consent).toContain('disabled={saving}');
    expect(consent).toContain('ASK_COPY.privacy.saveFailedTitle');
    expect(consent).toContain('onSaved: () => {');
    expect(consent).toContain("qc.setQueryData(['ask_onskin'], enabled);");
    expect(consent).not.toContain("qc.setQueryData(['ask_onskin'], enabled);\n    try");
  });
});
