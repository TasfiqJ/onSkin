import { describe, expect, it } from 'vitest';

import type { AskAnswer } from './answer';
import { blockUnreservedGroundedAnswer } from './groundedDelivery';

const UNRESERVED_GROUNDED: AskAnswer = {
  intent: 'concern_q',
  kind: 'grounded',
  badge: 'grounded answer',
  headline: null,
  claim: 'This must never be delivered before quota is reserved.',
  why: null,
  how: null,
  citation: null,
  severity: null,
  severityText: null,
  note: null,
  recommendationNote: false,
  claimSafeNote: false,
  cta: null,
  footnote: null,
};

describe('grounded answer delivery boundary', () => {
  it('replaces an unreserved grounded result with the standard refusal', () => {
    const result = blockUnreservedGroundedAnswer(UNRESERVED_GROUNDED);

    expect(result.kind).toBe('refuse');
    expect(result.intent).toBe('concern_q');
    expect(result.claim).not.toContain('must never be delivered');
  });

  it('preserves an already-local deterministic result by identity', () => {
    const deterministic = { ...UNRESERVED_GROUNDED, kind: 'deterministic' as const };

    expect(blockUnreservedGroundedAnswer(deterministic)).toBe(deterministic);
  });
});
