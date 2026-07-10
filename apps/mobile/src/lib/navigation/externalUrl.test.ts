import { describe, expect, it } from 'vitest';

import { appendExternalQueryParam, safeExternalHttpsUrl } from './externalUrl';

describe('external URL handoff guard', () => {
  it('allows normalized HTTPS URLs and strips fragments', () => {
    expect(safeExternalHttpsUrl(' https://example.com/path?x=1#token ')).toBe(
      'https://example.com/path?x=1',
    );
  });

  it('rejects custom schemes, plaintext HTTP, credentials, malformed strings, and controls', () => {
    expect(safeExternalHttpsUrl('onskin://auth/callback?token=x')).toBeNull();
    expect(safeExternalHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalHttpsUrl('http://example.com/path')).toBeNull();
    expect(safeExternalHttpsUrl('https://user:pass@example.com/path')).toBeNull();
    expect(safeExternalHttpsUrl('not a url')).toBeNull();
    expect(safeExternalHttpsUrl('https://example.com/\nnext')).toBeNull();
  });

  it('appends one opaque query parameter only after URL validation', () => {
    expect(
      appendExternalQueryParam('https://example.com/p?x=1&oref=old#frag', 'oref', 'tok 123'),
    ).toBe('https://example.com/p?x=1&oref=tok+123');
    expect(appendExternalQueryParam('onskin://retailer', 'oref', 'tok123')).toBeNull();
  });
});
