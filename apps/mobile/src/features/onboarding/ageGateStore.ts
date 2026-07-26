import { getPrivateItem, setPrivateItem } from '@/lib/storage/privateKV';

import { AGE_POLICY_RECEIPT_KEY, AGE_POLICY_SHA256 } from './ageGate';

export const AGE_POLICY_RECEIPT_VERSION = 1 as const;
export const CURRENT_AGE_POLICY_RECEIPT = Object.freeze({
  receipt_version: AGE_POLICY_RECEIPT_VERSION,
  policy_sha256: AGE_POLICY_SHA256,
  eligible: true,
} as const);
export const CURRENT_AGE_POLICY_RECEIPT_BYTES = JSON.stringify(CURRENT_AGE_POLICY_RECEIPT);
export const AGE_POLICY_REVERIFICATION_TOMBSTONE = Object.freeze({
  receipt_version: AGE_POLICY_RECEIPT_VERSION,
  verification_required: true,
} as const);
export const AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES = JSON.stringify(
  AGE_POLICY_REVERIFICATION_TOMBSTONE,
);
export const AGE_POLICY_STATUS_QUERY_KEY = ['agePolicyReceiptStatus', AGE_POLICY_SHA256] as const;

export type AgePolicyReceiptStatus =
  | 'current'
  | 'reverification_required'
  | 'missing'
  | 'legacy'
  | 'invalid'
  | 'unsupported'
  | 'policy_mismatch'
  | 'unavailable';

const RECEIPT_KEYS = ['eligible', 'policy_sha256', 'receipt_version'] as const;
const TOMBSTONE_KEYS = ['receipt_version', 'verification_required'] as const;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function classifyAgePolicyReceipt(raw: string | null): AgePolicyReceiptStatus {
  if (raw === null) return 'missing';

  const normalized = raw.trim();
  if (/^(?:true|false)$/i.test(normalized) || /^v1:[01]$/i.test(normalized)) return 'legacy';

  const legacyVersionMatch = /^v(\d+):[01]$/i.exec(normalized);
  if (legacyVersionMatch) {
    return Number(legacyVersionMatch[1]) > AGE_POLICY_RECEIPT_VERSION ? 'unsupported' : 'legacy';
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return 'invalid';
  }

  if (!isRecord(parsed)) return 'invalid';
  if (
    hasExactKeys(parsed, TOMBSTONE_KEYS) &&
    parsed.receipt_version === AGE_POLICY_RECEIPT_VERSION &&
    parsed.verification_required === true
  ) {
    return 'reverification_required';
  }
  if (!hasExactKeys(parsed, RECEIPT_KEYS)) return 'invalid';
  if (
    typeof parsed.receipt_version !== 'number' ||
    !Number.isSafeInteger(parsed.receipt_version) ||
    parsed.receipt_version < 1
  ) {
    return 'invalid';
  }
  if (parsed.receipt_version !== AGE_POLICY_RECEIPT_VERSION) return 'unsupported';
  if (parsed.eligible !== true) return 'invalid';
  if (typeof parsed.policy_sha256 !== 'string' || !SHA256_HEX.test(parsed.policy_sha256)) {
    return 'invalid';
  }
  if (parsed.policy_sha256 !== AGE_POLICY_SHA256) return 'policy_mismatch';
  return 'current';
}

export async function getAgePolicyReceiptStatus(): Promise<AgePolicyReceiptStatus> {
  try {
    return classifyAgePolicyReceipt(await getPrivateItem(AGE_POLICY_RECEIPT_KEY));
  } catch {
    return 'unavailable';
  }
}

export async function getAgeVerified(): Promise<boolean> {
  return (await getAgePolicyReceiptStatus()) === 'current';
}

/**
 * The route calls this only after a fresh neutral-DOB evaluation. An ineligible
 * result atomically replaces any older affirmative receipt with a minimized
 * re-verification tombstone. The tombstone stores no DOB, birth year, age,
 * threshold result, or reason, and the affirmative parser can never accept it.
 */
export async function setAgeVerified(eligible: boolean): Promise<void> {
  if (!eligible) {
    await setPrivateItem(AGE_POLICY_RECEIPT_KEY, AGE_POLICY_REVERIFICATION_TOMBSTONE_BYTES);
    return;
  }
  await setPrivateItem(AGE_POLICY_RECEIPT_KEY, CURRENT_AGE_POLICY_RECEIPT_BYTES);
}
