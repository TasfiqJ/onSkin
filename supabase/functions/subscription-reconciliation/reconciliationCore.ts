export const REVENUECAT_CUSTOMER_INFO_URL = 'https://api.revenuecat.com/v1/subscribers';

export type RevenueCatSnapshotRpcArgs = {
  p_user_id: string;
  p_snapshot_at: string;
  p_entitlement: 'pro' | 'pro_plus' | null;
  p_is_active: boolean;
  p_product_id: string | null;
  p_expires_at: string | null;
  p_store: 'app_store' | 'play_store' | 'web' | 'test_store' | 'promotional' | null;
  p_period_type: string | null;
  p_will_renew: boolean;
  p_original_purchase_at: string | null;
  p_offering_id: null;
  p_environment: 'production' | 'sandbox' | 'test_store' | 'unknown';
  p_management_url: string | null;
  p_package_id: null;
};

export type RevenueCatSnapshotErrorCode =
  | 'REVENUECAT_CUSTOMER_INFO_INVALID'
  | 'REVENUECAT_CUSTOMER_INFO_STALE';

export class RevenueCatSnapshotError extends Error {
  constructor(readonly code: RevenueCatSnapshotErrorCode) {
    super(code);
    this.name = 'RevenueCatSnapshotError';
  }
}

function invalid(): never {
  throw new RevenueCatSnapshotError('REVENUECAT_CUSTOMER_INFO_INVALID');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value !== value.trim() || value.length > maxLength) invalid();
  return value || null;
}

function requiredText(record: Record<string, unknown>, key: string, maxLength: number): string {
  if (!hasOwn(record, key)) invalid();
  const value = boundedText(record[key], maxLength);
  if (!value) invalid();
  return value;
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

function isoTimestamp(value: unknown): { iso: string; milliseconds: number } | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 64 || !RFC3339.test(value)) invalid();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) invalid();
  return { iso: new Date(milliseconds).toISOString(), milliseconds };
}

function requiredBoolean(record: Record<string, unknown>, key: string): boolean {
  if (!hasOwn(record, key) || typeof record[key] !== 'boolean') invalid();
  return record[key];
}

function mapStore(value: unknown): RevenueCatSnapshotRpcArgs['p_store'] {
  const raw = boundedText(value, 100);
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  if (normalized === 'APP_STORE' || normalized === 'MAC_APP_STORE') return 'app_store';
  if (normalized === 'PLAY_STORE' || normalized === 'GOOGLE_PLAY') return 'play_store';
  if (normalized === 'STRIPE' || normalized === 'PADDLE') return 'web';
  if (normalized === 'TEST_STORE') return 'test_store';
  if (normalized === 'PROMOTIONAL') return 'promotional';
  invalid();
}

function periodType(value: unknown): string | null {
  const raw = boundedText(value, 100);
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (!/^[a-z0-9_]+$/u.test(normalized)) invalid();
  return normalized;
}

function safeManagementUrl(value: unknown): string | null {
  const raw = boundedText(value, 2048);
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    !['apps.apple.com', 'play.google.com', 'payments.google.com'].includes(
      url.hostname.toLowerCase(),
    )
  ) {
    return null;
  }
  return url.toString();
}

type EntitlementCandidate = {
  tier: 'pro' | 'pro_plus';
  record: Record<string, unknown>;
  active: boolean;
  expiresAt: string | null;
  effectiveExpiryMs: number | null;
  purchaseAt: string;
  purchaseMs: number;
  productId: string;
};

function entitlementCandidate(
  tier: EntitlementCandidate['tier'],
  value: unknown,
  snapshotMs: number,
): EntitlementCandidate | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) invalid();
  if (
    !hasOwn(value, 'expires_date') ||
    !hasOwn(value, 'grace_period_expires_date') ||
    !hasOwn(value, 'purchase_date') ||
    !hasOwn(value, 'product_identifier')
  ) {
    invalid();
  }
  const expires = isoTimestamp(value.expires_date);
  const grace = isoTimestamp(value.grace_period_expires_date);
  const purchase = isoTimestamp(value.purchase_date);
  if (!purchase || purchase.milliseconds > snapshotMs + 60_000) invalid();
  const productId = requiredText(value, 'product_identifier', 500);
  const effective =
    [expires, grace]
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => right.milliseconds - left.milliseconds)[0] ?? null;
  if (effective && effective.milliseconds < purchase.milliseconds) invalid();
  return {
    tier,
    record: value,
    active: effective === null || effective.milliseconds > snapshotMs,
    expiresAt: effective?.iso ?? null,
    effectiveExpiryMs: effective?.milliseconds ?? null,
    purchaseAt: purchase.iso,
    purchaseMs: purchase.milliseconds,
    productId,
  };
}

