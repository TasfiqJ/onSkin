import * as Crypto from 'expo-crypto';

import { PHOTO_CAPTURE_CONSENT } from '@/features/onboarding/consentCopy';
import {
  awaitAccountGenerationLease,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { recordConsent } from '@/lib/consent/consent';
import {
  readPrivateBoolean,
  type PrivateBooleanCorruptReason,
  type PrivateBooleanReadResult,
} from '@/lib/storage/privateBoolean';
import {
  readPrivateItem,
  type PrivateKVReadFailureReason,
  type PrivateKVReadResult,
  updatePrivateItem,
} from '@/lib/storage/privateKV';

/**
 * Photo consents (docs/01 §4, docs/06 §7). Unbundled and local-first. Capture
 * consent is requested at FIRST camera use. Capture stores a local proof first
 * so the camera gate works offline / pre-account; the ledger sync is best-effort.
 * Cloud backup is unavailable until encrypted upload, restore, and deletion are
 * implemented end to end, so no runtime setter exists in this build.
 */
const CAPTURE_KEY = 'onskin.photos.captureConsent';
const CAPTURE_RECORD_KEY = 'onskin.photos.captureConsent.v1';
const CAPTURE_SCHEMA_VERSION = 1 as const;

export const PHOTO_CAPTURE_CONSENT_INVALID = 'PHOTO_CAPTURE_CONSENT_INVALID';
export const PHOTO_CAPTURE_CONSENT_UNAVAILABLE = 'PHOTO_CAPTURE_CONSENT_UNAVAILABLE';
export const PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION =
  'PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION';
export const PHOTO_CAPTURE_CONSENT_WRITE_UNCERTAIN = 'PHOTO_CAPTURE_CONSENT_WRITE_UNCERTAIN';

export const PHOTO_CLOUD_BACKUP_AVAILABLE = false as const;

export type LocalPhotoCaptureConsent = {
  type: 'photo_capture';
  granted: true;
  version: string;
  consentTextHash: string;
  recordedAt: string;
};

type PhotoCaptureConsentEnvelope = {
  schemaVersion: typeof CAPTURE_SCHEMA_VERSION;
  consent: LocalPhotoCaptureConsent;
};

type PhotoCaptureConsentRecordFormat = 'current' | 'legacy';
type PhotoCaptureConsentSource = 'primary' | 'legacy' | 'copy_hash';
type PrivateKVCorruptReason = Extract<PrivateKVReadResult, { status: 'corrupt' }>['reason'];

export type PhotoCaptureConsentReadResult =
  | { status: 'absent'; consent: null }
  | {
      status: 'available';
      state: 'current';
      source: 'primary';
      format: PhotoCaptureConsentRecordFormat;
      consent: LocalPhotoCaptureConsent;
    }
  | {
      status: 'available';
      state: 'reconsent_required';
      source: 'primary';
      format: PhotoCaptureConsentRecordFormat;
      reason: 'stale_version' | 'hash_mismatch';
      consent: LocalPhotoCaptureConsent;
    }
  | {
      status: 'available';
      state: 'reconsent_required';
      source: 'legacy';
      format: 'current' | 'legacy';
      reason: 'legacy_unverifiable';
      consent: null;
    }
  | {
      status: 'available';
      state: 'not_granted';
      source: 'legacy';
      format: 'current' | 'legacy';
      consent: null;
    }
  | {
      status: 'unavailable';
      source: PhotoCaptureConsentSource;
      reason: PrivateKVReadFailureReason | 'digest_unavailable';
      consent: null;
    }
  | {
      status: 'corrupt';
      source: 'primary';
      reason: PrivateKVCorruptReason | 'invalid_record';
      consent: null;
    }
  | {
      status: 'corrupt';
      source: 'legacy';
      reason: PrivateBooleanCorruptReason;
      consent: null;
    }
  | {
      status: 'unsupported_version';
      source: 'primary' | 'legacy';
      consent: null;
    };

export type PhotoCaptureConsentCurrentResult = Extract<
  PhotoCaptureConsentReadResult,
  { status: 'available'; state: 'current' }
>;

type DecodedPhotoCaptureConsent = {
  consent: LocalPhotoCaptureConsent;
  format: PhotoCaptureConsentRecordFormat;
};

export class PhotoCaptureConsentWriteUncertainError extends Error {
  constructor() {
    super(PHOTO_CAPTURE_CONSENT_WRITE_UNCERTAIN);
    this.name = 'PhotoCaptureConsentWriteUncertainError';
  }
}

/** The authoritative proof changed after the route rendered its prior choice state. */
export class PhotoCaptureConsentStateChangedError extends Error {
  readonly result: PhotoCaptureConsentReadResult;

  constructor(result: PhotoCaptureConsentReadResult, message: string) {
    super(message);
    this.name = 'PhotoCaptureConsentStateChangedError';
    this.result = result;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return null;
  return value;
}

function canonicalIsoString(value: unknown): string | null {
  const text = nonEmptyString(value);
  if (!text) return null;
  try {
    return new Date(text).toISOString() === text ? text : null;
  } catch {
    return null;
  }
}

function canonicalSha256(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null;
}

function normalizePhotoCaptureConsent(value: unknown): LocalPhotoCaptureConsent | null {
  if (!isRecord(value)) return null;
  const version = nonEmptyString(value.version);
  const consentTextHash = canonicalSha256(value.consentTextHash);
  const recordedAt = canonicalIsoString(value.recordedAt);
  if (
    value.type !== 'photo_capture' ||
    value.granted !== true ||
    !version ||
    !consentTextHash ||
    !recordedAt
  ) {
    return null;
  }
  return {
    type: 'photo_capture',
    granted: true,
    version,
    consentTextHash,
    recordedAt,
  };
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => hasOwn(value, key));
}

const CONSENT_RECORD_KEYS = [
  'type',
  'granted',
  'version',
  'consentTextHash',
  'recordedAt',
] as const;

function decodeConsentRecord(value: Record<string, unknown>): LocalPhotoCaptureConsent {
  const normalized = normalizePhotoCaptureConsent(value);
  if (
    !normalized ||
    !hasExactKeys(value, CONSENT_RECORD_KEYS) ||
    JSON.stringify(normalized) !== JSON.stringify(value)
  ) {
    throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
  }
  return normalized;
}

function decodePhotoCaptureConsent(raw: string): DecodedPhotoCaptureConsent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);

  if (hasOwn(parsed, 'schemaVersion')) {
    if (parsed.schemaVersion !== CAPTURE_SCHEMA_VERSION) {
      if (
        typeof parsed.schemaVersion === 'number' &&
        Number.isSafeInteger(parsed.schemaVersion) &&
        parsed.schemaVersion > CAPTURE_SCHEMA_VERSION
      ) {
        throw new Error(PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION);
      }
      throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
    }
    if (!hasExactKeys(parsed, ['schemaVersion', 'consent']) || !isRecord(parsed.consent)) {
      throw new Error(PHOTO_CAPTURE_CONSENT_INVALID);
    }
    return { consent: decodeConsentRecord(parsed.consent), format: 'current' };
  }

  return { consent: decodeConsentRecord(parsed), format: 'legacy' };
}

