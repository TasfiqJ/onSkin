import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const smokePath = fileURLToPath(
  new URL(
    '../../../../../scripts/optimization/secure-startup-audit-smoke.mjs',
    import.meta.url,
  ),
);

describe('secure startup audit', () => {
  it('passes the fixed contract and rejects gate, marker, and truth-table drift', () => {
    const result = spawnSync(process.execPath, [smokePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`);

    expect(result.stdout).toContain('13 fixed content-free milestones pass');
    expect(result.stdout).toContain('navigation escaping the secure gates fails closed');
    expect(result.stdout).toContain('dynamic startup marker content fails closed');
    expect(result.stdout).toContain('incomplete startup truth table fails closed');
    expect(result.stdout).toContain('authorization-gate relaxation fails closed');
  });
});
