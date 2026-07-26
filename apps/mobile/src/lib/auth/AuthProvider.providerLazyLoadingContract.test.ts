import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const AUTH_PROVIDER_SOURCE = fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url));
const ENCRYPTED_PHOTO_STORAGE_SOURCE = fileURLToPath(
  new URL('../../features/photos/encryptedStorage.ts', import.meta.url),
);
const LOCAL_ACCOUNT_ISOLATION_SOURCE = fileURLToPath(
  new URL('./localAccountIsolation.ts', import.meta.url),
);
const PHOTO_ACCOUNT_BOUNDARY_SOURCE = fileURLToPath(
  new URL('../../features/photos/photoAccountBoundary.ts', import.meta.url),
);

function resolveStaticLocalModule(importer: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC_DIR, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(importer), specifier)
      : null;
  if (!base) return null;

  return (
    [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      join(base, 'index.ts'),
      join(base, 'index.tsx'),
      join(base, 'index.js'),
      join(base, 'index.jsx'),
    ].find((candidate) => existsSync(candidate) && /\.[jt]sx?$/.test(candidate)) ?? null
  );
}

function staticRuntimeSpecifiers(path: string): string[] {
  const source = readFileSync(path, 'utf8');
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  return sourceFile.statements.flatMap((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      !statement.importClause?.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [statement.moduleSpecifier.text];
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
}

function staticLocalDependencyClosure(entry: string): Set<string> {
  const visited = new Set<string>();
  const pending = [entry];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const source = readFileSync(current, 'utf8');
    const sourceFile = ts.createSourceFile(current, source, ts.ScriptTarget.Latest, true);
    for (const statement of sourceFile.statements) {
      let specifier: string | null = null;
      if (
        ts.isImportDeclaration(statement) &&
        !statement.importClause?.isTypeOnly &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        specifier = statement.moduleSpecifier.text;
      } else if (
        ts.isExportDeclaration(statement) &&
        !statement.isTypeOnly &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        specifier = statement.moduleSpecifier.text;
      }

      if (!specifier) continue;
      const dependency = resolveStaticLocalModule(current, specifier);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }

  return visited;
}

describe('AuthProvider provider module loading contract', () => {
  it('does not statically import Apple or Google provider implementations', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');

    expect(source).not.toMatch(/\bfrom\s+['"]\.\/(?:apple|google)['"]/);
    expect(source).not.toMatch(/^\s*import\s+['"]\.\/(?:apple|google)['"]/m);
  });

  it('keeps the root photo account barrier independent of photo crypto and filesystem modules', () => {
    const providerSource = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');
    const isolationSource = readFileSync(LOCAL_ACCOUNT_ISOLATION_SOURCE, 'utf8');
    const boundarySource = readFileSync(PHOTO_ACCOUNT_BOUNDARY_SOURCE, 'utf8');

    for (const startupSource of [providerSource, isolationSource]) {
      expect(startupSource).toContain("} from '@/features/photos/photoAccountBoundary';");
      expect(startupSource).not.toContain('@/features/photos/encryptedStorage');
    }
    expect(staticLocalDependencyClosure(AUTH_PROVIDER_SOURCE)).not.toContain(
      ENCRYPTED_PHOTO_STORAGE_SOURCE,
    );
    expect(staticRuntimeSpecifiers(PHOTO_ACCOUNT_BOUNDARY_SOURCE)).toEqual([
      '@/lib/auth/accountGeneration',
    ]);
    expect(boundarySource).not.toContain('import(');
    expect(boundarySource).not.toMatch(/\bfrom\s+['"]expo-(?:crypto|file-system)/);
    expect(boundarySource).not.toMatch(/\bfrom\s+['"]@noble\/ciphers/);
    expect(boundarySource).not.toMatch(/\bfrom\s+['"]react-native/);
    expect(boundarySource).not.toMatch(/\bfrom\s+['"]\.\/encryptedStorage['"]/);
  });

  it('loads each provider implementation inside its coordinator-owned request callback', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');

    for (const provider of ['apple', 'google'] as const) {
      const runStart = source.indexOf(`providerSignInCoordinator.run(\n          '${provider}'`);
      const moduleLoad = source.indexOf(`import('./${provider}')`, runStart);
      const authenticationDependencies = source.indexOf('authenticate:', runStart);

      expect(runStart).toBeGreaterThan(-1);
      expect(moduleLoad).toBeGreaterThan(runStart);
      expect(authenticationDependencies).toBeGreaterThan(moduleLoad);
    }
  });
});
