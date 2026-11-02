import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha256';

export const OPTIONAL_CHANGE41_INVALID = 'OPTIONAL_CHANGE41_INVALID';
export const OPTIONAL_CHANGE41_STALE = 'OPTIONAL_CHANGE41_STALE';
export const OPTIONAL_CHANGE41_OWNER_MISMATCH = 'OPTIONAL_CHANGE41_OWNER_MISMATCH';
export const OPTIONAL_CHANGE41_BOUND = 'OPTIONAL_CHANGE41_BOUND';
export const OPTIONAL_CHANGE41_READBACK_UNCONFIRMED = 'OPTIONAL_CHANGE41_READBACK_UNCONFIRMED';
export const OPTIONAL_CHANGE41_MAX_TEXT = 2000;
export const OPTIONAL_CHANGE41_MAX_EVENTS = 200;
export const OPTIONAL_CHANGE41_MAX_BYTES = 2 * 1024 * 1024;

export type OptionalChangeCategory41 =
  | 'skipped_step' | 'used_different' | 'noticed_reaction' | 'personal_note' | 'no_change';
export type OptionalChangeInput41 = Readonly<{
  id: string;
  expectedRevision: number;
  expectedSourceProof: string;
  /** Exact memory-only source comparison; a hash alone never admits a write. */
  expectedSourceBytes: string | null;
  observedOn: string;
  category: OptionalChangeCategory41;
  text: string;
  kind: 'note' | 'correction' | 'retraction';
  targetEventId: string | null;
  confirmation: true;
}>;
export type OptionalChangeEvent41 = Readonly<{
  id: string;
  ownerUserId: string;
  observedOn: string;
  recordedAt: string;
  actor: 'owner';
  basis: 'owner_reported';
  kind: OptionalChangeInput41['kind'];
  category: OptionalChangeCategory41;
  text: string;
  targetEventId: string | null;
  revision: number;
  expectedRevision: number;
  sourceProof: string;
  contentHash: string;
}>;

export function invalidOptionalChange41(code = OPTIONAL_CHANGE41_INVALID): never {
  throw new Error(code);
}
export function record41(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function exactKeys41(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
export function canonical41(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical41).join(',')}]`;
  if (record41(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical41(value[key])}`).join(',')}}`;
  const result = JSON.stringify(value);
  if (result === undefined) invalidOptionalChange41();
  return result;
}
export function hashOptionalChange41(value: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(canonical41(value))));
}
export function optionalChangeDate41(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function safeText41(value: unknown, max: number, empty = false): value is string {
  return typeof value === 'string' && value.length <= max &&
    (empty ? value === '' : value.trim().length > 0) &&
    !/[\p{Cf}\p{Cs}\u007f-\u009f\u2028\u2029\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value) &&
    utf8ToBytes(value).length <= max * 3;
}
export function optionalChangeId41(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
function validHash41(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}
function validateFact41(value: { observedOn: unknown; category: unknown; text: unknown; kind: unknown; targetEventId: unknown }): void {
  if (!optionalChangeDate41(value.observedOn) ||
      !['skipped_step', 'used_different', 'noticed_reaction', 'personal_note', 'no_change'].includes(value.category as string) ||
      !['note', 'correction', 'retraction'].includes(value.kind as string) ||
      !safeText41(value.text, OPTIONAL_CHANGE41_MAX_TEXT, value.category === 'no_change') ||
      (value.kind === 'note' ? value.targetEventId !== null : !optionalChangeId41(value.targetEventId)) ||
      (value.kind === 'retraction' && value.category !== 'personal_note')) invalidOptionalChange41();
}
export function validateOptionalChangeInput41(value: OptionalChangeInput41, today: string): void {
  if (!record41(value) || !exactKeys41(value, ['id', 'expectedRevision', 'expectedSourceProof', 'expectedSourceBytes', 'observedOn', 'category', 'text', 'kind', 'targetEventId', 'confirmation']) ||
      !optionalChangeId41(value.id) || value.confirmation !== true ||
      !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0 ||
      !validHash41(value.expectedSourceProof) ||
      (value.expectedSourceBytes !== null && (typeof value.expectedSourceBytes !== 'string' || utf8ToBytes(value.expectedSourceBytes).length > OPTIONAL_CHANGE41_MAX_BYTES)) ||
      !optionalChangeDate41(today) || value.observedOn > today) invalidOptionalChange41();
  validateFact41(value);
  if (hashOptionalChange41(value.expectedSourceBytes) !== value.expectedSourceProof) invalidOptionalChange41(OPTIONAL_CHANGE41_STALE);
}
export function createOptionalChangeEvent41(input: OptionalChangeInput41, ownerUserId: string, recordedAt: string): OptionalChangeEvent41 {
  const body = {
    id: input.id, ownerUserId, observedOn: input.observedOn, recordedAt,
    actor: 'owner' as const, basis: 'owner_reported' as const,
    kind: input.kind, category: input.category, text: input.text, targetEventId: input.targetEventId,
    revision: input.expectedRevision + 1, expectedRevision: input.expectedRevision, sourceProof: input.expectedSourceProof,
  };
  const event = Object.freeze({ ...body, contentHash: hashOptionalChange41(body) });
  validateOptionalChangeEvent41(event);
  return event;
}
export function validateOptionalChangeEvent41(value: OptionalChangeEvent41): void {
  if (!record41(value) || !exactKeys41(value, ['id', 'ownerUserId', 'observedOn', 'recordedAt', 'actor', 'basis', 'kind', 'category', 'text', 'targetEventId', 'revision', 'expectedRevision', 'sourceProof', 'contentHash']) ||
      !optionalChangeId41(value.id) || !safeText41(value.ownerUserId, 128) || value.ownerUserId !== value.ownerUserId.trim() ||
      value.actor !== 'owner' || value.basis !== 'owner_reported' ||
      !Number.isSafeInteger(value.revision) || value.revision < 1 || value.expectedRevision !== value.revision - 1 ||
      !validHash41(value.sourceProof) || !validHash41(value.contentHash) ||
      typeof value.recordedAt !== 'string' || !Number.isFinite(Date.parse(value.recordedAt)) ||
      new Date(value.recordedAt).toISOString() !== value.recordedAt) invalidOptionalChange41();
  validateFact41(value);
  const latestObserved = new Date(value.recordedAt);
  latestObserved.setUTCDate(latestObserved.getUTCDate() + 1);
  if (value.observedOn > latestObserved.toISOString().slice(0, 10)) invalidOptionalChange41();
  const { contentHash, ...body } = value;
  if (hashOptionalChange41(body) !== contentHash) invalidOptionalChange41();
}
/** Retry equality includes every factual field, independently of content hashes. */
export function sameOptionalChangeInput41(event: OptionalChangeEvent41, input: OptionalChangeInput41): boolean {
  return event.id === input.id && event.observedOn === input.observedOn && event.kind === input.kind &&
    event.category === input.category && event.text === input.text && event.targetEventId === input.targetEventId &&
    event.expectedRevision === input.expectedRevision && event.sourceProof === input.expectedSourceProof;
}
