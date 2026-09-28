import { describe, expect, it } from 'vitest';

import {
  evaluateConflicts,
  previewDetectConflicts,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { STARTER_RULES } from '@/features/intelligence/rules';

import {
  answerPrompt,
  answerQuestion,
  pickFitRec,
  resolveRequestedShelfPair,
  type AskContext,
} from './answer';
import { ASK_COPY } from './copy';

// The pure, template-bounded answer engine (docs/13 §4, D-057). Substantive claims are
// filled from the deterministic engine + claim-safe copy. Never free-generated.

const PRODUCTS: EngineProduct[] = [
  { id: 'a', name: 'Retinol 0.3%', tags: ['retinoid'] },
  { id: 'b', name: 'Glycolic 7% Toner', tags: ['aha'] },
];
const PROFILE: EngineProfile = { sensitivity: 'sensitive', pregnancy: false };
const CONFLICTS = previewDetectConflicts(PRODUCTS, PROFILE, STARTER_RULES);
// A pregnant user with a retinoid. The engine emits a HIGH-severity safety contraindication.
const PREGNANT_CONFLICTS = previewDetectConflicts(
  [{ id: 'r', name: 'Retinol', tags: ['retinoid'] }],
  { sensitivity: 'neutral', pregnancy: true },
  STARTER_RULES,
);

const CTX: AskContext = {
  conflicts: CONFLICTS,
  shelfProducts: PRODUCTS.map(({ id, name }) => ({ id, name })),
  hasShelfProducts: true,
  shelfProductCount: PRODUCTS.length,
  conflictCoverageStatus: 'unsupported_unreviewed',
  pmSteps: [
    { name: 'Glycolic 7% Toner', role: 'exfoliant' },
    { name: 'Ceramide moisturizer', role: 'moisturiser' },
  ],
  isExamplePlan: false,
  hasReplenish: true,
  topRec: {
    what: 'A vitamin C serum',
    example: 'e.g. a 10% L-ascorbic acid serum',
    evidenceLabel: 'plausible',
  },
  youreSet: false,
  goalConcernText: 'a more even-looking tone',
  groundedAllowed: false,
  groundedReason: 'free_locked',
};

describe('the conflict answer is deterministic and template-bounded from the engine', () => {
  it('does not surface raw candidate conflict copy', () => {
    const a = answerPrompt('conflict', CTX);
    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.conflictCoverageUnavailable);
    expect(a.severity).toBeNull();
    expect(a.citation).toBeNull();
  });
  it('fails closed across suggested, typed, and fit reassurance paths with the empty admitted corpus', () => {
    const evaluation = evaluateConflicts(PRODUCTS, {
      sensitivity: PROFILE.sensitivity,
      reproductiveStatus: 'none',
    });
    const emptyCorpusContext: AskContext = {
      ...CTX,
      conflicts: evaluation.conflicts,
      conflictCoverageStatus: evaluation.status,
      topRec: null,
      // Even a stale/inconsistent consumer bit cannot override unavailable coverage.
      youreSet: true,
    };

    expect(evaluation).toMatchObject({
      status: 'unsupported_unreviewed',
      conflicts: [],
    });
    expect(answerPrompt('conflict', emptyCorpusContext)).toMatchObject({
      kind: 'refuse',
      claim: ASK_COPY.conflictCoverageUnavailable,
    });
    expect(
      answerQuestion('Can I use Retinol 0.3% with Glycolic 7% Toner?', emptyCorpusContext),
    ).toMatchObject({
      kind: 'refuse',
      claim: ASK_COPY.conflictCoverageUnavailable,
    });
    expect(answerPrompt('fit', emptyCorpusContext)).toMatchObject({
      kind: 'refuse',
      claim: ASK_COPY.refuse.outOfScope,
    });
  });
  it('says "you’re set" when nothing clashes', () => {
    const a = answerPrompt('conflict', {
      ...CTX,
      conflicts: [],
      conflictCoverageStatus: 'compatible',
    });
    expect(a.claim).toBe(ASK_COPY.noConflicts);
  });
  it('refuses generically when a typed conflict question cannot resolve an exact shelf pair', () => {
    const a = answerQuestion('Can I use retinol with glycolic toner?', {
      ...CTX,
      conflicts: [],
      shelfProducts: [],
      hasShelfProducts: false,
    });

    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.refuse.outOfScope);
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
  });
  it('answers a typed conflict question only for two complete shelf product names', () => {
    const exact = answerQuestion('Can I use Retinol 0.3% with Glycolic 7% Toner?', {
      ...CTX,
      conflicts: [],
      conflictCoverageStatus: 'compatible',
    });
    const partial = answerQuestion('Can I use retinol with glycolic toner?', {
      ...CTX,
      conflicts: [],
      conflictCoverageStatus: 'compatible',
    });

    expect(exact.kind).toBe('deterministic');
    expect(exact.claim).toBe(ASK_COPY.noConflicts);
    expect(partial.kind).toBe('refuse');
    expect(partial.claim).toBe(ASK_COPY.refuse.outOfScope);
  });
  it('keeps an exact resolved pair fail-closed while its interaction coverage is unavailable', () => {
    const a = answerQuestion('Can I use Retinol 0.3% with Glycolic 7% Toner?', CTX);

    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.conflictCoverageUnavailable);
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
  });
  it('keeps the suggested conflict prompt shelf-wide', () => {
    const suggested = answerPrompt('conflict', {
      ...CTX,
      conflicts: [],
      shelfProducts: [],
      conflictCoverageStatus: 'compatible',
    });

    expect(suggested.kind).toBe('deterministic');
    expect(suggested.claim).toBe(ASK_COPY.noConflicts);
  });
  it('refuses ambiguous duplicate shelf names instead of guessing an id', () => {
    expect(
      resolveRequestedShelfPair('Can I use Retinol with Glycolic Toner?', [
        { id: 'retinol-1', name: 'Retinol' },
        { id: 'retinol-2', name: 'Retinol' },
        { id: 'glycolic', name: 'Glycolic Toner' },
      ]),
    ).toBeNull();
  });
  it('resolves exactly the two fully named products on a larger shelf', () => {
    expect(
      resolveRequestedShelfPair('Can I layer Retinol 0.3% with Glycolic 7% Toner?', [
        ...CTX.shelfProducts,
        { id: 'c', name: 'Ceramide moisturizer' },
      ]),
    ).toEqual(['a', 'b']);
  });
  it('does not show a review warning or compatibility claim when no pair applies', () => {
    const a = answerPrompt('conflict', {
      ...CTX,
      conflicts: [],
      hasShelfProducts: true,
      shelfProductCount: 1,
      conflictCoverageStatus: 'not_applicable',
    });

    expect(a.kind).toBe('deterministic');
    expect(a.claim).toBe(ASK_COPY.noConflictPair);
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
    expect(a.claim).not.toBe(ASK_COPY.conflictCoverageUnavailable);
  });
  it('refuses an impossible no-pair state for two unassessable products', () => {
    const a = answerPrompt('conflict', {
      ...CTX,
      conflicts: [],
      hasShelfProducts: true,
      shelfProductCount: 2,
      conflictCoverageStatus: 'not_applicable',
    });

    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.conflictCoverageUnavailable);
    expect(a.claim).not.toBe(ASK_COPY.noConflictPair);
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
  });
  it('does not turn a raw candidate pregnancy row into safety guidance', () => {
    expect(PREGNANT_CONFLICTS.some((c) => c.rule.interactionType === 'safety')).toBe(true);
    const a = answerPrompt('conflict', { ...CTX, conflicts: PREGNANT_CONFLICTS });
    expect(a.kind).toBe('refuse');
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
    expect(a.claim).not.toMatch(/pregnan|doctor|clinician/iu);
  });
});

