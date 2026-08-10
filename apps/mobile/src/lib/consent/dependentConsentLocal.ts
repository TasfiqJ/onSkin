import {
  consentCopyFor,
  isExactHealthDependentConsentCopy,
  type HealthDependentConsentType,
} from './dependentConsentContract';
import type { HealthDependentConsentLease } from './dependentConsentLease';
import { assertHealthDependentConsentLease } from './dependentConsentLease';
import {
  getPrivateItem,
  removePrivateItem,
  setPrivateItem,
} from '@/lib/storage/privateKV';

import {
  clearOwnerDependentConsentRecoveryRaw,
  clearOwnerDependentConsentRecoveryRawByBinding,
  readDependentConsentRecoveryRaw,
  removeDependentConsentRecoveryRaw,
  writeDependentConsentRecoveryRaw,
} from './dependentConsentRecoveryStore';

const LOCAL_RECEIPT_SCHEMA_VERSION = 1 as const;
const WITHDRAWAL_TOMBSTONE_SCHEMA_VERSION = 1 as const;

const LOCAL_RECEIPT_KEYS: Record<HealthDependentConsentType, string> = {
  photo_capture: 'layerwell.photos.captureConsent.v1',
  photo_cloud_backup: 'layerwell.photos.cloudBackup',
  photo_trend_insights: 'layerwell.trendInsights.v1',
  ask_layerwell: 'layerwell.ask.consent.v1',
  community_participation: 'layerwell.communityConsent.v1',
  data_sharing: 'layerwell.commerceConsent.v1',
};

export type LocalDependentConsentReceipt = Readonly<{
  schemaVersion: typeof LOCAL_RECEIPT_SCHEMA_VERSION;
  type: HealthDependentConsentType;
  ownerUserId: string;
  granted: true;
  version: string;
  consentTextHash: string;
  healthEpoch: number;
  serverGeneration: number | null;
  recordedAt: string;
}>;

export type DependentConsentWithdrawalTombstone = Readonly<{
  schemaVersion: typeof WITHDRAWAL_TOMBSTONE_SCHEMA_VERSION;
  type: HealthDependentConsentType;
  ownerUserId: string;
  state: 'pending' | 'withdrawn';
  authority: 'local_only' | 'remote_required';
  resumeMode: 'local_intent' | 'poll_only';
  healthEpoch: number;
  expectedConsentGeneration: number | null;
  observedConsentGeneration: number | null;
  idempotencyKey: string;
  version: string;
  consentTextHash: string;
  requestedAt: string;
  updatedAt: string;
}>;

export const HEALTH_DEPENDENT_CONSENT_TOMBSTONE_TYPES = Object.freeze([
  'photo_capture',
  'photo_cloud_backup',
  'photo_trend_insights',
  'ask_layerwell',
  'community_participation',
  'data_sharing',
] satisfies HealthDependentConsentType[]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function validOwner(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim()
  );
}

function safeNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function parseJson(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('HEALTH_DEPENDENT_CONSENT_LOCAL_INVALID');
  }
  if (!isRecord(parsed)) throw new Error('HEALTH_DEPENDENT_CONSENT_LOCAL_INVALID');
  return parsed;
}

function decodeLocalReceipt(
  raw: string,
  expectedType: HealthDependentConsentType,
  expectedOwnerUserId: string,
  expectedHealthEpoch: number,
): LocalDependentConsentReceipt {
  const value = parseJson(raw);
  if (
    !exactKeys(value, [
      'schemaVersion',
      'type',
      'ownerUserId',
      'granted',
      'version',
      'consentTextHash',
      'healthEpoch',
      'serverGeneration',
      'recordedAt',
    ]) ||
    value.schemaVersion !== LOCAL_RECEIPT_SCHEMA_VERSION ||
    value.type !== expectedType ||
    value.ownerUserId !== expectedOwnerUserId ||
    value.granted !== true ||
    !safeNonnegativeInteger(value.healthEpoch) ||
    value.healthEpoch !== expectedHealthEpoch ||
    (value.serverGeneration !== null &&
      (!safeNonnegativeInteger(value.serverGeneration) || value.serverGeneration < 1)) ||
    !validIso(value.recordedAt) ||
    !isExactHealthDependentConsentCopy({
      type: expectedType,
      state: 'grant',
      version: value.version,
      consentTextHash: value.consentTextHash,
    })
  ) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_LOCAL_INVALID');
  }
  return Object.freeze(value as unknown as LocalDependentConsentReceipt);
}

function decodeTombstone(
  raw: string,
  expectedType: HealthDependentConsentType,
  expectedOwnerUserId: string,
): DependentConsentWithdrawalTombstone {
  const value = parseJson(raw);
  if (
    !exactKeys(value, [
      'schemaVersion',
      'type',
      'ownerUserId',
      'state',
      'authority',
      'resumeMode',
      'healthEpoch',
      'expectedConsentGeneration',
      'observedConsentGeneration',
      'idempotencyKey',
      'version',
      'consentTextHash',
      'requestedAt',
      'updatedAt',
    ]) ||
    value.schemaVersion !== WITHDRAWAL_TOMBSTONE_SCHEMA_VERSION ||
    value.type !== expectedType ||
    value.ownerUserId !== expectedOwnerUserId ||
    (value.state !== 'pending' && value.state !== 'withdrawn') ||
    (value.authority !== 'local_only' && value.authority !== 'remote_required') ||
    (value.resumeMode !== 'local_intent' && value.resumeMode !== 'poll_only') ||
    !safeNonnegativeInteger(value.healthEpoch) ||
    (value.expectedConsentGeneration !== null &&
      !safeNonnegativeInteger(value.expectedConsentGeneration)) ||
    (value.observedConsentGeneration !== null &&
      !safeNonnegativeInteger(value.observedConsentGeneration)) ||
    typeof value.idempotencyKey !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.idempotencyKey) ||
    !validIso(value.requestedAt) ||
    !validIso(value.updatedAt) ||
    !isExactHealthDependentConsentCopy({
      type: expectedType,
      state: 'withdrawal',
      version: value.version,
      consentTextHash: value.consentTextHash,
    })
  ) {
    throw new Error('HEALTH_DEPENDENT_CONSENT_TOMBSTONE_INVALID');
  }
  return Object.freeze(value as unknown as DependentConsentWithdrawalTombstone);
}

