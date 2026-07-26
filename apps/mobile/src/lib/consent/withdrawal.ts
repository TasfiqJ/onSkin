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

export const CONSENT_WITHDRAWAL_RESPONSE_INVALID = 'CONSENT_WITHDRAWAL_RESPONSE_INVALID';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  );
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isExactCountCleanup(value: unknown, expectedKeys: readonly string[]): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, expectedKeys) &&
    expectedKeys.every((key) => isNonnegativeInteger(value[key]))
  );
}

function isValidCleanup(type: WithdrawableConsentType, value: unknown): boolean {
  switch (type) {
    case 'photo_cloud_backup':
      return isExactCountCleanup(value, [
        'photo_rows_relocalized',
        'storage_objects_removed',
        'skipped_storage_paths',
      ]);
    case 'photo_trend_insights':
      return isExactCountCleanup(value, ['photo_trend_deleted']);
    case 'ask_onskin':
      return isExactCountCleanup(value, ['ask_safety_audit_deleted']);
    case 'community_participation':
      return isExactCountCleanup(value, [
        'community_reports_deleted',
        'community_reactions_deleted',
        'community_questions_deleted',
        'community_blocks_deleted',
      ]);
    case 'data_sharing':
      return isExactCountCleanup(value, [
        'order_attributions_detached',
        'commerce_click_events_deleted',
      ]);
    case 'marketing':
      return (
        isRecord(value) &&
        hasExactKeys(value, ['marketing_withdrawal_recorded']) &&
        value.marketing_withdrawal_recorded === true
      );
  }
}

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

    const response = await invokeEdgeFunction<unknown>('consent-withdrawal', {
      method: 'POST',
      signal: lease.signal,
      body: {
        consentType: params.type,
        version: params.version,
        consentTextHash,
      },
    });
    lease.assertCurrent();
    if (
      !isRecord(response) ||
      Object.keys(response).length !== 3 ||
      response.withdrawn !== true ||
      response.consent_type !== params.type ||
      !isValidCleanup(params.type, response.cleanup)
    ) {
      throw new Error(CONSENT_WITHDRAWAL_RESPONSE_INVALID);
    }
  });
}
