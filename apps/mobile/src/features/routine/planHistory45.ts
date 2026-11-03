import { utf8ToBytes } from '@noble/ciphers/utils.js';

import {
  assertOriginalHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';

import type { PlanSourceSnapshot44 } from './planSourceFence44';

export const PLAN_HISTORY45_KEY = 'layerwell.routinePlanHistory.v1';
export const PLAN_HISTORY45_CAPACITY = 100;
export const PLAN_HISTORY45_MAX_BYTES = 1_048_576;
export const PLAN_HISTORY45_MAX_STEPS = 50;
export const PLAN_HISTORY45_INVALID = 'PLAN_HISTORY45_INVALID';
export const PLAN_HISTORY45_OWNER_MISMATCH = 'PLAN_HISTORY45_OWNER_MISMATCH';
export const PLAN_HISTORY45_CAPACITY_REACHED = 'PLAN_HISTORY45_CAPACITY_REACHED';
export const PLAN_HISTORY45_RETRY_CONFLICT = 'PLAN_HISTORY45_RETRY_CONFLICT';

export type PlanHistoryStep45 = Readonly<{ productId: string; name: string }>;
export type PlanHistoryVersion45 = Readonly<{
  id: string;
  sequence: number;
  createdAt: string;
  sourceHash: string;
  am: readonly PlanHistoryStep45[];
  pm: readonly PlanHistoryStep45[];
}>;
export type PlanHistory45 = Readonly<{
  schemaVersion: 1;
  ownerUserId: string;
  versions: readonly PlanHistoryVersion45[];
}>;
export type PlanHistorySaveRequest45 = Readonly<{ id: string; createdAt: string }>;

function invalid(): never {
  throw new Error(PLAN_HISTORY45_INVALID);
}

function exactRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== [...fields].sort().join(',')) invalid();
  return record;
}

function boundedText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max ||
      value !== value.trim() || /[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value)) invalid();
  return value;
}

function versionId(value: unknown): string {
  if (typeof value !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value)) invalid();
  return value;
}

function utcTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid();
  return value;
}

function period(value: unknown): readonly PlanHistoryStep45[] {
  if (!Array.isArray(value) || value.length > PLAN_HISTORY45_MAX_STEPS) invalid();
  const seen = new Set<string>();
  return Object.freeze(value.map((entry: unknown) => {
    const row = exactRecord(entry, ['productId', 'name']);
    const productId = boundedText(row.productId, 128);
    const name = boundedText(row.name, 200);
    if (seen.has(productId)) invalid();
    seen.add(productId);
    return Object.freeze({ productId, name });
  }));
}

function version(value: unknown, sequence: number): PlanHistoryVersion45 {
  const row = exactRecord(value, ['id', 'sequence', 'createdAt', 'sourceHash', 'am', 'pm']);
  const id = versionId(row.id);
  if (row.sequence !== sequence || !Number.isSafeInteger(row.sequence)) invalid();
  const createdAt = utcTimestamp(row.createdAt);
  if (typeof row.sourceHash !== 'string' || !/^[a-f0-9]{64}$/u.test(row.sourceHash)) invalid();
  const am = period(row.am);
  const pm = period(row.pm);
  if (am.length + pm.length === 0) invalid();
  return Object.freeze({ id, sequence, createdAt, sourceHash: row.sourceHash, am, pm });
}

/** Pure strict decoder, also used by the existing owner-verified export lane.
 * Only true native absence is empty; malformed/future/legacy data never is. */
export function decodePlanHistory45(raw: string | null, expectedOwnerUserId: string): PlanHistory45 {
  const owner = boundedText(expectedOwnerUserId, 128);
  if (raw === null) return Object.freeze({ schemaVersion: 1, ownerUserId: owner, versions: Object.freeze([]) });
  if (typeof raw !== 'string' || raw.length > PLAN_HISTORY45_MAX_BYTES ||
      utf8ToBytes(raw).byteLength > PLAN_HISTORY45_MAX_BYTES) invalid();
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { invalid(); }
  const row = exactRecord(parsed, ['schemaVersion', 'ownerUserId', 'versions']);
  if (row.schemaVersion !== 1) invalid();
  boundedText(row.ownerUserId, 128);
  if (row.ownerUserId !== owner) throw new Error(PLAN_HISTORY45_OWNER_MISMATCH);
  if (!Array.isArray(row.versions) || row.versions.length > PLAN_HISTORY45_CAPACITY) invalid();
  const versions = row.versions.map((entry: unknown, index: number) => version(entry, index + 1));
  if (new Set(versions.map((entry) => entry.id)).size !== versions.length) invalid();
  return Object.freeze({ schemaVersion: 1, ownerUserId: owner, versions: Object.freeze(versions) });
}

/** Read under the destination queue, so tentative/compensating native bytes
 * cannot become a visible record. This creates no ciphertext, including empty. */
export async function loadPlanHistory45(lease: HealthDataWriteLease): Promise<PlanHistory45> {
  const assertCurrent = () => assertOriginalHealthDataWriteLease(lease);
  assertCurrent();
  let result: PlanHistory45 | undefined;
  const { updatePrivateItemWithSources } = await import('@/lib/storage/privateKV');
  assertCurrent();
  await updatePrivateItemWithSources(PLAN_HISTORY45_KEY, [], (values) => {
    assertCurrent();
    const raw = values.get(PLAN_HISTORY45_KEY) ?? null;
    result = decodePlanHistory45(raw, lease.ownerUserId);
    return raw;
  }, assertCurrent);
  assertCurrent();
  if (!result) invalid();
  return result;
}

/** Explicit caller intent only. The original proof, lease and source bytes are
 * checked by the fixed-destination C44 adapter before this pure transform. */
export async function savePlanHistory45(
  snapshot: PlanSourceSnapshot44,
  lease: HealthDataWriteLease,
  request: PlanHistorySaveRequest45,
): Promise<PlanHistory45> {
  assertOriginalHealthDataWriteLease(lease);
  const row = exactRecord(request, ['id', 'createdAt']);
  const id = versionId(row.id);
  const createdAt = utcTimestamp(row.createdAt);
  let committed: PlanHistory45 | undefined;
  const { appendPlanHistoryWithSources44 } = await import('./planSourceFence44');
  assertOriginalHealthDataWriteLease(lease);
  await appendPlanHistoryWithSources44(snapshot, lease, (raw) => {
    const current = decodePlanHistory45(raw, lease.ownerUserId);
    const existing = current.versions.find((entry) => entry.id === id);
    const next = version({ id, sequence: existing?.sequence ?? current.versions.length + 1,
      createdAt, sourceHash: snapshot.sourceHash, am: snapshot.am, pm: snapshot.pm },
    existing?.sequence ?? current.versions.length + 1);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(next)) throw new Error(PLAN_HISTORY45_RETRY_CONFLICT);
      committed = current;
      return raw!;
    }
    if (current.versions.length >= PLAN_HISTORY45_CAPACITY) throw new Error(PLAN_HISTORY45_CAPACITY_REACHED);
    const encoded = JSON.stringify({ schemaVersion: 1, ownerUserId: lease.ownerUserId,
      versions: [...current.versions, next] });
    committed = decodePlanHistory45(encoded, lease.ownerUserId);
    return encoded;
  });
  assertOriginalHealthDataWriteLease(lease);
  if (!committed) invalid();
  return committed;
}
