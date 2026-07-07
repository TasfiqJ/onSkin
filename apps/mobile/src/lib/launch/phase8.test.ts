import { describe, expect, it } from 'vitest';

import { productionUrlReady, supportEmailReady } from './phase8';

describe('Phase 8 production URL readiness', () => {
  it('accepts real HTTPS production URLs', () => {
    expect(productionUrlReady('https://routinekind.app')).toBe(true);
    expect(productionUrlReady('https://apps.apple.com/app/id123456789')).toBe(true);
    expect(productionUrlReady('https://play.google.com/store/apps/details?id=com.routinekind.app')).toBe(true);
  });

  it('rejects placeholders, local URLs, credentials, plaintext HTTP, and malformed values', () => {
    expect(productionUrlReady('https://example.com/privacy')).toBe(false);
    expect(productionUrlReady('https://EXAMPLE.COM/privacy')).toBe(false);
    expect(productionUrlReady('https://localhost/support')).toBe(false);
    expect(productionUrlReady('https://127.0.0.1/support')).toBe(false);
    expect(productionUrlReady('https://10.0.0.1/support')).toBe(false);
    expect(productionUrlReady('https://routinekind.local/support')).toBe(false);
    expect(productionUrlReady('https://routinekind.test/support')).toBe(false);
    expect(productionUrlReady('https://routinekind.invalid/support')).toBe(false);
    expect(productionUrlReady('https://user:pass@routinekind.app/support')).toBe(false);
    expect(productionUrlReady('http://routinekind.app/support')).toBe(false);
    expect(productionUrlReady('not a url')).toBe(false);
    expect(productionUrlReady('')).toBe(false);
  });

  it('accepts only real production support emails', () => {
    expect(supportEmailReady('support@routinekind.app')).toBe(true);
    expect(supportEmailReady(' support@routinekind.app ')).toBe(true);
    expect(supportEmailReady('support@example.com')).toBe(false);
    expect(supportEmailReady('support@EXAMPLE.COM')).toBe(false);
    expect(supportEmailReady('support@localhost')).toBe(false);
    expect(supportEmailReady('support@routinekind.local')).toBe(false);
    expect(supportEmailReady('support@routinekind.test')).toBe(false);
    expect(supportEmailReady('support@routinekind.invalid')).toBe(false);
    expect(supportEmailReady('not an email')).toBe(false);
  });
});
