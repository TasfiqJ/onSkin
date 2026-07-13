export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  product_id?: string;
  store?: string;
  environment?: string;
  entitlement_ids?: string[];
  event_timestamp_ms?: number;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  original_purchase_date_ms?: number;
  original_transaction_id?: string;
  transaction_id?: string;
  period_type?: string;
  is_sandbox?: boolean;
  presented_offering_id?: string;
};

export type RevenueCatVerification = {
  signatureVerified: boolean;
  authVerified: boolean;
};

export type RevenueCatAtomicArgs = Record<string, unknown> & {
  p_rc_event_id: string;
  p_event_type: string;
  p_user_candidates: string[];
  p_provider_event_at: string;
  p_received_at: string;
  p_should_project: boolean;
  p_projection_priority: number;
  p_is_active: boolean;
  p_will_renew: boolean;
};

export type RevenueCatAtomicResult = {
  outcome: 'processed' | 'stale' | 'duplicate' | 'ignored' | 'unresolved' | 'error';
  projection_applied: boolean;
  processing_status: string;
};

export type RevenueCatRpcClient = {
  rpc(
    functionName: string,
    args: RevenueCatAtomicArgs,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

export type ProjectionOrder = {
  providerEventAt: string;
  priority: number;
  eventId: string;
};

const ACTIVATE_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
]);
const DEACTIVATE_TYPES = new Set(['EXPIRATION', 'REFUND']);
const KEEP_ACTIVE_TYPES = new Set(['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED']);
const RENEWING_TYPES = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_EXTENDED',
  'REFUND_REVERSED',
]);

const PRIORITY = {
  ignored: 0,
  keepActive: 100,
  activate: 200,
  deactivate: 300,
} as const;

export class RevenueCatAtomicProcessingError extends Error {
  constructor() {
    super('REVENUECAT_ATOMIC_PROCESSING_FAILED');
    this.name = 'RevenueCatAtomicProcessingError';
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  );
  return filtered.length > 0 ? filtered : undefined;
}

function stableStrings(values: unknown): string[] {
  return [...new Set(optionalStringArray(values) ?? [])].sort();
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function isoFromMs(value: unknown, required: boolean): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    if (required) throw new Error('INVALID_REVENUECAT_EVENT_TIMESTAMP');
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    if (required) throw new Error('INVALID_REVENUECAT_EVENT_TIMESTAMP');
    return null;
  }
  return date.toISOString();
}

function mapStore(store: string | undefined): string | null {
  if (!store) return null;
  const normalized = store.toUpperCase();
  if (normalized.includes('APP_STORE') || normalized.includes('MAC_APP_STORE')) return 'app_store';
  if (normalized.includes('PLAY')) return 'play_store';
  if (normalized.includes('TEST_STORE')) return 'test_store';
  if (normalized.includes('PROMOTIONAL')) return 'app_granted';
  if (
    normalized.includes('STRIPE') ||
    normalized.includes('PADDLE') ||
    normalized.includes('WEB') ||
    normalized.includes('RC_BILLING')
  ) {
    return 'web';
  }
  return null;
}

function mapEnvironment(event: RevenueCatEvent): string {
  if (event.store?.toUpperCase() === 'TEST_STORE') return 'test_store';
  if (event.is_sandbox) return 'sandbox';
  const environment = event.environment?.toLowerCase();
  if (environment === 'production' || environment === 'sandbox') {
    return environment;
  }
  return 'unknown';
}

export function sanitizeRevenueCatEvent(event: RevenueCatEvent): Record<string, unknown> {
  return compactRecord({
    id: optionalString(event.id),
    type: optionalString(event.type)?.toUpperCase(),
    product_id: optionalString(event.product_id),
    store: optionalString(event.store),
    environment: optionalString(event.environment),
    entitlement_ids: optionalStringArray(event.entitlement_ids),
    event_timestamp_ms: optionalNumber(event.event_timestamp_ms),
    purchased_at_ms: optionalNumber(event.purchased_at_ms),
    expiration_at_ms: optionalNumber(event.expiration_at_ms),
    original_purchase_date_ms: optionalNumber(event.original_purchase_date_ms),
    original_transaction_id: optionalString(event.original_transaction_id),
    transaction_id: optionalString(event.transaction_id),
    period_type: optionalString(event.period_type),
    is_sandbox: optionalBoolean(event.is_sandbox),
    presented_offering_id: optionalString(event.presented_offering_id),
  });
}

function projectionFor(eventType: string): {
  shouldProject: boolean;
  priority: number;
  isActive: boolean;
  willRenew: boolean;
} {
  if (DEACTIVATE_TYPES.has(eventType)) {
    return {
      shouldProject: true,
      priority: PRIORITY.deactivate,
      isActive: false,
      willRenew: false,
    };
  }
  if (ACTIVATE_TYPES.has(eventType)) {
    return {
      shouldProject: true,
      priority: PRIORITY.activate,
      isActive: true,
      willRenew: RENEWING_TYPES.has(eventType),
    };
  }
  if (KEEP_ACTIVE_TYPES.has(eventType)) {
    return {
      shouldProject: true,
      priority: PRIORITY.keepActive,
      isActive: true,
      willRenew: RENEWING_TYPES.has(eventType),
    };
  }
  return {
    shouldProject: false,
    priority: PRIORITY.ignored,
    isActive: false,
    willRenew: false,
  };
}

