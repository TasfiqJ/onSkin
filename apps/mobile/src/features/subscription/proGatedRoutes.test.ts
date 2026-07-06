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

  expect(source, `${path} should use the shared 44pt route button`).toContain(
    'RouteIconButton',
  );
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
    expect(tolerance, 'routine/tolerance.tsx should keep text exits at least 44px tall').toContain(
      'min-h-[44px] min-w-[44px]',
    );
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

    const phasedIntro = readAppRoute('cycle/phased-intro.tsx');
    expect(phasedIntro).toContain('min-h-[44px] items-center justify-center');
  });

  it('keeps the widgets Live Activity opt-in on the 44px shared switch', () => {
    const source = readAppRoute('routine/widgets.tsx');

    expect(source).toContain('ToggleSwitch');
    expect(source).toContain('accessibilityLabel="Show on the Lock Screen"');
    expect(source).not.toContain('<Switch');
    expect(source).not.toContain('onValueChange');
  });
});
