import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function productionSourceFiles(directory = SRC_DIR): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.includes('.test.')) return [];
    return [path];
  });
}

function readSource(path: string): string {
  return readFileSync(join(SRC_DIR, path), 'utf8');
}

function filesMatching(pattern: RegExp): string[] {
  return productionSourceFiles()
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC_DIR, path).replaceAll('\\', '/'));
}

describe('Reduce Motion source inventory', () => {
  it('has no unconditional timed navigation, modal, stack, or programmatic-scroll motion', () => {
    expect(filesMatching(/animated:\s*true/)).toEqual([]);
    expect(filesMatching(/animationType="(?:fade|slide)"/)).toEqual([]);
    expect(filesMatching(/animation:\s*'(?:fade|slide_from_right)'/)).toEqual([]);
    expect(filesMatching(/setTimeout\([^\n]*2600|2600[^\n]*router\.replace/)).toEqual([]);
  });

  it('keeps the sole continuous animation behind the conservative platform preference', () => {
    expect(filesMatching(/Animated\.loop/)).toEqual(['app/onboarding/analyzing.tsx']);
    const analyzing = readSource('app/onboarding/analyzing.tsx');
    expect(analyzing).toContain('const renderStaticPulse = shouldReduceMotion(reduceMotion);');
    expect(analyzing).toContain('if (renderStaticPulse || saveError)');
    expect(analyzing).toContain("router.replace('/onboarding/reveal');");
  });

  it('routes every timed presentation and scroll surface through the shared preference', () => {
    const motionOwners = [
      'app/onboarding/_layout.tsx',
      'app/commerce/_layout.tsx',
      'app/paywall/_layout.tsx',
      'app/shelf/_layout.tsx',
      'app/cycle/_layout.tsx',
      'app/(tabs)/progress.tsx',
      'app/settings/timing.tsx',
      'app/cycle/settings.tsx',
      'app/progress/review.tsx',
      'app/onboarding/products.tsx',
      'app/onboarding/consent.tsx',
      'app/progress/[id].tsx',
      'app/ask/consent.tsx',
      'app/(tabs)/you.tsx',
      'app/community/note/[id].tsx',
      'features/photos/PhotoTimelapse.tsx',
    ];

    for (const path of motionOwners) {
      expect(readSource(path), path).toContain('useReduceMotionPreference');
    }
  });

  it('documents the zero-transition and user-driven motion exceptions in executable code', () => {
    expect(readSource('features/photos/PhotoImage.tsx')).toContain(
      'transition={SENSITIVE_IMAGE_TRANSITION_MS}',
    );
    expect(readSource('features/photos/sensitiveImagePolicy.ts')).toContain(
      'SENSITIVE_IMAGE_TRANSITION_MS = 0',
    );
    expect(readSource('app/shelf/ocr.tsx')).toContain('transition={0}');
    expect(readSource('features/photos/PhotoTimelapse.tsx')).toContain('animationType="none"');
    expect(readSource('app/(tabs)/progress.tsx')).toContain("'Use side-by-side comparison'");
  });
});