describe('pickFitRec keeps raw product-name DATA (a "7%") out of the scanned claim', () => {
  it('skips shelf-anchored replacement/conflict recs and picks a clean catalog type', () => {
    const picked = pickFitRec([
      {
        trigger: 'replacement',
        what: 'Your Glycolic 7% Toner reached its freshness date',
        example: null,
        evidenceLabel: null,
      },
      {
        trigger: 'goal',
        what: 'A vitamin C serum',
        example: 'e.g. 10% L-ascorbic acid',
        evidenceLabel: 'plausible',
      },
    ]);
    expect(picked?.what).toBe('A vitamin C serum');
    expect(picked?.what).not.toContain('%');
  });
  it('returns null when only shelf-anchored recs exist without implying completeness', () => {
    expect(
      pickFitRec([
        {
          trigger: 'replacement',
          what: 'Your X reached its freshness date',
          example: null,
          evidenceLabel: null,
        },
      ]),
    ).toBeNull();
  });
});

describe('the routine answer surfaces tonight from the generated plan', () => {
  it('lists the PM steps as data and links to the plan', () => {
    const a = answerPrompt('tonight', CTX);
    expect(a.kind).toBe('deterministic');
    expect(a.claim).toBe(ASK_COPY.tonight.lead);
    expect(a.note).toContain('Glycolic 7% Toner'); // step names are DATA, not a claim
    expect(a.cta?.route).toBe('/routine/plan');
  });
});

