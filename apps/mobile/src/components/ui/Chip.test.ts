import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('Chip controls', () => {
  it('keeps multi-select chips at least 44px tall on phones', () => {
    const source = readFileSync(`${UI_DIR}/Chip.tsx`, 'utf8');

    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityLabel={label}');
    expect(source).toContain('aria-pressed={selected}');
    expect(source).toContain('style={{ minHeight: 48 }}');
    expect(source).toContain('min-h-[48px] items-center justify-center');
    expect(source).not.toContain('min-h-[40px]');
  });

  it('keeps segment chips at least 44px tall on phones', () => {
    const source = readFileSync(`${UI_DIR}/SegmentChip.tsx`, 'utf8');

    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityLabel={accessibilityLabel ?? label}');
    expect(source).toContain('accessibilityLabel?: string;');
    expect(source).toContain('aria-pressed={selected}');
    expect(source).toContain('style={{ minHeight: 48 }}');
    expect(source).toContain('min-h-[48px] justify-center');
    expect(source).not.toContain('min-h-[40px]');
  });
});
