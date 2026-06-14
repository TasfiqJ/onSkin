import { describe, expect, it } from 'vitest';

import { COMMUNITY_COPY } from './copy';
import { SKIN_NOTES } from './notes';

// Claim-safety guard for community copy + the seeded expert notes (docs/11 §4/§9, the
// Slice-11..24 pattern). Community is health-adjacent and trust-critical, so the
// content must be claim-safe: recommend/explain for CONCERNS not CONDITIONS. No
// drug/disease verbs or disease names, no alarm, no urgency/guilt. And it must carry
// the mandatory "not medical advice" stance (Flo's posture). Curly-apostrophe-aware.

const DRUG = [
  /\btreats\b/i, // 3rd-person claim form ("treats acne"); the bare verb is unused here
  /\bcures?\b/i,
  /\bheals?\b/i,
  /\bdiagnos\w*/i,
  /\b(eczema|rosacea|psoriasis|dermatitis|melasma|acne)\b/i,
];
const ALARM = [/\bdanger\w*/i, /\bharmful\b/i, /\btoxic\b/i, /!/];
const URGENCY = [/\bdon['’]?t\s+miss\b/i, /\bhurry\b/i, /\blast\s+chance\b/i, /\bonly\s+\d+\s+left\b/i];

// The one meta string that QUOTES "treats/cures" precisely to say it found none. It
// negates the terms (the Slice-20 NO_SCORE_COPY exemption pattern). It is exempt from
// the DRUG scan but still held to the alarm/urgency bar.
const META_SAFETY = COMMUNITY_COPY.ask.claimSafePassed;

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => (text.match(re) ? [re.source] : []));
}

const NOTE_STRINGS = SKIN_NOTES.flatMap((n) => [n.title, n.summary, n.claim, n.why, n.verdict, n.sourceLabel]);
const ALL = [...collect(COMMUNITY_COPY), ...NOTE_STRINGS];

describe('community copy + expert notes are claim-safe (docs/11 §4/§9)', () => {
  for (const text of ALL) {
    if (!text) continue;
    it(`no drug/disease · alarm · urgency in: "${text.slice(0, 42)}…"`, () => {
      if (text !== META_SAFETY) expect(offenders(text, DRUG)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
      expect(offenders(text, URGENCY)).toEqual([]);
    });
  }
});

describe('the mandatory disclosures + "library not a feed" stance are present', () => {
  it('every note carries the "not medical advice" disclaimer', () => {
    expect(COMMUNITY_COPY.card.disclaimer.toLowerCase()).toContain('not medical advice');
  });
  it('the hub states it is a library, not a feed (no likes / no authors to follow)', () => {
    expect(COMMUNITY_COPY.hub.libraryFooter.toLowerCase()).toContain('not a feed');
  });
  it('the consent gate states it is separate/unbundled, anonymous, never sold, and 16+', () => {
    expect(COMMUNITY_COPY.consent.body.toLowerCase()).toContain('separate');
    expect(COMMUNITY_COPY.consent.never.toLowerCase()).toContain('never sold');
    expect(COMMUNITY_COPY.consent.age.toLowerCase()).toContain('16');
  });
  it('"people like you" states it is aggregated/anonymised and never a feed/ranking', () => {
    expect(COMMUNITY_COPY.peopleLikeYou.aggregateNote.toLowerCase()).toContain('anonymised');
    expect(COMMUNITY_COPY.peopleLikeYou.nevers.join(' ').toLowerCase()).toContain('never a feed');
  });
});

describe('the guard catches reintroduced violations', () => {
  it('rejects a condition claim and alarm', () => {
    expect(offenders('cures acne overnight', DRUG).length).toBeGreaterThan(0);
    expect(offenders('this is toxic!', ALARM).length).toBeGreaterThan(0);
  });
});
