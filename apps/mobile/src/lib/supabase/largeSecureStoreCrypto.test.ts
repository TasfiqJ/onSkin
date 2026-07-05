import * as aesjs from 'aes-js';
import { describe, expect, it } from 'vitest';

import { decryptLargeSecureStoreValue, encryptLargeSecureStoreValue } from './largeSecureStoreCrypto';

const KEY = Uint8Array.from(Array.from({ length: 32 }, (_, index) => index + 1));

function legacyAesCtrCiphertext(value: string): string {
  const cipher = new aesjs.ModeOfOperation.ctr(KEY, new aesjs.Counter(1));
  return aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));
}

function tamperCiphertext(encrypted: string): string {
  const envelope = JSON.parse(encrypted) as { ciphertextHex: string };
  const last = envelope.ciphertextHex.at(-1);
  envelope.ciphertextHex = `${envelope.ciphertextHex.slice(0, -1)}${last === '0' ? '1' : '0'}`;
  return JSON.stringify(envelope);
}

describe('large secure store authenticated session encryption', () => {
  it('round-trips Supabase session JSON through an authenticated envelope', () => {
    const value = JSON.stringify({ access_token: 'at', refresh_token: 'rt', user: { id: 'user-1' } });
    const encrypted = encryptLargeSecureStoreValue(value, KEY);
    const parsed = JSON.parse(encrypted) as { version?: string; ciphertextHex?: string };

    expect(parsed.version).toBe('xchacha20poly1305:v1');
    expect(encrypted).not.toContain('access_token');
    expect(encrypted).not.toContain('refresh_token');
    expect(decryptLargeSecureStoreValue(encrypted, KEY)).toEqual({ plaintext: value, needsMigration: false });
  });

  it('rejects tampered authenticated ciphertext instead of returning corrupted session JSON', () => {
    const encrypted = encryptLargeSecureStoreValue('{"access_token":"at"}', KEY);

    expect(decryptLargeSecureStoreValue(tamperCiphertext(encrypted), KEY)).toEqual({
      plaintext: null,
      needsMigration: false,
    });
  });

  it('rejects unexpected plaintext or malformed stored values', () => {
    expect(decryptLargeSecureStoreValue('{"access_token":"plaintext"}', KEY)).toEqual({
      plaintext: null,
      needsMigration: false,
    });
    expect(decryptLargeSecureStoreValue('not hex and not json', KEY)).toEqual({
      plaintext: null,
      needsMigration: false,
    });
  });

  it('reads legacy AES-CTR session ciphertext only as a migration source', () => {
    const value = JSON.stringify({ access_token: 'legacy-at', refresh_token: 'legacy-rt' });

    expect(decryptLargeSecureStoreValue(legacyAesCtrCiphertext(value), KEY)).toEqual({
      plaintext: value,
      needsMigration: true,
    });
  });
});
