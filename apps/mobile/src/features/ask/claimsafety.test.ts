import { describe, expect, it } from 'vitest';

import { scanClaimSafety } from '@/features/community/claimSafetyScan';
import {
  detectConflicts,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { STARTER_RULES } from '@/features/intelligence/rules';
import { UPSELL_COPY } from '@/features/subscription/copy';

import { answerPrompt, answerQuestion, type AskContext } from './answer';
import { ASK_COPY, RESOLUTION_LEAD } from './copy';

// Claim-safety guard EXTENDED to Ask (docs/13 §4/§5/§10, the Slice-11..26 guard
// pattern). The copy AND the generated answers are the regulated surface. Forbidden: any
// drug/disease verb ("treats/cures/heals/prevents/diagnoses" → FDA SaMD); a condition
// NAMED as a diagnosis; a dose; a superiority claim ("dermatologist-grade"/"more accurate
// than" → FTC AI-washing); a skin score/age/health/rating; alarm/urgency; and "AI" in
// user-facing MARKETING. The output ANSWER claims pass the FULL guard; only the Art. 50
// DISCLOSURE copy that names the AI honestly is exempt from the AI-marketing term-scan.
// NOTE: only the substantive `claim` field is scanned. Product/plan-name DATA (which may
// carry a "7%") lives in separate fields and is not a claim (the §4 template-bounding).

const DRUG_DISEASE = [/\b(treat|cure|heal|prevent)(s|d|ed|ing)?\b/i, /\bdiagnos\w*/i];
const DISEASE_NOUN = [/\b(acne|rosacea|psoriasis|dermatitis|melasma|eczema|hyperpigmentation)\b/i];
const SUPERIORITY = [
  /\bdermatologist-grade\b/i,
  /\bmore\s+accurate\s+than\b/i,
  /\bobjective\b/i,
  /\bclinically\s+proven\b/i,
];
const DOSAGE = [/\b\d+\s?(mg|ml|iu)\b/i, /\b\d+\s+times?\s+(a|per)\s+day\b/i];
const SKIN_SCORE = [
  /\bskin\s*score\b/i,
  /\bskin\s*age\b/i,
  /\bskin\s*health\b/i,
  /\b\d+\s?\/\s?\d+\b/,
  /\b\d+\s*stars?\b/i,
  /\b\d+\s+out\s+of\b/i,
];
const AI_MARKETING = [/\bai\b/i];
const ALARM = [/\b(danger\w*|harmful|toxic|poison\w*)\b/i, /!/];

const ALWAYS = [DRUG_DISEASE, DISEASE_NOUN, SUPERIORITY, DOSAGE, SKIN_SCORE, ALARM];

// The Art. 50 / SB 243 disclosure strings legitimately name the AI. Exempt from the
// AI-marketing term-scan ONLY (the Slice-24 NO_SCORE_COPY exemption pattern).
const AI_DISCLOSURE_EXEMPT = new Set<string>([
  ASK_COPY.home.disclosureFooter,
  ASK_COPY.firstRunDisclosure,
]);

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => (text.match(re) ? [re.source] : []));
}

// --- A representative AskContext, so every generated ANSWER claim is scanned ---------
const PRODUCTS: EngineProduct[] = [
  { id: 'a', name: 'Retinol 0.3%', tags: ['retinoid'] },
  { id: 'b', name: 'Glycolic 7% Toner', tags: ['aha'] },
];
const PROFILE: EngineProfile = { sensitivity: 'sensitive', pregnancy: false };
const CONFLICTS = detectConflicts(PRODUCTS, PROFILE, STARTER_RULES);

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
const NO_CONFLICT_CTX: AskContext = { ...CTX, conflicts: [] };
const EMPTY_SHELF_CTX: AskContext = { ...CTX, conflicts: [], hasShelfProducts: false };

