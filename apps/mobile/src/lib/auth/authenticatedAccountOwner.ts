import type { AccountGenerationLease } from './accountGeneration';

import { supabase } from '../supabase/client';

export const AUTHENTICATED_ACCOUNT_REQUIRED = 'AUTHENTICATED_ACCOUNT_REQUIRED';
export const AUTHENTICATED_ACCOUNT_SESSION_CHANGED = 'AUTHENTICATED_ACCOUNT_SESSION_CHANGED';

export type AuthenticatedAccountOwner = Readonly<{
  userId: string;
}>;

export type AuthenticatedAccountSession = AuthenticatedAccountOwner &
  Readonly<{
    authorizationHeaders: Readonly<{ Authorization: string }>;
  }>;

/**
 * Capture the authenticated owner while an account-generation lease is current.
 * Callers still assert immediately before and after their network request. Rows
 * must include this explicit user id so a late request cannot be accepted under
 * a different session's RLS policy.
 */
export async function captureAuthenticatedAccountOwner(
  lease: AccountGenerationLease,
): Promise<AuthenticatedAccountOwner | null> {
  lease.assertCurrent();
  const { data, error } = await supabase.auth.getUser();
  lease.assertCurrent();
  if (error) throw error;
  const userId = data.user?.id.trim();
  return userId ? Object.freeze({ userId }) : null;
}

export async function requireAuthenticatedAccountOwner(
  lease: AccountGenerationLease,
): Promise<AuthenticatedAccountOwner> {
  const owner = await captureAuthenticatedAccountOwner(lease);
  if (!owner) throw new Error(AUTHENTICATED_ACCOUNT_REQUIRED);
  return owner;
}

/**
 * Edge Functions otherwise resolve the client's latest access token lazily. Pin
 * the initiating session token in the request headers so an A payload cannot be
 * authenticated as B while an auth event is entering the account boundary.
 */
export async function requireAuthenticatedAccountSession(
  lease: AccountGenerationLease,
): Promise<AuthenticatedAccountSession> {
  const owner = await requireAuthenticatedAccountOwner(lease);
  const { data, error } = await supabase.auth.getSession();
  lease.assertCurrent();
  if (error) throw error;
  const session = data.session;
  if (!session?.access_token || session.user.id !== owner.userId) {
    throw new Error(AUTHENTICATED_ACCOUNT_SESSION_CHANGED);
  }
  return Object.freeze({
    ...owner,
    authorizationHeaders: Object.freeze({ Authorization: `Bearer ${session.access_token}` }),
  });
}
