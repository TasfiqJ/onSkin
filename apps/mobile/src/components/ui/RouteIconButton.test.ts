import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('RouteIconButton', () => {
  it('keeps route escape controls comfortably touchable on phones', () => {
    const source = readFileSync(`${UI_DIR}/RouteIconButton.tsx`, 'utf8');

    expect(source).toContain('width: 48');
    expect(source).toContain('height: 48');
    expect(source).toContain('borderRadius: 24');
    expect(source).toContain('accessibilityRole="button"');
  });
});