export async function readLocalDependentConsentReceipt(
  lease: HealthDependentConsentLease,
): Promise<LocalDependentConsentReceipt | null> {
  assertHealthDependentConsentLease(lease, lease.state);
  const raw = await getPrivateItem(LOCAL_RECEIPT_KEYS[lease.type]);
  assertHealthDependentConsentLease(lease, lease.state);
  return raw === null
    ? null
    : decodeLocalReceipt(raw, lease.type, lease.ownerUserId, lease.healthEpoch);
}

export async function writeLocalDependentConsentReceipt(params: {
  lease: HealthDependentConsentLease;
  serverGeneration: number | null;
}): Promise<void> {
  assertHealthDependentConsentLease(params.lease, params.lease.state);
  const copy = consentCopyFor(params.lease.type, 'grant');
  const receipt: LocalDependentConsentReceipt = Object.freeze({
    schemaVersion: LOCAL_RECEIPT_SCHEMA_VERSION,
    type: params.lease.type,
    ownerUserId: params.lease.ownerUserId,
    granted: true,
    version: copy.version,
    consentTextHash: copy.sha256,
    healthEpoch: params.lease.healthEpoch,
    serverGeneration: params.serverGeneration,
    recordedAt: new Date().toISOString(),
  });
  await setPrivateItem(LOCAL_RECEIPT_KEYS[params.lease.type], JSON.stringify(receipt));
  assertHealthDependentConsentLease(params.lease, params.lease.state);
}

export function removeLocalDependentConsentReceipt(
  type: HealthDependentConsentType,
): Promise<void> {
  return removePrivateItem(LOCAL_RECEIPT_KEYS[type]);
}

export async function readDependentConsentWithdrawalTombstone(
  ownerUserId: string,
  type: HealthDependentConsentType,
): Promise<DependentConsentWithdrawalTombstone | null> {
  if (!validOwner(ownerUserId)) throw new Error('HEALTH_DEPENDENT_CONSENT_OWNER_CHANGED');
  const raw = await readDependentConsentRecoveryRaw(ownerUserId, type);
  return raw === null ? null : decodeTombstone(raw, type, ownerUserId);
}

export async function writeDependentConsentWithdrawalTombstone(params: {
  ownerUserId: string;
  type: HealthDependentConsentType;
  state: 'pending' | 'withdrawn';
  authority: 'local_only' | 'remote_required';
  resumeMode: 'local_intent' | 'poll_only';
  healthEpoch: number;
  expectedConsentGeneration: number | null;
  observedConsentGeneration: number | null;
  idempotencyKey: string;
  requestedAt: string;
}): Promise<DependentConsentWithdrawalTombstone> {
  const copy = consentCopyFor(params.type, 'withdrawal');
  const value: DependentConsentWithdrawalTombstone = Object.freeze({
    schemaVersion: WITHDRAWAL_TOMBSTONE_SCHEMA_VERSION,
    type: params.type,
    ownerUserId: params.ownerUserId,
    state: params.state,
    authority: params.authority,
    resumeMode: params.resumeMode,
    healthEpoch: params.healthEpoch,
    expectedConsentGeneration: params.expectedConsentGeneration,
    observedConsentGeneration: params.observedConsentGeneration,
    idempotencyKey: params.idempotencyKey,
    version: copy.version,
    consentTextHash: copy.sha256,
    requestedAt: params.requestedAt,
    updatedAt: new Date().toISOString(),
  });
  // Decode before persisting too: malformed caller state cannot become a
  // durable authority record even if TypeScript was bypassed.
  decodeTombstone(JSON.stringify(value), params.type, params.ownerUserId);
  await writeDependentConsentRecoveryRaw(
    params.ownerUserId,
    params.type,
    JSON.stringify(value),
  );
  return value;
}

export function clearDependentConsentWithdrawalTombstone(
  ownerUserId: string,
  type: HealthDependentConsentType,
): Promise<void> {
  return removeDependentConsentRecoveryRaw(ownerUserId, type);
}

export function clearAllDependentConsentWithdrawalTombstones(
  ownerUserId: string,
): Promise<void> {
  return clearOwnerDependentConsentRecoveryRaw(ownerUserId);
}

/** Terminal account-deletion cleanup using its durable one-way owner proof. */
export function clearAllDependentConsentWithdrawalTombstonesByOwnerBinding(
  ownerBinding: string,
): Promise<void> {
  return clearOwnerDependentConsentRecoveryRawByBinding(ownerBinding);
}

export const dependentConsentLocalReceiptKeys = Object.freeze({ ...LOCAL_RECEIPT_KEYS });
