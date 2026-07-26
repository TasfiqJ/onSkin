import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('public conflict-share landing privacy boundary', () => {
  it('does not emit analytics or accept conflict-identifying attribution', () => {
    const source = readAppRoute('s/[shareId].tsx');

    expect(source).not.toMatch(/\btrack\s*\(/);
    expect(source).not.toContain('trackProductAddStarted');
    expect(source).not.toContain('sanitizeAttribution');
    expect(source).toContain('useLocalSearchParams<{ shareId?: string | string[] }>()');
    expect(source).toContain('isSafeOpaqueId(rawShareId)');
    expect(source).toContain('This shared link isn’t available.');
    expect(source).toContain('router.replace(APP_SHELF_ROUTE)');
    expect(source).not.toContain('campaign');
    expect(source).not.toContain('content');
    expect(source).not.toContain('creative_variant');
  });

  it('does not send public share route product, rule, or profile details', () => {
    const source = readAppRoute('s/[shareId].tsx');

    expect(source).not.toContain('rule_id');
    expect(source).not.toContain('product_name');
    expect(source).not.toContain('product_id');
    expect(source).not.toContain('skin_profile');
    expect(source).not.toContain('pregnancy');
  });
});
