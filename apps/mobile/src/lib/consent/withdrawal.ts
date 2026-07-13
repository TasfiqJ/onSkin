import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { runAccountGenerationOperation } from '@/lib/auth/accountGeneration';
import { isSupabaseConfigured } from '@/lib/env';
import { invokeEdgeFunction } from '@/lib/network/edgeFunctions';

export type WithdrawableConsentType =
  | 'photo_cloud_backup'
  | 'photo_trend_insights'
  | 'ask_onskin'
  | 'community_participation'
  | 'data_sharing'
  | 'marketing';

export async function withdrawConsent(params: {
  type: WithdrawableConsentType & ConsentType;
  version: string;
  consentText: string;
}): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('CONSENT_BACKEND_UNAVAILABLE');

  await runAccountGenerationOperation(async (lease) => {
    const consentTextHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      params.consentText,
    );
    lease.assertCurrent();

    await invokeEdgeFunction('consent-withdrawal', {
      method: 'POST',
      signal: lease.signal,
      body: {
        consentType: params.type,
        version: params.version,
        consentTextHash,
      },
    });
    lease.assertCurrent();
  });
}
