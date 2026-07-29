import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SHARE_CARD_EXPORT_SIZE, shareConflictCard } from './shareCard';

const source = readFileSync(fileURLToPath(new URL('./shareCard.ts', import.meta.url)), 'utf8');

describe('conflict share-card export', () => {
  it('keeps the future output dimensions explicit without exporting anything', () => {
    expect(SHARE_CARD_EXPORT_SIZE).toEqual({ width: 1080, height: 1920 });
  });

  it('returns false under every input without inspecting it', async () => {
    const unreadable = Object.defineProperty({}, 'current', {
      get() {
        throw new Error('closed export must not inspect input');
      },
    });

    await expect(shareConflictCard()).resolves.toBe(false);
    await expect(shareConflictCard(null)).resolves.toBe(false);
    await expect(shareConflictCard(unreadable)).resolves.toBe(false);
    await expect(
      shareConflictCard({
        admission: { decision: 'admitted' },
        confirmation: { confirmed: true },
        featureFlags: { shareCard: true },
      }),
    ).resolves.toBe(false);
  });

  it('contains no capture, file, network, fixture, or native-share dependency', () => {
    expect(source).not.toContain('react-native-view-shot');
    expect(source).not.toContain('captureRef');
    expect(source).not.toContain('expo-file-system');
    expect(source).not.toContain('expo-sharing');
    expect(source).not.toContain('shareAsync');
    expect(source).not.toContain('deleteAsync');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('EXPO_PUBLIC_');
  });
});
