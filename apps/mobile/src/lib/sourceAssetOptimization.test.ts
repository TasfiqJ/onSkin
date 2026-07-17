import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const optimizerPath = resolve(repositoryRoot, 'scripts/optimization/optimize-png-assets.mjs');
const activePngSources = [
  'apps/mobile/assets/images/icon.png',
  'apps/mobile/assets/images/splash-icon.png',
  'apps/mobile/assets/images/android-icon-foreground.png',
  'apps/mobile/assets/images/android-icon-background.png',
  'apps/mobile/assets/images/android-icon-monochrome.png',
  'apps/mobile/assets/images/favicon.png',
  'apps/mobile/assets/expo.icon/Assets/grid.png',
];

type OptimizationSummary = {
  assets: Array<{ path: string; savedBytes: number }>;
  savedBytes: number;
};

describe('source PNG optimization contract', () => {
  it('covers every configured PNG and rejects remaining lossless bytes', () => {
    const result = spawnSync(process.execPath, [optimizerPath, '--check', '--json'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 25_000,
    });
    if (result.status !== 0) {
      throw new Error(`${result.stdout}\n${result.stderr}`);
    }

    const summary = JSON.parse(result.stdout) as OptimizationSummary;
    expect(summary.assets.map((asset) => asset.path)).toEqual(activePngSources);
    expect(summary.savedBytes).toBe(0);
    expect(summary.assets.every((asset) => asset.savedBytes === 0)).toBe(true);

    const appBase = readFileSync(resolve(repositoryRoot, 'apps/mobile/app.base.json'), 'utf8');
    for (const path of activePngSources.filter((path) => path.includes('/images/'))) {
      expect(appBase).toContain(path.replace('apps/mobile/', './'));
    }

    const iconComposerConfig = readFileSync(
      resolve(repositoryRoot, 'apps/mobile/assets/expo.icon/icon.json'),
      'utf8',
    );
    expect(iconComposerConfig).toContain('"grid.png"');
  }, 30_000);
});
