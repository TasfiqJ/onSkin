import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('persistent routine order route contracts', () => {
  it('edits complete product-id steps in independent Morning and Evening modes', () => {
    const source = readSource('app/routine/reorder.tsx');

    expect(source).toContain('type PhaseSteps = Record<RoutineOrderPhase, PlanStep[]>');
    expect(source).toContain("(['am', 'pm'] as const).map");
    expect(source).toContain('accessibilityRole="tablist"');
    expect(source).toContain('aria-selected={selected}');
    expect(source).toContain('key={step.productId}');
    expect(source).toContain('canonicalPlan.am');
    expect(source).toContain('canonicalPlan.pm');
    expect(source).not.toContain('key={name}');
    expect(source).not.toContain('data?.plan.am.map((step) => step.name)');
  });

  it('awaits the encrypted save before updating cache, tracking success, and leaving', () => {
    const source = readSource('app/routine/reorder.tsx');
    const saveIndex = source.indexOf('const saved = await saveRoutineOrderOverrides');
    const cacheIndex = source.indexOf('queryClient.setQueryData', saveIndex);
    const trackIndex = source.indexOf("track('routine_edited'", cacheIndex);
    const exitIndex = source.indexOf('backOrReplace(router);', trackIndex);

    expect(saveIndex).toBeGreaterThan(-1);
    expect(source).toContain('if (saveInFlight.current || persistenceUnavailable) return;');
    expect(source).toContain('saveInFlight.current = true;');
    expect(source).toContain('saveInFlight.current = false;');
    expect(cacheIndex).toBeGreaterThan(saveIndex);
    expect(trackIndex).toBeGreaterThan(cacheIndex);
    expect(exitIndex).toBeGreaterThan(trackIndex);
    expect(source).toContain('Order not saved');
    expect(source).toContain('Your previous routine is still in place. Try Save again.');
    expect(source).toContain('EXPO_PUBLIC_E2E_ROUTINE_ORDER_SAVE_FAILURE');
  });

  it('applies overrides centrally without changing canonical cycle-night authority', () => {
    const usePlan = readSource('features/routine/usePlan.ts');
    const today = readSource('app/(tabs)/today.tsx');

    expect(usePlan).toContain('applyRoutineOrderOverrides(canonicalPlan, orderOverrides)');
    expect(usePlan).toContain('canonicalPlan,');
    expect(today).toContain('const scheduledCyclePlanStep =');
    expect(today).toContain('order: scheduledCyclePlanStep?.order ?? 40');
    expect(today).toContain('cTonight?.night.productId');
    expect(today).toContain("const hasScheduledRetinoid = cycledStep?.role === 'treatment';");
    expect(today).toContain('pmDisplaySub(s, hasScheduledRetinoid)');
  });

  it('offers phase-specific editor entry points from the generated Plan', () => {
    const source = readSource('app/routine/plan.tsx');

    expect(source).toContain("router.push('/routine/reorder?phase=am')");
    expect(source).toContain("router.push('/routine/reorder?phase=pm')");
    expect(source).toContain('Edit morning application order');
    expect(source).toContain('Edit evening application order');
  });
});
