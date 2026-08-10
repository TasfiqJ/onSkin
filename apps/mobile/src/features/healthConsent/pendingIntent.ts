import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { localDataOwnerBinding } from '@/lib/auth/sessionOwner';

export const HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY =
  'layerwell.health_data_withdrawal.pending.v1';
export const HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID = 'HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID';
export const HEALTH_WITHDRAWAL_PENDING_INTENT_STORE_UNAVAILABLE =
  'HEALTH_WITHDRAWAL_PENDING_INTENT_STORE_UNAVAILABLE';
export const HEALTH_WITHDRAWAL_PENDING_INTENT_CAPACITY =
  'HEALTH_WITHDRAWAL_PENDING_INTENT_CAPACITY';

const SCHEMA_VERSION = 1 as const;
const MAX_PENDING_OWNERS = 8;
const HEX_256 = /^[a-f0-9]{64}$/;

export type PendingHealthWithdrawalIntent = Readonly<{
  processingEpoch: number;
  /** Null only during the durable pre-intake boundary, before random work. */
  idempotencyKey: string | null;
  operationId: string | null;
  localCleanupComplete: boolean;
  requestedAt: string;
  updatedAt: string;
}>;

type PendingEnvelope = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  intents: Readonly<Record<string, PendingHealthWithdrawalIntent>>;
}>;

let storageTail: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validOperationId(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value === value.trim() &&
      value.length >= 1 &&
      value.length <= 128)
  );
}

function parseIntent(value: unknown): PendingHealthWithdrawalIntent {
  if (!isRecord(value)) throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  const expected = [
    'processingEpoch',
    'idempotencyKey',
    'operationId',
    'localCleanupComplete',
    'requestedAt',
    'updatedAt',
  ].sort();
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  if (
    !Number.isSafeInteger(value.processingEpoch) ||
    (value.processingEpoch as number) < 1 ||
    !(
      value.idempotencyKey === null ||
      (typeof value.idempotencyKey === 'string' && HEX_256.test(value.idempotencyKey))
    ) ||
    !validOperationId(value.operationId) ||
    typeof value.localCleanupComplete !== 'boolean' ||
    !validIso(value.requestedAt) ||
    !validIso(value.updatedAt)
  ) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  return Object.freeze({
    processingEpoch: value.processingEpoch as number,
    idempotencyKey: value.idempotencyKey as string | null,
    operationId: value.operationId,
    localCleanupComplete: value.localCleanupComplete,
    requestedAt: value.requestedAt,
    updatedAt: value.updatedAt,
  });
}

function parseEnvelope(raw: string | null): PendingEnvelope {
  if (raw === null) return Object.freeze({ schemaVersion: SCHEMA_VERSION, intents: {} });
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== SCHEMA_VERSION ||
    !isRecord(value.intents) ||
    Object.keys(value).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, 'schemaVersion') ||
    !Object.prototype.hasOwnProperty.call(value, 'intents')
  ) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  const entries = Object.entries(value.intents);
  if (
    entries.length > MAX_PENDING_OWNERS ||
    entries.some(([ownerBinding]) => !HEX_256.test(ownerBinding))
  ) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  const intents = Object.fromEntries(entries.map(([key, intent]) => [key, parseIntent(intent)]));
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, intents: Object.freeze(intents) });
}

async function secureStoreAvailable(): Promise<boolean> {
  try {
    return (
      typeof SecureStore.isAvailableAsync === 'function' && (await SecureStore.isAvailableAsync())
    );
  } catch {
    return false;
  }
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY);
  if (!(await secureStoreAvailable())) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_STORE_UNAVAILABLE);
  }
  return SecureStore.getItemAsync(HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY);
}

async function writeRaw(envelope: PendingEnvelope): Promise<void> {
  const serialized = JSON.stringify(envelope);
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY, serialized);
    return;
  }
  if (!(await secureStoreAvailable())) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_STORE_UNAVAILABLE);
  }
  await SecureStore.setItemAsync(HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function deleteRaw(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY);
    return;
  }
  if (!(await secureStoreAvailable())) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_STORE_UNAVAILABLE);
  }
  await SecureStore.deleteItemAsync(HEALTH_WITHDRAWAL_PENDING_INTENTS_KEY);
}

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const run = storageTail.then(operation, operation);
  storageTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function bindingFor(ownerUserId: string): Promise<string> {
  if (!ownerUserId || ownerUserId !== ownerUserId.trim()) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  return localDataOwnerBinding(ownerUserId);
}

function assertOwnerBinding(ownerBinding: string): void {
  if (!HEX_256.test(ownerBinding)) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
}

