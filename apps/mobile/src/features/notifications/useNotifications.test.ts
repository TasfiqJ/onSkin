import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./useNotifications.ts', import.meta.url)),
  'utf8',
);

describe('notification preference foreground contract', () => {
  it('refetches on every foreground transition even while the local query is fresh', () => {
    expect(source).toContain("refetchOnWindowFocus: 'always'");
  });
});
