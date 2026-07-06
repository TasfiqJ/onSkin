import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const UI_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('StripedThumb', () => {
  it('uses a clipped web gradient instead of offscreen transformed stripe children', () => {
    const source = readFileSync(`${UI_DIR}/StripedThumb.tsx`, 'utf8');

    expect(source).toContain("import { Platform, View, type ViewStyle } from 'react-native';");
    expect(source).toContain("Platform.OS === 'web'");
    expect(source).toContain('backgroundImage: `repeating-linear-gradient(135deg');
    expect(source).toContain("Platform.OS !== 'web'");
    expect(source).toContain("transform: [{ rotate: '45deg' }]");
  });
});