function encodePhotoCaptureConsent(consent: LocalPhotoCaptureConsent): string {
  return JSON.stringify({
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    consent,
  } satisfies PhotoCaptureConsentEnvelope);
}

let e2ePhotoConsentReadFailureCount = 0;
let e2ePhotoConsentWriteUncertainCount = 0;

function devPhotoConsentReadFailureFixture(): 'always' | 'once' | 'hang' | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_READ_FAILURE?.trim().toLowerCase();
  return fixture === 'always' || fixture === 'once' || fixture === 'hang' ? fixture : null;
}

function devPhotoConsentStateFixture(): PhotoCaptureConsentReadResult | null {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const fixture = process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_STATE?.trim().toLowerCase();
  const consent = {
    type: 'photo_capture',
    granted: true,
    version: PHOTO_CAPTURE_CONSENT.version,
    consentTextHash: 'b'.repeat(64),
    recordedAt: '2026-07-14T00:00:00.000Z',
  } as const satisfies LocalPhotoCaptureConsent;

  switch (fixture) {
    case 'stale_version':
      return {
        status: 'available',
        state: 'reconsent_required',
        source: 'primary',
        format: 'current',
        reason: 'stale_version',
        consent: { ...consent, version: 'e2e-stale-photo-consent-v1' },
      };
    case 'wrong_hash':
      return {
        status: 'available',
        state: 'reconsent_required',
        source: 'primary',
        format: 'current',
        reason: 'hash_mismatch',
        consent,
      };
    case 'legacy_true':
      return {
        status: 'available',
        state: 'reconsent_required',
        source: 'legacy',
        format: 'legacy',
        reason: 'legacy_unverifiable',
        consent: null,
      };
    case 'malformed':
      return { status: 'corrupt', source: 'primary', reason: 'invalid_record', consent: null };
    case 'future':
      return { status: 'unsupported_version', source: 'primary', consent: null };
    default:
      return null;
  }
}

