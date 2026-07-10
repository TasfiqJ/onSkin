/**
 * Local health-adjacent state is keyed to the active Supabase user. If Supabase
 * replaces that user without going through the app's explicit sign-out path, the
 * private offline stores must be wiped before the new account can render.
 */
export type LocalDataOwnership = 'match' | 'mismatch' | 'unclaimed';

export function latestSessionForCompletedBoundary<T extends { user: { id: string } }>(
  pending: T | null | undefined,
  fallback: T | null,
  targetUserId: string | null,
): T | null {
  return (pending?.user.id ?? null) === targetUserId ? (pending ?? null) : fallback;
}

export function shouldClearLocalPrivateDataForSessionChange(
  previousUserId: string | null,
  nextUserId: string | null,
  ownership: LocalDataOwnership = 'unclaimed',
): boolean {
  if (ownership === 'mismatch') return true;
  return previousUserId !== null && previousUserId !== nextUserId;
}
