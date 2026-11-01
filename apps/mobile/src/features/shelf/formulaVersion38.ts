import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha256';

import { validLocalDate } from './freshness';

export const FORMULA38_INVALID = 'FORMULA38_INVALID';
export const FORMULA38_STALE = 'FORMULA38_STALE';
export const FORMULA38_MISSING = 'FORMULA38_MISSING';
export const FORMULA38_OWNER_MISMATCH = 'FORMULA38_OWNER_MISMATCH';
export const FORMULA38_READBACK_UNCONFIRMED = 'FORMULA38_READBACK_UNCONFIRMED';
export const FORMULA38_LABEL_MAX_LENGTH = 8000;
export const FORMULA38_MARKET_MAX_LENGTH = 80;
export const FORMULA38_VARIANT_MAX_LENGTH = 160;

export type FormulaObservation38 = Readonly<{
  confirmation: 'confirm_label' | 'retain_unknown';
  labelText: string | null;
  market: string | null;
  variant: string | null;
  observedOn: string | null;
}>;

export type FormulaVersion38 = Readonly<{
  schemaVersion: 1;
  ownerUserId: string;
  ownedUnitId: string;
  previousFormulaVersionId: string | null;
  actor: 'owner';
  basis: 'label_in_hand' | 'unavailable';
  sourceRights: 'owner_private_observation';
  labelStatus: 'user_confirmed_label' | 'unknown';
  labelText: string | null;
  market: string | null;
  variant: string | null;
  observedOn: string | null;
  recordedAt: string;
  id: string;
  contentHash: string;
}>;

export function invalidFormula38(): never {
  throw new Error(FORMULA38_INVALID);
}

function canonical38(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical38).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical38((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) invalidFormula38();
  return encoded;
}

/** SHA-256 of deterministic UTF-8 canonical JSON; this is identity, not a clinical claim. */
export function contentHash38(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(canonical38(value))));
}

export function safeText38(value: unknown, maxLength: number, multiline = false): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength || value.trim().length === 0) return false;
  if (!multiline && value !== value.trim()) return false;
  if (/[\p{Cf}\p{Cs}\u007f-\u009f\u2028\u2029]/u.test(value)) return false;
  if ((multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u : /[\u0000-\u001f]/u).test(value)) return false;
  return utf8ToBytes(value).length <= maxLength * 3;
}

export function validTimestamp38(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

export function validateObservation38(value: FormulaObservation38, today?: string): void {
  if (!value || (value.confirmation !== 'confirm_label' && value.confirmation !== 'retain_unknown')) invalidFormula38();
  if (value.confirmation === 'confirm_label') {
    if (!safeText38(value.labelText, FORMULA38_LABEL_MAX_LENGTH, true) || validLocalDate(value.observedOn) === null) invalidFormula38();
  } else if (value.labelText !== null) invalidFormula38();
  if ((value.market !== null && !safeText38(value.market, FORMULA38_MARKET_MAX_LENGTH)) ||
      (value.variant !== null && !safeText38(value.variant, FORMULA38_VARIANT_MAX_LENGTH)) ||
      (value.observedOn !== null && validLocalDate(value.observedOn) === null) ||
      (today !== undefined && value.observedOn !== null && value.observedOn > today)) invalidFormula38();
}

export function createFormulaVersion38(
  observation: FormulaObservation38,
  ownerUserId: string,
  ownedUnitId: string,
  previousFormulaVersionId: string | null,
  recordedAt: string,
): FormulaVersion38 {
  validateObservation38(observation);
  if (!safeText38(ownerUserId, 128) || !safeText38(ownedUnitId, 128) || !validTimestamp38(recordedAt) ||
      (previousFormulaVersionId !== null && !/^formula38:[0-9a-f]{64}$/.test(previousFormulaVersionId))) invalidFormula38();
  const latestLocalDay = new Date(recordedAt);
  latestLocalDay.setUTCDate(latestLocalDay.getUTCDate() + 1);
  validateObservation38(observation, latestLocalDay.toISOString().slice(0, 10));
  const body = {
    schemaVersion: 1 as const, ownerUserId, ownedUnitId, previousFormulaVersionId,
    actor: 'owner' as const,
    basis: observation.confirmation === 'confirm_label' ? 'label_in_hand' as const : 'unavailable' as const,
    sourceRights: 'owner_private_observation' as const,
    labelStatus: observation.confirmation === 'confirm_label' ? 'user_confirmed_label' as const : 'unknown' as const,
    labelText: observation.labelText, market: observation.market, variant: observation.variant,
    observedOn: observation.observedOn, recordedAt,
  };
  const contentHash = contentHash38(body);
  return Object.freeze({ ...body, id: `formula38:${contentHash}`, contentHash });
}

export function observationForFormula38(value: FormulaVersion38): FormulaObservation38 {
  return {
    confirmation: value.labelStatus === 'user_confirmed_label' ? 'confirm_label' : 'retain_unknown',
    labelText: value.labelText, market: value.market, variant: value.variant, observedOn: value.observedOn,
  };
}

export function validateFormulaVersion38(value: FormulaVersion38): void {
  if (!value || JSON.stringify(value) !== JSON.stringify(createFormulaVersion38(
    observationForFormula38(value), value.ownerUserId, value.ownedUnitId,
    value.previousFormulaVersionId, value.recordedAt,
  ))) invalidFormula38();
}
