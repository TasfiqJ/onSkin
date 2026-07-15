import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { AUTH_DERIVED_CLEANUP_REQUIRED_KEY } from '@/lib/auth/authDerivedCleanupRequired';

import {
  LOCAL_PRIVATE_CONTROL_KEYS,
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_METADATA_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
  LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
  LOCAL_PRIVATE_SECURE_STORE_KEYS,
} from './localPrivateDataKeys';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const STORAGE_KEY_RE = /['"`]((?:onskin|routinekind)\.[^'"`]+)['"`]/g;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) return [];
    return [path];
  });
}

describe('local private data registry', () => {
  it('covers every on-device private storage key', () => {
    const registered = new Set([
      ...LOCAL_PRIVATE_CONTROL_KEYS,
      ...LOCAL_PRIVATE_DATA_KEYS,
      ...LOCAL_PRIVATE_METADATA_KEYS,
      ...LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
      ...LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
      ...LOCAL_PRIVATE_SECURE_STORE_KEYS,
    ]);
    const discovered = new Set<string>();

    for (const file of walk(SRC_DIR)) {
      if (file.endsWith('/features/settings/localPrivateDataKeys.ts')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(STORAGE_KEY_RE)) discovered.add(match[1]!);
    }
    discovered.delete('onskin.app');

    expect([...discovered].sort()).toEqual([...registered].sort());
  });

  it('does not register duplicate keys', () => {
    const all = [
      ...LOCAL_PRIVATE_CONTROL_KEYS,
      ...LOCAL_PRIVATE_DATA_KEYS,
      ...LOCAL_PRIVATE_METADATA_KEYS,
      ...LOCAL_PRIVATE_SECURE_CONTROL_KEYS,
      ...LOCAL_PRIVATE_SECURE_CONTROL_KEY_PREFIXES,
      ...LOCAL_PRIVATE_SECURE_STORE_KEYS,
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps auth-derived crash recovery outside destructive private-data registries', () => {
    expect(LOCAL_PRIVATE_CONTROL_KEYS).toContain(AUTH_DERIVED_CLEANUP_REQUIRED_KEY);
    expect([
      ...LOCAL_PRIVATE_DATA_KEYS,
      ...LOCAL_PRIVATE_METADATA_KEYS,
      ...LOCAL_PRIVATE_SECURE_STORE_KEYS,
    ]).not.toContain(AUTH_DERIVED_CLEANUP_REQUIRED_KEY);
  });
});
