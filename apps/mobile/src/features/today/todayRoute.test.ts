import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Today route mobile contracts', () => {
  it('keeps the streak and adherence pill comfortably tappable on phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain('accessibilityLabel="View your streak and adherence"');
    expect(source).toContain("router.push('/routine/streak')");
    expect(source).toContain('min-h-[48px]');
    expect(source).not.toContain('min-h-[44px]');
    expect(source).toContain('px-4 py-2.5');
    expect(source).not.toContain('px-3.5 py-1.5');
  });
});
