import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('public share landing route analytics', () => {
  it('tracks the Phase 8 dashboard landing event with sanitized attribution', () => {
    const source = readAppRoute('s/[shareId].tsx');

    expect(source).toContain('import { isSafeOpaqueId, sanitizeAttribution }');
    expect(source).toContain('const attribution = useMemo(');
    expect(source).toContain("track('landing_viewed', landingProps)");
    expect(source).toContain("track('share_link_opened', landingProps)");
    expect(source).toContain('source: firstParam(params.source)');
    expect(source).toContain('campaign: firstParam(params.campaign)');
    expect(source).toContain('creative_variant: firstParam(params.creative_variant)');
    expect(source).toContain('platform: firstParam(params.platform)');
    expect(source).toContain('share_id: safeShareId');
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
