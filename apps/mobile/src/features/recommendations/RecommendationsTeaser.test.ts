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
    expect(source).toContain('numberOfLines={2}');
    expect(source).toContain('className="font-sans-bold text-[12.5px]"');
    expect(source).toContain('style={{ color: colors.clayDeep, lineHeight: 15 }}');
    expect(source).toContain('{compactTitle}');
    expect(source).toContain('className="mt-0.5 font-sans-semibold text-[12px]"');
    expect(source).toContain(
      'className="min-h-[48px] min-w-[72px] items-center justify-center rounded-full px-3"',
    );
    expect(source).toContain('{REC_COPY.gapPrompt.dismiss}');
    expect(source).toContain('className="font-sans-bold text-[12.5px]"');
    expect(source).toContain('className="mt-4 rounded-[18px] p-4"');
    expect(source).toContain(
      'className="absolute right-3 top-3 h-12 w-12 items-center justify-center rounded-full"',
    );
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.cta}');
    expect(source).toContain('accessibilityLabel={REC_COPY.gapPrompt.dismiss}');
    expect(source).toContain('style={{ minHeight: 48, backgroundColor: colors.clay }}');
    expect(source).toContain('minHeight: 48');
    expect(source).toContain('className="mb-2 flex-row items-center gap-2.5 pr-12"');
    expect(source).not.toContain(
      "'absolute right-2 top-2 h-12 w-12 items-center justify-center rounded-full'",
    );
    expect(source).not.toContain(
      'className="mt-3 flex-row items-center gap-2 rounded-[16px] p-2.5"',
    );
    expect(source).not.toContain('className="mt-2 flex-row items-center gap-2 rounded-[16px] p-1"');
    expect(source).not.toContain('className="mt-1 flex-row items-center gap-2 rounded-[16px] p-1"');
    expect(source).not.toContain('className="h-8 w-8 items-center justify-center rounded-lg"');
    expect(source).not.toContain("compact ? 'mt-3 rounded-[16px] p-3' : 'mt-4 rounded-[18px] p-4'");
    expect(source).not.toContain('style={{ color: colors.clayDeep, lineHeight: 16 }}');
    expect(source).not.toContain('lineHeight: compact ? 15 : 18');
    expect(source).toContain(
      'const showCompactGapOnly = compact && showGapPrompt && Boolean(spfGap)',
    );
    expect(source).toContain('recId={spfGap.id}');
    expect(source).toContain('onDismissFailure={markDismissFailure}');
    expect(source).toContain('onDismissSuccess={clearDismissFailure}');
    expect(source).toContain('showCompactGapOnly ? null');
    expect(source).toContain('<ForYouCard');
    expect(source).toContain('compact={compact}');
    expect(source).toContain('count={result.recommendations.length}');
    expect(source).toContain('youreSet={result.youreSet}');
    expect(source).not.toContain('hitSlop={8}');
    expect(source).not.toContain('hitSlop={6}');
    expect(source).not.toContain(
      'className="h-[38px] items-center justify-center rounded-pill px-5"',
    );
    expect(source).toContain('Suggestion not dismissed');
    expect(source).toContain('if (dismissFailed && !isSuccess)');
    expect(source).toContain(
      'const dismissFailed = controlledDismissFailed ?? localDismissFailed;',
    );
    expect(source).toContain('className="mt-2 min-h-[48px] items-center justify-center');
    expect(source).toContain('accessibilityState={{ disabled: dismissing }}');
  });

  it('keeps dismissal route-owned and single-flight across prompt unmounts', () => {
    const source = readFileSync(`${RECS_DIR}/RecommendationsTeaser.tsx`, 'utf8');
    const handler = source.slice(
      source.indexOf('const dismiss = async () => {'),
      source.indexOf('\n\n  const openRecommendation'),
    );

    expect(handler).toContain('if (dismissInFlightRef.current) return;');
    expect(handler).toContain('dismissInFlightRef.current = true;');
    expect(handler).toContain('await runRecommendationDismissalMutation');
    expect(handler).toContain('onFailure: onDismissFailure');
    expect(handler).toContain('onSuccess: onDismissSuccess');
    expect(handler).toContain("if (outcome === 'failed' && mountedRef.current)");
    expect(handler).not.toContain('await dismissRecommendation');
    expect(handler).not.toContain('await qc.invalidateQueries');

    expect(source).toContain('if (mountedRef.current) setLocalDismissFailed(true);');
    expect(source).toContain('if (mountedRef.current) setLocalDismissFailed(false);');
    expect(source.indexOf('if (mountedRef.current) setLocalDismissFailed(true);')).toBeLessThan(
      source.indexOf('onDismissFailure?.();'),
    );
    expect(source.indexOf('if (mountedRef.current) setLocalDismissFailed(false);')).toBeLessThan(
      source.indexOf('onDismissSuccess?.();'),
    );
  });

  it('reuses route-owned Shelf/profile sources while preserving the standalone teaser', () => {
    const source = readFileSync(`${RECS_DIR}/RecommendationsTeaser.tsx`, 'utf8');
    const standaloneStart = source.indexOf('export function RecommendationsTeaser(');
    const sharedStart = source.indexOf('function RecommendationsTeaserFromSourcesImpl(');
    const standalone = source.slice(standaloneStart, sharedStart);
    const shared = source.slice(sharedStart);

    expect(source).toContain('export type RecommendationsTeaserProps = {');
    expect(source).toContain('export type RecommendationsTeaserFromSourcesProps =');
    expect(source).toContain('shelf: RecommendationShelfSource;');
    expect(source).toContain('profile: RecommendationProfileSource;');
    expect(standalone).toContain('const recommendations = useRecommendations();');
    expect(standalone).toContain(
      '<RecommendationsTeaserContent {...props} recommendations={recommendations} />',
    );
    expect(shared).toContain(
      'const recommendations = useRecommendationsFromSources(shelf, profile);',
    );
    expect(shared).toContain(
      '<RecommendationsTeaserContent {...props} recommendations={recommendations} />',
    );
    expect(shared).toContain(
      'export const RecommendationsTeaserFromSources = memo(RecommendationsTeaserFromSourcesImpl);',
    );
    expect(shared).not.toContain('useRecommendations();');
  });
});
