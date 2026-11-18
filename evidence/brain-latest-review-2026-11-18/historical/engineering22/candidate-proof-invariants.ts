import { expect, it } from 'vitest';
import { createOptionalChangeEvent41, hashOptionalChange41, sameOptionalChangeInput41, type OptionalChangeInput41 } from './optionalChange41';
import { optionalChangeDraftEventMatches, type OptionalChangeDraftFields } from './optionalChangeDraftCodec';

// Pure in-memory predicate invariants: no store, serialization or history append.
it.each(['note', 'correction', 'retraction'] as const)('requires equal predecessor proof for an otherwise matching %s', kind => {
  const input: OptionalChangeInput41 = {
    id: '11111111-1111-4111-8111-111111111111', expectedRevision: 1,
    expectedSourceBytes: null, expectedSourceProof: hashOptionalChange41(null),
    observedOn: '2026-11-17', category: 'personal_note', text: 'Synthetic factual text',
    kind, targetEventId: kind === 'note' ? null : '22222222-2222-4222-8222-222222222222', confirmation: true,
  };
  const event = createOptionalChangeEvent41(input, 'synthetic-proof-owner', '2026-11-17T12:00:00.000Z');
  const fields: OptionalChangeDraftFields = {
    eventId: input.id, kind, targetEventId: input.targetEventId,
    targetContentHash: kind === 'note' ? null : hashOptionalChange41('synthetic target'),
    observedOn: input.observedOn, category: input.category, text: input.text,
    sourceRevision: input.expectedRevision, sourceProof: input.expectedSourceProof, attempted: true,
  };
  expect(optionalChangeDraftEventMatches(fields, event)).toBe(true);
  expect(sameOptionalChangeInput41(event, input)).toBe(true);
  const differentProof = hashOptionalChange41('different in-memory predecessor');
  expect(optionalChangeDraftEventMatches({ ...fields, sourceProof: differentProof }, event)).toBe(false);
  expect(sameOptionalChangeInput41(event, { ...input, expectedSourceProof: differentProof })).toBe(false);
});
