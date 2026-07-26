import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { recordConsent } from '@/lib/consent/consent';
import { runSerializedConsentWorkflow } from '@/lib/consent/workflow';
import { withdrawConsent } from '@/lib/consent/withdrawal';
import {
  clearCommerceConsentLocal,
  COMMERCE_CONSENT_WITHDRAWAL_PENDING,
  readCommerceConsentLocal,
  setCommerceConsentLocal,
} from '@/features/commerce/store';
import { CONSENT_COPY_VERSION } from '@/features/onboarding/consentCopy';
import {
  isOwnerQueryScopeCurrent,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { requirePrivateBoolean } from '@/lib/storage/privateBoolean';

export type SettingsPrivacyConsentType = 'data_sharing' | 'marketing';
export type SettingsPrivacyFeedbackPlacement = 'commerce' | 'privacy';
export type SettingsPrivacyFailedChoice = Readonly<{
  granted: boolean;
  ownerGeneration: number;
  placement: SettingsPrivacyFeedbackPlacement;
  type: SettingsPrivacyConsentType;
}>;

export type SettingsPrivacyConsentPersistence = Readonly<{
  remote: 'confirmed' | 'deferred';
}>;

type SettingsPrivacyConsentPersistenceDeps = Readonly<{
  clearCommerceConsentLocal: typeof clearCommerceConsentLocal;
  readCommerceConsentLocal: typeof readCommerceConsentLocal;
  recordConsent: typeof recordConsent;
  setCommerceConsentLocal: typeof setCommerceConsentLocal;
  withdrawConsent: typeof withdrawConsent;
}>;

const defaultDeps: SettingsPrivacyConsentPersistenceDeps = {
  clearCommerceConsentLocal,
  readCommerceConsentLocal,
  recordConsent,
  setCommerceConsentLocal,
  withdrawConsent,
};

function consentText(type: SettingsPrivacyConsentType): string {
  return `[PLACEHOLDER ${type} consent. B-PRIVACY-COPY]`;
}

export function retryableSettingsPrivacyChoice(
  failed: SettingsPrivacyFailedChoice | null,
  ownerScope: OwnerQueryScope,
): Omit<SettingsPrivacyFailedChoice, 'ownerGeneration'> | null {
  if (
    !failed ||
    failed.ownerGeneration !== ownerScope.generation ||
    !isOwnerQueryScopeCurrent(ownerScope)
  ) {
    return null;
  }
  return Object.freeze({
    granted: failed.granted,
    placement: failed.placement,
    type: failed.type,
  });
}

async function persistRemoteChoice(
  lease: AccountGenerationLease,
  input: Readonly<{ type: SettingsPrivacyConsentType; granted: boolean }>,
  deps: SettingsPrivacyConsentPersistenceDeps,
): Promise<void> {
  const params = {
    type: input.type,
    version: CONSENT_COPY_VERSION,
    consentText: consentText(input.type),
  } as const;
  if (input.granted) {
    await awaitAccountGenerationLease(lease, () =>
      deps.recordConsent({ ...params, granted: true }),
    );
  } else {
    await awaitAccountGenerationLease(lease, () => deps.withdrawConsent(params));
  }
  lease.assertCurrent();
}

/**
 * Persists the You-tab marketing/data-sharing choice under its mounted owner.
 * Commerce remains local-first for offline grants. Revocations never claim
 * success until the cleanup endpoint confirms; a failed data-sharing
 * withdrawal still leaves the local commerce gate locked.
 */
export function persistSettingsPrivacyConsentChoice(
  ownerScope: OwnerQueryScope,
  input: Readonly<{
    type: SettingsPrivacyConsentType;
    granted: boolean;
    onLocalDataSharingSaved?: (granted: boolean) => void | Promise<void>;
    onDataSharingWithdrawalCompleted?: () => void | Promise<void>;
  }>,
  deps: SettingsPrivacyConsentPersistenceDeps = defaultDeps,
): Promise<SettingsPrivacyConsentPersistence> {
  return runOwnerQueryOperation(ownerScope, async (lease) => {
    return runSerializedConsentWorkflow(lease, async () => {
      if (input.type === 'data_sharing') {
        lease.assertCurrent();
        if (input.granted) {
          const current = await awaitAccountGenerationLease(lease, deps.readCommerceConsentLocal);
          lease.assertCurrent();
          if (current.status !== 'absent' && requirePrivateBoolean(current) === false) {
            throw new Error(COMMERCE_CONSENT_WITHDRAWAL_PENDING);
          }
        }
        await awaitAccountGenerationLease(lease, () => deps.setCommerceConsentLocal(input.granted));
        lease.assertCurrent();
        if (!input.granted && input.onLocalDataSharingSaved) {
          const onLocalDataSharingSaved = input.onLocalDataSharingSaved;
          await awaitAccountGenerationLease(lease, () =>
            Promise.resolve(onLocalDataSharingSaved(input.granted)),
          );
          lease.assertCurrent();
        }
        if (input.granted) {
          try {
            await persistRemoteChoice(lease, input, deps);
            return Object.freeze({ remote: 'confirmed' as const });
          } catch {
            lease.assertCurrent();
            return Object.freeze({ remote: 'deferred' as const });
          }
        }
      }

      await persistRemoteChoice(lease, input, deps);
      if (input.type === 'data_sharing') {
        await awaitAccountGenerationLease(lease, deps.clearCommerceConsentLocal);
        lease.assertCurrent();
        if (input.onDataSharingWithdrawalCompleted) {
          const onDataSharingWithdrawalCompleted = input.onDataSharingWithdrawalCompleted;
          await awaitAccountGenerationLease(lease, () =>
            Promise.resolve(onDataSharingWithdrawalCompleted()),
          );
          lease.assertCurrent();
        }
      }
      return Object.freeze({ remote: 'confirmed' as const });
    });
  });
}