describe('the product-fit answer is deterministic, from the fit engine', () => {
  it('frames the top recommendation against the goal, with the deeper-advisor note', () => {
    const a = answerPrompt('fit', CTX);
    expect(a.kind).toBe('deterministic');
    expect(a.claim).toContain('A vitamin C serum');
    expect(a.claim).toContain('a more even-looking tone');
    expect(a.claimSafeNote).toBe(true);
    expect(a.footnote).toBe(ASK_COPY.fit.deeperNote);
    expect(a.citation).toBeNull();
  });
  it('falls back to "complete" only when the engine positively reports it', () => {
    const a = answerPrompt('fit', {
      ...CTX,
      topRec: null,
      youreSet: true,
      conflictCoverageStatus: 'compatible',
    });
    expect(a.claim).toBe(ASK_COPY.fit.youreSet);
  });
  it.each([
    ['the fit engine has not reported completion', false, 'compatible'],
    ['conflict coverage is still unreviewed', true, 'unsupported_unreviewed'],
    ['no product pair was evaluated', true, 'not_applicable'],
    ['the shelf contains reviewed interactions', true, 'reviewed_interactions'],
    ['conflict coverage is missing', true, undefined],
  ] as const)('refuses generically when %s', (_reason, youreSet, conflictCoverageStatus) => {
    const a = answerPrompt('fit', {
      ...CTX,
      topRec: null,
      youreSet,
      conflictCoverageStatus,
    });

    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.refuse.outOfScope);
    expect(a.claim).not.toBe(ASK_COPY.fit.youreSet);
  });
});

describe('refuse-over-guess and escalation', () => {
  it('medical questions escalate verbally. Never answer, never a misrouted CTA', () => {
    const a = answerQuestion('what antibiotic should I take for this', CTX);
    expect(a.kind).toBe('escalate');
    expect(a.claim).toBe(ASK_COPY.escalate.body);
    expect(a.cta).toBeNull(); // no in-app derm finder exists. Verbal escalation only (docs/13 §9)
    expect(a.footnote).toBe(ASK_COPY.escalate.footnote);
  });
  it('active-frequency questions escalate instead of misrouting to product fit', () => {
    const a = answerQuestion('Should I use retinol every night?', CTX);

    expect(a.kind).toBe('escalate');
    expect(a.intent).toBe('medical');
    expect(a.claim).toBe(ASK_COPY.escalate.body);
    expect(a.claim).not.toContain('vitamin C serum');
    expect(a.badge).toBe(ASK_COPY.escalate.eyebrow);
  });
  it('a grounded concern question refuses with the Pro-locked message for free users', () => {
    const a = answerQuestion('what is niacinamide', CTX);
    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.refuse.groundedLocked);
  });
  it('a grounded concern question degrades honestly when grounding is allowed but offline', () => {
    const a = answerQuestion('what is niacinamide', {
      ...CTX,
      groundedAllowed: true,
      groundedReason: null,
    });
    expect(a.claim).toBe(ASK_COPY.refuse.groundedSetup);
  });
  it('off-topic input refuses honestly', () => {
    const a = answerQuestion('qwerty asdf', CTX);
    expect(a.kind).toBe('refuse');
    expect(a.claim).toBe(ASK_COPY.refuse.outOfScope);
  });
});
