import * as Crypto from 'expo-crypto';

import { OUTBOX_INVALID } from './outbox.pure';

const OWNER_HASH_NAMESPACE = 'onskin:outbox-owner:v1:';

export async function hashOutboxOwner(ownerId: string): Promise<string> {
  const normalized = ownerId.trim();
  if (!normalized || normalized.length > 512) throw new Error(OUTBOX_INVALID);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${OWNER_HASH_NAMESPACE}${normalized}`,
  );
  const hash = digest.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(OUTBOX_INVALID);
  return hash;
}
