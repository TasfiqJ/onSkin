import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));

function readFeatureSource(path: string): string {
  return readFileSync(`${FEATURE_DIR}/${path}`, 'utf8');
}

describe('cycle analytics minimization', () => {
  it('does not send irritation or recovery-duration details to analytics', () => {
    const source = readFeatureSource('useCycle.ts');

    expect(source).toContain("track('cycle_paused')");
    expect(source).toContain("track('cycle_recovery_started')");
    expect(source).not.toContain('cycle_deescalated');
    expect(source).not.toContain("track('cycle_paused', { reason })");
    expect(source).not.toContain('{ reason, days }');
  });
});