async function prepareAtBinding(params: {
  ownerBinding: string;
  processingEpoch: number;
  idempotencyKey: string | null;
}): Promise<PendingHealthWithdrawalIntent> {
  assertOwnerBinding(params.ownerBinding);
  if (
    !Number.isSafeInteger(params.processingEpoch) ||
    params.processingEpoch < 1 ||
    !(params.idempotencyKey === null || HEX_256.test(params.idempotencyKey))
  ) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
  }
  const envelope = parseEnvelope(await readRaw());
  const existing = envelope.intents[params.ownerBinding];
  if (existing) {
    if (existing.processingEpoch !== params.processingEpoch) {
      throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
    }
    // A pre-intake retry never erases or replaces the first assigned key.
    // Key assignment itself uses the CAS update below.
    return existing;
  }
  if (Object.keys(envelope.intents).length >= MAX_PENDING_OWNERS) {
    throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_CAPACITY);
  }
  const now = new Date().toISOString();
  const intent: PendingHealthWithdrawalIntent = Object.freeze({
    processingEpoch: params.processingEpoch,
    idempotencyKey: params.idempotencyKey,
    operationId: null,
    localCleanupComplete: false,
    requestedAt: now,
    updatedAt: now,
  });
  await writeRaw({
    schemaVersion: SCHEMA_VERSION,
    intents: { ...envelope.intents, [params.ownerBinding]: intent },
  });
  return intent;
}

export function readPendingHealthWithdrawalIntent(
  ownerUserId: string,
): Promise<PendingHealthWithdrawalIntent | null> {
  return serialized(async () => {
    const binding = await bindingFor(ownerUserId);
    return parseEnvelope(await readRaw()).intents[binding] ?? null;
  });
}

export function preparePendingHealthWithdrawalIntent(params: {
  ownerUserId: string;
  processingEpoch: number;
  idempotencyKey: string | null;
}): Promise<PendingHealthWithdrawalIntent> {
  return serialized(async () => {
    const binding = await bindingFor(params.ownerUserId);
    return prepareAtBinding({ ...params, ownerBinding: binding });
  });
}

/**
 * The active processing lease already carries this validated one-way owner
 * binding. Using it lets a confirmed withdrawal persist its pre-intake marker
 * as the first fallible operation, before hashing, random bytes, private reads,
 * cleanup, or network work.
 */
export function preparePendingHealthWithdrawalIntentByOwnerBinding(params: {
  ownerBinding: string;
  processingEpoch: number;
}): Promise<PendingHealthWithdrawalIntent> {
  return serialized(() =>
    prepareAtBinding({
      ownerBinding: params.ownerBinding,
      processingEpoch: params.processingEpoch,
      idempotencyKey: null,
    }),
  );
}

export function updatePendingHealthWithdrawalIntent(params: {
  ownerUserId: string;
  expectedProcessingEpoch: number;
  expectedIdempotencyKey: string | null;
  idempotencyKey?: string;
  operationId?: string | null;
  localCleanupComplete?: boolean;
}): Promise<PendingHealthWithdrawalIntent> {
  return serialized(async () => {
    const binding = await bindingFor(params.ownerUserId);
    const envelope = parseEnvelope(await readRaw());
    const existing = envelope.intents[binding];
    if (
      !existing ||
      existing.processingEpoch !== params.expectedProcessingEpoch ||
      existing.idempotencyKey !== params.expectedIdempotencyKey
    ) {
      throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
    }
    const operationId =
      params.operationId === undefined ? existing.operationId : params.operationId;
    if (!validOperationId(operationId)) {
      throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
    }
    const idempotencyKey = params.idempotencyKey ?? existing.idempotencyKey;
    if (
      idempotencyKey === null ||
      !HEX_256.test(idempotencyKey) ||
      (existing.idempotencyKey !== null && existing.idempotencyKey !== idempotencyKey)
    ) {
      throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
    }
    const next: PendingHealthWithdrawalIntent = Object.freeze({
      ...existing,
      idempotencyKey,
      operationId,
      localCleanupComplete: params.localCleanupComplete ?? existing.localCleanupComplete,
      updatedAt: new Date().toISOString(),
    });
    await writeRaw({
      schemaVersion: SCHEMA_VERSION,
      intents: { ...envelope.intents, [binding]: next },
    });
    return next;
  });
}

async function clearBinding(ownerBinding: string): Promise<void> {
  assertOwnerBinding(ownerBinding);
  const envelope = parseEnvelope(await readRaw());
  if (!envelope.intents[ownerBinding]) return;
  const intents = { ...envelope.intents };
  delete intents[ownerBinding];
  if (Object.keys(intents).length === 0) await deleteRaw();
  else await writeRaw({ schemaVersion: SCHEMA_VERSION, intents });
}

export function clearPendingHealthWithdrawalIntent(
  ownerUserId: string,
  expected?: { processingEpoch: number; idempotencyKey: string | null },
): Promise<void> {
  return serialized(async () => {
    const binding = await bindingFor(ownerUserId);
    if (expected) {
      const existing = parseEnvelope(await readRaw()).intents[binding];
      if (!existing) return;
      if (
        existing.processingEpoch !== expected.processingEpoch ||
        existing.idempotencyKey !== expected.idempotencyKey
      ) {
        throw new Error(HEALTH_WITHDRAWAL_PENDING_INTENT_INVALID);
      }
    }
    await clearBinding(binding);
  });
}

/** Terminal full-account deletion already carries this exact pseudonymous binding. */
export function clearPendingHealthWithdrawalIntentByOwnerBinding(
  ownerBinding: string,
): Promise<void> {
  return serialized(() => clearBinding(ownerBinding));
}

export const pendingHealthWithdrawalIntentParserForTests = parseEnvelope;
