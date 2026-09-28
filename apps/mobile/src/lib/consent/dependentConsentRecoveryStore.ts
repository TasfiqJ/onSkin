import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { localDataOwnerBinding } from '@/lib/auth/sessionOwner';

import type { HealthDependentConsentType } from './dependentConsentContract';
import {
  HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX,
  HEALTH_DEPENDENT_CONSENT_RECOVERY_TYPES,
} from './dependentConsentRecoveryContract';

export {
  HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX,
} from './dependentConsentRecoveryContract';

export const HEALTH_DEPENDENT_CONSENT_RECOVERY_STORE_UNAVAILABLE =
  'HEALTH_DEPENDENT_CONSENT_RECOVERY_STORE_UNAVAILABLE';
const OWNER_BINDING_PATTERN = /^[a-f0-9]{64}$/u;
const RECOVERY_TYPES = new Set<HealthDependentConsentType>(
  HEALTH_DEPENDENT_CONSENT_RECOVERY_TYPES,
);
let storageTail: Promise<void> = Promise.resolve();

async function assertSecureStoreAvailable(): Promise<void> {
  try {
    if (
      typeof SecureStore.isAvailableAsync !== 'function' ||
      !(await SecureStore.isAvailableAsync())
    ) {
      throw new Error(HEALTH_DEPENDENT_CONSENT_RECOVERY_STORE_UNAVAILABLE);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === HEALTH_DEPENDENT_CONSENT_RECOVERY_STORE_UNAVAILABLE
    ) {
      throw error;
    }
    throw new Error(HEALTH_DEPENDENT_CONSENT_RECOVERY_STORE_UNAVAILABLE);
  }
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const run = storageTail.then(operation, operation);
  storageTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function assertType(type: HealthDependentConsentType): void {
  if (!RECOVERY_TYPES.has(type)) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_INVALID');
  }
}

function recoveryKey(ownerBinding: string, type: HealthDependentConsentType): string {
  if (!OWNER_BINDING_PATTERN.test(ownerBinding)) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_RECOVERY_OWNER_INVALID');
  }
  assertType(type);
  return `${HEALTH_DEPENDENT_CONSENT_RECOVERY_KEY_PREFIX}${ownerBinding}.${type}.v1`;
}

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  await assertSecureStoreAvailable();
  return SecureStore.getItemAsync(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await assertSecureStoreAvailable();
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function removeRaw(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await assertSecureStoreAvailable();
  await SecureStore.deleteItemAsync(key);
}

async function ownerBinding(ownerUserId: string): Promise<string> {
  if (!ownerUserId || ownerUserId !== ownerUserId.trim() || ownerUserId.length > 128) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_RECOVERY_OWNER_INVALID');
  }
  const binding = await localDataOwnerBinding(ownerUserId);
  if (!OWNER_BINDING_PATTERN.test(binding)) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_RECOVERY_OWNER_INVALID');
  }
  return binding;
}

export function readDependentConsentRecoveryRaw(
  ownerUserId: string,
  type: HealthDependentConsentType,
): Promise<string | null> {
  return serialized(async () => {
    const binding = await ownerBinding(ownerUserId);
    return readRaw(recoveryKey(binding, type));
  });
}

export function writeDependentConsentRecoveryRaw(
  ownerUserId: string,
  type: HealthDependentConsentType,
  value: string,
): Promise<void> {
  return serialized(async () => {
    const binding = await ownerBinding(ownerUserId);
    await writeRaw(recoveryKey(binding, type), value);
  });
}

export function removeDependentConsentRecoveryRaw(
  ownerUserId: string,
  type: HealthDependentConsentType,
): Promise<void> {
  return serialized(async () => {
    const binding = await ownerBinding(ownerUserId);
    await removeRaw(recoveryKey(binding, type));
  });
}

export function clearOwnerDependentConsentRecoveryRaw(ownerUserId: string): Promise<void> {
  return serialized(async () => {
    const binding = await ownerBinding(ownerUserId);
    await clearOwnerBinding(binding);
  });
}

async function clearOwnerBinding(binding: string): Promise<void> {
  if (!OWNER_BINDING_PATTERN.test(binding)) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_RECOVERY_OWNER_INVALID');
  }
  const results = await Promise.allSettled(
    [...RECOVERY_TYPES].map((type) => removeRaw(recoveryKey(binding, type))),
  );
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error(HEALTH_DEPENDENT_CONSENT_RECOVERY_STORE_UNAVAILABLE);
  }
}

/**
 * Terminal account deletion retains only the one-way owner binding, not the
 * raw account identifier. That binding is the exact namespace used by the
 * recovery keys, so it can delete only that proven owner's capabilities.
 */
export function clearOwnerDependentConsentRecoveryRawByBinding(
  binding: string,
): Promise<void> {
  return serialized(async () => {
    await clearOwnerBinding(binding);
  });
}

export function resetDependentConsentRecoverySerializationForTests(): void {
  storageTail = Promise.resolve();
}
