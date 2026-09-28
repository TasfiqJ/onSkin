import { afterEach, describe, expect, it, vi } from 'vitest';

import { brandCachePrefix, brandFileSlug, buildBrandIdentity } from './brand';

const ORIGINAL_PUBLIC_NAME = process.env.EXPO_PUBLIC_APP_DISPLAY_NAME;
const ORIGINAL_NATIVE_NAME = process.env.APP_DISPLAY_NAME;

function setEnv(
  name: 'EXPO_PUBLIC_APP_DISPLAY_NAME' | 'APP_DISPLAY_NAME',
  value: string | undefined,
) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  vi.resetModules();
  setEnv('EXPO_PUBLIC_APP_DISPLAY_NAME', ORIGINAL_PUBLIC_NAME);
  setEnv('APP_DISPLAY_NAME', ORIGINAL_NATIVE_NAME);
});

describe('brand identity', () => {
  it('defaults runtime public copy to the working rebrand candidate', () => {
    expect(buildBrandIdentity()).toEqual({
      appName: 'Layerwell',
      proName: 'Layerwell Pro',
      askName: 'Ask Layerwell',
      appLockPrompt: 'Unlock Layerwell',
      catalogCuratedSource: 'Layerwell curated',
      catalogParserSource: 'Layerwell parser',
    });
  });

  it('normalizes configured names before composing product labels', () => {
    expect(buildBrandIdentity('  Layer   Wise  ').proName).toBe('Layer Wise Pro');
    expect(buildBrandIdentity('  Layer   Wise  ').askName).toBe('Ask Layer Wise');
  });

  it('builds filesystem-safe cache prefixes from runtime brand names', () => {
    expect(brandFileSlug()).toBe('layerwell');
    expect(brandFileSlug('  Layer   Wise!  ')).toBe('layer-wise');
    expect(brandCachePrefix('export', 'Layer Wise')).toBe('layer-wise-export-');
    expect(brandCachePrefix('share', '   ')).toBe('layerwell-share-');
  });

  it('prefers the public Expo display name at module load', async () => {
    vi.resetModules();
    setEnv('APP_DISPLAY_NAME', 'Native Only');
    setEnv('EXPO_PUBLIC_APP_DISPLAY_NAME', 'Public Runtime');

    const mod = await import('./brand');

    expect(mod.BRAND.appName).toBe('Public Runtime');
    expect(mod.BRAND.proName).toBe('Public Runtime Pro');
  });
});
