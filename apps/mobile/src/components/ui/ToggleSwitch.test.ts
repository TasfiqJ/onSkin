import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('ToggleSwitch', () => {
  it('keeps switch controls touchable and semantic on phones', () => {
    const source = readFileSync(`${UI_DIR}/ToggleSwitch.tsx`, 'utf8');

    expect(source).toContain("import { Platform, Pressable");
    expect(source).toContain('accessibilityRole="switch"');
    expect(source).toContain('accessibilityState={{ checked: value, disabled: !!disabled }}');
    expect(source).toContain('aria-checked={value}');
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain("event.key !== ' ' && event.key !== 'Enter'");
    expect(source).toContain('tabIndex: disabled ? -1 : 0');
    expect(source).toContain('onPress={activate}');
    expect(source).not.toContain('onClick:');
    expect(source).not.toContain("onPress={Platform.OS === 'web' ? undefined : activate}");
    expect(source).toContain('width: 52');
    expect(source).toContain('height: 48');
    expect(source).toContain("'h-12 min-h-[44px] w-[52px] items-center justify-center'");
    expect(source.match(/pointerEvents: 'none'/g)).toHaveLength(2);
    expect(source).toContain('className="h-[24px] w-[42px] justify-center rounded-pill px-0.5"');
    expect(source).toContain('translateX: value ? 18 : 0');
  });
});
