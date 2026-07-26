import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Conflict route contracts', () => {
  it('keeps conflict detail and share-card exits safe for direct entry', () => {
    for (const route of ['conflict/[ruleId].tsx', 'share/conflict/[ruleId].tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should not depend on direct-entry history`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should recover direct entries to Shelf`).toContain(
        'APP_SHELF_ROUTE',
      );
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_SHELF_ROUTE)',
      );
    }
  });

  it('returns deferred share-card direct entries to Shelf', () => {
    const source = readAppRoute('share/conflict/[ruleId].tsx');

    expect(source).toContain('surface="shareCard"');
    expect(source).toContain('fallbackRoute={APP_SHELF_ROUTE}');
    expect(source).toContain('fallbackLabel="Back to Shelf"');
  });

  it('keeps share-card export recovery inline on the share route', () => {
    const source = readAppRoute('share/conflict/[ruleId].tsx');

    expect(source).toContain('const [shareFeedback, setShareFeedback]');
    expect(source).toContain('SHARE_LINK_UNAVAILABLE_MESSAGE');
    expect(source).toContain('SHARE_UNAVAILABLE_MESSAGE');
    expect(source).toContain('setShareFeedback({');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('shareCardUserMessage()');
    expect(source).not.toContain('Alert.alert');
  });

  it('recovers missing conflict-detail routes without stale guidance', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('This timing note is no longer active.');
    expect(source).toContain(
      'Your shelf or safety setting has changed since this note was created.',
    );
    expect(source).toContain('old links');
    expect(source).toContain('Back to Shelf');
    expect(source).toContain('Add a product');
    expect(source).toContain('router.replace(APP_SHELF_ROUTE)');
    expect(source).toContain("router.replace('/shelf/manual')");
    expect(source).not.toContain('This conflict is no longer on your shelf.');
    expect(source).not.toContain(
      'Your shelf no longer has the product pair that created this note.',
    );
    expect(source).not.toContain('<Button label="Close" variant="ghost" onPress={onDismiss} />');
  });

  it('keeps safety copy corpus-bound and exposes no safety override', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('label={r.copy.primaryActionLabel}');
    expect(source).toContain("router.push('/settings/skin-profile?returnTo=shelf')");
    expect(source).not.toContain('Keep it on my shelf');
    expect(source).not.toContain('talk to your doctor');
  });

  it('does not claim conflict-detail placement without scheduler output', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('return conflict.rule.copy.resolution;');
    expect(source).not.toMatch(/Already in your plan|already reflected/i);
    expect(source).not.toContain('Retinol on cycling night 2, glycolic on night 1');
    expect(source).not.toContain("We've left both in your AM routine");
  });

  it('renders interaction-specific claim copy only from the canonical corpus', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('{r.copy.mechanism}');
    expect(source).toContain('{r.copy.resolution}');
    expect(source).toContain('{r.copy.sourceLimitationTitle}');
    expect(source).toContain('{r.copy.sourceLimitationBody}');
    expect(source).toContain('r.copy.overrideActionLabel ?');
    expect(source).not.toContain('const COPY:');
    expect(source).not.toContain('CopyOverride');
    expect(source).not.toContain('dermatology literature review, 2025');
    expect(source).not.toContain('copy.mechanism ??');
    expect(source).not.toContain('copy.suggestion ??');
    expect(source).not.toContain('noteForTags');
    expect(source).not.toContain('InContextNote');
    expect(source).not.toContain('Refuted myth');
    expect(source).not.toContain('Use together anyway');
  });

  it('keeps direct conflict details behind the launch-gated shelf conflict source', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain("from '@/features/shelf/useShelf';");
    expect(source).toContain('const { data } = useShelf();');
    expect(source).toContain('const requestedPair =');
    expect(source).toContain('isAdmittedDetectedConflict(candidate)');
    expect(source).toContain('ruleMatches.length === 1');
    expect(source).toContain("sort().join('+')");
    expect(source).toContain('requestedPair,');
    expect(source).not.toContain('STARTER_RULES');
    expect(source).not.toContain('previewDetectConflicts(');
    expect(source).not.toContain('shippableRules(');
  });

  it('routes shelf conflicts by rule and exact unordered product pair', () => {
    const shelf = readAppRoute('(tabs)/shelf.tsx');
    const product = readAppRoute('shelf/[id].tsx');
    const detail = readAppRoute('conflict/[ruleId].tsx');
    const identity = readFileSync(
      `${APP_DIR}/../features/intelligence/conflictIdentity.ts`,
      'utf8',
    );

    expect(identity).toContain('export function conflictDetailRoute');
    expect(identity).toContain('productAId: c.productAId');
    expect(identity).toContain('productBId: c.productBId');
    expect(identity).toContain('const subjectProductId = c.productAId ?? c.productBId');
    expect(detail).toContain('subjectProductId?: string | string[];');
    expect(detail).toContain('candidate.productAId === subjectProductId');
    expect(shelf).toContain('router.push(conflictDetailRoute(data.banner!))');
    expect(product).toContain('router.push(conflictDetailRoute(c))');
  });

  it('shows the Shelf review state only when an assessable pair is unsupported', () => {
    const shelf = readAppRoute('(tabs)/shelf.tsx');

    expect(shelf).toContain("data?.conflictCoverageStatus === 'unsupported_unreviewed'");
    expect(shelf).toContain('data.unsupportedConflictPairs.length > 0');
  });

  it('preserves exact pair identity when opening a share card', () => {
    const detail = readAppRoute('conflict/[ruleId].tsx');
    const share = readAppRoute('share/conflict/[ruleId].tsx');

    expect(detail).toContain('router.push(conflictShareRoute(conflict))');
    expect(share).toContain('const requestedPair =');
    expect(share).toContain('isAdmittedDetectedConflict(candidate)');
    expect(share).toContain('ruleMatches.length === 1');
    expect(share).toContain("sort().join('+')");
    expect(share).toContain('requestedPair,');
  });

  it('keeps recommendation conflict routes tied to the detected product pair', () => {
    const route = readAppRoute('recommendations/[id].tsx');
    const engine = readFileSync(`${APP_DIR}/../features/recommendations/engine.ts`, 'utf8');

    expect(engine).toContain('relatedConflictProductIds: [string, string] | null;');
    expect(engine).toContain('const id = `conflict:${conflictKey(topConflict)}`;');
    expect(engine).toContain('relatedConflictProductIds: productIds');
    expect(route).toContain(
      'const [productAId, productBId] = rec.relatedConflictProductIds ?? [];',
    );
    expect(route).toContain('...(productAId && productBId ? { productAId, productBId } : {})');
  });

  it('emits no telemetry from any conflict-only route', () => {
    for (const route of [
      'conflict/[ruleId].tsx',
      'share/conflict/[ruleId].tsx',
      's/[shareId].tsx',
    ]) {
      const source = readAppRoute(route);
      expect(source).not.toContain("from '@/lib/analytics/track'");
      expect(source).not.toMatch(/\btrack\(/u);
      expect(source).not.toContain('trackProductAddStarted');
    }
  });

  it('creates an opaque conflict-share URL without attribution metadata', () => {
    const source = readFileSync(`${APP_DIR}/../features/growth/shareLinks.ts`, 'utf8');

    expect(source).toContain('buildPublicGrowthUrl(`/s/${shareId}`, {})');
    expect(source).not.toContain('campaign:');
    expect(source).not.toContain('content:');
    expect(source).not.toContain('creative_variant:');
    expect(source).not.toContain('share_id:');
  });

  it('uses only admitted conflicts and canonical corpus copy in recommendations', () => {
    const source = readFileSync(`${APP_DIR}/../features/recommendations/engine.ts`, 'utf8');

    expect(source).toContain('isAdmittedDetectedConflict(conflict)');
    expect(source).toContain('evidence: topConflict.rule.copy.resolution');
    expect(source).not.toContain('evidence: topConflict.rule.resolutionCopy');
  });

  it('keeps candidate-rule injection out of production plan and recommendation APIs', () => {
    const featureDir = `${APP_DIR}/../features`;
    const productionConsumers = [
      readFileSync(`${featureDir}/routine/generate.ts`, 'utf8'),
      readFileSync(`${featureDir}/scheduler/orchestrate.ts`, 'utf8'),
      readFileSync(`${featureDir}/recommendations/engine.ts`, 'utf8'),
    ];

    for (const source of productionConsumers) {
      expect(source).not.toContain('STARTER_RULES');
      expect(source).not.toContain('previewConflictRules');
      expect(source).not.toContain('previewDetectConflicts');
      expect(source).not.toMatch(/export function preview(?:GeneratePlan|Orchestrate|Recommend)/u);
    }
  });

  it('persists locally before navigation and recovers failed encrypted writes inline', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');
    const privateKV = readFileSync(`${APP_DIR}/../lib/storage/privateKV.ts`, 'utf8');
    const writeIndex = source.indexOf('await setConflictChoice(c, userChoice);');
    const cacheIndex = source.indexOf('qc.setQueryData<ShelfData>', writeIndex);
    const dismissIndex = source.indexOf('onDismiss();', cacheIndex);

    expect(writeIndex).toBeGreaterThan(-1);
    expect(cacheIndex).toBeGreaterThan(writeIndex);
    expect(dismissIndex).toBeGreaterThan(cacheIndex);
    expect(source).toContain('if (saveInFlight.current) return;');
    expect(source).toContain('applyConflictChoicesToShelfData(current, conflictChoices)');
    expect(source).not.toContain("invalidateQueries({ queryKey: ['shelf'] })");
    expect(privateKV).toContain('EXPO_PUBLIC_E2E_CONFLICT_CHOICE_SAVE_FAILURE');
    expect(privateKV).toContain('await new Promise((resolve) => setTimeout(resolve, 600));');
    expect(privateKV).toContain('key !== CONFLICT_CHOICE_STORAGE_KEY');
    expect(source).toContain('Choice not saved');
    expect(source).toContain('Your previous schedule is unchanged. Try again.');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).not.toContain('.upsert(');
    expect(source).not.toContain('routine_conflicts');
    expect(source).toContain('local-only');
  });

  it('names the exact shelf products before a timing choice is made', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('function conflictProductPairLabel');
    expect(source).toContain('Your products');
    expect(source).toContain('{productPairLabel}');
    expect(source).toContain('function conflictSuggestion');
    expect(source).toContain('return conflict.rule.copy.resolution;');
    expect(source).toContain(
      "[familyTitle(conflict), productPairLabel].filter(Boolean).join('. ')",
    );
  });

  it('keeps dense conflict sheets scrollable and actions touchable on short phones', () => {
    const source = readAppRoute('conflict/[ruleId].tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('const { height: viewportHeight } = useWindowDimensions();');
    expect(source).toContain('const insets = useSafeAreaInsets();');
    expect(source).toContain(
      'const sheetMaxHeight = viewportHeight > 44 ? viewportHeight - 44 : 524;',
    );
    expect(source).toContain('const dialogLabel = conflict');
    expect(source).toContain('const compactMissingConflict = !conflict && viewportHeight < 520;');
    expect(source).toContain('const missingConflictActions = (');
    expect(source).toContain('const missingConflictAdviceCard = (');
    expect(source).toContain(
      '{compactMissingConflict ? missingConflictActions : missingConflictAdviceCard}',
    );
    expect(source).toContain(
      '{compactMissingConflict ? missingConflictAdviceCard : missingConflictActions}',
    );
    expect(source).toContain('insets.bottom > 0 ? Math.max(40, insets.bottom + 24) : undefined');
    expect(source).toContain('aria-modal');
    expect(source).toContain('role="dialog"');
    expect(source).toContain('accessibilityLabel={dialogLabel}');
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).toContain('onAccessibilityEscape={onDismiss}');
    expect(source).toContain('nativeID="conflict-choice-dialog"');
    expect(source).toContain("dialog?.addEventListener('keydown', trapFocus)");
    expect(source).toContain("if (event.key === 'Escape')");
    expect(source).toContain('event.stopPropagation();');
    expect(source).toContain('if (active === dialog || !dialog.contains(active))');
    expect(source).toContain('(event.shiftKey ? last : first).focus();');
    expect(source).toContain('AccessibilityInfo.setAccessibilityFocus(handle)');
    expect(source).toContain('aria-hidden');
    expect(source).toContain('accessibilityElementsHidden');
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain('maxHeight: sheetMaxHeight');
    expect(source).toContain('<ScrollView');
    expect(source).toContain('contentContainerClassName="pb-10"');
    expect(source).toContain('paddingBottom: contentPaddingBottom');
    expect(source).toContain('className="min-h-[48px] items-center justify-center py-2"');
    expect(source).toContain('className="mt-4 min-h-[48px] items-center justify-center"');
    expect(source).not.toContain('const sheetMaxHeight = Math.max(320, height - 24)');
    expect(source).not.toContain('height - 24');
    expect(source).not.toContain('viewportHeight > 0 ? Math.max(0, viewportHeight - 44) : 524');
    expect(source).not.toContain('className="items-center py-2"');
    expect(source).not.toContain('className="mt-4 items-center"');
  });
});
