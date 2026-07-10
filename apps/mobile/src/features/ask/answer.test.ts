import { describe, expect, it } from 'vitest';

import {
  detectConflicts,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { bannerSubhead } from '@/features/intelligence/presentation';
import { STARTER_RULES } from '@/features/intelligence/rules';

import { answerPrompt, answerQuestion, pickFitRec, type AskContext } from './answer';
import { ASK_COPY } from './copy';

// The pure, template-bounded answer engine (docs/13 §4, D-057). Substantive claims are
// filled from the deterministic engine + claim-safe copy. Never free-generated.

const PRODUCTS: EngineProduct[] = [
  { id: 'a', name: 'Retinol 0.3%', tags: ['retinoid'] },
  { id: 'b', name: 'Glycolic 7% Toner', tags: ['aha'] },
];
const PROFILE: EngineProfile = { sensitivity: 'sensitive', pregnancy: false };
const CONFLICTS = detectConflicts(PRODUCTS, PROFILE, STARTER_RULES);
// A pregnant user with a retinoid. The engine emits a HIGH-severity safety contraindication.
const PREGNANT_CONFLICTS = detectConflicts(
  [{ id: 'r', name: 'Retinol', tags: ['retinoid'] }],
  { sensitivity: 'neutral', pregnancy: true },
  STARTER_RULES,
);

const CTX: AskContext = {
  conflicts: CONFLICTS,
  hasShelfProducts: true,
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
  it('surfaces the top shelf conflict with severity, citation, and the recommendation note', () => {
    const a = answerPrompt('conflict', CTX);
    expect(a.kind).toBe('deterministic');
    expect(a.badge).toBe(ASK_COPY.badges.deterministic);
    expect(a.severity).not.toBeNull();
    expect(a.citation).not.toBeNull();
    expect(a.recommendationNote).toBe(true);
    // The substantive sentence ends in the ENGINE's resolution subhead. Not free text.
    const top = CONFLICTS.find((c) => c.computedSeverity !== 'none');
    expect(top).toBeTruthy();
    expect(a.claim).toContain(bannerSubhead(top!));
    // The product-name DATA (with "7%") lives in `note`, never in the scanned `claim`.
    expect(a.claim).not.toContain('7%');
  });
  it('says "you’re set" when nothing clashes', () => {
    const a = answerPrompt('conflict', { ...CTX, conflicts: [] });
    expect(a.claim).toBe(ASK_COPY.noConflicts);
  });
  it('does not reassure when the shelf is empty', () => {
    const a = answerQuestion('Can I use retinol with glycolic toner?', {
      ...CTX,
      conflicts: [],
      hasShelfProducts: false,
    });

    expect(a.kind).toBe('deterministic');
    expect(a.claim).toBe(ASK_COPY.emptyShelfConflict);
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
  });
  it('a safety contraindication (e.g. pregnancy) escalates. NEVER "you’re set"', () => {
    expect(PREGNANT_CONFLICTS.some((c) => c.rule.interactionType === 'safety')).toBe(true);
    const a = answerPrompt('conflict', { ...CTX, conflicts: PREGNANT_CONFLICTS });
    expect(a.kind).toBe('escalate');
    expect(a.claim).not.toBe(ASK_COPY.noConflicts);
    expect(a.badge).toBe(ASK_COPY.escalate.safetyEyebrow);
  });
});

describe('pickFitRec keeps raw product-name DATA (a "7%") out of the scanned claim', () => {
  it('skips shelf-anchored replacement/conflict recs and picks a clean catalog type', () => {
    const picked = pickFitRec([
      {
        trigger: 'replacement',
        what: 'Your Glycolic 7% Toner is running low',
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
  it('returns null when only shelf-anchored recs exist (→ "your routine looks complete")', () => {
    expect(
      pickFitRec([
        {
          trigger: 'replacement',
          what: 'Your X is running low',
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
  });
  it('falls back to "complete" when there is nothing to add', () => {
    const a = answerPrompt('fit', { ...CTX, topRec: null });
    expect(a.claim).toBe(ASK_COPY.fit.youreSet);
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
