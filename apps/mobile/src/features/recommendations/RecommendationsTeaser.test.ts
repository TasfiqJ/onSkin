import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RECS_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('RecommendationsTeaser mobile contracts', () => {
  it('keeps the Today SPF prompt actions touchable on phones', () => {
    const source = readFileSync(`${RECS_DIR}/RecommendationsTeaser.tsx`, 'utf8');

    expect(source).toContain('accessibilityLabel="Dismiss SPF recommendation"');
    expect(source).toContain('if (compact) {');
    expect(source).toContain("const compactTitle = 'No SPF this morning';");
    expect(source).toContain('className="mt-0 flex-row items-center gap-2 rounded-[16px] p-0"');
    expect(source).toContain('className="min-h-[48px] flex-1 flex-row items-center gap-2"');
    expect(source).toContain('className="h-7 w-7 items-center justify-center rounded-lg"');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('className="font-sans-bold text-[12.5px]"');
    expect(source).toContain('style={{ color: colors.clayDeep, lineHeight: 15 }}');
    expect(source).toContain('{compactTitle}');
    expect(source).toContain('className="mt-0.5 font-sans-semibold text-[12px]"');
    expect(source).toContain('className="h-12 w-12 items-center justify-center rounded-full"');
    expect(source).toContain('className="mt-4 rounded-[18px] p-4"');
    expect(source).toContain('className="absolute right-3 top-3 h-12 w-12 items-center justify-center rounded-full"');
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.cta}');
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.dismiss}');
    expect(source).toContain('style={{ minHeight: 48, backgroundColor: colors.clay }}');
    expect(source).toContain('minHeight: 48');
    expect(source).toContain('className="mb-2 flex-row items-center gap-2.5 pr-12"');
    expect(source).not.toContain("'absolute right-2 top-2 h-12 w-12 items-center justify-center rounded-full'");
    expect(source).not.toContain('className="mt-3 flex-row items-center gap-2 rounded-[16px] p-2.5"');
    expect(source).not.toContain('className="mt-2 flex-row items-center gap-2 rounded-[16px] p-1"');
    expect(source).not.toContain('className="mt-1 flex-row items-center gap-2 rounded-[16px] p-1"');
    expect(source).not.toContain('className="h-8 w-8 items-center justify-center rounded-lg"');
    expect(source).not.toContain("compact ? 'mt-3 rounded-[16px] p-3' : 'mt-4 rounded-[18px] p-4'");
    expect(source).not.toContain('style={{ color: colors.clayDeep, lineHeight: 16 }}');
    expect(source).not.toContain("lineHeight: compact ? 15 : 18");
    expect(source).toContain('const showCompactGapOnly = compact && showGapPrompt && Boolean(spfGap)');
    expect(source).toContain('<GapPrompt compact={compact} recId={spfGap.id} />');
    expect(source).toContain('showCompactGapOnly ? null');
    expect(source).toContain('<ForYouCard compact={compact} count={result.recommendations.length} youreSet={result.youreSet} />');
    expect(source).not.toContain('hitSlop={8}');
    expect(source).not.toContain('hitSlop={6}');
    expect(source).not.toContain('className="h-[38px] items-center justify-center rounded-pill px-5"');
  });
});
