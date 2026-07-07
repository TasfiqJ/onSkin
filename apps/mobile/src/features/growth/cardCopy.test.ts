import { describe, expect, it } from 'vitest';

import { BRAND } from '@/lib/brand';

import { CARD_COPY, CARD_SHARE_URL, resolveCardPublicDomain } from './cardCopy';

// Claim-safety + no-dark-pattern regression guard for the shareable Conflict Card
// (docs/14 §3). The card is a public, screenshot-worthy artifact, so its copy is a
// claims surface (FD&C Act / FTC): it must stay COSMETIC and CALM. No future edit
// may slip a drug claim, a disease name, or a fear/urgency hook onto the card.
const DRUG_VERBS = /\b(treats?|cures?|heals?|prevents?|reverses?|repairs?|stimulates?)\b/i;
const DISEASE = /\b(acne|rosacea|eczema|melasma|dermatitis|psoriasis)\b/i;
const DARK_PATTERN =
  /\b(hurry|now only|don'?t miss|act fast|limited time|last chance|selling fast)\b/i;

describe('Shelf Conflict Card copy (docs/14 §3) is claim-safe and calm', () => {
  const strings = Object.values(CARD_COPY);

  it('contains no drug-claim verbs', () => {
    for (const s of strings) expect(s).not.toMatch(DRUG_VERBS);
  });

  it('names no disease/condition', () => {
    for (const s of strings) expect(s).not.toMatch(DISEASE);
  });

  it('uses no urgency / FOMO dark patterns', () => {
    for (const s of strings) expect(s).not.toMatch(DARK_PATTERN);
  });

  it('carries the not-medical-advice footnote and a brand watermark', () => {
    expect(CARD_COPY.footnote.toLowerCase()).toContain('not medical advice');
    expect(CARD_COPY.handle).toBeTruthy();
    expect(CARD_COPY.brand).toBe(BRAND.appName);
  });

  it('uses only a normalized first-party public domain for share-card URLs', () => {
    expect(resolveCardPublicDomain('https://RoutineKind.app/share')).toBe('routinekind.app');
    expect(resolveCardPublicDomain('https://example.com')).toBe('routinekind.example');
    expect(resolveCardPublicDomain('http://localhost:19006')).toBe('routinekind.example');
    expect(resolveCardPublicDomain('routinekind.app@evil.com')).toBe('routinekind.example');
    expect(CARD_SHARE_URL).toBe(`https://${CARD_COPY.handle}`);
  });
});