function consumeE2EPhotoConsentReadFailure(): boolean {
  const fixture = devPhotoConsentReadFailureFixture();
  if (fixture === 'always') return true;
  if (fixture !== 'once' || e2ePhotoConsentReadFailureCount > 0) return false;
  e2ePhotoConsentReadFailureCount += 1;
  return true;
}

function consumeE2EPhotoConsentWriteUncertain(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  const fixture = process.env.EXPO_PUBLIC_E2E_PHOTO_CONSENT_FAILURE?.trim().toLowerCase();
  if (fixture !== 'uncertain_once' || e2ePhotoConsentWriteUncertainCount > 0) return false;
  e2ePhotoConsentWriteUncertainCount += 1;
  return true;
}

async function currentPhotoCaptureConsentHash(lease: AccountGenerationLease): Promise<string> {
  let hash: string;
  try {
    hash = await awaitAccountGenerationLease(lease, () =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, PHOTO_CAPTURE_CONSENT.fullText),
    );
  } catch {
    lease.assertCurrent();
    throw new Error(PHOTO_CAPTURE_CONSENT_UNAVAILABLE);
  }
  lease.assertCurrent();
  if (!canonicalSha256(hash)) throw new Error(PHOTO_CAPTURE_CONSENT_UNAVAILABLE);
  return hash;
}

function primaryReadFailure(
  stored: Exclude<PrivateKVReadResult, { status: 'absent' } | { status: 'available' }>,
): PhotoCaptureConsentReadResult {
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', source: 'primary', reason: stored.reason, consent: null };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', source: 'primary', reason: stored.reason, consent: null };
  }
  return { status: 'unsupported_version', source: 'primary', consent: null };
}

function legacyReadFailure(
  stored: Exclude<PrivateBooleanReadResult, { status: 'absent' } | { status: 'available' }>,
): PhotoCaptureConsentReadResult {
  if (stored.status === 'unavailable') {
    return { status: 'unavailable', source: 'legacy', reason: stored.reason, consent: null };
  }
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', source: 'legacy', reason: stored.reason, consent: null };
  }
  return { status: 'unsupported_version', source: 'legacy', consent: null };
}

