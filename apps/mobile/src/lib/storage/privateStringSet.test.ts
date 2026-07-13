import { describe, expect, it } from 'vitest';

import {
  decodePrivateStringSet,
  encodePrivateStringSet,
  PRIVATE_STRING_SET_INVALID,
  PRIVATE_STRING_SET_UNSUPPORTED_VERSION,
} from './privateStringSet';

describe('versioned private string-set codec', () => {
  it('round-trips the strict current envelope', () => {
    const encoded = encodePrivateStringSet(['alpha', 'beta']);

    expect(JSON.parse(encoded)).toEqual({ version: 1, values: ['alpha', 'beta'] });
    expect(decodePrivateStringSet(encoded)).toEqual(['alpha', 'beta']);
  });

  it('decodes the legacy array without requiring read-time repair', () => {
    expect(decodePrivateStringSet(JSON.stringify([' alpha ', 'alpha', 7, '', 'beta']))).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('distinguishes invalid and unsupported data', () => {
    expect(() => decodePrivateStringSet('{not-json')).toThrow(PRIVATE_STRING_SET_INVALID);
    expect(() => decodePrivateStringSet(JSON.stringify({ version: 1, values: [' alpha'] }))).toThrow(
      PRIVATE_STRING_SET_INVALID,
    );
    expect(() => decodePrivateStringSet(JSON.stringify({ version: 2, values: [] }))).toThrow(
      PRIVATE_STRING_SET_UNSUPPORTED_VERSION,
    );
  });
});
