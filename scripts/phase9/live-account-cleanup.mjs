import { randomBytes } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const LIVE_ACCOUNT_STILL_PRESENT = 'LIVE_ACCOUNT_STILL_PRESENT';

function authUserNotFound(error) {
  return error?.code === 'user_not_found';
}

function defaultErrorKind(error) {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * Dispose of a live-test identity through the same guarded state machine used
 * by the app. A direct admin delete is intentionally not a fallback: once the
 * deletion migration is installed it must fail outside an unexpired auth lease.
 */
export async function deleteLiveTestAccount(client) {
  const completionToken = randomBytes(32).toString('hex');
  const { data, error } = await client.functions.invoke('account-deletion', {
    method: 'POST',
    body: { completionToken },
  });
  if (error) throw error;
  if (
    !data ||
    data.deleted !== true ||
    typeof data.request_id !== 'string' ||
    !UUID_PATTERN.test(data.request_id) ||
    !['revoked', 'skipped'].includes(data.apple) ||
    !['deleted', 'already_absent', 'skipped'].includes(data.posthog)
  ) {
    throw new Error('LIVE_ACCOUNT_DELETION_RESPONSE_INVALID');
  }
}

/**
 * Prove that a harness identity is absent through the Auth admin API. Only the
 * typed `user_not_found` response is accepted as an error-shaped absence;
 * transport, authorization, and malformed responses remain verification
 * failures rather than being collapsed into "not found".
 */
export async function verifyLiveTestAccountAbsent(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    if (authUserNotFound(error)) return;
    throw error;
  }
  if (data?.user?.id) throw new Error(LIVE_ACCOUNT_STILL_PRESENT);
  if (data?.user !== null) throw new Error('LIVE_ACCOUNT_ABSENCE_RESPONSE_INVALID');
}

/**
 * Clean every surviving harness identity without stopping after the first
 * failure. Failures are appended to the caller's error sink so PASS/exit
 * calculation happens only after deletion and authoritative absence checks.
 */
export async function cleanupLiveTestAccounts({
  admin,
  users,
  errors,
  label = 'Live test account cleanup',
  errorKind = defaultErrorKind,
}) {
  for (const user of users) {
    if (!user?.id) continue;

    let alreadyAbsent = false;
    try {
      await verifyLiveTestAccountAbsent(admin, user.id);
      alreadyAbsent = true;
    } catch {
      // A present user and an inconclusive preflight both require a best-effort
      // deletion attempt. The post-delete check below is authoritative.
    }
    if (alreadyAbsent) continue;

    try {
      await deleteLiveTestAccount(user.client);
    } catch (error) {
      errors.push(`${label} deletion failed: ${errorKind(error)}`);
    }

    try {
      await verifyLiveTestAccountAbsent(admin, user.id);
    } catch (error) {
      errors.push(`${label} auth absence verification failed: ${errorKind(error)}`);
    }
  }
}
