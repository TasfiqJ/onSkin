import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function productionSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...productionSourceFiles(path));
      continue;
    }
    if (!['.ts', '.tsx'].includes(extname(entry.name))) continue;
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) continue;
    files.push(path);
  }
  return files;
}

function sourceMatches(pattern: RegExp): string[] {
  return productionSourceFiles(SOURCE_ROOT)
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SOURCE_ROOT, path).replaceAll('\\', '/'))
    .sort();
}

describe('production analytics transport source contract', () => {
  it('keeps publication opening and PostHog transport absent from non-test app source', () => {
    expect(sourceMatches(/\bopenAnalyticsPublication\b/)).toEqual([
      'lib/analytics/publicationGate.ts',
    ]);
    expect(
      sourceMatches(
        /(?:from\s+|import\s*\(|require\s*\()\s*['"]posthog-react-native['"]|new\s+PostHog\b|\bposthog\w*\.(?:capture|identify|flush)\s*\(/i,
      ),
    ).toEqual([]);
  });

  it('keeps the final publication function reachable only through track', () => {
    expect(sourceMatches(/\bpublishAnalyticsEvent\b/)).toEqual([
      'lib/analytics/publicationGate.ts',
      'lib/analytics/track.ts',
    ]);
  });
});
