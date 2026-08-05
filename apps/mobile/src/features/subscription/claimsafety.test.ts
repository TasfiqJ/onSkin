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
  it('the offer makes reminder delivery conditional and names App Store management', () => {
    const reassurance = PAYWALL_COPY.offer.trialReassurance.toLowerCase();
    expect(reassurance).toContain('notifications enabled');
    expect(reassurance).toContain('app store');
    expect(reassurance).not.toMatch(/we(?:’|')ll remind|apple sends|one tap/iu);
  });
  it('the reverse trial is stated as no-card', () => {
    expect(PAYWALL_COPY.offer.exploreBody.toLowerCase()).toContain('no credit card');
  });
  it('the onboarding free path promises no purchase or Pro unlock', () => {
    expect(PAYWALL_COPY.offer.continueFreeBody.toLowerCase()).toContain('no purchase');
    expect(PAYWALL_COPY.offer.continueFreeBody.toLowerCase()).toContain('stay locked');
  });
  it('the trust block carries the privacy promise, no data sales', () => {
    expect(PAYWALL_COPY.offer.trustBlock.toLowerCase()).toContain('no data sales');
  });
});

describe('zero-admission marketing cannot sell unavailable clinical guidance', () => {
  it('states the review prerequisite without claiming an active review', () => {
    expect(PAYWALL_COPY.offer.trustBlock).toContain(
      'Health-related guidance requires independent professional review before availability',
    );
    expect(PAYWALL_COPY.offer.trustBlock).not.toMatch(/is under .*review/iu);
    expect(ALL.join('\n')).not.toMatch(/reviewed by dermatologists/iu);
  });

  it('does not advertise paid conflict, sequencing, ramp, or skin-cycling guidance', () => {
    const copy = ALL.join('\n');
    expect(copy).not.toMatch(/unlimited (?:ingredient-)?conflict checks/iu);
    expect(copy).not.toMatch(/conflict checks, with evidence grades/iu);
    expect(copy).not.toMatch(/full skin-cycling scheduler/iu);
    expect(copy).not.toMatch(/complete builder, sequencing and ramp/iu);
    expect(UPSELL_COPY.conflict_checks.body).toContain(
      'required before product-interaction claims can be sold, unlocked, or shown',
    );
  });
});

describe('the guard catches reintroduced dark patterns', () => {
  it('rejects manufactured urgency and guilt', () => {
    expect(offenders('Don’t miss out. Only 2 left!', URGENCY).length).toBeGreaterThan(0);
    expect(offenders('You’ll lose your streak', GUILT).length).toBeGreaterThan(0);
    expect(offenders('Limited time offer', URGENCY).length).toBeGreaterThan(0);
  });
});
