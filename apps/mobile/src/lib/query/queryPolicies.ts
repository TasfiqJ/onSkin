type QueryStatusSource = Readonly<{ state: Readonly<{ status: string }> }>;

/** Preserve ordinary stale-data refreshes without treating an error as a retry trigger. */
export function shouldAutomaticallyRefetchQuery(query: QueryStatusSource): boolean {
  return query.state.status !== 'error';
}

/** Revalidate even fresh successful state while leaving a rejected error stable. */
export function alwaysRefetchSuccessfulQuery(query: QueryStatusSource): boolean | 'always' {
  return query.state.status === 'error' ? false : 'always';
}

/**
 * Encrypted/local reads must execute while offline and surface an exact failure
 * once. Recovery is an explicit user action through the owning availability
 * boundary, never a hidden background retry.
 */
export const manualRecoveryQueryPolicy = {
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  retry: false,
  retryOnMount: false,
} as const;

/**
 * Ordinary successful snapshots may refresh when stale. Rejected errors remain
 * stable because retry ownership belongs to a visible/manual boundary.
 */
export const stableErrorQueryPolicy = {
  refetchOnMount: shouldAutomaticallyRefetchQuery,
  refetchOnReconnect: shouldAutomaticallyRefetchQuery,
  refetchOnWindowFocus: shouldAutomaticallyRefetchQuery,
  retry: false,
  retryOnMount: false,
} as const;

/**
 * TanStack retries are deny-by-default. A query that genuinely needs an outer
 * retry budget must opt in at its call site after its failure taxonomy is
 * reviewed. Successful stale queries retain ordinary lifecycle refreshes, but
 * an error remains stable until an explicit recovery action.
 */
export const queryClientDefaultPolicy = {
  refetchOnMount: shouldAutomaticallyRefetchQuery,
  refetchOnReconnect: shouldAutomaticallyRefetchQuery,
  refetchOnWindowFocus: shouldAutomaticallyRefetchQuery,
  retry: false,
  retryOnMount: false,
  staleTime: 60_000,
} as const;

export const deterministicLocalQueryPolicy = {
  ...manualRecoveryQueryPolicy,
  networkMode: 'always',
} as const;

/**
 * Network operations wrapped by requestPolicy already own deadlines,
 * cancellation, and bounded transient retries. Their TanStack observer must not
 * add another retry layer.
 */
export const requestPolicyOwnedQueryPolicy = {
  ...stableErrorQueryPolicy,
} as const;
