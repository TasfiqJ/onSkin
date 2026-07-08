import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_SUFFIXES = ['.test.ts', '.test.tsx', '.d.ts'];

function listProductionSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listProductionSourceFiles(path));
      continue;
    }

    if (![...SOURCE_EXTENSIONS].some((extension) => path.endsWith(extension))) continue;
    if (EXCLUDED_SUFFIXES.some((suffix) => path.endsWith(suffix))) continue;

    files.push(path);
  }

  return files;
}

describe('production dialog contracts', () => {
  it('keeps launch recovery out of native and browser system dialogs', () => {
    const blockedPatterns: { label: string; pattern: RegExp }[] = [
      {
        label: 'react-native Alert import',
        pattern: /import\s*\{[\s\S]*?\bAlert\b[\s\S]*?\}\s*from\s*['"]react-native['"]/,
      },
      {
        label: 'react-native default Alert import',
        pattern: /import\s+Alert\b[\s\S]*?from\s*['"]react-native['"]/,
      },
      { label: 'Alert.alert call', pattern: /\bAlert\s*\.\s*alert\b/ },
      {
        label: 'ReactNative.Alert.alert call',
        pattern: /\bReactNative\s*\.\s*Alert\s*\.\s*alert\b/,
      },
      { label: 'window dialog call', pattern: /\bwindow\s*\.\s*(?:alert|confirm|prompt)\s*\(/ },
      {
        label: 'globalThis dialog call',
        pattern: /\bglobalThis\s*\.\s*(?:alert|confirm|prompt)\s*\(/,
      },
    ];

    const violations = listProductionSourceFiles(SRC_DIR).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      const relPath = relative(SRC_DIR, path).replace(/\\/g, '/');

      return blockedPatterns
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${relPath}: ${label}`);
    });

    expect(violations).toEqual([]);
  });
});
