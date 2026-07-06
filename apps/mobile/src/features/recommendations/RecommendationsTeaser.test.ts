import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RECS_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('RecommendationsTeaser mobile contracts', () => {
  it('keeps the Today SPF prompt actions touchable on phones', () => {
    const source = readFileSync(`${RECS_DIR}/RecommendationsTeaser.tsx`, 'utf8');

    expect(source).toContain('accessibilityLabel="Dismiss SPF recommendation"');
    expect(source).toContain('className="absolute right-3 top-3 h-12 w-12');
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.cta}');
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.dismiss}');
    expect(source).toContain('style={{ minHeight: 48, backgroundColor: colors.clay }}');
    expect(source).toContain('minHeight: 48');
    expect(source).toContain('className="mb-2 flex-row items-center gap-2.5 pr-12"');
    expect(source).not.toContain('hitSlop={8}');
    expect(source).not.toContain('hitSlop={6}');
    expect(source).not.toContain('className="h-[38px] items-center justify-center rounded-pill px-5"');
  });
});
