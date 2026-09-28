import type { CuratorKind } from '@layerwell/types';
import { describe, expect, it } from 'vitest';

import { COMMERCE_COPY } from './copy';
import { STARTER_STACKS } from './stacks';

// Negative safety baseline for unapproved future copy. These tests do not certify
// FTC, privacy, Apple, or other legal acceptance. COM-01A forbids production
// consumers; any successor must re-review exact copy and actual data flows.

const FTC_INADEQUATE = [/\baffiliate\s+link/i, /\bcommissionable\s+link/i, /\bbuy\s+now\b/i];
const URGENCY = [
  /\bdon['’]?t\s+miss\b/i,
  /\bhurry\b/i,
  /\blast\s+chance\b/i,
  /\bonly\s+\d+\s+left\b/i,
  /\bselling\s+fast\b/i,
  /\blimited\s+time\b/i,
];
const GUILT = [/\byou['’]?ll\s+lose\b/i, /\bdon['’]?t\s+lose\b/i];
// `treats` (3rd-person) is the drug-CLAIM form ("treats acne"); the bare routine-step
// verb "Treat" (Cleanse · Treat · Moisturise · Protect) is allowed. Real claims are
// still caught by `treats` + the disease-name list ("Treat acne" → matches `acne`).
const CONDITION_OR_DRUG = [
  /\btreats\b/i,
  /\bcures?\b/i,
  /\bheals?\b/i,
  /\bprevents?\b/i,
  /\bdiagnos\w*/i,
  /\b(eczema|rosacea|psoriasis|dermatitis|melasma|acne)\b/i,
];

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    for (const arg of ['$34', 'derm', 'editorial', 'creator'] as (string | CuratorKind)[]) {
      try {
        out.push(String((v as (a: unknown) => unknown)(arg)));
      } catch {
        /* */
      }
    }
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => (text.match(re) ? [re.source] : []));
}

const ALL = [
  ...collect(COMMERCE_COPY),
  ...STARTER_STACKS.flatMap((s) => [
    s.title,
    s.subtitle,
    s.curator,
    ...s.items.flatMap((i) => [i.label, i.roleLabel]),
  ]),
];

describe('unapproved future commerce draft avoids known high-risk wording', () => {
  for (const text of ALL) {
    if (!text) continue;
    it(`no inadequate-FTC / urgency / guilt / condition wording in: "${text.slice(0, 40)}…"`, () => {
      expect(offenders(text, FTC_INADEQUATE)).toEqual([]);
      expect(offenders(text, URGENCY)).toEqual([]);
      expect(offenders(text, GUILT)).toEqual([]);
      expect(offenders(text, CONDITION_OR_DRUG)).toEqual([]);
    });
  }
});

describe('future draft retains disclosure and independence review prompts', () => {
  it('the where-to-buy disclosure uses "paid link" and states independence', () => {
    const d = COMMERCE_COPY.whereToBuy.disclosure.toLowerCase();
    expect(d).toContain('paid link');
    expect(d).toContain('never affects what we recommend');
  });
  it('retains the paid-link draft label without treating it as legal approval', () => {
    expect(COMMERCE_COPY.whereToBuy.paidChip).toBe('Paid link');
    expect(COMMERCE_COPY.stack.paidChip).toBe('Paid link');
  });
  it('the stack disclosure states the order was set on merit, not commission', () => {
    expect(COMMERCE_COPY.stack.disclosure.toLowerCase()).toContain('never changed the list');
  });
  it('the transparency page states ranking is independent by architecture', () => {
    expect(COMMERCE_COPY.transparency.principles[0]!.body.toLowerCase()).toContain(
      'never enter the ranking',
    );
  });
  it('the closed consent draft states separation and no current commerce data flow', () => {
    expect(COMMERCE_COPY.consent.note.toLowerCase()).toContain('separate');
    expect(COMMERCE_COPY.consent.never.toLowerCase()).toContain('no current');
  });
});

describe('the guard catches reintroduced violations', () => {
  it('rejects the FTC-inadequate "affiliate link" wording and a "buy now" CTA', () => {
    expect(offenders('Affiliate link. We earn a cut', FTC_INADEQUATE).length).toBeGreaterThan(0);
    expect(
      offenders('Buy now before it sells out', [...FTC_INADEQUATE, ...URGENCY]).length,
    ).toBeGreaterThan(0);
  });
  it('rejects a condition claim', () => {
    expect(offenders('Treats acne in two weeks', CONDITION_OR_DRUG).length).toBeGreaterThan(0);
  });
});