function selectEntitlement(
  entitlements: Record<string, unknown>,
  snapshotMs: number,
): EntitlementCandidate | null {
  const proPlus = entitlementCandidate('pro_plus', entitlements.pro_plus, snapshotMs);
  const pro = entitlementCandidate('pro', entitlements.pro, snapshotMs);
  return [proPlus, pro].find((candidate) => candidate?.active) ?? proPlus ?? pro ?? null;
}

type ProductEvidence = {
  store: NonNullable<RevenueCatSnapshotRpcArgs['p_store']>;
  periodType: string | null;
  sandbox: boolean;
  originalPurchase: string;
  originalPurchaseMs: number;
  purchaseAt: string;
  purchaseMs: number;
  effectiveExpiryAt: string | null;
  effectiveExpiryMs: number | null;
  unsubscribedAt: string | null;
};

function subscriptionEvidence(value: unknown, snapshotMs: number): ProductEvidence {
  if (!isRecord(value)) invalid();
  for (const key of [
    'expires_date',
    'grace_period_expires_date',
    'is_sandbox',
    'original_purchase_date',
    'period_type',
    'purchase_date',
    'store',
    'unsubscribe_detected_at',
  ]) {
    if (!hasOwn(value, key)) invalid();
  }
  const expires = isoTimestamp(value.expires_date);
  const grace = isoTimestamp(value.grace_period_expires_date);
  const purchase = isoTimestamp(value.purchase_date);
  const originalPurchase = isoTimestamp(value.original_purchase_date);
  const store = mapStore(value.store);
  const normalizedPeriodType = periodType(value.period_type);
  const sandbox = requiredBoolean(value, 'is_sandbox');
  const unsubscribedAt = isoTimestamp(value.unsubscribe_detected_at);
  if (
    !purchase ||
    !originalPurchase ||
    !store ||
    !normalizedPeriodType ||
    originalPurchase.milliseconds > purchase.milliseconds ||
    purchase.milliseconds > snapshotMs + 60_000
  ) {
    invalid();
  }
  const effectiveExpiry =
    [expires, grace]
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => right.milliseconds - left.milliseconds)[0] ?? null;
  if (effectiveExpiry && effectiveExpiry.milliseconds < purchase.milliseconds) invalid();
  return {
    store,
    periodType: normalizedPeriodType,
    sandbox,
    originalPurchase: originalPurchase.iso,
    originalPurchaseMs: originalPurchase.milliseconds,
    purchaseAt: purchase.iso,
    purchaseMs: purchase.milliseconds,
    effectiveExpiryAt: effectiveExpiry?.iso ?? null,
    effectiveExpiryMs: effectiveExpiry?.milliseconds ?? null,
    unsubscribedAt: unsubscribedAt?.iso ?? null,
  };
}

function nonSubscriptionEvidence(value: unknown, snapshotMs: number): ProductEvidence {
  if (!Array.isArray(value) || value.length === 0 || value.length > 512) invalid();
  const candidates = value.map((entry) => {
    if (!isRecord(entry)) invalid();
    for (const key of ['id', 'is_sandbox', 'purchase_date', 'store']) {
      if (!hasOwn(entry, key)) invalid();
    }
    requiredText(entry, 'id', 500);
    const purchase = isoTimestamp(entry.purchase_date);
    const store = mapStore(entry.store);
    const sandbox = requiredBoolean(entry, 'is_sandbox');
    if (!purchase || !store || purchase.milliseconds > snapshotMs + 60_000) invalid();
    return { purchase, store, sandbox };
  });
  const latest = candidates.sort(
    (left, right) => right.purchase.milliseconds - left.purchase.milliseconds,
  )[0];
  if (!latest) invalid();
  return {
    store: latest.store,
    periodType: null,
    sandbox: latest.sandbox,
    originalPurchase: latest.purchase.iso,
    originalPurchaseMs: latest.purchase.milliseconds,
    purchaseAt: latest.purchase.iso,
    purchaseMs: latest.purchase.milliseconds,
    effectiveExpiryAt: null,
    effectiveExpiryMs: null,
    unsubscribedAt: null,
  };
}

function productEvidence(
  productId: string,
  subscriptions: Record<string, unknown>,
  nonSubscriptions: Record<string, unknown>,
  snapshotMs: number,
): ProductEvidence {
  const hasSubscription = hasOwn(subscriptions, productId);
  const hasNonSubscription = hasOwn(nonSubscriptions, productId);
  // A product identifier must resolve to exactly one provider purchase lane.
  // Accepting a missing or contradictory product key would allow a malformed
  // positive entitlement object to manufacture access.
  if (hasSubscription === hasNonSubscription) invalid();
  return hasSubscription
    ? subscriptionEvidence(subscriptions[productId], snapshotMs)
    : nonSubscriptionEvidence(nonSubscriptions[productId], snapshotMs);
}

