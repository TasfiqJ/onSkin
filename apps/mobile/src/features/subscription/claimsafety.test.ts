import { describe, expect, it } from 'vitest';

import { PAYWALL_COPY, UPSELL_COPY, UPSELL_DISMISS } from './copy';

// Honest-by-design guard for the paywall + lifecycle copy (docs/08 §9, the
// Slice-11/20/21 pattern). The subscription playbook is where dark patterns live;
// this blocks manufactured urgency, guilt, fake scarcity, drug/disease claims, and
// alarm/exclamation. And positively asserts the honest disclosures are present.

// Apostrophe class is ['’] so both the straight ASCII quote and the curly U+2019
// the copy uses are caught (the Slice-21 lesson).
const URGENCY = [
  /\bdon['’]?t\s+miss\b/i,
  /\bhurry\b/i,
  /\blast\s+chance\b/i,
  /\bact\s+now\b/i,
  /\bonly\s+\d+\s+left\b/i,
  /\bexpires?\s+in\b/i,
  /\blimited\s+time\b/i,
];
const GUILT = [/\byou['’]?ll\s+lose\b/i, /\bdon['’]?t\s+lose\b/i, /\byou\s+failed\b/i];
const DRUG_CLAIMS = [/\btreats?\b/i, /\bcures?\b/i, /\bheals?\b/i, /\bclinically\s+proven\b/i];
const ALARM = [/\bdanger\w*/i, /\bwarning\b/i, /!/];

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') {
    try {
      out.push(String((v as (...a: unknown[]) => unknown)('dry, sensitive skin')));
    } catch {
      /* fns needing other arg shapes are exercised via screens */
    }
  } else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => {
    const m = text.match(re);
    return m ? [m[0]] : [];
  });
}

const ALL = [...collect(PAYWALL_COPY), ...collect(UPSELL_COPY), UPSELL_DISMISS];

describe('paywall copy is honest-by-design (docs/08 §9)', () => {
  for (const text of ALL) {
    it(`no urgency · guilt · drug claim · alarm in: "${text.slice(0, 44)}…"`, () => {
      expect(offenders(text, URGENCY)).toEqual([]);
      expect(offenders(text, GUILT)).toEqual([]);
      expect(offenders(text, DRUG_CLAIMS)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
    });
  }
});

describe('the required honest disclosures are present (Apple 3.1.2 / ARLs)', () => {
  it('the auto-renew disclosure names the conversion, auto-renew, and how to cancel', () => {
    const d = PAYWALL_COPY.offer.autoRenewDisclosure.toLowerCase();
    expect(d).toContain('auto-renew');
    expect(d).toContain('cancel');
  });
  it('the offer promises the 2-day pre-charge reminder and cancel-anytime', () => {
    expect(PAYWALL_COPY.offer.trialReassurance.toLowerCase()).toContain('2 days before');
    expect(PAYWALL_COPY.offer.trialReassurance.toLowerCase()).toContain('cancel anytime');
  });
  it('the reverse trial is stated as no-card', () => {
    expect(PAYWALL_COPY.offer.exploreBody.toLowerCase()).toContain('no credit card');
  });
  it('the trust block carries the privacy promise, no data sales', () => {
    expect(PAYWALL_COPY.offer.trustBlock.toLowerCase()).toContain('no data sales');
  });
});

describe('the guard catches reintroduced dark patterns', () => {
  it('rejects manufactured urgency and guilt', () => {
    expect(offenders('Don’t miss out. Only 2 left!', URGENCY).length).toBeGreaterThan(0);
    expect(offenders('You’ll lose your streak', GUILT).length).toBeGreaterThan(0);
    expect(offenders('Limited time offer', URGENCY).length).toBeGreaterThan(0);
  });
});
