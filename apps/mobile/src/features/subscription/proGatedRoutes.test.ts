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
});
