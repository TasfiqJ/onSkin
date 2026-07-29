import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('public conflict-share landing privacy boundary', () => {
  it('renders one generic unavailable recovery without reading or branching on the path value', () => {
    const source = readAppRoute('s/[shareId].tsx');

    expect(source).toContain('Public sharing is unavailable.');
    expect(source).toContain('This address does not load another person&apos;s products');
    expect(source).toContain('router.replace(APP_SHELF_ROUTE)');
    expect(source).toContain("router.replace('/shelf/manual')");
    expect(source).not.toContain('useLocalSearchParams');
    expect(source).not.toContain('isSafeOpaqueId');
    expect(source).not.toContain('shareId');
    expect(source).not.toContain('rawShareId');
    expect(source).not.toContain('hasValidShareId');
    expect(source).not.toContain('Shared cards');
    expect(source).not.toContain('BRAND');
  });

  it('emits no telemetry, attribution, network request, or private context', () => {
    const source = readAppRoute('s/[shareId].tsx');

    expect(source).not.toMatch(/\btrack\s*\(/u);
    expect(source).not.toContain('trackProductAddStarted');
    expect(source).not.toContain('sanitizeAttribution');
    expect(source).not.toContain('campaign');
    expect(source).not.toContain('content');
    expect(source).not.toContain('creative_variant');
    expect(source).not.toContain('rule_id');
    expect(source).not.toContain('product_name');
    expect(source).not.toContain('product_id');
    expect(source).not.toContain('skin_profile');
    expect(source).not.toContain('pregnancy');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('supabase');
  });
});
