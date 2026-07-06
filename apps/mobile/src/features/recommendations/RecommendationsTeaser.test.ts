import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RECS_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('RecommendationsTeaser mobile contracts', () => {
  it('keeps the Today SPF prompt actions touchable on phones', () => {
    const source = readFileSync(`${RECS_DIR}/RecommendationsTeaser.tsx`, 'utf8');

    expect(source).toContain('accessibilityLabel="Dismiss SPF recommendation"');
    expect(source).toContain("'absolute right-3 top-3 h-12 w-12 items-center justify-center rounded-full'");
    expect(source).toContain("'absolute right-2.5 top-2.5 h-11 w-11 items-center justify-center rounded-full'");
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.cta}');
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.dismiss}');
    expect(source).toContain('style={{ minHeight: 48, backgroundColor: colors.clay }}');
    expect(source).toContain('minHeight: 48');
    expect(source).toContain("'mb-2 flex-row items-center gap-2.5 pr-12'");
    expect(source).toContain("compact ? 'mt-3 rounded-[16px] p-3' : 'mt-4 rounded-[18px] p-4'");
    expect(source).toContain("'mb-1.5 flex-row items-center gap-2 pr-11'");
    expect(source).toContain("lineHeight: compact ? 15 : 18");
    expect(source).toContain('const showCompactGapOnly = compact && showGapPrompt && Boolean(spfGap)');
    expect(source).toContain('<GapPrompt compact={compact} recId={spfGap.id} />');
    expect(source).toContain('showCompactGapOnly ? null');
    expect(source).toContain('<ForYouCard compact={compact} count={result.recommendations.length} youreSet={result.youreSet} />');
    expect(source).not.toContain('hitSlop={8}');
    expect(source).not.toContain('hitSlop={6}');
    expect(source).not.toContain('className="h-[38px] items-center justify-center rounded-pill px-5"');
  });
});
