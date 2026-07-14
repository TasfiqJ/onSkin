export const ACCOUNT_SERVICE_SCRUB_FAILED = 'ACCOUNT_SERVICE_SCRUB_FAILED';
export const ACCOUNT_SERVICE_SCRUB_RPC = 'scrub_account_service_rows';

export type AccountServiceScrubResult = {
  complete: true;
  order_attributions_scrubbed: number;
  commerce_click_events_deleted: number;
  obf_contribution_queue_deleted: number;
  subscriptions_events_deleted: number;
  subscriptions_events_scrubbed: number;
  residual_order_attributions: 0;
  residual_obf_contributions: 0;
  residual_subscription_identities: 0;
};

type ServiceRoleRpcClient = {
  rpc: (
    functionName: typeof ACCOUNT_SERVICE_SCRUB_RPC,
    args: { p_user_id: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

const RESULT_KEYS = [
  'commerce_click_events_deleted',
  'complete',
  'obf_contribution_queue_deleted',
  'order_attributions_scrubbed',
  'residual_obf_contributions',
  'residual_order_attributions',
  'residual_subscription_identities',
  'subscriptions_events_deleted',
  'subscriptions_events_scrubbed',
] as const;

function scrubFailure(): Error {
  return new Error(ACCOUNT_SERVICE_SCRUB_FAILED);
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validatedResult(data: unknown): AccountServiceScrubResult {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw scrubFailure();
  }

  const record = data as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== RESULT_KEYS.length || keys.some((key, index) => key !== RESULT_KEYS[index])) {
    throw scrubFailure();
  }

  if (
    record.complete !== true ||
    !isNonnegativeSafeInteger(record.order_attributions_scrubbed) ||
    !isNonnegativeSafeInteger(record.commerce_click_events_deleted) ||
    !isNonnegativeSafeInteger(record.obf_contribution_queue_deleted) ||
    !isNonnegativeSafeInteger(record.subscriptions_events_deleted) ||
    !isNonnegativeSafeInteger(record.subscriptions_events_scrubbed) ||
    record.residual_order_attributions !== 0 ||
    record.residual_obf_contributions !== 0 ||
    record.residual_subscription_identities !== 0
  ) {
    throw scrubFailure();
  }

  return {
    complete: true,
    order_attributions_scrubbed: record.order_attributions_scrubbed,
    commerce_click_events_deleted: record.commerce_click_events_deleted,
    obf_contribution_queue_deleted: record.obf_contribution_queue_deleted,
    subscriptions_events_deleted: record.subscriptions_events_deleted,
    subscriptions_events_scrubbed: record.subscriptions_events_scrubbed,
    residual_order_attributions: 0,
    residual_obf_contributions: 0,
    residual_subscription_identities: 0,
  };
}

/**
 * Atomically scrubs service-role-only account rows before auth.users deletion.
 * The caller must pass the user id returned by the verified Supabase JWT lookup.
 */
export async function scrubAccountServiceRows(
  verifiedUserId: string,
  supabase: ServiceRoleRpcClient,
): Promise<AccountServiceScrubResult> {
  if (typeof verifiedUserId !== 'string' || verifiedUserId.length === 0) {
    throw scrubFailure();
  }

  try {
    const response = await supabase.rpc(ACCOUNT_SERVICE_SCRUB_RPC, {
      p_user_id: verifiedUserId,
    });
    if (!response || response.error) throw scrubFailure();
    return validatedResult(response.data);
  } catch {
    throw scrubFailure();
  }
}
