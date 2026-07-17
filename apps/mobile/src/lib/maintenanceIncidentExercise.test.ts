import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const smokePath = fileURLToPath(
  new URL(
    '../../../../scripts/optimization/maintenance-incident-exercise-smoke.mjs',
    import.meta.url,
  ),
);

describe('maintenance incident exercise contract', () => {
  it('passes the store-only native, compatible-JS, and privacy failure drills', () => {
    const result = spawnSync(process.execPath, [smokePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

    expect(result.stdout).toContain('five content-free dashboard domains');
    expect(result.stdout).toContain('native/runtime-incompatible incident rejects OTA');
    expect(result.stdout).toContain(
      'store-only policy keeps same-runtime JS incident on binary hotfix path',
    );
    expect(result.stdout).toContain('privacy incident selects containment and review');
    expect(result.stdout).toContain('content-bearing incident fields fail closed');
    expect(result.stdout).toContain('rejects unreviewed EAS Update enablement');
  });
});
