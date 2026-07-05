/**
 * Local health-adjacent state is keyed to the active Supabase user. If Supabase
 * replaces that user without going through the app's explicit sign-out path, the
 * private offline stores must be wiped before the new account can render.
 */
export function shouldClearLocalPrivateDataForSessionChange(
  previousUserId: string | null,
  nextUserId: string | null,
): boolean {
  if (!previousUserId) return false;
  return previousUserId !== nextUserId;
}