async function readPhotoCaptureConsentWithLease(
  lease: AccountGenerationLease,
  useE2EFixture = true,
): Promise<PhotoCaptureConsentReadResult> {
  if (useE2EFixture) {
    const stateFixture = devPhotoConsentStateFixture();
    if (stateFixture) return stateFixture;
    if (devPhotoConsentReadFailureFixture() === 'hang') {
      await awaitAccountGenerationLease(lease, () => new Promise<never>(() => undefined));
      lease.assertCurrent();
    }
  }
  if (useE2EFixture && consumeE2EPhotoConsentReadFailure()) {
    return {
      status: 'unavailable',
      source: 'primary',
      reason: 'storage_unavailable',
      consent: null,
    };
  }

  let primary: PrivateKVReadResult;
  try {
    primary = await awaitAccountGenerationLease(lease, () => readPrivateItem(CAPTURE_RECORD_KEY));
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
    return {
      status: 'unavailable',
      source: 'primary',
      reason: 'storage_unavailable',
      consent: null,
    };
  }

  if (primary.status !== 'absent' && primary.status !== 'available') {
    return primaryReadFailure(primary);
  }

  if (primary.status === 'available') {
    let decoded: DecodedPhotoCaptureConsent;
    try {
      decoded = decodePhotoCaptureConsent(primary.value);
    } catch (error) {
      return error instanceof Error && error.message === PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION
        ? { status: 'unsupported_version', source: 'primary', consent: null }
        : { status: 'corrupt', source: 'primary', reason: 'invalid_record', consent: null };
    }

    if (decoded.consent.version !== PHOTO_CAPTURE_CONSENT.version) {
      return {
        status: 'available',
        state: 'reconsent_required',
        source: 'primary',
        format: decoded.format,
        reason: 'stale_version',
        consent: decoded.consent,
      };
    }

    let currentHash: string;
    try {
      currentHash = await currentPhotoCaptureConsentHash(lease);
      lease.assertCurrent();
    } catch {
      lease.assertCurrent();
      return {
        status: 'unavailable',
        source: 'copy_hash',
        reason: 'digest_unavailable',
        consent: null,
      };
    }

    return decoded.consent.consentTextHash === currentHash
      ? {
          status: 'available',
          state: 'current',
          source: 'primary',
          format: decoded.format,
          consent: decoded.consent,
        }
      : {
          status: 'available',
          state: 'reconsent_required',
          source: 'primary',
          format: decoded.format,
          reason: 'hash_mismatch',
          consent: decoded.consent,
        };
  }

  let legacy: PrivateBooleanReadResult;
  try {
    legacy = await awaitAccountGenerationLease(lease, () => readPrivateBoolean(CAPTURE_KEY));
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
    return {
      status: 'unavailable',
      source: 'legacy',
      reason: 'storage_unavailable',
      consent: null,
    };
  }

  if (legacy.status === 'absent') return { status: 'absent', consent: null };
  if (legacy.status !== 'available') return legacyReadFailure(legacy);
  return legacy.value
    ? {
        status: 'available',
        state: 'reconsent_required',
        source: 'legacy',
        format: legacy.format,
        reason: 'legacy_unverifiable',
        consent: null,
      }
    : {
        status: 'available',
        state: 'not_granted',
        source: 'legacy',
        format: legacy.format,
        consent: null,
      };
}

/** Read both proof generations without repairing, deleting, or migrating bytes. */
export function readPhotoCaptureConsent(): Promise<PhotoCaptureConsentReadResult> {
  return runAccountGenerationOperation((lease) => readPhotoCaptureConsentWithLease(lease));
}

export function isCurrentPhotoCaptureConsent(
  result: PhotoCaptureConsentReadResult,
): result is PhotoCaptureConsentCurrentResult {
  return result.status === 'available' && result.state === 'current';
}

export function photoCaptureConsentNeedsChoice(result: PhotoCaptureConsentReadResult): boolean {
  return (
    result.status === 'absent' || (result.status === 'available' && result.state !== 'current')
  );
}

function photoConsentReadError(result: PhotoCaptureConsentReadResult): Error {
  let message: string;
  if (result.status === 'unsupported_version') {
    message = PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION;
  } else if (result.status === 'corrupt') {
    message = PHOTO_CAPTURE_CONSENT_INVALID;
  } else {
    message = PHOTO_CAPTURE_CONSENT_UNAVAILABLE;
  }
  return new PhotoCaptureConsentStateChangedError(result, message);
}

let grantTail: Promise<void> | null = null;

async function runSerializedGrant<T>(operation: () => Promise<T>): Promise<T> {
  const ready = grantTail?.catch(() => undefined) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = ready.then(() => gate);
  grantTail = tail;

  await ready;
  try {
    return await operation();
  } finally {
    release();
    if (grantTail === tail) grantTail = null;
  }
}

async function readExactPrimaryWithLease(
  lease: AccountGenerationLease,
): Promise<
  | { status: 'available'; decoded: DecodedPhotoCaptureConsent }
  | { status: 'absent' }
  | { status: 'unreadable' }
  | Extract<PhotoCaptureConsentReadResult, { status: 'corrupt' | 'unsupported_version' }>
> {
  let stored: PrivateKVReadResult;
  try {
    stored = await awaitAccountGenerationLease(lease, () => readPrivateItem(CAPTURE_RECORD_KEY));
    lease.assertCurrent();
  } catch {
    lease.assertCurrent();
    return { status: 'unreadable' };
  }
  if (stored.status === 'absent') return { status: 'absent' };
  if (stored.status === 'unavailable') return { status: 'unreadable' };
  if (stored.status === 'corrupt') {
    return { status: 'corrupt', source: 'primary', reason: stored.reason, consent: null };
  }
  if (stored.status === 'unsupported_version') {
    return { status: 'unsupported_version', source: 'primary', consent: null };
  }
  try {
    return { status: 'available', decoded: decodePhotoCaptureConsent(stored.value) };
  } catch (error) {
    return error instanceof Error && error.message === PHOTO_CAPTURE_CONSENT_UNSUPPORTED_VERSION
      ? { status: 'unsupported_version', source: 'primary', consent: null }
      : { status: 'corrupt', source: 'primary', reason: 'invalid_record', consent: null };
  }
}

