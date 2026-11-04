import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = mkdtempSync(join(tmpdir(), 'optional-change41-vitest-'));
const config = join(directory, 'ui.config.mjs');
try {
  const root = resolve('apps/mobile');
  writeFileSync(config, 'export default ' + JSON.stringify({ root,
    resolve: { alias: { '@': join(root, 'src') } },
    test: { environment: 'node', include: ['src/features/today/OptionalChangePanel41.test.tsx', 'src/features/routine/PlanHistoryPanel45.test.tsx'] }
  }) + ';\n');
  const result = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'),
    'run', '--config', config, '--passWithNoTests=false', '--reporter=verbose'],
    { stdio: 'inherit', timeout: 120000 });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(config);
  rmdirSync(directory);
}
