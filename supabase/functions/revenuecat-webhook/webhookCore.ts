import {
  buildRevenueCatIdentityTombstoneLookup,
  type RevenueCatIdentityTombstoneCandidate,
  type RevenueCatIdentityTombstoneKeyring,
} from '../_shared/revenueCatIdentityTombstone.ts';

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

export type RevenueCatStructuredIdentityFields = {
  app_user_id: string | null;
  original_app_user_id: string | null;
  aliases: string[] | null;
  transferred_from: string[] | null;
  transferred_to: string[] | null;
};

export type RevenueCatIdentityFilterResult =
  | {
      outcome: 'persist';
      userCandidates: string[];
      identityFields: RevenueCatStructuredIdentityFields;
    }
  | {
      outcome: 'suppressed_deleted_account';
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
  p_identity_hmac_key_versions: number[];
  p_identity_hmacs: string[];
  p_identity_values: string[];
};

export type RevenueCatAtomicResult = {
  outcome:
    | 'processed'
    | 'stale'
    | 'duplicate'
    | 'ignored'
    | 'unresolved'
    | 'suppressed_deleted_account'
    | 'error';
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_SUBSTRING_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ASCII_BOUNDARY_WHITESPACE = /^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g;

export class RevenueCatAtomicProcessingError extends Error {
  constructor() {
    super('REVENUECAT_ATOMIC_PROCESSING_FAILED');
    this.name = 'RevenueCatAtomicProcessingError';
  }
}

export class RevenueCatIdentityInputError extends Error {
  constructor(code: 'INVALID_REVENUECAT_IDENTITY_SHAPE' | 'INVALID_ACTIVE_ACCOUNT_SET') {
    super(code);
    this.name = 'RevenueCatIdentityInputError';
  }
}

function normalizeRevenueCatEventType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(ASCII_BOUNDARY_WHITESPACE, '').toUpperCase();
  return normalized || undefined;
}

type NormalizedIdentityValue = {
  value: string;
  accountUuid: string | null;
  embeddedAccountUuids: string[];
};

type NormalizedRevenueCatIdentities = {
  appUserId: NormalizedIdentityValue | null;
  originalAppUserId: NormalizedIdentityValue | null;
  aliases: NormalizedIdentityValue[];
  transferredFrom: NormalizedIdentityValue[];
  transferredTo: NormalizedIdentityValue[];
  accountUuidCandidates: string[];
};

function invalidIdentityShape(): never {
  throw new RevenueCatIdentityInputError('INVALID_REVENUECAT_IDENTITY_SHAPE');
}

function normalizeIdentityValue(value: unknown): NormalizedIdentityValue {
  if (typeof value !== 'string') invalidIdentityShape();
  const trimmed = value.replace(ASCII_BOUNDARY_WHITESPACE, '');
  if (!trimmed) invalidIdentityShape();
  const accountUuid = UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
  const embeddedAccountUuids = [
    ...new Set((trimmed.match(UUID_SUBSTRING_PATTERN) ?? []).map((uuid) => uuid.toLowerCase())),
  ];
  return {
    value: accountUuid ?? value,
    accountUuid,
    embeddedAccountUuids,
  };
}

function normalizeIdentityScalar(
  record: Record<string, unknown>,
  key: 'app_user_id' | 'original_app_user_id',
): NormalizedIdentityValue | null {
  const value = record[key];
  if (value === undefined || value === null) return null;
  return normalizeIdentityValue(value);
}

function normalizeIdentityArray(
  record: Record<string, unknown>,
  key: 'aliases' | 'transferred_from' | 'transferred_to',
): NormalizedIdentityValue[] {
  const value = record[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalidIdentityShape();
  return value.map(normalizeIdentityValue);
}

function normalizeRevenueCatIdentities(event: unknown): NormalizedRevenueCatIdentities {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    invalidIdentityShape();
  }
  const record = event as Record<string, unknown>;
  const appUserId = normalizeIdentityScalar(record, 'app_user_id');
  const originalAppUserId = normalizeIdentityScalar(record, 'original_app_user_id');
  const aliases = normalizeIdentityArray(record, 'aliases');
  const transferredFrom = normalizeIdentityArray(record, 'transferred_from');
  const transferredTo = normalizeIdentityArray(record, 'transferred_to');
  const accountUuidCandidates = [
    appUserId,
    originalAppUserId,
    ...aliases,
    ...transferredFrom,
    ...transferredTo,
  ].flatMap((identity) => identity?.embeddedAccountUuids ?? []);

  return {
    appUserId,
    originalAppUserId,
    aliases,
    transferredFrom,
    transferredTo,
    accountUuidCandidates: [...new Set(accountUuidCandidates)].sort(),
  };
}

/**
 * Returns only canonical account UUIDs in global sort order. Callers may use
 * this order for database advisory locks and active-account lookups; it is not
 * the semantic RevenueCat owner resolution order.
 */
export function extractRevenueCatAccountUuidCandidates(event: unknown): string[] {
  return normalizeRevenueCatIdentities(event).accountUuidCandidates;
}

