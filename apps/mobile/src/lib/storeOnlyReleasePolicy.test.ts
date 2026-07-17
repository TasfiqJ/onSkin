import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const smokePath = fileURLToPath(
  new URL(
    '../../../../scripts/optimization/store-only-release-audit-smoke.mjs',
    import.meta.url,
  ),
);

describe('store-only release policy', () => {
  it('passes the accepted policy and rejects every OTA configuration drift', () => {
    const result = spawnSync(process.execPath, [smokePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

    expect(result.stdout).toContain('accepted store-only release policy passes');
    expect(result.stdout).toContain('enabled Expo updates fail closed');
    expect(result.stdout).toContain('unexpected update URL fails closed');
    expect(result.stdout).toContain('direct expo-updates dependency fails closed');
    expect(result.stdout).toContain('unexpected EAS channel fails closed');
    expect(result.stdout).toContain('maintenance release-policy drift fails closed');
  });
});
