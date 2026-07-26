import * as Crypto from 'expo-crypto';

import { buildPublicGrowthUrl } from '@/lib/growth/attribution';

export type ConflictShareLink = {
  shareId: string;
  url: string;
};

export async function createShareId(seed: string = ''): Promise<string> {
  const random = Crypto.randomUUID();
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${random}:${Date.now()}:${seed}`,
  );
  return digest.slice(0, 32);
}

export async function createConflictShareLink(): Promise<ConflictShareLink | null> {
  const shareId = await createShareId('conflict-share');
  // The opaque path is the complete public payload. Query attribution would let
  // analytics infer that a health-adjacent product interaction exists.
  const url = buildPublicGrowthUrl(`/s/${shareId}`, {});

  if (!url) return null;
  return { shareId, url };
}
