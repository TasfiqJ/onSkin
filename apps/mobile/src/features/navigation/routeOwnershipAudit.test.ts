import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type AuditResult = {
  oversizedRouteCount: number;
  measuredRouteCount: number;
  measuredRoutes: { route: string; pass: boolean }[];
  unmeasuredOversizedRoutes: { path: string }[];
  pass: boolean;
};

const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const auditPath = fileURLToPath(
  new URL('../../../../../scripts/optimization/route-ownership-audit.mjs', import.meta.url),
);
const measuredRoutes = [
  'apps/mobile/src/app/(tabs)/today.tsx',
  'apps/mobile/src/app/(tabs)/progress.tsx',
  'apps/mobile/src/app/(tabs)/shelf.tsx',
  'apps/mobile/src/app/ask/index.tsx',
  'apps/mobile/src/app/shelf/search.tsx',
  'apps/mobile/src/app/shelf/ocr.tsx',
  'apps/mobile/src/app/(tabs)/you.tsx',
];

describe('measured route ownership audit', () => {
  it('retains every profiler- or test-proven split without treating line count as proof', () => {
    const result = spawnSync(process.execPath, [auditPath, '--json'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

    const audit = JSON.parse(result.stdout) as AuditResult;
    expect(audit.pass).toBe(true);
    expect(audit.measuredRouteCount).toBe(measuredRoutes.length);
    expect(audit.measuredRoutes.map((route) => route.route)).toEqual(measuredRoutes);
    expect(audit.measuredRoutes.every((route) => route.pass)).toBe(true);
    expect(audit.oversizedRouteCount).toBeGreaterThan(audit.measuredRouteCount);
    expect(audit.unmeasuredOversizedRoutes).toContainEqual({
      path: 'apps/mobile/src/app/progress/capture.tsx',
      lines: expect.any(Number),
    });
  });
});
