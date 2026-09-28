import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const source = readFileSync(
  fileURLToPath(new URL('../../app/(tabs)/_layout.tsx', import.meta.url)),
  'utf8',
);
describe('V1 tab navigation', () => {
  it('uses one floating navigator with full labels', () => {
    for (const label of ['Today', 'Progress', 'Shelf', 'You']) {
      expect(source).toContain(`title: '${label}'`);
      expect(source).toContain(`name="${label.toLowerCase()}"`);
    }
    expect(source).not.toContain('NativeTabs');
    expect(source).not.toContain('Prog.');
  });
  it('preserves owner-bound lifecycle cancellation and local reminders', () => {
    expect(source).toContain('runAccountGenerationOperation(async (lease) =>');
    expect(source).toContain('lease.assertCurrent();');
    expect(source).toContain('mounted = false');
    expect(source).toContain('if (!mounted || !route) return;');
    expect(source).toContain('<BehaviouralTriggers />');
  });
});
