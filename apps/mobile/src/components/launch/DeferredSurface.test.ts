import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const COMPONENT_PATH = fileURLToPath(new URL('./DeferredSurface.tsx', import.meta.url));

function readComponent(): string {
  return readFileSync(COMPONENT_PATH, 'utf8');
}

describe('DeferredSurface mobile layout', () => {
  it('keeps deferred route copy scrollable above a buffered bottom action', () => {
    const source = readComponent();

    expect(source).toContain('import { ScrollView, View } from');
    expect(source).toContain('className="flex-1"');
    expect(source).toContain('contentContainerClassName="flex-grow justify-center pb-6 pt-4"');
    expect(source).toContain('<View className="pb-3 pt-2">');
    expect(source).toContain('className="mb-6"');
    expect(source).toContain('variant="ghost"');
    expect(source).toContain("fallbackBehavior = 'back-or-replace'");
    expect(source).toContain("if (fallbackBehavior === 'replace')");
    expect(source).toContain('replaceWithFallback(router, fallbackRoute)');
    expect(source).toContain('backOrReplace(router, fallbackRoute)');
    expect(source).not.toContain('<View className="flex-1 justify-center">');
  });
});
