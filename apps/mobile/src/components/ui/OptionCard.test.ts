import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('OptionCard controls', () => {
  it('keeps default and compact option cards large enough for phone taps', () => {
    const source = readFileSync(`${UI_DIR}/OptionCard.tsx`, 'utf8');

    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityState={{ selected, disabled }}');
    expect(source).toContain('disabled={disabled}');
    expect(source).toContain('accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}');
    expect(source).toContain('compact?: boolean;');
    expect(source).toContain('tight?: boolean;');
    expect(source).toContain("'min-h-[52px] px-4 py-2'");
    expect(source).toContain("? 'min-h-[60px] px-5 py-3'");
    expect(source).toContain(": 'min-h-[64px] px-5 py-4'");
    expect(source).not.toContain('min-h-[44px]');
    expect(source).not.toContain('min-h-[48px]');
  });
});
