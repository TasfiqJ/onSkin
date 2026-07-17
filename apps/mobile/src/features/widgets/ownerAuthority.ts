import { randomUUID } from 'expo-crypto';

import {
  runHealthDataOperation,
  type HealthDataWriteOperationLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { updatePrivateItem } from '@/lib/storage/privateKV';

export const ROUTINE_WIDGET_OWNER_AUTHORITY_KEY = 'routinekind.widgetOwnerAuthority.v1';
export const ROUTINE_WIDGET_OWNER_AUTHORITY_INVALID = 'ROUTINE_WIDGET_OWNER_AUTHORITY_INVALID';
export const ROUTINE_WIDGET_OWNER_AUTHORITY_UNSUPPORTED_VERSION =
  'ROUTINE_WIDGET_OWNER_AUTHORITY_UNSUPPORTED_VERSION';
export const ROUTINE_WIDGET_OWNER_AUTHORITY_STALE = 'ROUTINE_WIDGET_OWNER_AUTHORITY_STALE';

const SCHEMA_VERSION = 1 as const;
const MAX_STORED_AUTHORITY_CHARS = 4_096;
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const AUTHORITY_KEYS = [
  'accountGeneration',
  'ownerGeneration',
  'ownerUserId',
  'processingEpoch',
  'processingGeneration',
  'schemaVersion',
].sort();

export type RoutineWidgetOwnerAuthority = Readonly<{
  schemaVersion: typeof SCHEMA_VERSION;
  ownerUserId: string;
  ownerGeneration: string;
  processingEpoch: number;
  processingGeneration: number;
  accountGeneration: number;
}>;

export type RoutineWidgetOwnerAuthorityInput = Readonly<{
  ownerUserId: string;
  processingEpoch: number;
}>;

function fail(code = ROUTINE_WIDGET_OWNER_AUTHORITY_INVALID): never {
  throw new Error(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value).sort();
  return (
    keys.length === AUTHORITY_KEYS.length &&
    keys.every((key, index) => key === AUTHORITY_KEYS[index])
  );
}

function safeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function ownerUserId(value: unknown): string | null {
  return typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim()
    ? value
    : null;
}

function opaqueUuid(value: unknown): string | null {
  return typeof value === 'string' && value === value.toLowerCase() && UUID_V4_RE.test(value)
    ? value
    : null;
}

function decodeCurrentAuthority(raw: string): RoutineWidgetOwnerAuthority | null {
  if (raw.length > MAX_STORED_AUTHORITY_CHARS) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (
    typeof value.schemaVersion === 'number' &&
    Number.isSafeInteger(value.schemaVersion) &&
    value.schemaVersion > SCHEMA_VERSION
  ) {
    fail(ROUTINE_WIDGET_OWNER_AUTHORITY_UNSUPPORTED_VERSION);
  }
  if (value.schemaVersion !== SCHEMA_VERSION || !exactKeys(value)) return null;
  const normalizedOwnerUserId = ownerUserId(value.ownerUserId);
  const ownerGeneration = opaqueUuid(value.ownerGeneration);
  if (
    normalizedOwnerUserId === null ||
    ownerGeneration === null ||
    !safeNonNegativeInteger(value.processingEpoch) ||
    !safeNonNegativeInteger(value.processingGeneration) ||
    !safeNonNegativeInteger(value.accountGeneration)
  ) {
    return null;
  }
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    ownerUserId: normalizedOwnerUserId,
    ownerGeneration,
    processingEpoch: value.processingEpoch,
    processingGeneration: value.processingGeneration,
    accountGeneration: value.accountGeneration,
  });
}

function freshOwnerGeneration(excluding: string | null): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = opaqueUuid(randomUUID().toLowerCase());
    if (candidate !== null && candidate !== excluding) return candidate;
  }
  fail();
}

function encodeAuthority(authority: RoutineWidgetOwnerAuthority): string {
  return JSON.stringify({
    accountGeneration: authority.accountGeneration,
    ownerGeneration: authority.ownerGeneration,
    ownerUserId: authority.ownerUserId,
    processingEpoch: authority.processingEpoch,
    processingGeneration: authority.processingGeneration,
    schemaVersion: authority.schemaVersion,
  });
}

/**
 * Establishes one opaque owner generation inside encrypted private storage.
 * Only the opaque UUID crosses into the App Group; account identifiers and
 * processing/account generations never do.
 */
export function runWithRoutineWidgetOwnerAuthority<T>(
  expected: RoutineWidgetOwnerAuthorityInput,
  operation: (
    authority: RoutineWidgetOwnerAuthority,
    lease: HealthDataWriteOperationLease,
  ) => T | Promise<T>,
): Promise<T> {
  const expectedOwnerUserId = ownerUserId(expected.ownerUserId);
  if (expectedOwnerUserId === null || !safeNonNegativeInteger(expected.processingEpoch)) {
    return Promise.reject(new Error(ROUTINE_WIDGET_OWNER_AUTHORITY_INVALID));
  }

  return runHealthDataOperation(expectedOwnerUserId, async (lease) => {
    if (lease.epoch !== expected.processingEpoch) {
      fail(ROUTINE_WIDGET_OWNER_AUTHORITY_STALE);
    }
    lease.assertCurrent();
    let selected: RoutineWidgetOwnerAuthority | null = null;
    await updatePrivateItem(ROUTINE_WIDGET_OWNER_AUTHORITY_KEY, (current) => {
      lease.assertCurrent();
      const existing = current === null ? null : decodeCurrentAuthority(current);
      const reusable =
        existing !== null &&
        existing.ownerUserId === lease.ownerUserId &&
        existing.processingEpoch === lease.epoch &&
        existing.processingGeneration === lease.generation &&
        existing.accountGeneration === lease.accountGeneration;
      selected = reusable
        ? existing
        : Object.freeze({
            schemaVersion: SCHEMA_VERSION,
            ownerUserId: lease.ownerUserId,
            ownerGeneration: freshOwnerGeneration(existing?.ownerGeneration ?? null),
            processingEpoch: lease.epoch,
            processingGeneration: lease.generation,
            accountGeneration: lease.accountGeneration,
          });
      lease.assertCurrent();
      return encodeAuthority(selected);
    });
    lease.assertCurrent();
    if (selected === null) fail();
    const result = await operation(selected, lease);
    lease.assertCurrent();
    return result;
  });
}
