import { supabase } from '@/lib/supabase/client';
import {
  requireAuthenticatedAccountSession,
  type AuthenticatedAccountSession,
} from '@/lib/auth/authenticatedAccountOwner';

import { runRequest, type RequestEndpoint, type RequestPolicy } from './requestPolicy';

export type EdgeFunctionName =
  | 'account-deletion'
  | 'catalog-lookup'
  | 'catalog-report'
  | 'catalog-search'
  | 'consent-withdrawal'
  | 'data-export'
  | 'subscription-grants';

type EdgeRequestPolicy = Readonly<
  Pick<
    RequestPolicy,
    'deadlineMs' | 'endpoint' | 'idempotent' | 'maxAttempts' | 'maxResponseBytes' | 'ownerScoped'
  >
>;

type EdgeInvokeOptions = NonNullable<Parameters<typeof supabase.functions.invoke>[1]>;

export const EDGE_REQUEST_POLICIES: Readonly<Record<EdgeFunctionName, EdgeRequestPolicy>> = {
  'account-deletion': {
    endpoint: 'account_deletion',
    deadlineMs: 30_000,
    idempotent: false,
    maxAttempts: 1,
    maxResponseBytes: 64 * 1024,
    ownerScoped: true,
  },
  'catalog-lookup': {
    endpoint: 'catalog_lookup',
    deadlineMs: 8_000,
    idempotent: true,
    maxAttempts: 2,
    maxResponseBytes: 512 * 1024,
    ownerScoped: true,
  },
  'catalog-report': {
    endpoint: 'catalog_report',
    deadlineMs: 8_000,
    idempotent: false,
    maxAttempts: 1,
    maxResponseBytes: 64 * 1024,
    ownerScoped: true,
  },
  'catalog-search': {
    endpoint: 'catalog_search',
    deadlineMs: 8_000,
    idempotent: true,
    maxAttempts: 2,
    maxResponseBytes: 512 * 1024,
    ownerScoped: true,
  },
  'consent-withdrawal': {
    endpoint: 'consent_withdrawal',
    deadlineMs: 15_000,
    idempotent: false,
    maxAttempts: 1,
    maxResponseBytes: 64 * 1024,
    ownerScoped: true,
  },
  'data-export': {
    endpoint: 'data_export',
    deadlineMs: 20_000,
    idempotent: true,
    maxAttempts: 2,
    maxResponseBytes: 8 * 1024 * 1024,
    ownerScoped: true,
  },
  'subscription-grants': {
    endpoint: 'subscription_grants',
    deadlineMs: 10_000,
    idempotent: false,
    maxAttempts: 1,
    maxResponseBytes: 256 * 1024,
    ownerScoped: true,
  },
};

export async function invokeEdgeFunction<T>(
  functionName: EdgeFunctionName,
  options: EdgeInvokeOptions = {},
): Promise<T | null> {
  const { signal: callerSignal, ...invokeOptions } = options;
  const policy = EDGE_REQUEST_POLICIES[functionName];
  let pinnedSession: AuthenticatedAccountSession | null = null;
  return runRequest(
    { ...policy, signal: callerSignal },
    async ({ ownerLease, signal }) => {
      if (!ownerLease) throw new Error('AUTHENTICATED_EDGE_OWNER_LEASE_REQUIRED');
      pinnedSession ??= await requireAuthenticatedAccountSession(ownerLease);
      ownerLease.assertCurrent();
      if (signal.aborted) {
        throw Object.assign(new Error('NETWORK_REQUEST_CANCELLED'), {
          code: 'ABORT_ERR',
          name: 'AbortError',
        });
      }
      const { data, error } = await supabase.functions.invoke<T>(functionName, {
        ...invokeOptions,
        headers: {
          ...invokeOptions.headers,
          ...pinnedSession.authorizationHeaders,
        },
        signal,
      });
      ownerLease.assertCurrent();
      if (error) throw error;
      return data;
    },
  );
}

export function requestEndpointForEdgeFunction(functionName: EdgeFunctionName): RequestEndpoint {
  return EDGE_REQUEST_POLICIES[functionName].endpoint;
}