function deterministicUserCandidates(event: RevenueCatEvent, eventType: string): string[] {
  const destinationCandidates = eventType === 'TRANSFER' ? stableStrings(event.transferred_to) : [];
  const directCandidates = [
    optionalString(event.app_user_id),
    optionalString(event.original_app_user_id),
  ].filter((value): value is string => Boolean(value));
  return [
    ...new Set([...destinationCandidates, ...directCandidates, ...stableStrings(event.aliases)]),
  ];
}

export function buildRevenueCatAtomicArgs(
  event: RevenueCatEvent,
  verification: RevenueCatVerification,
  receivedAt = new Date(),
): RevenueCatAtomicArgs {
  const eventId = optionalString(event.id);
  const eventType = optionalString(event.type)?.toUpperCase();
  if (!eventId || eventId.length > 255 || !eventType || eventType.length > 100) {
    throw new Error('INVALID_REVENUECAT_EVENT');
  }
  if (!Number.isFinite(receivedAt.getTime())) {
    throw new Error('INVALID_RECEIVED_AT');
  }

  const providerEventAt = isoFromMs(event.event_timestamp_ms, true);
  if (!providerEventAt) throw new Error('INVALID_REVENUECAT_EVENT_TIMESTAMP');
  const aliases = stableStrings(event.aliases);
  const transferredFrom = stableStrings(event.transferred_from);
  const transferredTo = stableStrings(event.transferred_to);
  const projection = projectionFor(eventType);
  const sanitizedEvent = sanitizeRevenueCatEvent(event);
  const entitlementIds = optionalStringArray(event.entitlement_ids) ?? [];
  const entitlement = entitlementIds.includes('pro_plus') ? 'pro_plus' : 'pro';

  return {
    p_rc_event_id: eventId,
    p_event_type: eventType,
    p_user_candidates: deterministicUserCandidates(event, eventType),
    p_app_user_id: optionalString(event.app_user_id) ?? null,
    p_original_app_user_id: optionalString(event.original_app_user_id) ?? null,
    p_aliases: aliases.length > 0 ? aliases : null,
    p_transferred_from: transferredFrom.length > 0 ? transferredFrom : null,
    p_transferred_to: transferredTo.length > 0 ? transferredTo : null,
    p_environment: mapEnvironment(event),
    p_store: mapStore(event.store),
    p_product_id: optionalString(event.product_id) ?? null,
    p_entitlement: entitlement,
    p_expiration_at: isoFromMs(event.expiration_at_ms, false),
    p_original_purchase_at:
      isoFromMs(event.purchased_at_ms, false) ?? isoFromMs(event.original_purchase_date_ms, false),
    p_provider_event_at: providerEventAt,
    p_received_at: receivedAt.toISOString(),
    p_original_transaction_id: optionalString(event.original_transaction_id) ?? null,
    p_transaction_id: optionalString(event.transaction_id) ?? null,
    p_period_type: optionalString(event.period_type)?.toLowerCase() ?? null,
    p_will_renew: projection.willRenew,
    p_is_active: projection.isActive,
    p_should_project: projection.shouldProject,
    p_projection_priority: projection.priority,
    p_offering_id: optionalString(event.presented_offering_id) ?? null,
    p_payload: { event: sanitizedEvent },
    p_signature_verified: verification.signatureVerified,
    p_auth_verified: verification.authVerified,
  };
}

function isAtomicResult(value: unknown): value is RevenueCatAtomicResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.outcome === 'string' &&
    typeof row.projection_applied === 'boolean' &&
    typeof row.processing_status === 'string'
  );
}

export async function persistRevenueCatEvent(
  client: RevenueCatRpcClient,
  args: RevenueCatAtomicArgs,
): Promise<RevenueCatAtomicResult> {
  const { data, error } = await client.rpc('process_revenuecat_webhook_event', args);
  if (error) throw new RevenueCatAtomicProcessingError();
  const row = Array.isArray(data) ? data[0] : data;
  if (!isAtomicResult(row) || row.outcome === 'error' || row.processing_status === 'error') {
    throw new RevenueCatAtomicProcessingError();
  }
  return row;
}

export function compareProjectionOrder(left: ProjectionOrder, right: ProjectionOrder): number {
  const timeDifference = Date.parse(left.providerEventAt) - Date.parse(right.providerEventAt);
  if (timeDifference !== 0) return timeDifference;
  if (left.priority !== right.priority) return left.priority - right.priority;
  const leftBytes = new TextEncoder().encode(left.eventId);
  const rightBytes = new TextEncoder().encode(right.eventId);
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? -1) - (rightBytes[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return 0;
}
