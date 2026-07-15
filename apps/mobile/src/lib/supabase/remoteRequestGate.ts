import { env } from '../env';
import {
  SupabaseRemoteRequestAdmissionController,
  SupabaseRemoteRequestAdmissionError,
  parseSupabaseRemoteSessionBinding,
  type SupabaseAccountDeletionAction,
  type SupabaseRemoteRequestSnapshot,
  type SupabaseRemoteRequestTransport,
  type SupabaseRemoteSessionBinding,
} from './remoteRequestAdmission';

type AuthenticatedAccountDeletionAction = Exclude<
  SupabaseAccountDeletionAction,
  'status' | 'publication_release'
>;

export type SupabaseAccountDeletionRequestPermit =
  | Readonly<{
      action: AuthenticatedAccountDeletionAction;
      binding: SupabaseRemoteSessionBinding;
      timeoutMs?: number;
    }>
  | Readonly<{
      action: 'status' | 'publication_release';
      binding?: never;
      timeoutMs?: number;
    }>;

/**
 * One process-wide authority instance. The Supabase client, direct Edge
 * transports, Auth lifecycle, and account-deletion lifecycle must all use this
 * exact controller so none can create an independently open network lane.
 */
export const supabaseRemoteRequestAdmission = new SupabaseRemoteRequestAdmissionController(
  env.supabaseUrl,
  { publicAuthorizationToken: env.supabasePublishableKey },
);

export function requireSupabaseRemoteSessionBinding(
  accessToken: unknown,
  expectedSubject: unknown,
): SupabaseRemoteSessionBinding {
  const binding = parseSupabaseRemoteSessionBinding(accessToken, expectedSubject);
  if (binding === null) {
    throw new SupabaseRemoteRequestAdmissionError('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
  }
  return binding;
}

export function supabaseRemoteRequestSnapshot(): SupabaseRemoteRequestSnapshot {
  return supabaseRemoteRequestAdmission.snapshot();
}

/** Exact active bearer check that never returns or serializes the stored token. */
export function hasActiveSupabaseRemoteRequestBinding(
  accessToken: unknown,
  expectedSubject: unknown,
): boolean {
  return supabaseRemoteRequestAdmission.hasActiveBinding(accessToken, expectedSubject);
}

export function createSupabaseRemoteRequestGatedFetch(
  transport?: SupabaseRemoteRequestTransport,
): SupabaseRemoteRequestTransport {
  return supabaseRemoteRequestAdmission.createFetch(transport);
}

export function setSupabaseRemoteRequestCandidate(
  accessToken: unknown,
  expectedSubject: unknown,
): SupabaseRemoteSessionBinding {
  return supabaseRemoteRequestAdmission.setCandidate(accessToken, expectedSubject);
}

export function activateSupabaseRemoteRequest(
  accessToken: unknown,
  expectedSubject: unknown,
): SupabaseRemoteSessionBinding {
  return supabaseRemoteRequestAdmission.activate(accessToken, expectedSubject);
}

export function rotateActiveSupabaseRemoteRequestBinding(
  previousBinding: SupabaseRemoteSessionBinding,
  accessToken: unknown,
  expectedSubject: unknown,
): Promise<SupabaseRemoteSessionBinding> {
  return supabaseRemoteRequestAdmission.rotateActiveBinding(
    previousBinding,
    accessToken,
    expectedSubject,
  );
}

/** The deletion state closes synchronously before this returned drain settles. */
export function beginSupabaseRemoteDeletionBoundary(
  binding: SupabaseRemoteSessionBinding,
): Promise<SupabaseRemoteSessionBinding> {
  return supabaseRemoteRequestAdmission.beginDeletion(binding.accessToken, binding.subject);
}

/** The closed state is visible synchronously before this returned drain settles. */
export function closeSupabaseRemoteRequestBoundary(): Promise<void> {
  return supabaseRemoteRequestAdmission.close();
}

/** Wait until even deadline-quarantined SDK continuations have truly settled. */
export function waitForSupabaseRemoteResidualSettlement(): Promise<void> {
  return supabaseRemoteRequestAdmission.waitForResidualSettlement();
}

export function runWithSupabaseFreshAuthPermit<T>(
  operation: () => T | Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  return supabaseRemoteRequestAdmission.runWithPermit(
    { purpose: 'auth_fresh_sign_in', timeoutMs },
    operation,
  );
}

export function runWithSupabaseIdentityUpgradePermit<T>(
  binding: SupabaseRemoteSessionBinding,
  operation: () => T | Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  return supabaseRemoteRequestAdmission.runWithPermit(
    { purpose: 'auth_identity_upgrade', binding, timeoutMs },
    operation,
  );
}

export function runWithSupabaseAuthRefreshPermit<T>(
  binding: SupabaseRemoteSessionBinding,
  refreshToken: string,
  operation: () => T | Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  return supabaseRemoteRequestAdmission.runWithPermit(
    { purpose: 'auth_refresh', binding, refreshToken, timeoutMs },
    operation,
  );
}

export function runWithSupabaseAuthVerificationPermit<T>(
  binding: SupabaseRemoteSessionBinding,
  operation: () => T | Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  return supabaseRemoteRequestAdmission.runWithPermit(
    { purpose: 'auth_verify', binding, timeoutMs },
    operation,
  );
}

export function runWithSupabaseAuthLogoutPermit<T>(
  binding: SupabaseRemoteSessionBinding,
  operation: () => T | Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  return supabaseRemoteRequestAdmission.runWithPermit(
    { purpose: 'auth_logout', binding, timeoutMs },
    operation,
  );
}

export function runWithSupabaseAccountDeletionRequestPermit<T>(
  permit: SupabaseAccountDeletionRequestPermit,
  transport: SupabaseRemoteRequestTransport,
  operation: (gatedTransport: SupabaseRemoteRequestTransport) => T | Promise<T>,
): Promise<T> {
  const requestPermit =
    permit.action === 'status' || permit.action === 'publication_release'
      ? {
          purpose: 'account_deletion' as const,
          action: permit.action,
          timeoutMs: permit.timeoutMs,
        }
      : {
          purpose: 'account_deletion' as const,
          action: permit.action,
          binding: permit.binding,
          timeoutMs: permit.timeoutMs,
        };
  return supabaseRemoteRequestAdmission.runWithPermit(requestPermit, () =>
    operation(supabaseRemoteRequestAdmission.createFetch(transport)),
  );
}

export {
  isSupabaseRemoteRequestAdmissionError,
  parseSupabaseRemoteSessionBinding,
} from './remoteRequestAdmission';
export type {
  SupabaseRemoteRequestAdmissionErrorCode,
  SupabaseRemoteRequestState,
  SupabaseRemoteRequestTransport,
  SupabaseRemoteSessionBinding,
} from './remoteRequestAdmission';
