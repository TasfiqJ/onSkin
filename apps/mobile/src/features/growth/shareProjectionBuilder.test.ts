import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { STARTER_RULES } from '@/features/intelligence/conflictRuleCorpus.v1';

import { buildReviewedConflictShareProjection } from './shareProjectionBuilder';

const source = readFileSync(
  fileURLToPath(new URL('./shareProjectionBuilder.ts', import.meta.url)),
  'utf8',
);

describe('reviewed conflict share projection builder', () => {
  it('rejects the bundled candidate corpus and a self-asserted reviewed marker', () => {
    const candidate = STARTER_RULES[0]!;

    expect(buildReviewedConflictShareProjection(candidate)).toBeNull();
    expect(
      buildReviewedConflictShareProjection({ ...candidate, reviewedBy: 'self-asserted-reviewer' }),
    ).toBeNull();
  });

  it('takes public claim text only from the canonical admitted rule copy', () => {
    expect(source).toContain('if (!isReviewedRule(rule)) return null;');
    expect(source).toContain('title: admittedRule.copy.shareTitle');
    expect(source).toContain('claim: admittedRule.copy.shareClaim');
    expect(source).toContain('severityLabel: admittedRule.copy.severityLabel');
    expect(source).not.toContain('productAName');
    expect(source).not.toContain('productBName');
    expect(source).not.toContain('productId');
    expect(source).not.toContain('userId');
    expect(source).not.toContain('skinProfile');
    expect(source).not.toContain('sourceCitation');
    expect(source).not.toContain('reviewedBy:');
  });

  it('requires the exact normalized final domain for the visible watermark', () => {
    expect(source).toContain('normalizePublicDomain(env.finalBrandDomain)');
    expect(source).toContain('finalDomain !== CONFLICT_SHARE_PUBLIC_COPY.attributionLabel');
    expect(source).toContain('attributionLabel: finalDomain');
  });
});
