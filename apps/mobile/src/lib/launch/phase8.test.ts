import { describe, expect, it } from 'vitest';

import { phase8Flags, productionUrlReady, supportEmailReady } from './phase8';

describe('Phase 8 production URL readiness', () => {
  it('keeps public conflict links independently closed', () => {
    expect(phase8Flags.publicLinks).toBe(false);
  });

  it('accepts real HTTPS production URLs', () => {
    expect(productionUrlReady('https://layerwell.app')).toBe(true);
    expect(productionUrlReady('https://apps.apple.com/app/id123456789')).toBe(true);
    expect(
      productionUrlReady('https://play.google.com/store/apps/details?id=com.layerwell.app'),
    ).toBe(true);
  });

  it('rejects placeholders, local URLs, credentials, plaintext HTTP, and malformed values', () => {
    expect(productionUrlReady('https://example.com/privacy')).toBe(false);
    expect(productionUrlReady('https://EXAMPLE.COM/privacy')).toBe(false);
    expect(productionUrlReady('https://localhost/support')).toBe(false);
    expect(productionUrlReady('https://127.0.0.1/support')).toBe(false);
    expect(productionUrlReady('https://10.0.0.1/support')).toBe(false);
    expect(productionUrlReady('https://layerwell.local/support')).toBe(false);
    expect(productionUrlReady('https://layerwell.test/support')).toBe(false);
    expect(productionUrlReady('https://layerwell.invalid/support')).toBe(false);
    expect(productionUrlReady('https://user:pass@layerwell.app/support')).toBe(false);
    expect(productionUrlReady('http://layerwell.app/support')).toBe(false);
    expect(productionUrlReady('not a url')).toBe(false);
    expect(productionUrlReady('')).toBe(false);
  });

  it('accepts only real production support emails', () => {
    expect(supportEmailReady('support@layerwell.app')).toBe(true);
    expect(supportEmailReady(' support@layerwell.app ')).toBe(true);
    expect(supportEmailReady('support@example.com')).toBe(false);
    expect(supportEmailReady('support@EXAMPLE.COM')).toBe(false);
    expect(supportEmailReady('support@localhost')).toBe(false);
    expect(supportEmailReady('support@layerwell.local')).toBe(false);
    expect(supportEmailReady('support@layerwell.test')).toBe(false);
    expect(supportEmailReady('support@layerwell.invalid')).toBe(false);
    expect(supportEmailReady('not an email')).toBe(false);
  });
});