const GENERATED_CLAIMS = [
  answerPrompt('conflict', CTX).claim,
  answerPrompt('conflict', NO_CONFLICT_CTX).claim,
  answerPrompt('conflict', EMPTY_SHELF_CTX).claim,
  answerPrompt('tonight', CTX).claim,
  answerPrompt('fit', CTX).claim,
  answerPrompt('fit', { ...CTX, topRec: null }).claim,
  answerQuestion('what is running low on my shelf', CTX).claim,
  answerQuestion('I have a painful cystic breakout, what antibiotic should I take', CTX).claim,
  answerQuestion('what is niacinamide', CTX).claim,
  answerQuestion('qwerty asdf', CTX).claim,
];

// Includes UPSELL_COPY.ask. The Ask paywall copy, "the regulated surface" (docs/13 §10 /
// FTC AI-washing). Which the subscription guard does NOT scan for AI/disease/superiority.
const STATIC = [
  ...collect(ASK_COPY),
  ...Object.values(RESOLUTION_LEAD),
  ...collect(UPSELL_COPY.ask),
];

describe('every generated ANSWER claim passes the FULL guard. Template-bounded, claim-safe', () => {
  for (const claim of GENERATED_CLAIMS) {
    it(`clean claim: "${claim.slice(0, 48)}…"`, () => {
      for (const pats of [...ALWAYS, AI_MARKETING]) {
        expect(offenders(claim, pats)).toEqual([]);
      }
      // The answer claim also passes the SHIPPED runtime guard (docs/13 §5 reuse).
      expect(scanClaimSafety(claim).flagged).toBe(false);
    });
  }
});

describe('all Ask copy is claim-safe (AI-disclosure copy exempt only from the term-scan)', () => {
  for (const text of STATIC) {
    if (!text) continue;
    it(`no drug/disease/condition/dose/score/superiority/alarm in: "${text.slice(0, 38)}…"`, () => {
      for (const pats of ALWAYS) {
        expect(offenders(text, pats)).toEqual([]);
      }
      if (!AI_DISCLOSURE_EXEMPT.has(text)) {
        expect(offenders(text, AI_MARKETING)).toEqual([]);
      }
    });
  }
});

describe('the required stances are present (off-by-default, on-device, refuse, escalate, disclose)', () => {
  it('the privacy gate states on-device, zero-retention, a safety window, and off-by-default', () => {
    const keep = ASK_COPY.privacy.keep.join(' ').toLowerCase();
    expect(keep).toContain('on-device');
    expect(keep).toContain('zero-retention');
    expect(keep).toContain('safety window');
    expect(ASK_COPY.privacy.toggleHint.toLowerCase()).toContain('off by default');
    expect(ASK_COPY.privacy.never.toLowerCase()).toContain('never sold');
  });
  it('refuse-over-guess and clinician escalation copy exist', () => {
    expect(ASK_COPY.refuse.outOfScope.toLowerCase()).toContain('don’t have sourced information');
    expect(ASK_COPY.escalate.body.toLowerCase()).toContain('dermatologist');
  });
  it('the AI is disclosed honestly (Art. 50 / SB 243)', () => {
    expect(ASK_COPY.firstRunDisclosure.toLowerCase()).toContain('ai advisor');
  });
  it('the church-and-state line is present (no commerce influence)', () => {
    expect(ASK_COPY.triad.howFit.toLowerCase()).toContain('never by commission');
  });
});

describe('the guard catches reintroduced violations', () => {
  it('rejects a drug claim, a condition, a superiority claim, a score, and "AI" marketing', () => {
    expect(offenders('this serum treats acne', DRUG_DISEASE).length).toBeGreaterThan(0);
    expect(offenders('you have rosacea', DISEASE_NOUN).length).toBeGreaterThan(0);
    expect(offenders('dermatologist-grade analysis', SUPERIORITY).length).toBeGreaterThan(0);
    expect(offenders('your skin score is 85/100', SKIN_SCORE).length).toBeGreaterThan(0);
    expect(offenders('our AI is smarter', AI_MARKETING).length).toBeGreaterThan(0);
    expect(scanClaimSafety('this product cures eczema').flagged).toBe(true);
  });
});
