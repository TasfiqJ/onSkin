import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

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

export async function createConflictShareLink(
  opts: { creativeVariant?: string } = {},
): Promise<ConflictShareLink | null> {
  const shareId = await createShareId(opts.creativeVariant ?? 'story-v1');
  const url = buildPublicGrowthUrl(`/s/${shareId}`, {
    source: 'share_card',
    medium: 'organic_share',
    campaign: 'shelf_conflict_card_v1',
    content: 'conflict_card',
    creative_variant: opts.creativeVariant ?? 'story-v1',
    platform: Platform.OS,
    app_version: Application.nativeApplicationVersion ?? '0.1.0',
    build_number: Application.nativeBuildVersion ?? 'dev',
    share_id: shareId,
  });

  if (!url) return null;
  return { shareId, url };
}
