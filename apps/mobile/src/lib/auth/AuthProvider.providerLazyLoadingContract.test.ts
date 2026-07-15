import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AUTH_PROVIDER_SOURCE = fileURLToPath(new URL('./AuthProvider.tsx', import.meta.url));

describe('AuthProvider provider module loading contract', () => {
  it('does not statically import Apple or Google provider implementations', () => {
    const source = readFileSync(AUTH_PROVIDER_SOURCE, 'utf8');

    expect(source).not.toMatch(/\bfrom\s+['"]\.\/(?:apple|google)['"]/);
    expect(source).not.toMatch(/^\s*import\s+['"]\.\/(?:apple|google)['"]/m);
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
