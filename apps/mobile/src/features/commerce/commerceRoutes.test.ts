import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));
const FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function readFeatureFile(path: string): string {
  return readFileSync(`${FEATURE_DIR}/${path}`, 'utf8');
}

const COMMERCE_ROUTES = [
  'commerce/stacks.tsx',
  'commerce/transparency.tsx',
  'commerce/consent.tsx',
  'commerce/stack/[slug].tsx',
];

describe('COM-01A direct-entry and dormant-renderer contracts', () => {
  it('keeps the route layout transparent so direct URLs remain exact', () => {
    const source = readAppRoute('commerce/_layout.tsx');

    expect(source).toContain("import { Slot } from 'expo-router';");
    expect(source).toContain('return <Slot />;');
    expect(source).not.toContain('CommerceDeferredSurface');
    expect(source).not.toMatch(/track\(|useEffect|useQuery|router\./);
  });

  it('renders every commerce route through one analytics-free deferred surface', () => {
    for (const route of COMMERCE_ROUTES) {
      const source = readAppRoute(route);

      expect(source, route).toContain(
        "import { CommerceDeferredSurface } from '@/features/commerce/CommerceDeferredSurface';",
      );
      expect(source, route).toContain('return <CommerceDeferredSurface />;');
      for (const forbidden of [
        'track(',
        'useEffect',
        'useQuery',
        'router.',
        '<Stack',
        'grantCommerceConsent',
        'refuseCommerceConsent',
        'recordClick',
      ]) {
        expect(source, `${route} must not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('keeps the shared recovery surface explicit and disables view analytics', () => {
    const source = readFeatureFile('CommerceDeferredSurface.tsx');

    expect(source).toContain('<DeferredSurface');
    expect(source).toContain('surface="commerce"');
    expect(source).toContain('fallbackRoute={APP_YOU_ROUTE}');
    expect(source).toContain('fallbackLabel="Back to You"');
    expect(source).toContain('fallbackBehavior="replace"');
    expect(source).toContain('trackView={false}');
  });

  it('keeps WhereToBuy a null renderer with no runtime import or hook side effect', () => {
    const source = readFeatureFile('WhereToBuy.tsx');

    expect(source).toContain('_props: { provenance: unknown }');
    expect(source).toContain('return null;');
    expect(source).not.toMatch(/^import /m);
    for (const forbidden of [
      'useCommerce',
      'useQuery',
      'useEffect',
      'phase7Flags',
      'router',
      'track',
      'recordClick',
      'openExternal',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('removes commerce reads, routes, and toggles from You', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    for (const forbidden of [
      'CommerceConsent',
      'commerceConsent',
      'phase7Flags.commerce',
      'data_sharing',
      '/commerce/',
      'Shoppable routines',
      'where-to-buy',
      'Share data with partners',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain('withdrawHealthDataConsent');
    expect(source).toContain('deleteAccount');
  });
});
