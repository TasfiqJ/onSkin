import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  randomBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';

import {
  PRIVATE_KV_CONTENT_KEY_NAME,
  clearStoredPrivateKVContentKey,
  getStoredPrivateKVContentKey,
  setStoredPrivateKVContentKey,
} from './privateKVContentKey';

const ENCRYPTION_VERSION = 'xchacha20poly1305:v1';
const NONCE_BYTES = 24;

type PrivateEnvelope = {
  version: typeof ENCRYPTION_VERSION;
  nonceHex: string;
  ciphertextHex: string;
};

async function getContentKey(): Promise<Uint8Array> {
  const existing = await getStoredPrivateKVContentKey();
  if (existing) return hexToBytes(existing);

  const key = randomBytes(32);
  await setStoredPrivateKVContentKey(bytesToHex(key));
  return key;
}

function parseEnvelope(raw: string): PrivateEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PrivateEnvelope>;
    if (
      parsed.version === ENCRYPTION_VERSION &&
      typeof parsed.nonceHex === 'string' &&
      typeof parsed.ciphertextHex === 'string'
    ) {
      return parsed as PrivateEnvelope;
    }
  } catch {
    /* Legacy plaintext JSON/string. */
  }
  return null;
}

export async function getPrivateItem(key: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  const envelope = parseEnvelope(raw);
  if (!envelope) return raw;

  const contentKey = await getContentKey();
  try {
    const plaintext = xchacha20poly1305(contentKey, hexToBytes(envelope.nonceHex)).decrypt(
      hexToBytes(envelope.ciphertextHex),
    );
    return bytesToUtf8(plaintext);
  } catch {
    await AsyncStorage.removeItem(key).catch(() => undefined);
    return null;
  }
}

export async function setPrivateItem(key: string, value: string): Promise<void> {
  const contentKey = await getContentKey();
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(contentKey, nonce).encrypt(utf8ToBytes(value));
  const envelope: PrivateEnvelope = {
    version: ENCRYPTION_VERSION,
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
  await AsyncStorage.setItem(key, JSON.stringify(envelope));
}

export async function removePrivateItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function multiRemovePrivateItems(keys: readonly string[]): Promise<void> {
  await AsyncStorage.multiRemove([...keys]);
}

export async function clearPrivateKVContentKey(): Promise<void> {
  await clearStoredPrivateKVContentKey();
}

export const privateKVEncryptionInfo = {
  version: ENCRYPTION_VERSION,
  secureStoreKey: PRIVATE_KV_CONTENT_KEY_NAME,
} as const;
