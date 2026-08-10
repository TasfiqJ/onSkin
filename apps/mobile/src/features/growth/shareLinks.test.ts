import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createConflictShareLink } from './shareLinks';

const source = readFileSync(fileURLToPath(new URL('./shareLinks.ts', import.meta.url)), 'utf8');

describe('conflict public-link creation', () => {
  it('returns null under every input without inspecting it', async () => {
    const unreadable = Object.defineProperty({}, 'authorityId', {
      get() {
        throw new Error('closed link creation must not inspect input');
      },
    });

    await expect(createConflictShareLink()).resolves.toBeNull();
    await expect(createConflictShareLink(unreadable)).resolves.toBeNull();
    await expect(
      createConflictShareLink({
        publicLinksFlag: true,
        finalDomain: 'https://layerwell.app',
        authority: { decision: 'admitted' },
      }),
    ).resolves.toBeNull();
  });

  it('contains no token, crypto, URL, persistence, network, or fixture path', () => {
    expect(source).not.toContain('expo-crypto');
    expect(source).not.toContain('randomUUID');
    expect(source).not.toContain('digestStringAsync');
    expect(source).not.toContain('buildPublicGrowthUrl');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('supabase');
    expect(source).not.toContain('AsyncStorage');
    expect(source).not.toContain('EXPO_PUBLIC_');
  });
});