function changedReadbackResult(
  readback: Awaited<ReturnType<typeof readExactPrimaryWithLease>>,
  desired: LocalPhotoCaptureConsent,
): PhotoCaptureConsentReadResult | null {
  if (readback.status === 'corrupt' || readback.status === 'unsupported_version') return readback;
  if (readback.status !== 'available') return null;
  const { consent, format } = readback.decoded;
  if (consent.version !== PHOTO_CAPTURE_CONSENT.version) {
    return {
      status: 'available',
      state: 'reconsent_required',
      source: 'primary',
      format,
      reason: 'stale_version',
      consent,
    };
  }
  if (consent.consentTextHash !== desired.consentTextHash) {
    return {
      status: 'available',
      state: 'reconsent_required',
      source: 'primary',
      format,
      reason: 'hash_mismatch',
      consent,
    };
  }
  return null;
}

async function setPhotoCaptureConsentLocal(
  lease: AccountGenerationLease,
): Promise<LocalPhotoCaptureConsent> {
  const consentTextHash = await currentPhotoCaptureConsentHash(lease);
  lease.assertCurrent();
  const consent: LocalPhotoCaptureConsent = {
    type: 'photo_capture',
    granted: true,
    version: PHOTO_CAPTURE_CONSENT.version,
    consentTextHash,
    recordedAt: new Date().toISOString(),
  };
  const simulateWriteUncertain = consumeE2EPhotoConsentWriteUncertain();

  try {
    await awaitAccountGenerationLease(lease, () =>
      updatePrivateItem(CAPTURE_RECORD_KEY, (current) => {
        if (current !== null) decodePhotoCaptureConsent(current);
        return encodePhotoCaptureConsent(consent);
      }),
    );
    lease.assertCurrent();
    if (simulateWriteUncertain) throw new Error('E2E_PHOTO_CONSENT_WRITE_RESPONSE_LOST');
    return consent;
  } catch (writeError) {
    lease.assertCurrent();
    const readback = simulateWriteUncertain
      ? { status: 'unreadable' as const }
      : await readExactPrimaryWithLease(lease);
    lease.assertCurrent();
    if (
      readback.status === 'available' &&
      JSON.stringify(readback.decoded.consent) === JSON.stringify(consent)
    ) {
      return consent;
    }
    if (readback.status === 'unreadable') throw new PhotoCaptureConsentWriteUncertainError();
    const changed = changedReadbackResult(readback, consent);
    if (changed) throw photoConsentReadError(changed);
    throw writeError;
  }
}

/** Compatibility hard gate. Typed consumers should use readPhotoCaptureConsent. */
export async function hasPhotoCaptureConsent(): Promise<boolean> {
  return isCurrentPhotoCaptureConsent(await readPhotoCaptureConsent());
}

export function grantPhotoCaptureConsent(): Promise<PhotoCaptureConsentCurrentResult> {
  return runAccountGenerationOperation((lease) =>
    runSerializedGrant(async () => {
      lease.assertCurrent();
      const existing = await readPhotoCaptureConsentWithLease(lease, false);
      lease.assertCurrent();
      if (isCurrentPhotoCaptureConsent(existing)) return existing;
      if (!photoCaptureConsentNeedsChoice(existing)) throw photoConsentReadError(existing);

      const consent = await setPhotoCaptureConsentLocal(lease);
      lease.assertCurrent();
      try {
        await awaitAccountGenerationLease(lease, () =>
          recordConsent({
            type: 'photo_capture',
            granted: true,
            version: PHOTO_CAPTURE_CONSENT.version,
            consentText: PHOTO_CAPTURE_CONSENT.fullText,
          }),
        );
        lease.assertCurrent();
      } catch {
        lease.assertCurrent();
        /* offline / no anonymous session. Keep the local-only proof; production ledger QA is a launch gate. */
      }
      return {
        status: 'available',
        state: 'current',
        source: 'primary',
        format: 'current',
        consent,
      };
    }),
  );
}
