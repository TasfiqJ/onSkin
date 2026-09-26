import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('native review source contract', () => {
  it('keeps StoreReview behind one fail-safe service instead of route-owned prompts', () => {
    const prompt = readSource('features/review/prompt.ts');
    const today = readSource('app/(tabs)/today.tsx');
    const conflict = readSource('app/conflict/[ruleId].tsx');
    const settings = readSource('app/(tabs)/you.tsx');

    expect(prompt).toContain("import * as StoreReview from 'expo-store-review'");
    expect(prompt.match(/StoreReview\.requestReview\(\)/g)).toHaveLength(1);
    expect(today).not.toContain('expo-store-review');
    expect(conflict).not.toContain('expo-store-review');
    expect(settings).not.toContain('requestReviewAfterValue');
  });

  it('contains no custom rating gate, incentive, sentiment screen, or pressure copy', () => {
    const productionSource = [
      readSource('features/review/policy.ts'),
      readSource('features/review/prompt.ts'),
      readSource('app/(tabs)/today.tsx'),
      readSource('app/conflict/[ruleId].tsx'),
    ].join('\n');

    expect(productionSource).not.toMatch(
      /(?:reward|discount|coupon|unlock|bonus|five[- ]star|5[- ]star|love (?:the|our) app|enjoying (?:the|our) app|rate us to|review us to)/iu,
    );
    expect(productionSource).not.toMatch(/(?:rating|review).{0,40}(?:required|continue|access)/iu);
  });
});