export function buildRevenueCatCustomerInfoRequest(
  userId: string,
  secretApiKey: string,
): { url: string; init: RequestInit } {
  const key = secretApiKey.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(userId) ||
    key !== secretApiKey ||
    key.length < 8 ||
    key.length > 512
  ) {
    throw new Error('REVENUECAT_RECONCILIATION_NOT_CONFIGURED');
  }
  return {
    url: `${REVENUECAT_CUSTOMER_INFO_URL}/${encodeURIComponent(userId)}`,
    init: {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
    },
  };
}

export function parseRevenueCatCustomerInfoSnapshot(
  body: unknown,
  userId: string,
  nowMs: number,
  maxSnapshotAgeMs: number,
): RevenueCatSnapshotRpcArgs {
  if (
    !isRecord(body) ||
    !Number.isFinite(nowMs) ||
    !Number.isInteger(maxSnapshotAgeMs) ||
    maxSnapshotAgeMs < 15_000 ||
    maxSnapshotAgeMs > 300_000
  ) {
    invalid();
  }

  // Only RevenueCat v1's snake_case provider request_date is a trusted
  // snapshot watermark. Never substitute requestDate, observedAt, Date, or
  // local processing time.
  const requestDate = isoTimestamp(body.request_date);
  if (!requestDate) invalid();
  if (requestDate.milliseconds < nowMs - maxSnapshotAgeMs) {
    throw new RevenueCatSnapshotError('REVENUECAT_CUSTOMER_INFO_STALE');
  }
  if (requestDate.milliseconds > nowMs + 60_000) invalid();
  if (
    !hasOwn(body, 'request_date_ms') ||
    typeof body.request_date_ms !== 'number' ||
    !Number.isSafeInteger(body.request_date_ms) ||
    Math.abs(body.request_date_ms - requestDate.milliseconds) > 1_000
  ) {
    invalid();
  }

  if (!isRecord(body.subscriber)) invalid();
  const subscriber = body.subscriber;
  if (
    !hasOwn(subscriber, 'entitlements') ||
    !hasOwn(subscriber, 'subscriptions') ||
    !hasOwn(subscriber, 'non_subscriptions') ||
    !hasOwn(subscriber, 'management_url') ||
    !hasOwn(subscriber, 'original_app_user_id')
  ) {
    invalid();
  }
  const entitlements = subscriber.entitlements;
  const subscriptions = subscriber.subscriptions;
  const nonSubscriptions = subscriber.non_subscriptions;
  if (!isRecord(entitlements) || !isRecord(subscriptions) || !isRecord(nonSubscriptions)) {
    invalid();
  }
  requiredText(subscriber, 'original_app_user_id', 1500);
  const managementUrlValue = subscriber.management_url;
  if (managementUrlValue !== null && typeof managementUrlValue !== 'string') invalid();
  if (
    Object.keys(entitlements).length > 512 ||
    Object.keys(subscriptions).length > 512 ||
    Object.keys(nonSubscriptions).length > 512
  ) {
    invalid();
  }

  const selected = selectEntitlement(entitlements, requestDate.milliseconds);
  const productId = selected?.productId ?? null;
  const evidence = selected
    ? productEvidence(productId!, subscriptions, nonSubscriptions, requestDate.milliseconds)
    : null;
  if (
    selected &&
    evidence &&
    (evidence.originalPurchaseMs > selected.purchaseMs ||
      evidence.purchaseMs !== selected.purchaseMs ||
      evidence.effectiveExpiryMs !== selected.effectiveExpiryMs)
  ) {
    invalid();
  }

  const environment: RevenueCatSnapshotRpcArgs['p_environment'] =
    evidence?.store === 'test_store'
      ? 'test_store'
      : evidence?.sandbox === true
        ? 'sandbox'
        : evidence?.sandbox === false
          ? 'production'
          : 'unknown';
  const willRenew = Boolean(
    selected?.active &&
    selected.effectiveExpiryMs !== null &&
    evidence?.periodType !== null &&
    evidence?.store !== 'promotional' &&
    evidence?.store !== 'test_store' &&
    evidence?.unsubscribedAt === null,
  );

  return {
    p_user_id: userId,
    p_snapshot_at: requestDate.iso,
    p_entitlement: selected?.tier ?? null,
    p_is_active: selected?.active ?? false,
    p_product_id: productId,
    p_expires_at: selected?.expiresAt ?? null,
    p_store: evidence?.store ?? null,
    p_period_type: evidence?.periodType ?? null,
    p_will_renew: willRenew,
    p_original_purchase_at: evidence?.originalPurchase ?? null,
    p_offering_id: null,
    p_environment: environment,
    p_management_url: selected ? safeManagementUrl(subscriber.management_url) : null,
    p_package_id: null,
  };
}
