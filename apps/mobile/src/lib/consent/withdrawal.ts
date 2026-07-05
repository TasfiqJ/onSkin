import type { ConsentType } from '@onskin/types';
import * as Crypto from 'expo-crypto';

import { supabase } from '../supabase/client';

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
  const consentTextHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    params.consentText,
  );
  const { error } = await supabase.functions.invoke('consent-withdrawal', {
    method: 'POST',
    body: {
      consentType: params.type,
      version: params.version,
      consentTextHash,
    },
  });
  if (error) throw error;
}
