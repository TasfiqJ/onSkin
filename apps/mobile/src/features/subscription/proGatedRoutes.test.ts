import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function expectNoRawBack(path: string) {
  expect(
    readAppRoute(path),
    `${path} should use backOrReplace for direct-entry exits`,
  ).not.toContain('router.back()');
}

function expectTouchableRouteIcon(path: string) {
  const source = readAppRoute(path);

  expect(source, `${path} should use the shared 44pt route button`).toContain('RouteIconButton');
  expect(source, `${path} should not rely on small hit slop for route exits`).not.toContain(
    'hitSlop={8}',
  );
}

describe('Pro-gated route contracts', () => {
  it('gates the full cycle route group, not only the week overview', () => {
    const layout = readAppRoute('cycle/_layout.tsx');

    expect(layout).toMatch(/<ProGate\s+feature=["']scheduler["']/);
    for (const route of [
      'week',
      'settings',
      'procedure',
      'recovery',
      'why-tonight',
      'disruption',
      'phased-intro',
    ]) {
      expect(layout).toMatch(new RegExp(`name=["']${route}["']`));
    }
  });

  it('gates the routine route group through the contextual route mapper', () => {
    const layout = readAppRoute('routine/_layout.tsx');

    expect(layout).toContain('<ProGate feature={routineGateFeatureForPath(pathname)}>');
  });

  it('gates conflict details after the free conflict-check quota is used', () => {
    const route = readAppRoute('conflict/[ruleId].tsx');

    expect(route).toContain('conflictCheckAccess');
    expect(route).toContain('recordFreeConflictCheckRuleId');
    expect(route).toContain('<ProGate feature="conflict_checks">');
  });

  it('keeps scheduler and routine exits safe for direct-entry Pro users', () => {
    for (const route of [
      'cycle/week.tsx',
      'cycle/settings.tsx',
      'cycle/procedure.tsx',
      'cycle/recovery.tsx',
      'cycle/why-tonight.tsx',
      'cycle/disruption.tsx',
      'cycle/phased-intro.tsx',
      'routine/plan.tsx',
      'routine/reorder.tsx',
      'routine/ramp.tsx',
      'routine/tolerance.tsx',
      'routine/adaptation.tsx',
      'routine/streak.tsx',
      'routine/widgets.tsx',
    ]) {
      expectNoRawBack(route);
    }
  });

  it('keeps scheduler and routine route exits touchable on phones', () => {
    for (const route of [
      'cycle/week.tsx',
      'cycle/settings.tsx',
      'cycle/procedure.tsx',
      'cycle/recovery.tsx',
      'routine/plan.tsx',
      'routine/ramp.tsx',
      'routine/streak.tsx',
      'routine/widgets.tsx',
    ]) {
      expectTouchableRouteIcon(route);
    }

    const reorder = readAppRoute('routine/reorder.tsx');
    expect(reorder, 'routine/reorder.tsx should buffer text exits above sub-pixel 44px').toContain(
      'min-h-[48px] min-w-[48px]',
    );
    expect(reorder).toContain('className="h-[48px] flex-1');
    expect(reorder).not.toContain('className="h-[44px] flex-1');
    expect(reorder).not.toContain('className="h-9 flex-1');

    const tolerance = readAppRoute('routine/tolerance.tsx');
    expect(
      tolerance,
      'routine/tolerance.tsx should buffer text exits above sub-pixel 44px targets',
    ).toContain('min-h-[48px] min-w-[48px]');
    expect(tolerance).not.toContain(
      'className="mb-1 min-h-[44px] min-w-[44px] self-end items-center justify-center px-2"',
    );
  });

  it('keeps routine intelligence screens bound to generated plan data', () => {
    const plan = readAppRoute('routine/plan.tsx');
    expect(plan).toContain('APP_YOU_ROUTE');
    expect(plan).toContain('backOrReplace(router, APP_YOU_ROUTE)');
    expect(plan).toContain("import { startCycleToday } from '@/features/scheduler/cycleStore';");
    expect(plan).toContain('async function startToday()');
    expect(plan).toContain('await startCycleToday();');
    expect(plan).not.toContain("import { setCycleAnchor } from '@/features/routine/cycleAnchor';");
    expect(plan).not.toContain('void setCycleAnchor();');
    expect(plan).toContain('RouteIconButton');
    expect(plan).toContain('ScrollView');
    expect(plan).toContain('useWindowDimensions');
    expect(plan).toContain('const compactPlan = height < 640');
    expect(plan).toContain('const planScrollBottomPadding = compactPlan ? 144 : 112');
    expect(plan).toContain('const hasCycle = plan?.cycle != null');
    expect(plan).toContain("const hasBarrierStep = plan?.pm.some((s) => s.role === 'moisturiser')");
    expect(plan).toContain("{hasCycle ? 'Evening · skin cycling' : 'Evening'}");
    expect(plan).toContain('{hasCycle ? (');
    expect(plan).toContain("{hasBarrierStep ? 'moisturiser only' : 'keep it simple'}");
    expect(plan).toContain('No night steps yet.');
    expect(plan).not.toContain('suffix="ceramide only"');
    expect(plan).toContain('style={{ overflow:');
    expect(plan).toContain(
      'contentContainerStyle={{ flexGrow: 1, paddingBottom: planScrollBottomPadding }}',
    );
    expect(plan).toContain('backgroundColor: colors.paper');
    expect(plan).toContain('marginHorizontal: -24');
    expect(plan).toContain('paddingHorizontal: 24');
    expect(plan).toContain("'mt-3.5 flex-row gap-2.5 rounded-2xl");
    expect(plan).not.toContain('contentContainerClassName="pb-6"');
    expect(plan).not.toContain('contentContainerClassName="pb-[112px]"');
    expect(plan).not.toContain("'mt-8 flex-row gap-2.5 rounded-2xl");
    expect(plan).not.toContain('className="pb-9"');

    const adaptation = readAppRoute('routine/adaptation.tsx');
    expect(adaptation).toContain('usePlan');
    expect(adaptation).not.toContain('Azelaic Acid 10%');
    expect(adaptation).not.toContain('Azelaic plays well');

    const reorder = readAppRoute('routine/reorder.tsx');
    expect(reorder).toContain('usePlan');
    expect(reorder).toContain('ScrollView');
    expect(reorder).not.toContain("const CANONICAL = ['Cream cleanser'");
    expect(reorder).not.toContain("const REORDERED = ['Cream cleanser'");
    expect(reorder).not.toContain('Vitamin C serum');

    expect(adaptation).toContain('ScrollView');
  });

  it('keeps scheduler and routine sheets reachable on short phones', () => {
    for (const route of [
      'cycle/why-tonight.tsx',
      'cycle/disruption.tsx',
      'cycle/phased-intro.tsx',
      'routine/tolerance.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should use capped sheet scrolling`).toContain('scroll');
      expect(source, `${route} should keep a safe Today fallback`).toContain(
        'fallbackRoute={APP_HOME_ROUTE}',
      );
    }

    const disruption = readAppRoute('cycle/disruption.tsx');
    expect(disruption).toContain('useWindowDimensions');
    expect(disruption).toContain('const compactSheet = height < 640');
    expect(disruption).toContain('backdropAccessible={!compactSheet}');
    expect(disruption).toContain("className={compactSheet ? 'pb-6' : undefined}");
    expect(disruption).toContain("className={compactSheet ? 'mt-4 gap-2' : 'mt-6 gap-2.5'}");
    expect(disruption).toContain("'min-h-[72px] gap-3 px-3.5 py-3'");
    expect(disruption).toContain('accessibilityLabel={`${title}. ${sub}`}');
    expect(disruption).toContain('compact={compactSheet}');
    expect(disruption).not.toContain('<Sheet fallbackRoute={APP_HOME_ROUTE} scroll>');

    const phasedIntro = readAppRoute('cycle/phased-intro.tsx');
    expect(phasedIntro).toContain('useWindowDimensions');
    expect(phasedIntro).toContain('const compactSheet = height < 640');
    expect(phasedIntro).toContain('backdropAccessible={!compactSheet}');
    expect(phasedIntro).toContain("className={compactSheet ? 'pb-6' : undefined}");
    expect(phasedIntro).toContain("className={compactSheet ? 'mt-4' : 'mt-6'}");
    expect(phasedIntro).toContain("className={compactSheet ? 'min-h-[48px] py-3' : undefined}");
    expect(phasedIntro).toContain('compact={compactSheet}');
    expect(phasedIntro).toContain('min-h-[48px] items-center justify-center');
    expect(phasedIntro).not.toContain('min-h-[44px] items-center justify-center');
    expect(phasedIntro).not.toContain('<Sheet fallbackRoute={APP_HOME_ROUTE} scroll>');

    const recovery = readAppRoute('cycle/recovery.tsx');
    expect(recovery).toContain('useWindowDimensions');
    expect(recovery).toContain('const compactScreen = height < 640');
    expect(recovery).toContain("contentContainerClassName={compactScreen ? 'pb-5' : 'pb-6'}");
    expect(recovery).toContain("className={compactScreen ? 'mt-4' : 'mt-6'}");

    const tolerance = readAppRoute('routine/tolerance.tsx');
    expect(tolerance).toContain('useWindowDimensions');
    expect(tolerance).toContain('const compactSheet = height < 640');
    expect(tolerance).toContain('backdropAccessible={!compactSheet}');
    expect(tolerance).toContain("className={compactSheet ? 'pb-6' : undefined}");
    expect(tolerance).toContain("className={compactSheet ? 'mt-4 gap-2' : 'mt-6 gap-2.5'}");
    expect(tolerance).toContain("'h-[72px] min-h-[72px] gap-3 px-3.5 py-2.5'");
    expect(tolerance).toContain('accessibilityLabel={`${o.title}. ${o.sub}`}');
    expect(tolerance).toContain(
      "className={compactSheet ? 'mt-3 h-[48px] min-h-[48px] py-2.5' : 'mt-6'}",
    );
    expect(tolerance).not.toContain('<Sheet fallbackRoute={APP_HOME_ROUTE} scroll>');
  });

  it('keeps the widgets Live Activity opt-in on the 44px shared switch', () => {
    const source = readAppRoute('routine/widgets.tsx');

    expect(source).toContain('ToggleSwitch');
    expect(source).toContain('accessibilityLabel="Show on the Lock Screen"');
    expect(source).not.toContain('<Switch');
    expect(source).not.toContain('onValueChange');
  });
});
