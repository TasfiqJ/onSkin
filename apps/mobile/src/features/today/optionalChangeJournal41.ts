import { utf8ToBytes } from '@noble/ciphers/utils.js';

import {
  canonical41, createOptionalChangeEvent41, exactKeys41, hashOptionalChange41, invalidOptionalChange41,
  OPTIONAL_CHANGE41_BOUND, OPTIONAL_CHANGE41_MAX_BYTES, OPTIONAL_CHANGE41_MAX_EVENTS,
  OPTIONAL_CHANGE41_OWNER_MISMATCH, OPTIONAL_CHANGE41_STALE, record41,
  sameOptionalChangeInput41, validateOptionalChangeEvent41, validateOptionalChangeInput41,
  type OptionalChangeEvent41, type OptionalChangeInput41,
} from './optionalChange41';

export type OptionalChangeJournal41 = Readonly<{
  ownerUserId: string;
  revision: number;
  events: readonly OptionalChangeEvent41[];
}>;
export type OptionalChangeEnvelope41 = Readonly<{
  version: 4;
  /** Exact original completion representation, unchanged by note-only writes. */
  completionBytes: string | null;
  changes: OptionalChangeJournal41;
}>;
export type OptionalChangeSnapshot41 = Readonly<{
  revision: number;
  sourceProof: string;
  sourceBytes: string | null;
  events: readonly OptionalChangeEvent41[];
}>;

export function decodeOptionalChangeEnvelope41(value: unknown, ownerUserId: string): OptionalChangeEnvelope41 {
  if (!record41(value) || !exactKeys41(value, ['version', 'completionBytes', 'changes']) || value.version !== 4 ||
      (value.completionBytes !== null && (typeof value.completionBytes !== 'string' || utf8ToBytes(value.completionBytes).length > OPTIONAL_CHANGE41_MAX_BYTES)) ||
      !record41(value.changes) || !exactKeys41(value.changes, ['ownerUserId', 'revision', 'events']) ||
      !Array.isArray(value.changes.events) || value.changes.events.length < 1 || value.changes.events.length > OPTIONAL_CHANGE41_MAX_EVENTS ||
      value.changes.revision !== value.changes.events.length) invalidOptionalChange41();
  if (value.changes.ownerUserId !== ownerUserId) invalidOptionalChange41(OPTIONAL_CHANGE41_OWNER_MISMATCH);
  const events: OptionalChangeEvent41[] = [];
  const ids = new Map<string, OptionalChangeEvent41>();
  for (const candidate of value.changes.events) {
    const event = candidate as OptionalChangeEvent41;
    validateOptionalChangeEvent41(event);
    const target = event.targetEventId === null ? undefined : ids.get(event.targetEventId);
    if (event.ownerUserId !== ownerUserId) invalidOptionalChange41(OPTIONAL_CHANGE41_OWNER_MISMATCH);
    if (event.revision !== events.length + 1 || ids.has(event.id) ||
        (events.length > 0 && event.recordedAt < events[events.length - 1]!.recordedAt) ||
        (event.kind !== 'note' && (!target || target.observedOn !== event.observedOn))) invalidOptionalChange41();
    const frozen = Object.freeze({ ...event });
    ids.set(event.id, frozen); events.push(frozen);
  }
  return Object.freeze({ version: 4, completionBytes: value.completionBytes as string | null,
    changes: Object.freeze({ ownerUserId, revision: events.length, events: Object.freeze(events) }) });
}
export function encodeOptionalChangeEnvelope41(completionBytes: string | null, changes: OptionalChangeJournal41): string {
  const encoded = JSON.stringify({ version: 4, completionBytes, changes });
  if (utf8ToBytes(encoded).length > OPTIONAL_CHANGE41_MAX_BYTES) invalidOptionalChange41(OPTIONAL_CHANGE41_BOUND);
  decodeOptionalChangeEnvelope41(JSON.parse(encoded) as unknown, changes.ownerUserId);
  return encoded;
}
export function snapshotOptionalChange41(raw: string | null, envelope: OptionalChangeEnvelope41 | null): OptionalChangeSnapshot41 {
  return Object.freeze({ revision: envelope?.changes.revision ?? 0, sourceProof: hashOptionalChange41(raw),
    sourceBytes: raw, events: envelope?.changes.events ?? Object.freeze([]) });
}
/** One synchronous transform. The store validates the inner completion source first. */
export function appendOptionalChangeEnvelope41(
  raw: string | null, envelope: OptionalChangeEnvelope41 | null, input: OptionalChangeInput41,
  ownerUserId: string, recordedAt: string, today: string,
): string {
  validateOptionalChangeInput41(input, today);
  const journal = envelope?.changes;
  const existing = journal?.events.find((event) => event.id === input.id);
  if (existing) {
    if (!sameOptionalChangeInput41(existing, input)) invalidOptionalChange41();
    // A retry proves its exact predecessor, including source bytes, rather than
    // accepting a coincidentally equal hash or an event in a later history.
    const preceding = journal!.events.length === 1 ? envelope!.completionBytes :
      encodeOptionalChangeEnvelope41(envelope!.completionBytes, {
        ownerUserId, revision: journal!.revision - 1, events: journal!.events.slice(0, -1),
      });
    if (existing.revision !== journal!.revision || preceding !== input.expectedSourceBytes) invalidOptionalChange41(OPTIONAL_CHANGE41_STALE);
    return raw!;
  }
  if (raw !== input.expectedSourceBytes || hashOptionalChange41(raw) !== input.expectedSourceProof ||
      (journal?.revision ?? 0) !== input.expectedRevision) invalidOptionalChange41(OPTIONAL_CHANGE41_STALE);
  if ((journal?.events.length ?? 0) >= OPTIONAL_CHANGE41_MAX_EVENTS) invalidOptionalChange41(OPTIONAL_CHANGE41_BOUND);
  if (input.targetEventId !== null) {
    const target = journal?.events.find((event) => event.id === input.targetEventId);
    if (!target || target.observedOn !== input.observedOn) invalidOptionalChange41(OPTIONAL_CHANGE41_STALE);
  }
  const event = createOptionalChangeEvent41(input, ownerUserId, recordedAt);
  return encodeOptionalChangeEnvelope41(envelope ? envelope.completionBytes : raw, {
    ownerUserId, revision: event.revision, events: [...(journal?.events ?? []), event],
  });
}
export function equalOptionalChangeEvents41(left: readonly OptionalChangeEvent41[], right: readonly OptionalChangeEvent41[]): boolean {
  return canonical41(left) === canonical41(right);
}
