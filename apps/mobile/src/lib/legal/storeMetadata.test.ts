import { describe, expect, it } from 'vitest';

import { POLICY_LINKS } from './policyLinks';
import { BRAND } from '@/lib/brand';
import {
  PHASE8_STORE_METADATA_PACKET,
  STORE_METADATA_DRAFT,
  STORE_METADATA_LIMITS,
  validateStoreMetadataPacket,
} from './storeMetadata';

const DRUG_DISEASE = [
  /\b(treat|cure|heal|prevent)(s|ed|ing)?\b/i,
  /\bdiagnos\w*\b/i,
  /\bdetect(s|ed|ing)?\b/i,
];
const CONDITION_NOUNS = [
  /\b(acne|eczema|rosacea|psoriasis|dermatitis|melasma|hyperpigmentation)\b/i,
];
const SUPERIORITY = [
  /\bclinically\s+proven\b/i,
  /\bdermatologist-grade\b/i,
  /\bmore\s+accurate\s+than\b/i,
];
const SCORE = [/\bskin\s*(score|age|health)\b/i, /\bhazard\s*score\b/i, /\b\d+\s*\/\s*\d+\b/];
const COMMERCE_DARK_PATTERN = [
  /\baffiliate\s+link\b/i,
  /\bcommissionable\s+link\b/i,
  /\bbuy\s+now\b/i,
  /\blimited\s+time\b/i,
];
const AI_MARKETING = [/\bai\s+(skin|analysis|dermatologist|diagnos\w*)\b/i];

function offenders(text: string, patterns: RegExp[]): string[] {
  return patterns.flatMap((re) => (text.match(re) ? [re.source] : []));
}

const listingText = [
  STORE_METADATA_DRAFT.subtitle,
  STORE_METADATA_DRAFT.shortDescription,
  ...STORE_METADATA_DRAFT.keywords,
  ...STORE_METADATA_DRAFT.longDescriptionBullets,
  ...STORE_METADATA_DRAFT.screenshotCaptions,
];

describe('Phase 3 store metadata draft is claim-safe', () => {
  it('uses the configured runtime brand for submitter-facing app names', () => {
    expect(STORE_METADATA_DRAFT.appName).toBe(BRAND.appName);
    expect(PHASE8_STORE_METADATA_PACKET.ios.appName).toBe(BRAND.appName);
    expect(PHASE8_STORE_METADATA_PACKET.googlePlay.title).toBe(BRAND.appName);
  });

  for (const text of listingText) {
    it(`keeps public listing copy clean: "${text.slice(0, 48)}..."`, () => {
      for (const patterns of [
        DRUG_DISEASE,
        CONDITION_NOUNS,
        SUPERIORITY,
        SCORE,
        COMMERCE_DARK_PATTERN,
        AI_MARKETING,
      ]) {
        expect(offenders(text, patterns)).toEqual([]);
      }
    });
  }

  it('uses the review note to state the medical boundary explicitly', () => {
    const note = STORE_METADATA_DRAFT.reviewNotes.toLowerCase();

    expect(note).toContain('does not diagnose');
    expect(note).toContain('treat');
    expect(note).toContain('detect medical conditions');
    expect(note).toContain('no score');
  });

  it('keeps the prohibited-claims examples intentionally bad for reviewer scanning', () => {
    const blockedExamples = STORE_METADATA_DRAFT.prohibitedLaunchClaims.join(' ');

    expect(
      offenders(blockedExamples, [
        ...DRUG_DISEASE,
        ...CONDITION_NOUNS,
        ...SUPERIORITY,
        ...SCORE,
        ...AI_MARKETING,
      ]).length,
    ).toBeGreaterThan(0);
  });
});

describe('Phase 3 policy link registry includes required platform and health-data links', () => {
  it('covers privacy, consumer health privacy, support, deletion, export, terms', () => {
    expect(Object.keys(POLICY_LINKS).sort()).toEqual([
      'accountDeletion',
      'consumerHealthPrivacy',
      'dataExport',
      'privacy',
      'support',
      'terms',
    ]);
  });
});

describe('Phase 8 store metadata packet is submitter-ready copy', () => {
  it('fits App Store and Play metadata limits', () => {
    const packet = PHASE8_STORE_METADATA_PACKET;

    expect(packet.ios.appName.length).toBeLessThanOrEqual(STORE_METADATA_LIMITS.ios.appName);
    expect(packet.ios.subtitle.length).toBeLessThanOrEqual(STORE_METADATA_LIMITS.ios.subtitle);
    expect(packet.ios.promotionalText.length).toBeLessThanOrEqual(
      STORE_METADATA_LIMITS.ios.promotionalText,
    );
    expect(packet.ios.keywords.length).toBeLessThanOrEqual(STORE_METADATA_LIMITS.ios.keywords);
    expect(packet.googlePlay.title.length).toBeLessThanOrEqual(
      STORE_METADATA_LIMITS.googlePlay.title,
    );
    expect(packet.googlePlay.shortDescription.length).toBeLessThanOrEqual(
      STORE_METADATA_LIMITS.googlePlay.shortDescription,
    );
  });

  it('validates with no public-copy claim blockers', () => {
    expect(validateStoreMetadataPacket().errors).toEqual([]);
  });

  it('keeps reviewer medical-boundary notes separate from public marketing copy', () => {
    expect(PHASE8_STORE_METADATA_PACKET.ios.reviewNotes.toLowerCase()).toContain(
      'does not diagnose',
    );
    expect(PHASE8_STORE_METADATA_PACKET.googlePlay.reviewerNotes.toLowerCase()).toContain(
      'test credentials',
    );
  });
});
