import type { SubscriptionState } from './entitlement';

export const SUCCESS_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1000;

export function monotonicSuccessClockMs(previousNowMs: number, observedNowMs: number): number {
  return Math.max(previousNowMs, observedNowMs);
}

export function successEvidenceBoundaryMs(
  state: Pick<SubscriptionState, 'expiresAt' | 'verifiedAt'> | null | undefined,
): number | null {
  if (!state?.expiresAt || !state.verifiedAt) return null;
  const expiresAtMs = Date.parse(state.expiresAt);
  const verifiedAtMs = Date.parse(state.verifiedAt);
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(verifiedAtMs)) return null;
  return Math.min(expiresAtMs, verifiedAtMs + SUCCESS_EVIDENCE_MAX_AGE_MS);
}

export type SuccessEntitlementQuery = Readonly<{
  data?: SubscriptionState;
  isError: boolean;
  isFetchedAfterMount: boolean;
  isFetching: boolean;
  isLoading: boolean;
}>;

/**
 * A route transition or cached query is not payment proof. Admit the success UI
 * only after this mount has completed a current exact-owner query and the
 * resulting authority evidence is still active and freshly verified.
 */
export function admittedSuccessState(
  query: SuccessEntitlementQuery,
  nowMs: number,
): SubscriptionState | null {
  if (query.isError || query.isLoading || query.isFetching || !query.isFetchedAfterMount)
    return null;

  const state = query.data;
  if (!state?.isPro || !state.expiresAt || !state.verifiedAt) return null;
  if (!state.periodType || !state.store || !state.source) return null;

  const expiresAtMs = Date.parse(state.expiresAt);
  const verifiedAtMs = Date.parse(state.verifiedAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) return null;
  if (!Number.isFinite(verifiedAtMs)) return null;
  if (verifiedAtMs < nowMs - SUCCESS_EVIDENCE_MAX_AGE_MS) return null;
  if (verifiedAtMs > nowMs + SUCCESS_EVIDENCE_MAX_AGE_MS) return null;

  return state;
}
