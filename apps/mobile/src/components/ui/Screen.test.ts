import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./Screen.tsx', import.meta.url)), 'utf8');

describe('Screen background', () => {
  it('sets an explicit full-screen color in addition to utility classes', () => {
    expect(source).toContain("tone === 'night' ? colors.night : colors.paper");
    expect(source).toContain("tone === 'night' ? 'bg-night' : 'bg-paper'");
  });
});
