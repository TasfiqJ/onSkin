import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

function listTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
}

function importsReactNativeText(source: string): boolean {
  const imports = source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/gs);
  return Array.from(imports).some((match) =>
    match[1]
      .split(',')
      .map((specifier) => specifier.trim().replace(/^type\s+/, ''))
      .some((specifier) => specifier === 'Text' || specifier.startsWith('Text as ')),
  );
}

describe('pseudo-localization inventory', () => {
  it('routes every production text node through the shared Text boundary', () => {
    const sharedText = path.join(sourceRoot, 'components', 'ui', 'Text.tsx');
    const offenders = listTsxFiles(sourceRoot)
      .filter((file) => file !== sharedText)
      .filter((file) => importsReactNativeText(readFileSync(file, 'utf8')))
      .map((file) => path.relative(sourceRoot, file).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
    expect(readFileSync(sharedText, 'utf8')).toContain('pseudoLocalizeNode(children)');
  });

  it('pseudo-localizes prose placeholders without changing data-format placeholders', () => {
    const prosePlaceholderFiles = [
      'app/ask/index.tsx',
      'app/onboarding/products.tsx',
      'app/progress/[id].tsx',
      'app/shelf/manual.tsx',
      'app/shelf/ocr.tsx',
      'app/shelf/search.tsx',
    ];

    for (const relativePath of prosePlaceholderFiles) {
      const source = readFileSync(path.join(sourceRoot, relativePath), 'utf8');
      expect(source, relativePath).toContain('pseudoLocalizeString');
    }

    const dateField = readFileSync(
      path.join(sourceRoot, 'features', 'shelf', 'LocalDateField.tsx'),
      'utf8',
    );
    expect(dateField).not.toContain('pseudoLocalizeString');
  });

  it('keeps the fixture development-only and records it in screenshot evidence', () => {
    const helper = readFileSync(path.join(sourceRoot, 'lib', 'accessibility', 'pseudoLocalization.ts'), 'utf8');
    const audit = readFileSync(
      path.join(repoRoot, 'scripts', 'e2e', 'text-pressure-route-audit.mjs'),
      'utf8',
    );

    expect(helper).toContain("value === 'expanded'");
    expect(helper).toContain("typeof __DEV__ !== 'undefined' && __DEV__");
    expect(audit).toContain('EXPO_PUBLIC_E2E_PSEUDO_LOCALE');
    expect(audit).toContain('pseudoLocale,');
    expect(audit).toContain('Pseudo locale: ${pseudoLocale}');
    expect(audit).toContain('waitForStartupSettled');
    expect(audit).toContain('Chrome DevTools connection closed.');
    expect(audit).toContain('Chrome DevTools command timed out: ${method}');
    expect(audit).toContain('visibleBounds');
  });
});