function revenueCatTombstoneCandidates(
  identities: NormalizedRevenueCatIdentities,
): RevenueCatIdentityTombstoneCandidate[] {
  const result: RevenueCatIdentityTombstoneCandidate[] = [];
  const seen = new Set<string>();
  for (const identity of [
    identities.appUserId,
    identities.originalAppUserId,
    ...identities.aliases,
    ...identities.transferredFrom,
    ...identities.transferredTo,
  ]) {
    if (!identity) continue;
    for (const hashIdentity of [identity.value, ...identity.embeddedAccountUuids]) {
      const key = `${identity.value.length}:${identity.value}${hashIdentity.length}:${hashIdentity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ identityValue: identity.value, hashIdentity });
    }
  }
  return result;
}

/**
 * Adds aligned, keyed-HMAC lookup inputs after the synchronous event mapping.
 * An empty/unattached lookup is rejected by migration 0051 whenever structured
 * identities are present, so production cannot silently bypass tombstones.
 */
export async function attachRevenueCatIdentityTombstoneLookup(
  args: RevenueCatAtomicArgs,
  event: unknown,
  projectId: unknown,
  keyring: RevenueCatIdentityTombstoneKeyring,
): Promise<RevenueCatAtomicArgs> {
  const lookup = await buildRevenueCatIdentityTombstoneLookup(
    projectId,
    revenueCatTombstoneCandidates(normalizeRevenueCatIdentities(event)),
    keyring,
  );
  return {
    ...args,
    p_identity_hmac_key_versions: lookup.keyVersions,
    p_identity_hmacs: lookup.identityHmacs,
    p_identity_values: lookup.identityValues,
  };
}

function normalizeActiveAccountSet(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    throw new RevenueCatIdentityInputError('INVALID_ACTIVE_ACCOUNT_SET');
  }
  const active = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new RevenueCatIdentityInputError('INVALID_ACTIVE_ACCOUNT_SET');
    }
    const trimmed = item.replace(ASCII_BOUNDARY_WHITESPACE, '');
    if (!UUID_PATTERN.test(trimmed)) {
      throw new RevenueCatIdentityInputError('INVALID_ACTIVE_ACCOUNT_SET');
    }
    active.add(trimmed.toLowerCase());
  }
  return active;
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function stableSortedIdentityValues(values: NormalizedIdentityValue[]): string[] | null {
  const normalized = [...new Set(values.map((identity) => identity.value))].sort();
  return normalized.length > 0 ? normalized : null;
}

function containsInactiveAccountUuid(value: string, inactiveAccountUuids: string[]): boolean {
  const normalized = value.toLowerCase();
  return inactiveAccountUuids.some((accountUuid) => normalized.includes(accountUuid));
}

function retainedIdentity(
  identity: NormalizedIdentityValue,
  activeAccountUuids: Set<string>,
  inactiveAccountUuids: string[],
): boolean {
  if (identity.accountUuid) return activeAccountUuids.has(identity.accountUuid);
  return !containsInactiveAccountUuid(identity.value, inactiveAccountUuids);
}

function activeUuidValues(
  identities: NormalizedIdentityValue[],
  activeAccountUuids: Set<string>,
): string[] {
  return identities
    .map((identity) => identity.accountUuid)
    .filter(
      (identity): identity is string => identity !== null && activeAccountUuids.has(identity),
    );
}

/**
 * Removes deleted-account UUIDs before an event is persisted. Anonymous
 * provider identifiers remain audit-only and are never returned as owner
 * candidates. A webhook containing account UUIDs but no active account is
 * represented by a constant, identifier-free suppression outcome.
 */
export function filterRevenueCatIdentitiesForActiveAccounts(
  event: unknown,
  activeAccountIds: unknown,
): RevenueCatIdentityFilterResult {
  const normalized = normalizeRevenueCatIdentities(event);
  const eventType = normalizeRevenueCatEventType((event as Record<string, unknown>).type) ?? '';
  const activeAccountUuids = normalizeActiveAccountSet(activeAccountIds);
  const eventActiveAccountUuids = normalized.accountUuidCandidates.filter((accountUuid) =>
    activeAccountUuids.has(accountUuid),
  );

  if (normalized.accountUuidCandidates.length > 0 && eventActiveAccountUuids.length === 0) {
    return { outcome: 'suppressed_deleted_account' };
  }

  const inactiveAccountUuids = normalized.accountUuidCandidates.filter(
    (accountUuid) => !activeAccountUuids.has(accountUuid),
  );
  const aliases = normalized.aliases.filter((identity) =>
    retainedIdentity(identity, activeAccountUuids, inactiveAccountUuids),
  );
  const transferredFrom = normalized.transferredFrom.filter((identity) =>
    retainedIdentity(identity, activeAccountUuids, inactiveAccountUuids),
  );
  const transferredTo = normalized.transferredTo.filter((identity) =>
    retainedIdentity(identity, activeAccountUuids, inactiveAccountUuids),
  );
  const appUserId =
    normalized.appUserId &&
    retainedIdentity(normalized.appUserId, activeAccountUuids, inactiveAccountUuids)
      ? normalized.appUserId
      : null;
  const originalAppUserId =
    normalized.originalAppUserId &&
    retainedIdentity(normalized.originalAppUserId, activeAccountUuids, inactiveAccountUuids)
      ? normalized.originalAppUserId
      : null;
  const userCandidates = stableUnique([
    ...(eventType === 'TRANSFER' ? activeUuidValues(transferredTo, activeAccountUuids) : []),
    ...(appUserId?.accountUuid ? [appUserId.accountUuid] : []),
    ...(originalAppUserId?.accountUuid ? [originalAppUserId.accountUuid] : []),
    ...activeUuidValues(aliases, activeAccountUuids),
  ]);

  return {
    outcome: 'persist',
    userCandidates,
    identityFields: {
      app_user_id: appUserId?.value ?? null,
      original_app_user_id: originalAppUserId?.value ?? null,
      aliases: stableSortedIdentityValues(aliases),
      transferred_from: stableSortedIdentityValues(transferredFrom),
      transferred_to: stableSortedIdentityValues(transferredTo),
    },
  };
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
  // RevenueCat promotional entitlements are still provider authority. The
  // `app_granted` value is reserved for the app's independent reverse-trial
  // lane and must never be emitted by a provider webhook.
  if (normalized.includes('PROMOTIONAL')) return 'promotional';
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
    type: normalizeRevenueCatEventType(event.type),
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

function sortedAccountUuids(identities: NormalizedIdentityValue[]): string[] {
  return [
    ...new Set(
      identities
        .map((identity) => identity.accountUuid)
        .filter((identity): identity is string => identity !== null),
    ),
  ].sort();
}

function deterministicUserCandidates(
  identities: NormalizedRevenueCatIdentities,
  eventType: string,
): string[] {
  const directCandidates = [
    identities.appUserId?.accountUuid,
    identities.originalAppUserId?.accountUuid,
  ].filter((value): value is string => Boolean(value));
  return [
    ...new Set([
      ...(eventType === 'TRANSFER' ? sortedAccountUuids(identities.transferredTo) : []),
      ...directCandidates,
      ...sortedAccountUuids(identities.aliases),
    ]),
  ];
}

export function buildRevenueCatAtomicArgs(
  event: RevenueCatEvent,
  verification: RevenueCatVerification,
  receivedAt = new Date(),
): RevenueCatAtomicArgs {
  const eventId = optionalString(event.id);
  const eventType = normalizeRevenueCatEventType(event.type);
  if (!eventId || eventId.length > 255 || !eventType || eventType.length > 100) {
    throw new Error('INVALID_REVENUECAT_EVENT');
  }
  if (!Number.isFinite(receivedAt.getTime())) {
    throw new Error('INVALID_RECEIVED_AT');
  }

  const providerEventAt = isoFromMs(event.event_timestamp_ms, true);
  if (!providerEventAt) throw new Error('INVALID_REVENUECAT_EVENT_TIMESTAMP');
  const identities = normalizeRevenueCatIdentities(event);
  const aliases = stableSortedIdentityValues(identities.aliases) ?? [];
  const transferredFrom = stableSortedIdentityValues(identities.transferredFrom) ?? [];
  const transferredTo = stableSortedIdentityValues(identities.transferredTo) ?? [];
  const projection = projectionFor(eventType);
  const sanitizedEvent = sanitizeRevenueCatEvent(event);
  const entitlementIds = optionalStringArray(event.entitlement_ids) ?? [];
  const entitlement = entitlementIds.includes('pro_plus') ? 'pro_plus' : 'pro';

  return {
    p_rc_event_id: eventId,
    p_event_type: eventType,
    p_user_candidates: deterministicUserCandidates(identities, eventType),
    p_app_user_id: identities.appUserId?.value ?? null,
    p_original_app_user_id: identities.originalAppUserId?.value ?? null,
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
    // Migration 0051 rejects this fail-closed placeholder for any event that
    // has structured identities. The handler must attach authenticated lookup
    // inputs immediately before persistence.
    p_identity_hmac_key_versions: [],
    p_identity_hmacs: [],
    p_identity_values: [],
  };
}

function isAtomicResult(value: unknown): value is RevenueCatAtomicResult {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.outcome === 'string' &&
    [
      'processed',
      'stale',
      'duplicate',
      'ignored',
      'unresolved',
      'suppressed_deleted_account',
      'error',
    ].includes(row.outcome) &&
    typeof row.projection_applied === 'boolean' &&
    typeof row.processing_status === 'string'
  );
}

export async function persistRevenueCatEvent(
  client: RevenueCatRpcClient,
  args: RevenueCatAtomicArgs,
): Promise<RevenueCatAtomicResult> {
  const { data, error } = await client.rpc('process_revenuecat_webhook_event_guarded', args);
  if (error) throw new RevenueCatAtomicProcessingError();
  const row = Array.isArray(data) ? data[0] : data;
  if (
    !isAtomicResult(row) ||
    row.outcome === 'error' ||
    row.processing_status === 'error' ||
    (row.outcome === 'suppressed_deleted_account' &&
      (row.projection_applied || row.processing_status !== 'suppressed_deleted_account'))
  ) {
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
