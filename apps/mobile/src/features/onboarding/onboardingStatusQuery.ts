import {
  awaitAccountGenerationLease,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';
import { isSupabaseConfigured } from '@/lib/env';
import {
  queryKeys,
  runOwnerQueryOperation,
  type OwnerQueryScope,
} from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase/client';

import {
  readLocalOnboardingStatus,
  SKIN_PROFILE_INVALID,
  SKIN_PROFILE_UNAVAILABLE,
  SKIN_PROFILE_UNSUPPORTED_VERSION,
} from './skinProfileStore';

export const ONBOARDING_STATUS_UNAVAILABLE = 'ONBOARDING_STATUS_UNAVAILABLE';

export class OnboardingStatusUnavailableError extends Error {
  readonly code = ONBOARDING_STATUS_UNAVAILABLE;

  constructor(message = 'Onboarding status is unavailable.') {
    super(message);
    this.name = 'OnboardingStatusUnavailableError';
  }
}

export type WelcomeOnboardingGateDecision =
  | 'checking'
  | 'error'
  | 'redirect_today'
  | 'welcome';

type WelcomeOnboardingGateInput = {
  data: boolean | undefined;
  initializing: boolean;
  isError: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  ownerScopeCurrent: boolean;
  resetting: boolean;
  shouldCheck: boolean;
};

/**
 * Resolve the startup surface from the live observer state. Cached completion
 * data is deliberately unusable while a fresh owner-bound fetch is active.
 */
export function decideWelcomeOnboardingGate({
  data,
  initializing,
  isError,
  isFetching,
  isSuccess,
  ownerScopeCurrent,
  resetting,
  shouldCheck,
}: WelcomeOnboardingGateInput): WelcomeOnboardingGateDecision {
  if (resetting || initializing) return 'checking';
  if (!shouldCheck) return 'welcome';
  if (!ownerScopeCurrent) return 'checking';
  // Keep a previous failure and its accessible retry controls mounted while
  // that explicit retry is in flight. Successful cached data still remains
  // hidden behind the checking state during a fresh authoritative read.
  if (isError) return 'error';
  if (isFetching) return 'checking';
  if (isSuccess && data === true) return 'redirect_today';
  return 'welcome';
}

export type OnboardingStatusFailureKind =
  | 'invalid_profile'
  | 'retryable_unavailable'
  | 'unsupported_profile';

export function classifyOnboardingStatusFailure(error: unknown): OnboardingStatusFailureKind {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code
      : undefined;
  const message = error instanceof Error ? error.message : undefined;
  if (code === SKIN_PROFILE_UNSUPPORTED_VERSION || message === SKIN_PROFILE_UNSUPPORTED_VERSION) {
    return 'unsupported_profile';
  }
  if (code === SKIN_PROFILE_INVALID || message === SKIN_PROFILE_INVALID) {
    return 'invalid_profile';
  }
  // Private-storage availability, server failures, and a missing exact count
  // can all recover without modifying the preserved local bytes.
  if (
    code === SKIN_PROFILE_UNAVAILABLE ||
    message === SKIN_PROFILE_UNAVAILABLE ||
    code === ONBOARDING_STATUS_UNAVAILABLE
  ) {
    return 'retryable_unavailable';
  }
  return 'retryable_unavailable';
}

export async function readOnboardingStatusWithLease(
  lease: AccountGenerationLease,
): Promise<boolean> {
  const localStatus = await awaitAccountGenerationLease(lease, readLocalOnboardingStatus);
  if (localStatus === 'complete') return true;
  if (!isSupabaseConfigured) return false;

  const { count, error } = await awaitAccountGenerationLease(lease, () =>
    supabase
      .from('skin_profiles')
      .select('id', { count: 'exact', head: true })
      .not('completed_at', 'is', null)
      .abortSignal(lease.signal),
  );
  lease.assertCurrent();
  if (error) throw error;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new OnboardingStatusUnavailableError(
      'The server did not return an exact onboarding-status count.',
    );
  }
  return count > 0;
}

export function onboardingStatusQueryOptions(ownerScope: OwnerQueryScope) {
  return {
    queryKey: queryKeys.onboarded(ownerScope),
    queryFn: () => runOwnerQueryOperation(ownerScope, readOnboardingStatusWithLease),
    networkMode: 'always' as const,
    refetchOnMount: 'always' as const,
    retry: 0,
    staleTime: 0,
  };
}
