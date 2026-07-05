import { describe, expect, it } from 'vitest';

import {
  LOCK_SCREEN_NOTIFICATION_TITLE,
  MILESTONE_COPY,
  notificationContentForLockScreen,
  REMINDER_COPY,
  SETTINGS_COPY,
  SOFT_ASK,
  WELCOME_BACK,
} from './copy';

// Claim-safety + calm-copy guard for the engagement layer (docs/07 §2/§3.3, the
// Slice-11/20 pattern). Notifications are a claims surface AND a place dark patterns
// creep in. This guard blocks: guilt/loss-aversion ("don't break", "you lost",
// "streak!"), manufactured urgency ("hurry", "last chance", "now!"), drug/disease
// claims, and alarm words. On every future copy edit.

// NOTE: the apostrophe class is ['’] so it catches BOTH the straight ASCII quote
// and the curly U+2019 the copy actually uses ("Don’t"). Otherwise a reintroduced
// "Don’t break your streak" would slip past the guard.
const GUILT = [
  /don['’]?t\s+break/i,
  /\byou\s+lost\b/i,
  /\bbroke\s+your\b/i,
  /\bstreak!/i,
  /don['’]?t\s+lose\b/i,
];
const URGENCY = [/\bhurry\b/i, /\blast\s+chance\b/i, /\bact\s+now\b/i, /\bnow!/i, /don['’]?t\s+miss\s+out\b/i];
const DRUG_CLAIMS = [/\btreats?\b/i, /\bcures?\b/i, /\bheals?\b/i, /\bdiagnos\w*/i, /\bclinically\s+proven\b/i];
const ALARM = [/\bdanger\w*/i, /\bharmful\b/i, /\bwarning\b/i, /!{1}/]; // any exclamation mark

function collect(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') out.push(v(7) as string); // copy fns (e.g. safeTagTitle)
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collect(x, out));
  return out;
}
function offenders(text: string, pats: RegExp[]): string[] {
  return pats.flatMap((re) => {
    const m = text.match(re);
    return m ? [m[0]] : [];
  });
}

const ALL = [
  ...collect(REMINDER_COPY),
  ...collect(SOFT_ASK),
  ...collect(WELCOME_BACK),
  ...collect(MILESTONE_COPY),
  ...collect(SETTINGS_COPY),
];

describe('engagement copy is calm + claim-safe (docs/07 §2/§3.3)', () => {
  for (const text of ALL) {
    it(`no guilt · urgency · drug claim · alarm in: "${text.slice(0, 44)}…"`, () => {
      expect(offenders(text, GUILT)).toEqual([]);
      expect(offenders(text, URGENCY)).toEqual([]);
      expect(offenders(text, DRUG_CLAIMS)).toEqual([]);
      expect(offenders(text, ALARM)).toEqual([]);
    });
  }
});

describe('the guard actually catches reintroduced dark-pattern copy', () => {
  it('rejects guilt copy written with BOTH straight and curly apostrophes', () => {
    expect(offenders("Don't break your streak", GUILT).length).toBeGreaterThan(0);
    expect(offenders('Don’t break your streak', GUILT).length).toBeGreaterThan(0); // curly U+2019
    expect(offenders('You lost your 30-day streak', GUILT).length).toBeGreaterThan(0);
  });
  it('rejects manufactured urgency (curly apostrophe too)', () => {
    expect(offenders('Hurry. Last chance', URGENCY).length).toBeGreaterThan(0);
    expect(offenders('Don’t miss out', URGENCY).length).toBeGreaterThan(0);
  });
  it('rejects any exclamation mark as non-calm', () => {
    expect(offenders('Your streak is safe!', ALARM).length).toBeGreaterThan(0);
  });
});

describe('discretion: lock-screen copy is generic (docs/07 §3.6)', () => {
  it('every discreet body avoids product/condition specifics', () => {
    const banned = [/retino/i, /acid\b/i, /acne/i, /\bspf\b/i, /vitamin\s*c/i, /niacinamide/i];
    for (const k of Object.keys(REMINDER_COPY) as (keyof typeof REMINDER_COPY)[]) {
      expect(offenders(REMINDER_COPY[k].discreet, banned)).toEqual([]);
    }
  });

  it('OS notification payloads always use generic title/body copy', () => {
    const banned = [
      /progress\s*photo/i,
      /\bphoto\b/i,
      /\bproduct/i,
      /\bskin\b/i,
      /retino/i,
      /acid\b/i,
      /acne/i,
      /\bspf\b/i,
      /vitamin\s*c/i,
      /niacinamide/i,
      /recovery\s+nights?/i,
      /step-up/i,
    ];
    for (const k of Object.keys(REMINDER_COPY) as (keyof typeof REMINDER_COPY)[]) {
      const content = notificationContentForLockScreen(k);
      expect(content.title).toBe(LOCK_SCREEN_NOTIFICATION_TITLE);
      expect(offenders(content.body, banned)).toEqual([]);
    }
  });
});
