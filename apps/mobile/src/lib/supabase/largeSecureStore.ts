// LargeSecureStore (docs/01 §5): SecureStore has a ~2KB limit and the Supabase
// session JSON exceeds it. So we keep the content key in SecureStore (small) and
// store an authenticated encrypted session envelope in AsyncStorage.
import 'react-native-get-random-values'; // polyfills crypto.getRandomValues
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/ciphers/utils.js';

import {
  deletePrivateSecureStoreItemAsync,
  getPrivateSecureStoreItemAsync,
  setPrivateSecureStoreItemAsync,
} from '@/lib/storage/privateSecureStore';

import {
  decryptLargeSecureStoreValue,
  encryptLargeSecureStoreValue,
} from './largeSecureStoreCrypto';

const CONTENT_KEY_BYTES = 32;

export const LARGE_SECURE_STORE_CONTENT_KEY_MISSING = 'LARGE_SECURE_STORE_CONTENT_KEY_MISSING';
export const LARGE_SECURE_STORE_CONTENT_KEY_INVALID = 'LARGE_SECURE_STORE_CONTENT_KEY_INVALID';
export const LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE =
  'LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE';
export const LARGE_SECURE_STORE_DECRYPTION_FAILED = 'LARGE_SECURE_STORE_DECRYPTION_FAILED';
export const LARGE_SECURE_STORE_ENVELOPE_UNSUPPORTED = 'LARGE_SECURE_STORE_ENVELOPE_UNSUPPORTED';
export const LARGE_SECURE_STORE_ROLLBACK_FAILED = 'LARGE_SECURE_STORE_ROLLBACK_FAILED';

type StorageSnapshot = {
  asyncValue: string | null;
  secureValue: string | null;
};

type AttemptedWrites = {
  async: boolean;
  secure: boolean;
};

const storageOperationTails = new Map<string, Promise<void>>();

async function runSerializedStorageOperation<T>(
  key: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = storageOperationTails.get(key) ?? Promise.resolve();
  const ready = previous.catch(() => undefined);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = ready.then(() => gate);
  storageOperationTails.set(key, tail);

  await ready;
  try {
    return await operation();
  } finally {
    release();
    if (storageOperationTails.get(key) === tail) storageOperationTails.delete(key);
  }
}

async function readSecureValue(key: string): Promise<string | null> {
  try {
    return await getPrivateSecureStoreItemAsync(key);
  } catch {
    throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_STORAGE_UNAVAILABLE);
  }
}

function contentKeyFromStored(value: string | null): Uint8Array | null {
  if (value === null) return null;
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
  }
  try {
    const decoded = hexToBytes(value);
    if (decoded.length !== CONTENT_KEY_BYTES) {
      throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
    }
    return decoded;
  } catch {
    throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_INVALID);
  }
}

function decodeReadableValue(value: string, contentKey: Uint8Array): string {
  const result = decryptLargeSecureStoreValue(value, contentKey);
  if (result.kind === 'current' || result.kind === 'legacy') return result.plaintext;
  if (result.kind === 'unsupported_version') {
    throw new Error(LARGE_SECURE_STORE_ENVELOPE_UNSUPPORTED);
  }
  throw new Error(LARGE_SECURE_STORE_DECRYPTION_FAILED);
}

async function restoreAttemptedWrites(
  key: string,
  snapshot: StorageSnapshot,
  attempted: AttemptedWrites,
): Promise<void> {
  const restoreAsyncAuthority = async (): Promise<void> => {
    try {
      if (snapshot.asyncValue === null) await AsyncStorage.removeItem(key);
      else await AsyncStorage.setItem(key, snapshot.asyncValue);
    } catch {
      // A native write may commit and then reject. The readback below is authoritative.
    }

    let restored: string | null;
    try {
      restored = await AsyncStorage.getItem(key);
    } catch {
      throw new Error(LARGE_SECURE_STORE_ROLLBACK_FAILED);
    }
    if (restored !== snapshot.asyncValue) {
      throw new Error(LARGE_SECURE_STORE_ROLLBACK_FAILED);
    }
  };

  const restoreSecureAuthority = async (): Promise<void> => {
    try {
      if (snapshot.secureValue === null) await deletePrivateSecureStoreItemAsync(key);
      else await setPrivateSecureStoreItemAsync(key, snapshot.secureValue);
    } catch {
      // A native write may commit and then reject. The readback below is authoritative.
    }

    let restored: string | null;
    try {
      restored = await getPrivateSecureStoreItemAsync(key);
    } catch {
      throw new Error(LARGE_SECURE_STORE_ROLLBACK_FAILED);
    }
    if (restored !== snapshot.secureValue) {
      throw new Error(LARGE_SECURE_STORE_ROLLBACK_FAILED);
    }
  };

  try {
    const revertingFirstCreation =
      attempted.async &&
      attempted.secure &&
      snapshot.asyncValue === null &&
      snapshot.secureValue === null;

    if (revertingFirstCreation) {
      // Never delete a newly-created key until ciphertext removal is confirmed.
      await restoreAsyncAuthority();
      await restoreSecureAuthority();
      return;
    }

    // A removed ciphertext must not be restored until its key is confirmed present.
    if (attempted.secure) await restoreSecureAuthority();
    if (attempted.async) await restoreAsyncAuthority();
  } catch {
    throw new Error(LARGE_SECURE_STORE_ROLLBACK_FAILED);
  }
}

export class LargeSecureStore {
  async getItem(key: string): Promise<string | null> {
    return runSerializedStorageOperation(key, async () => {
      const encrypted = await AsyncStorage.getItem(key);
      if (encrypted === null) return null;
      const contentKey = contentKeyFromStored(await readSecureValue(key));
      if (!contentKey) throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_MISSING);
      return decodeReadableValue(encrypted, contentKey);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    return runSerializedStorageOperation(key, async () => {
      const snapshot: StorageSnapshot = {
        asyncValue: await AsyncStorage.getItem(key),
        secureValue: await readSecureValue(key),
      };
      let contentKey = contentKeyFromStored(snapshot.secureValue);
      if (snapshot.asyncValue !== null) {
        if (!contentKey) throw new Error(LARGE_SECURE_STORE_CONTENT_KEY_MISSING);
        decodeReadableValue(snapshot.asyncValue, contentKey);
      }

      contentKey ??= randomBytes(CONTENT_KEY_BYTES);
      const encrypted = encryptLargeSecureStoreValue(value, contentKey);
      const attempted: AttemptedWrites = { async: false, secure: false };
      try {
        if (snapshot.secureValue === null) {
          attempted.secure = true;
          await setPrivateSecureStoreItemAsync(key, bytesToHex(contentKey));
        }
        attempted.async = true;
        await AsyncStorage.setItem(key, encrypted);
      } catch (error) {
        await restoreAttemptedWrites(key, snapshot, attempted);
        throw error;
      }
    });
  }

  async removeItem(key: string): Promise<void> {
    return runSerializedStorageOperation(key, async () => {
      const snapshot: StorageSnapshot = {
        asyncValue: await AsyncStorage.getItem(key),
        secureValue: await readSecureValue(key),
      };
      const attempted: AttemptedWrites = { async: false, secure: false };
      try {
        attempted.async = true;
        await AsyncStorage.removeItem(key);
        attempted.secure = true;
        await deletePrivateSecureStoreItemAsync(key);
      } catch (error) {
        await restoreAttemptedWrites(key, snapshot, attempted);
        throw error;
      }
    });
  }
}
