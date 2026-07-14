import { normalizePostHogApiHost, pseudonymousUserId } from './providerDeletion.ts';

type ProviderRequest = {
  url: string;
  init: RequestInit;
};

const NETWORK_REQUEST_PHASES = ['before_request_started', 'after_request_started'] as const;
export type NetworkRequestPhase = (typeof NETWORK_REQUEST_PHASES)[number];

export type ProviderResultCode =
  | 'REVENUECAT_V1_DELETED'
  | 'REVENUECAT_V1_RETRY'
  | 'REVENUECAT_V1_RATE_LIMITED'
  | 'REVENUECAT_V1_DISPATCH_AMBIGUOUS'
  | 'REVENUECAT_V1_CONFIGURATION_REQUIRED'
  | 'REVENUECAT_V2_RETRY'
  | 'REVENUECAT_V2_RATE_LIMITED'
  | 'REVENUECAT_V2_DISPATCH_AMBIGUOUS'
  | 'REVENUECAT_V2_CONFIGURATION_REQUIRED'
  | 'REVENUECAT_V2_PREFLIGHT_RETRY'
  | 'REVENUECAT_V2_PREFLIGHT_UNATTESTED'
  | 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED'
  | 'REVENUECAT_V2_DELETE_ACKNOWLEDGED'
  | 'REVENUECAT_V2_DELETE_QUEUED'
  | 'REVENUECAT_V2_DELETE_ABSENT_RECONCILE'
  | 'REVENUECAT_V2_RECONCILIATION_RETRY'
  | 'REVENUECAT_V2_QUIESCENCE_PENDING'
  | 'REVENUECAT_V2_CUSTOMER_STILL_PRESENT'
  | 'REVENUECAT_V2_DELETION_VERIFIED'
  | 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY'
  | 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED'
  | 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED'
  | 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED'
  | 'APPLE_REVOKED'
  | 'APPLE_REVOKE_RETRY'
  | 'APPLE_MANUAL_REVOCATION_REQUIRED'
  | 'APPLE_MANUAL_REVOCATION_RECORDED'
  | 'POSTHOG_LOOKUP_RETRY'
  | 'POSTHOG_LOOKUP_UNATTESTED'
  | 'POSTHOG_DELETE_QUEUED'
  | 'POSTHOG_DELETE_RETRY'
  | 'POSTHOG_DELETE_RATE_LIMITED'
  | 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS'
  | 'POSTHOG_DELETE_CONFIGURATION_REQUIRED'
  | 'POSTHOG_STATUS_RETRY'
  | 'POSTHOG_STATUS_UNATTESTED'
  | 'POSTHOG_STATUS_PENDING'
  | 'POSTHOG_STATUS_COMPLETED'
  | 'POSTHOG_STATUS_MISSING'
  | 'POSTHOG_PERSON_REAPPEARED'
  | 'POSTHOG_RECORDING_VERIFICATION_REQUIRED'
  | 'POSTHOG_QUIESCENCE_PENDING'
  | 'POSTHOG_DELETION_VERIFIED';

export type ProviderFailureDisposition =
  | { kind: 'retryable'; resultCode: ProviderResultCode }
  | { kind: 'ambiguous'; resultCode: ProviderResultCode }
  | { kind: 'action_required'; resultCode: ProviderResultCode };

export type RevenueCatV1DeletionDisposition =
  | {
      kind: 'succeeded';
      resultCode: 'REVENUECAT_V1_DELETED';
      receipt: { provider: 'revenuecat_v1'; result: 'deleted' };
    }
  | ProviderFailureDisposition;

/**
 * RevenueCat v2 mutation responses only choose the read-only reconciliation
 * lane. Terminal success is produced solely by `attestRevenueCatV2Deletion`.
 */
export type RevenueCatV2DeletionDisposition =
  | {
      kind: 'verification_required';
      resultCode:
        | 'REVENUECAT_V2_DELETE_ACKNOWLEDGED'
        | 'REVENUECAT_V2_DELETE_QUEUED'
        | 'REVENUECAT_V2_DELETE_ABSENT_RECONCILE';
      acknowledgement: {
        mode: 'completed' | 'queued' | 'already_absent';
        deletedAt: number | null;
      };
    }
  | ProviderFailureDisposition;

export type RevenueCatV2CustomerLookupEvidence = {
  /** Sensitive active-state evidence. Never place these fields in a receipt/error. */
  projectId: string;
  lookupCustomerId: string;
  customerId: string;
  firstSeenAt: number;
  lastSeenAt: number | null;
  observedAt: string;
};

export type RevenueCatV2CustomerLookupDisposition =
  | {
      kind: 'found';
      transientEvidence: RevenueCatV2CustomerLookupEvidence;
    }
  | {
      kind: 'absent';
      transientEvidence: RevenueCatV2CustomerAbsenceEvidence;
    }
  | ProviderFailureDisposition;

export type RevenueCatV2CustomerAbsenceEvidence = {
  projectId: string;
  lookupCustomerId: string;
  observedAt: string;
};

export type RevenueCatV2ProjectVisibilityEvidence = {
  projectId: string;
  projectCreatedAt: number;
  observedAt: string;
};

export type RevenueCatV2ProjectPageDisposition =
  | {
      kind: 'found';
      transientEvidence: RevenueCatV2ProjectVisibilityEvidence;
    }
  | {
      kind: 'continue';
      nextStartingAfter: string;
    }
  | ProviderFailureDisposition;

export type RevenueCatV2AliasPageEvidence = {
  /** Sensitive active-state evidence. Never place alias IDs in a receipt/error. */
  projectId: string;
  customerId: string;
  requestedStartingAfter: string | null;
  nextStartingAfter: string | null;
  aliases: Array<{ id: string; createdAt: number }>;
  observedAt: string;
};

export type RevenueCatV2AliasPageDisposition =
  | { kind: 'page'; transientEvidence: RevenueCatV2AliasPageEvidence }
  | ProviderFailureDisposition;

export type RevenueCatV2PreflightEvidence = {
  version: 1;
  persisted: true;
  projectId: string;
  lookupCustomerId: string;
  customerId: string;
  firstSeenAt: number;
  lastSeenAt: number | null;
  aliasSnapshotCompletedAt: string;
  aliasPageCount: number;
  aliases: Array<{ id: string; createdAt: number }>;
};

export type RevenueCatV2PreflightDisposition =
  | { kind: 'ready'; evidence: RevenueCatV2PreflightEvidence }
  | {
      kind: 'action_required';
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED';
    };

export type RevenueCatV2CustomerReconciliationObservation = {
  kind: 'absent' | 'present';
  targetIndex: number;
  /** Encrypted active-state binding only; never copy into a receipt/error. */
  targetCustomerId: string;
  observedAt: string;
};

export type RevenueCatV2AliasesReconciliationObservation = {
  kind: 'absent' | 'present';
  /** Encrypted active-state binding only; never copy into a receipt/error. */
  customerId: string;
  observedAt: string;
};

export type RevenueCatV2CustomerReconciliationDisposition =
  | RevenueCatV2CustomerReconciliationObservation
  | ProviderFailureDisposition;

export type RevenueCatV2AliasesReconciliationDisposition =
  | RevenueCatV2AliasesReconciliationObservation
  | ProviderFailureDisposition;

export type RevenueCatV2DispatchEvidence = {
  persisted: true;
  requestStartedAt: string;
  resultCode:
    | 'REVENUECAT_V2_DELETE_ACKNOWLEDGED'
    | 'REVENUECAT_V2_DELETE_QUEUED'
    | 'REVENUECAT_V2_DELETE_ABSENT_RECONCILE'
    | 'REVENUECAT_V2_DISPATCH_AMBIGUOUS';
  deletedAt: number | null;
};

export type RevenueCatV2ReconciliationEvidence = {
  persisted: true;
  customerObservations: RevenueCatV2CustomerReconciliationObservation[];
  aliasesObservation: RevenueCatV2AliasesReconciliationObservation;
};

export type RevenueCatV2TerminalDisposition =
  | {
      kind: 'succeeded';
      resultCode: 'REVENUECAT_V2_DELETION_VERIFIED';
      receipt: {
        provider: 'revenuecat_v2';
        result: 'deleted_verified';
        scope: 'customer_and_alias_family';
      };
    }
  | {
      kind: 'succeeded';
      resultCode: 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED';
      receipt: {
        provider: 'revenuecat_v2';
        result: 'already_absent_verified';
        scope: 'customer_and_alias_family';
      };
    }
  | {
      kind: 'pending';
      resultCode: 'REVENUECAT_V2_CUSTOMER_STILL_PRESENT';
    };

export type AppleRevocationDisposition =
  | {
      kind: 'succeeded';
      resultCode: 'APPLE_REVOKED';
      receipt: { provider: 'apple'; result: 'revoked' };
    }
  | {
      kind: 'manual_required';
      resultCode: 'APPLE_MANUAL_REVOCATION_REQUIRED';
      notice: { action: 'remove_apple_authorization' };
    }
  | { kind: 'retryable'; resultCode: 'APPLE_REVOKE_RETRY' };

export type AppleRevokeResponse = {
  status: number;
  /** Exact bounded decoded response text. */
  body: string;
  /** Raw bounded response-body bytes before UTF-8 decoding/BOM handling. */
  responseBytes: number;
};

export type AppleDeletionStepDisposition =
  | Extract<AppleRevocationDisposition, { kind: 'succeeded' }>
  | {
      kind: 'succeeded';
      resultCode: 'APPLE_MANUAL_REVOCATION_RECORDED';
      receipt: { provider: 'apple'; result: 'manual_action_recorded' };
      notice: { action: 'remove_apple_authorization' };
    }
  | Extract<AppleRevocationDisposition, { kind: 'retryable' }>;

/** Found UUIDs are transient provider handles and must never enter a receipt/error. */
export type PostHogLookupDisposition =
  | { kind: 'found'; personUuids: string[] }
  | { kind: 'absent' }
  | ProviderFailureDisposition;

export type PostHogBulkDeleteDisposition =
  | {
      kind: 'queued';
      resultCode: 'POSTHOG_DELETE_QUEUED';
      queue: {
        events: true;
        recordings: boolean;
        dispatchCutoffAt: string;
        targetCount: number;
      };
    }
  | ProviderFailureDisposition;

export type PostHogCompletedEventEvidence = {
  /** Transient provider handle; terminal receipts deliberately omit it. */
  personUuid: string;
  dispatchCutoffAt: string;
  createdAt: string;
  verifiedAt: string;
};

export type PostHogEventStatusDisposition =
  | { kind: 'pending'; resultCode: 'POSTHOG_STATUS_PENDING' }
  | {
      kind: 'completed';
      resultCode: 'POSTHOG_STATUS_COMPLETED';
      transientEvidence: PostHogCompletedEventEvidence;
    }
  | { kind: 'missing'; resultCode: 'POSTHOG_STATUS_MISSING' }
  | ProviderFailureDisposition;

export type PostHogAbsenceObservation = {
  kind: 'absent';
  observedAt: string;
  persisted: true;
};

export type PostHogTargetSetEvidence = {
  /** Active encrypted reconciliation state only; never copy UUIDs to a receipt/error. */
  personUuids: readonly string[];
  persisted: true;
  capturedAt: string;
};

export type PostHogNoRecordingsEvidence = {
  recordingsCollected: boolean;
  durable: true;
  evidence: 'production_capture_disabled_and_storage_audited';
  verifiedAt: string;
};

export type PostHogTerminalDisposition =
  | {
      kind: 'succeeded';
      resultCode: 'POSTHOG_DELETION_VERIFIED';
      receipt: {
        provider: 'posthog';
        result: 'deleted_verified';
        scope: 'persons_and_events';
        recordings: 'attested_not_collected';
        absenceObservations: number;
      };
    }
  | {
      kind: 'pending';
      resultCode:
        | 'POSTHOG_STATUS_PENDING'
        | 'POSTHOG_PERSON_REAPPEARED'
        | 'POSTHOG_QUIESCENCE_PENDING';
    }
  | ProviderFailureDisposition;

export type PostHogLookupRequest = ProviderRequest & {
  expectedDistinctIds: string[];
};

export type PostHogBulkDeleteRequest = ProviderRequest & {
  expectedPersonUuids: string[];
  deleteRecordings: boolean;
  dispatchCutoffAt: string;
};

export type PostHogDeletionStatusRequest = ProviderRequest & {
  expectedPersonUuid: string;
  dispatchCutoffAt: string;
};

export type RevenueCatV2CustomerRequest = ProviderRequest & {
  expectedProjectId: string;
  lookupCustomerId: string;
};

export type RevenueCatV2ProjectPageRequest = ProviderRequest & {
  requestedStartingAfter: string | null;
  pageNumber: number;
};

export type RevenueCatV2AliasPageRequest = ProviderRequest & {
  expectedProjectId: string;
  expectedCustomerId: string;
  requestedStartingAfter: string | null;
};

export type RevenueCatV2DeleteRequest = ProviderRequest & {
  expectedProjectId: string;
  expectedCustomerId: string;
};

export type RevenueCatV2CustomerReconciliationRequest = ProviderRequest & {
  expectedProjectId: string;
  expectedCanonicalCustomerId: string;
  targetCustomerId: string;
  targetIndex: number;
};

export type RevenueCatV2AliasesReconciliationRequest = ProviderRequest & {
  expectedProjectId: string;
  expectedCustomerId: string;
};

const REVENUECAT_V2_API_BASE = 'https://api.revenuecat.com/v2';
const REVENUECAT_V2_ALIAS_PAGE_SIZE = 20;
const REVENUECAT_V2_MAX_LIST_PAGES = 50;
// These caps leave room for dispatch plus one observation per identity inside
// a 32,768-byte AES-GCM JSON envelope (24,518 plaintext bytes in the shared
// crypto format). An over-cap family is held before DELETE for operator action.
const REVENUECAT_V2_MAX_ALIASES = 64;
const REVENUECAT_V2_MAX_EVIDENCE_ID_BYTES = 4_096;
const REVENUECAT_V2_MAX_PREFLIGHT_SERIALIZED_BYTES = 7_500;
const REVENUECAT_V2_MAX_DURABLE_EVIDENCE_BYTES = 23_000;
const REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH = 1_500;
const REVENUECAT_V2_MAX_PROJECT_ID_LENGTH = 255;

type RevenueCatV2RequestOptions = {
  projectId: string;
  secretApiKey: string;
};

type PostHogRequestOptions = {
  host: string;
  projectId: string;
  personalApiKey: string;
};

export class DurableProviderDeletionError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_REQUEST_INVALID'
      | 'PROVIDER_RESPONSE_INVALID'
      | 'PROVIDER_REQUEST_PHASE_INVALID'
      | 'REVENUECAT_CUSTOMER_ID_INVALID'
      | 'REVENUECAT_V2_EVIDENCE_INVALID'
      | 'APPLE_DISPOSITION_INVALID'
      | 'POSTHOG_PERSON_UUID_INVALID'
      | 'POSTHOG_STATUS_INPUT_INVALID',
  ) {
    super(code);
    this.name = 'DurableProviderDeletionError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasRequiredAndOnlyKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  allowed: readonly string[],
): boolean {
  const keys = Object.keys(value);
  const allowedSet = new Set(allowed);
  return (
    required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowedSet.has(key))
  );
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function exactNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function boundedExactString(value: unknown, maximum: number): value is string {
  return exactNonBlank(value) && value.length <= maximum;
}

function nullableBoundedString(value: unknown, maximum: number): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= maximum);
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validHttpStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599;
}

function assertHttpStatus(status: unknown): asserts status is number {
  if (!validHttpStatus(status)) {
    throw new DurableProviderDeletionError('PROVIDER_RESPONSE_INVALID');
  }
}

function assertNetworkRequestPhase(phase: unknown): asserts phase is NetworkRequestPhase {
  if (!isOneOf(phase, NETWORK_REQUEST_PHASES)) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_PHASE_INVALID');
  }
}

function validIsoTimestamp(value: unknown): value is string {
  if (!exactNonBlank(value)) return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (match === null) return false;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    ,
    zoneHourText,
    zoneMinuteText,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const zoneHour = zoneHourText === undefined ? 0 : Number(zoneHourText);
  const zoneMinute = zoneMinuteText === undefined ? 0 : Number(zoneMinuteText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    zoneHour > 14 ||
    zoneMinute > 59 ||
    (zoneHour === 14 && zoneMinute !== 0)
  ) {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function timestampMs(value: string): number {
  return Date.parse(value);
}

function canonicalUuid(value: unknown): string | null {
  if (!exactNonBlank(value)) return null;
  const normalized = value.toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

function canonicalTargetUuids(
  values: unknown,
  options: { requireCanonicalUnique: boolean },
): string[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > 1_000) {
    return null;
  }
  const normalized: string[] = [];
  for (const value of values) {
    const uuid = canonicalUuid(value);
    if (uuid === null || (options.requireCanonicalUnique && uuid !== value)) {
      return null;
    }
    normalized.push(uuid);
  }
  const unique = [...new Set(normalized)].sort();
  if (options.requireCanonicalUnique && unique.length !== values.length) {
    return null;
  }
  return unique;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function revenueCatV2Headers(secretApiKey: string): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${secretApiKey}`,
  };
}

function assertRevenueCatV2RequestOptions(options: RevenueCatV2RequestOptions): void {
  if (
    !isRecord(options) ||
    !boundedExactString(options.projectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    !boundedExactString(options.secretApiKey, 1_000)
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
}

function assertRevenueCatV2CustomerId(value: unknown): asserts value is string {
  if (!boundedExactString(value, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH)) {
    throw new DurableProviderDeletionError('REVENUECAT_CUSTOMER_ID_INVALID');
  }
}

function revenueCatV2CustomerPath(projectId: string, customerId: string): string {
  return `/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(
    customerId,
  )}`;
}

function revenueCatV2AliasesPath(projectId: string, customerId: string): string {
  return `${revenueCatV2CustomerPath(projectId, customerId)}/aliases`;
}

function validRevenueCatV2Error(
  body: unknown,
  expectedTypes: readonly string[],
  expectedRetryable: boolean,
): boolean {
  if (
    !isRecord(body) ||
    !hasRequiredAndOnlyKeys(
      body,
      ['object', 'type', 'message', 'retryable'],
      [
        'object',
        'type',
        'message',
        'retryable',
        'param',
        'doc_url',
        'backoff_ms',
        'referenced_object_ids',
      ],
    ) ||
    body.object !== 'error' ||
    !exactNonBlank(body.type) ||
    !expectedTypes.includes(body.type) ||
    !boundedExactString(body.message, 4_096) ||
    body.retryable !== expectedRetryable
  ) {
    return false;
  }
  if (
    Object.hasOwn(body, 'param') &&
    body.param !== null &&
    !boundedExactString(body.param, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH)
  ) {
    return false;
  }
  if (Object.hasOwn(body, 'doc_url')) {
    if (!boundedExactString(body.doc_url, 2_048)) return false;
    try {
      const url = new URL(body.doc_url);
      if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.hash !== ''
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }
  if (
    Object.hasOwn(body, 'backoff_ms') &&
    body.backoff_ms !== null &&
    !nonNegativeSafeInteger(body.backoff_ms)
  ) {
    return false;
  }
  if (Object.hasOwn(body, 'referenced_object_ids')) {
    if (
      !Array.isArray(body.referenced_object_ids) ||
      body.referenced_object_ids.length > 1_000 ||
      body.referenced_object_ids.some(
        (id) => !boundedExactString(id, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH),
      )
    ) {
      return false;
    }
  }
  return true;
}

function validRevenueCatV2ActiveEntitlements(value: unknown): boolean {
  if (value === null) return true;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['object', 'items', 'next_page', 'url']) ||
    value.object !== 'list' ||
    !Array.isArray(value.items) ||
    value.items.length > 1_000 ||
    !nullableBoundedString(value.next_page, 5_000) ||
    typeof value.url !== 'string' ||
    value.url.length > 5_000
  ) {
    return false;
  }
  return value.items.every(
    (item) =>
      isRecord(item) &&
      hasExactKeys(item, ['object', 'entitlement_id', 'expires_at']) &&
      item.object === 'customer.active_entitlement' &&
      boundedExactString(item.entitlement_id, 255) &&
      (item.expires_at === null || nonNegativeSafeInteger(item.expires_at)),
  );
}

function validRevenueCatV2Experiment(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      hasExactKeys(value, ['object', 'id', 'name', 'variant']) &&
      value.object === 'experiment_enrollment' &&
      boundedExactString(value.id, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) &&
      boundedExactString(value.name, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) &&
      typeof value.variant === 'string' &&
      value.variant.length === 1)
  );
}

function parseRevenueCatV2Customer(
  body: unknown,
  expectedProjectId: string,
): {
  customerId: string;
  firstSeenAt: number;
  lastSeenAt: number | null;
} | null {
  const required = [
    'object',
    'id',
    'project_id',
    'first_seen_at',
    'last_seen_at',
    'last_seen_app_version',
    'last_seen_country',
    'last_seen_platform',
    'last_seen_platform_version',
  ] as const;
  const allowed = [...required, 'active_entitlements', 'experiment', 'attributes'] as const;
  if (
    !isRecord(body) ||
    !hasRequiredAndOnlyKeys(body, required, allowed) ||
    body.object !== 'customer' ||
    !boundedExactString(body.id, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
    body.project_id !== expectedProjectId ||
    !nonNegativeSafeInteger(body.first_seen_at) ||
    (body.last_seen_at !== null &&
      (!nonNegativeSafeInteger(body.last_seen_at) || body.last_seen_at < body.first_seen_at)) ||
    !nullableBoundedString(body.last_seen_app_version, 5_000) ||
    !nullableBoundedString(body.last_seen_country, 5_000) ||
    !nullableBoundedString(body.last_seen_platform, 5_000) ||
    !nullableBoundedString(body.last_seen_platform_version, 5_000) ||
    (Object.hasOwn(body, 'active_entitlements') &&
      !validRevenueCatV2ActiveEntitlements(body.active_entitlements)) ||
    (Object.hasOwn(body, 'experiment') && !validRevenueCatV2Experiment(body.experiment)) ||
    (Object.hasOwn(body, 'attributes') && body.attributes !== null)
  ) {
    return null;
  }
  return {
    customerId: body.id,
    firstSeenAt: body.first_seen_at,
    lastSeenAt: body.last_seen_at,
  };
}

function revenueCatV2IdentityFamily(evidence: RevenueCatV2PreflightEvidence): string[] {
  return [
    ...new Set([
      evidence.lookupCustomerId,
      evidence.customerId,
      ...evidence.aliases.map((alias) => alias.id),
    ]),
  ].sort();
}

function revenueCatV2EvidenceIdBytes(projectId: string, identities: readonly string[]): number {
  const encoder = new TextEncoder();
  return (
    encoder.encode(projectId).byteLength +
    identities.reduce((total, identity) => total + encoder.encode(identity).byteLength, 0)
  );
}

function assertRevenueCatV2PreflightEvidence(
  value: unknown,
): asserts value is RevenueCatV2PreflightEvidence {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'version',
      'persisted',
      'projectId',
      'lookupCustomerId',
      'customerId',
      'firstSeenAt',
      'lastSeenAt',
      'aliasSnapshotCompletedAt',
      'aliasPageCount',
      'aliases',
    ]) ||
    value.version !== 1 ||
    value.persisted !== true ||
    !boundedExactString(value.projectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    canonicalUuid(value.lookupCustomerId) !== value.lookupCustomerId ||
    !boundedExactString(value.customerId, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
    !nonNegativeSafeInteger(value.firstSeenAt) ||
    (value.lastSeenAt !== null &&
      (!nonNegativeSafeInteger(value.lastSeenAt) || value.lastSeenAt < value.firstSeenAt)) ||
    !validIsoTimestamp(value.aliasSnapshotCompletedAt) ||
    typeof value.aliasPageCount !== 'number' ||
    !Number.isInteger(value.aliasPageCount) ||
    value.aliasPageCount < 1 ||
    value.aliasPageCount > REVENUECAT_V2_MAX_LIST_PAGES ||
    !Array.isArray(value.aliases) ||
    value.aliases.length > REVENUECAT_V2_MAX_ALIASES
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  const aliasIds = new Set<string>();
  let previousAliasId: string | null = null;
  for (const alias of value.aliases) {
    if (
      !isRecord(alias) ||
      !hasExactKeys(alias, ['id', 'createdAt']) ||
      !boundedExactString(alias.id, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
      !nonNegativeSafeInteger(alias.createdAt) ||
      alias.createdAt < value.firstSeenAt ||
      (previousAliasId !== null && alias.id <= previousAliasId) ||
      aliasIds.has(alias.id)
    ) {
      throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
    }
    aliasIds.add(alias.id);
    previousAliasId = alias.id;
  }
  const identities = [
    ...new Set([value.lookupCustomerId as string, value.customerId as string, ...aliasIds]),
  ];
  if (
    revenueCatV2EvidenceIdBytes(value.projectId, identities) >
      REVENUECAT_V2_MAX_EVIDENCE_ID_BYTES ||
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
      REVENUECAT_V2_MAX_PREFLIGHT_SERIALIZED_BYTES
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
}

function assertPostHogRequestOptions(options: PostHogRequestOptions): string {
  if (
    !isRecord(options) ||
    !exactNonBlank(options.projectId) ||
    !exactNonBlank(options.personalApiKey) ||
    options.projectId.length > 200 ||
    options.personalApiKey.length > 1_000
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  try {
    return normalizePostHogApiHost(options.host);
  } catch {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
}

function postHogHeaders(personalApiKey: string, includeContentType: boolean): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${personalApiKey}`,
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

function lookupFailure(status: number): ProviderFailureDisposition {
  if (status === 429 || status >= 500) {
    return { kind: 'retryable', resultCode: 'POSTHOG_LOOKUP_RETRY' };
  }
  return { kind: 'action_required', resultCode: 'POSTHOG_LOOKUP_UNATTESTED' };
}

function statusFailure(status: number): ProviderFailureDisposition {
  if (status === 429 || status >= 500) {
    return { kind: 'retryable', resultCode: 'POSTHOG_STATUS_RETRY' };
  }
  return { kind: 'action_required', resultCode: 'POSTHOG_STATUS_UNATTESTED' };
}

export function classifyRevenueCatV1DeleteResponse(
  status: number,
  body: unknown,
  expectedAppUserId: string,
): RevenueCatV1DeletionDisposition {
  assertHttpStatus(status);
  if (!exactNonBlank(expectedAppUserId) || expectedAppUserId.length > 500) {
    throw new DurableProviderDeletionError('REVENUECAT_CUSTOMER_ID_INVALID');
  }
  if (
    status === 200 &&
    isRecord(body) &&
    hasExactKeys(body, ['app_user_id', 'deleted']) &&
    body.app_user_id === expectedAppUserId &&
    body.deleted === true
  ) {
    return {
      kind: 'succeeded',
      resultCode: 'REVENUECAT_V1_DELETED',
      receipt: { provider: 'revenuecat_v1', result: 'deleted' },
    };
  }
  if (status === 429) {
    return { kind: 'retryable', resultCode: 'REVENUECAT_V1_RATE_LIMITED' };
  }
  if (status === 400 || status === 401 || status === 403) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V1_CONFIGURATION_REQUIRED',
    };
  }
  return { kind: 'ambiguous', resultCode: 'REVENUECAT_V1_DISPATCH_AMBIGUOUS' };
}

export function classifyRevenueCatV1TransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return phase === 'after_request_started'
    ? { kind: 'ambiguous', resultCode: 'REVENUECAT_V1_DISPATCH_AMBIGUOUS' }
    : { kind: 'retryable', resultCode: 'REVENUECAT_V1_RETRY' };
}

function validRevenueCatV2ErrorForStatus(status: number, body: unknown): boolean {
  switch (status) {
    case 400:
      return validRevenueCatV2Error(body, ['parameter_error', 'invalid_request'], false);
    case 401:
      return validRevenueCatV2Error(body, ['authentication_error'], false);
    case 403:
      return validRevenueCatV2Error(body, ['authorization_error'], false);
    case 404:
      return validRevenueCatV2Error(body, ['resource_missing'], false);
    case 409:
      return validRevenueCatV2Error(
        body,
        ['resource_already_exists', 'idempotency_error', 'invalid_request'],
        false,
      );
    case 422:
      return (
        isRecord(body) &&
        exactNonBlank(body.type) &&
        validRevenueCatV2Error(
          body,
          [
            'unprocessable_entity_error',
            'parameter_error',
            'store_error',
            'entity_references_archived_entities',
          ],
          body.type === 'store_error',
        )
      );
    case 423:
      return validRevenueCatV2Error(body, ['resource_locked_error'], true);
    case 429:
      return validRevenueCatV2Error(body, ['rate_limit_error'], true);
    case 500:
    case 503:
      return validRevenueCatV2Error(body, ['server_error'], true);
    default:
      return false;
  }
}

export function buildRevenueCatV2ProjectPageRequest(options: {
  secretApiKey: string;
  startingAfter: string | null;
  pageNumber: number;
}): RevenueCatV2ProjectPageRequest {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['secretApiKey', 'startingAfter', 'pageNumber']) ||
    !boundedExactString(options.secretApiKey, 1_000) ||
    !Number.isInteger(options.pageNumber) ||
    options.pageNumber < 0 ||
    options.pageNumber >= REVENUECAT_V2_MAX_LIST_PAGES ||
    (options.startingAfter !== null &&
      !boundedExactString(options.startingAfter, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH))
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  const query =
    options.startingAfter === null
      ? ''
      : `?starting_after=${encodeURIComponent(options.startingAfter)}`;
  return {
    url: `${REVENUECAT_V2_API_BASE}/projects${query}`,
    init: {
      method: 'GET',
      redirect: 'error',
      headers: revenueCatV2Headers(options.secretApiKey),
    },
    requestedStartingAfter: options.startingAfter,
    pageNumber: options.pageNumber,
  };
}

function parseRevenueCatV2ProjectNextCursor(
  value: unknown,
  projects: readonly { id: string }[],
  requestedStartingAfter: string | null,
): string | null | undefined {
  if (value === null) return null;
  if (!boundedExactString(value, 5_000) || !value.startsWith('/v2/')) {
    return undefined;
  }
  try {
    const url = new URL(value, 'https://api.revenuecat.com');
    const entries = [...url.searchParams.entries()];
    if (
      url.origin !== 'https://api.revenuecat.com' ||
      url.pathname !== '/v2/projects' ||
      url.hash !== '' ||
      entries.length !== 1 ||
      entries[0][0] !== 'starting_after' ||
      !boundedExactString(entries[0][1], REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
      entries[0][1] === requestedStartingAfter ||
      projects.length === 0 ||
      entries[0][1] !== projects[projects.length - 1].id
    ) {
      return undefined;
    }
    return entries[0][1];
  } catch {
    return undefined;
  }
}

export function classifyRevenueCatV2ProjectPageResponse(
  status: number,
  body: unknown,
  expectedProjectId: string,
  requestedStartingAfter: string | null,
  pageNumber: number,
  observedAt: string,
): RevenueCatV2ProjectPageDisposition {
  assertHttpStatus(status);
  if (
    !boundedExactString(expectedProjectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    (requestedStartingAfter !== null &&
      !boundedExactString(requestedStartingAfter, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH)) ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 0 ||
    pageNumber >= REVENUECAT_V2_MAX_LIST_PAGES ||
    !validIsoTimestamp(observedAt)
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  if (status === 200) {
    if (
      !isRecord(body) ||
      !hasExactKeys(body, ['object', 'items', 'next_page', 'url']) ||
      body.object !== 'list' ||
      body.url !== '/v2/projects' ||
      !Array.isArray(body.items) ||
      body.items.length > REVENUECAT_V2_ALIAS_PAGE_SIZE
    ) {
      return {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
      };
    }
    const projects: Array<{ id: string; createdAt: number }> = [];
    const seen = new Set<string>();
    for (const item of body.items) {
      if (
        !isRecord(item) ||
        !hasRequiredAndOnlyKeys(
          item,
          ['object', 'id', 'name', 'created_at'],
          ['object', 'id', 'name', 'created_at', 'icon_url', 'icon_url_large'],
        ) ||
        item.object !== 'project' ||
        !boundedExactString(item.id, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
        !boundedExactString(item.name, 256) ||
        !nonNegativeSafeInteger(item.created_at) ||
        seen.has(item.id) ||
        (Object.hasOwn(item, 'icon_url') &&
          item.icon_url !== null &&
          (typeof item.icon_url !== 'string' || item.icon_url.length > 5_000)) ||
        (Object.hasOwn(item, 'icon_url_large') &&
          item.icon_url_large !== null &&
          (typeof item.icon_url_large !== 'string' || item.icon_url_large.length > 5_000))
      ) {
        return {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
        };
      }
      seen.add(item.id);
      projects.push({ id: item.id, createdAt: item.created_at });
    }
    const nextStartingAfter = parseRevenueCatV2ProjectNextCursor(
      body.next_page,
      projects,
      requestedStartingAfter,
    );
    if (nextStartingAfter === undefined) {
      return {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
      };
    }
    const expectedProject = projects.find((project) => project.id === expectedProjectId);
    if (expectedProject !== undefined) {
      return {
        kind: 'found',
        transientEvidence: {
          projectId: expectedProjectId,
          projectCreatedAt: expectedProject.createdAt,
          observedAt,
        },
      };
    }
    return nextStartingAfter === null || pageNumber + 1 >= REVENUECAT_V2_MAX_LIST_PAGES
      ? {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
        }
      : { kind: 'continue', nextStartingAfter };
  }
  if (
    (status === 423 || status === 429 || status === 500 || status === 503) &&
    validRevenueCatV2ErrorForStatus(status, body)
  ) {
    return {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY',
    };
  }
  if ((status === 401 || status === 403) && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
    };
  }
  return {
    kind: 'action_required',
    resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
  };
}

export function classifyRevenueCatV2ProjectTransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return {
    kind: 'retryable',
    resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY',
  };
}

export function buildRevenueCatV2CustomerLookupRequest(
  options: RevenueCatV2RequestOptions & { lookupCustomerId: string },
): RevenueCatV2CustomerRequest {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['projectId', 'secretApiKey', 'lookupCustomerId'])
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  assertRevenueCatV2RequestOptions(options);
  const lookupCustomerId = canonicalUuid(options.lookupCustomerId);
  if (lookupCustomerId === null || lookupCustomerId !== options.lookupCustomerId) {
    throw new DurableProviderDeletionError('REVENUECAT_CUSTOMER_ID_INVALID');
  }
  const path = revenueCatV2CustomerPath(options.projectId, lookupCustomerId);
  return {
    url: `${REVENUECAT_V2_API_BASE}${path.slice(3)}`,
    init: {
      method: 'GET',
      redirect: 'error',
      headers: revenueCatV2Headers(options.secretApiKey),
    },
    expectedProjectId: options.projectId,
    lookupCustomerId,
  };
}

export function classifyRevenueCatV2CustomerLookupResponse(
  status: number,
  body: unknown,
  expectedProjectId: string,
  lookupCustomerId: string,
  observedAt: string,
): RevenueCatV2CustomerLookupDisposition {
  assertHttpStatus(status);
  if (
    !boundedExactString(expectedProjectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    canonicalUuid(lookupCustomerId) !== lookupCustomerId ||
    !validIsoTimestamp(observedAt)
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  if (status === 200) {
    const customer = parseRevenueCatV2Customer(body, expectedProjectId);
    return customer === null
      ? {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_PREFLIGHT_UNATTESTED',
        }
      : {
          kind: 'found',
          transientEvidence: {
            projectId: expectedProjectId,
            lookupCustomerId,
            customerId: customer.customerId,
            firstSeenAt: customer.firstSeenAt,
            lastSeenAt: customer.lastSeenAt,
            observedAt,
          },
        };
  }
  if (status === 404 && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'absent',
      transientEvidence: {
        projectId: expectedProjectId,
        lookupCustomerId,
        observedAt,
      },
    };
  }
  if (
    (status === 423 || status === 429 || status === 500 || status === 503) &&
    validRevenueCatV2ErrorForStatus(status, body)
  ) {
    return { kind: 'retryable', resultCode: 'REVENUECAT_V2_PREFLIGHT_RETRY' };
  }
  if ((status === 401 || status === 403) && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
    };
  }
  // `absent` is transient only. It cannot complete without a separately
  // persisted project-list visibility attestation from the same configured key.
  return {
    kind: 'action_required',
    resultCode: 'REVENUECAT_V2_PREFLIGHT_UNATTESTED',
  };
}

export function classifyRevenueCatV2PreflightTransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return { kind: 'retryable', resultCode: 'REVENUECAT_V2_PREFLIGHT_RETRY' };
}

/**
 * This terminal route is only for a never-created/already-absent customer. The
 * caller must round-trip both pieces through the encrypted step payload and
 * must use one loaded v2 key for project visibility and customer lookup.
 */
export function attestRevenueCatV2AlreadyAbsent(options: {
  projectVisibility: RevenueCatV2ProjectVisibilityEvidence;
  customerAbsence: RevenueCatV2CustomerAbsenceEvidence;
  persisted: true;
}): RevenueCatV2TerminalDisposition {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['projectVisibility', 'customerAbsence', 'persisted']) ||
    options.persisted !== true ||
    !isRecord(options.projectVisibility) ||
    !hasExactKeys(options.projectVisibility, ['projectId', 'projectCreatedAt', 'observedAt']) ||
    !isRecord(options.customerAbsence) ||
    !hasExactKeys(options.customerAbsence, ['projectId', 'lookupCustomerId', 'observedAt']) ||
    !boundedExactString(options.projectVisibility.projectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    options.customerAbsence.projectId !== options.projectVisibility.projectId ||
    !nonNegativeSafeInteger(options.projectVisibility.projectCreatedAt) ||
    !validIsoTimestamp(options.projectVisibility.observedAt) ||
    canonicalUuid(options.customerAbsence.lookupCustomerId) !==
      options.customerAbsence.lookupCustomerId ||
    !validIsoTimestamp(options.customerAbsence.observedAt) ||
    timestampMs(options.customerAbsence.observedAt) <
      timestampMs(options.projectVisibility.observedAt) ||
    new TextEncoder().encode(JSON.stringify(options)).byteLength >
      REVENUECAT_V2_MAX_DURABLE_EVIDENCE_BYTES
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  return {
    kind: 'succeeded',
    resultCode: 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
    receipt: {
      provider: 'revenuecat_v2',
      result: 'already_absent_verified',
      scope: 'customer_and_alias_family',
    },
  };
}

export function buildRevenueCatV2AliasPageRequest(
  options: RevenueCatV2RequestOptions & {
    customerId: string;
    startingAfter: string | null;
  },
): RevenueCatV2AliasPageRequest {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['projectId', 'secretApiKey', 'customerId', 'startingAfter'])
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  assertRevenueCatV2RequestOptions(options);
  assertRevenueCatV2CustomerId(options.customerId);
  if (
    options.startingAfter !== null &&
    !boundedExactString(options.startingAfter, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH)
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  const path = revenueCatV2AliasesPath(options.projectId, options.customerId);
  const query =
    options.startingAfter === null
      ? ''
      : `?starting_after=${encodeURIComponent(options.startingAfter)}`;
  return {
    url: `${REVENUECAT_V2_API_BASE}${path.slice(3)}${query}`,
    init: {
      method: 'GET',
      redirect: 'error',
      headers: revenueCatV2Headers(options.secretApiKey),
    },
    expectedProjectId: options.projectId,
    expectedCustomerId: options.customerId,
    requestedStartingAfter: options.startingAfter,
  };
}

function parseRevenueCatV2NextAliasCursor(
  value: unknown,
  expectedPath: string,
  aliases: readonly { id: string }[],
  requestedStartingAfter: string | null,
): string | null | undefined {
  if (value === null) return null;
  if (!boundedExactString(value, 5_000) || !value.startsWith('/v2/')) {
    return undefined;
  }
  try {
    const url = new URL(value, 'https://api.revenuecat.com');
    const entries = [...url.searchParams.entries()];
    if (
      url.origin !== 'https://api.revenuecat.com' ||
      url.pathname !== expectedPath ||
      url.hash !== '' ||
      entries.length !== 1 ||
      entries[0][0] !== 'starting_after' ||
      !boundedExactString(entries[0][1], REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
      entries[0][1] === requestedStartingAfter ||
      aliases.length === 0 ||
      entries[0][1] !== aliases[aliases.length - 1].id
    ) {
      return undefined;
    }
    return entries[0][1];
  } catch {
    return undefined;
  }
}

export function classifyRevenueCatV2AliasPageResponse(
  status: number,
  body: unknown,
  expectedProjectId: string,
  expectedCustomerId: string,
  requestedStartingAfter: string | null,
  observedAt: string,
): RevenueCatV2AliasPageDisposition {
  assertHttpStatus(status);
  if (
    !boundedExactString(expectedProjectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    !boundedExactString(expectedCustomerId, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
    (requestedStartingAfter !== null &&
      !boundedExactString(requestedStartingAfter, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH)) ||
    !validIsoTimestamp(observedAt)
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  if (status === 200) {
    const expectedPath = revenueCatV2AliasesPath(expectedProjectId, expectedCustomerId);
    if (
      !isRecord(body) ||
      !hasExactKeys(body, ['object', 'items', 'next_page', 'url']) ||
      body.object !== 'list' ||
      body.url !== expectedPath ||
      !Array.isArray(body.items) ||
      body.items.length > REVENUECAT_V2_ALIAS_PAGE_SIZE
    ) {
      return {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
      };
    }
    const aliases: Array<{ id: string; createdAt: number }> = [];
    const seen = new Set<string>();
    for (const item of body.items) {
      if (
        !isRecord(item) ||
        !hasExactKeys(item, ['object', 'id', 'created_at']) ||
        item.object !== 'customer.alias' ||
        !boundedExactString(item.id, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
        !nonNegativeSafeInteger(item.created_at) ||
        seen.has(item.id)
      ) {
        return {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
        };
      }
      seen.add(item.id);
      aliases.push({ id: item.id, createdAt: item.created_at });
    }
    const nextStartingAfter = parseRevenueCatV2NextAliasCursor(
      body.next_page,
      expectedPath,
      aliases,
      requestedStartingAfter,
    );
    if (nextStartingAfter === undefined) {
      return {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
      };
    }
    return {
      kind: 'page',
      transientEvidence: {
        projectId: expectedProjectId,
        customerId: expectedCustomerId,
        requestedStartingAfter,
        nextStartingAfter,
        aliases,
        observedAt,
      },
    };
  }
  if (
    (status === 423 || status === 429 || status === 500 || status === 503) &&
    validRevenueCatV2ErrorForStatus(status, body)
  ) {
    return { kind: 'retryable', resultCode: 'REVENUECAT_V2_PREFLIGHT_RETRY' };
  }
  if ((status === 401 || status === 403) && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
    };
  }
  return {
    kind: 'action_required',
    resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
  };
}

export function attestRevenueCatV2PreflightSnapshot(options: {
  customer: RevenueCatV2CustomerLookupEvidence;
  aliasPages: RevenueCatV2AliasPageEvidence[];
  aliasSnapshotCompletedAt: string;
  persisted: true;
}): RevenueCatV2PreflightDisposition {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['customer', 'aliasPages', 'aliasSnapshotCompletedAt', 'persisted']) ||
    options.persisted !== true ||
    !isRecord(options.customer) ||
    !hasExactKeys(options.customer, [
      'projectId',
      'lookupCustomerId',
      'customerId',
      'firstSeenAt',
      'lastSeenAt',
      'observedAt',
    ]) ||
    !boundedExactString(options.customer.projectId, REVENUECAT_V2_MAX_PROJECT_ID_LENGTH) ||
    canonicalUuid(options.customer.lookupCustomerId) !== options.customer.lookupCustomerId ||
    !boundedExactString(options.customer.customerId, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
    !nonNegativeSafeInteger(options.customer.firstSeenAt) ||
    (options.customer.lastSeenAt !== null &&
      (!nonNegativeSafeInteger(options.customer.lastSeenAt) ||
        options.customer.lastSeenAt < options.customer.firstSeenAt)) ||
    !validIsoTimestamp(options.customer.observedAt) ||
    !Array.isArray(options.aliasPages) ||
    !validIsoTimestamp(options.aliasSnapshotCompletedAt)
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  if (options.aliasPages.length === 0 || options.aliasPages.length > REVENUECAT_V2_MAX_LIST_PAGES) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    };
  }
  const completedAtMs = timestampMs(options.aliasSnapshotCompletedAt);
  let expectedCursor: string | null = null;
  let previousObservedAtMs = timestampMs(options.customer.observedAt);
  const aliases: Array<{ id: string; createdAt: number }> = [];
  const aliasIds = new Set<string>();
  for (const page of options.aliasPages) {
    if (
      !isRecord(page) ||
      !hasExactKeys(page, [
        'projectId',
        'customerId',
        'requestedStartingAfter',
        'nextStartingAfter',
        'aliases',
        'observedAt',
      ]) ||
      page.projectId !== options.customer.projectId ||
      page.customerId !== options.customer.customerId ||
      page.requestedStartingAfter !== expectedCursor ||
      (page.nextStartingAfter !== null &&
        !boundedExactString(page.nextStartingAfter, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH)) ||
      !Array.isArray(page.aliases) ||
      page.aliases.length > REVENUECAT_V2_ALIAS_PAGE_SIZE ||
      !validIsoTimestamp(page.observedAt) ||
      timestampMs(page.observedAt) < previousObservedAtMs ||
      timestampMs(page.observedAt) > completedAtMs
    ) {
      return {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
      };
    }
    previousObservedAtMs = timestampMs(page.observedAt);
    for (const alias of page.aliases) {
      if (
        !isRecord(alias) ||
        !hasExactKeys(alias, ['id', 'createdAt']) ||
        !boundedExactString(alias.id, REVENUECAT_V2_MAX_CUSTOMER_ID_LENGTH) ||
        !nonNegativeSafeInteger(alias.createdAt) ||
        alias.createdAt < options.customer.firstSeenAt ||
        aliasIds.has(alias.id)
      ) {
        return {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
        };
      }
      aliasIds.add(alias.id);
      aliases.push({ id: alias.id, createdAt: alias.createdAt });
    }
    if (
      page.nextStartingAfter !== null &&
      (page.aliases.length === 0 || aliases[aliases.length - 1].id !== page.nextStartingAfter)
    ) {
      return {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
      };
    }
    expectedCursor = page.nextStartingAfter;
  }
  if (
    expectedCursor !== null ||
    completedAtMs < timestampMs(options.customer.observedAt) ||
    aliases.length > REVENUECAT_V2_MAX_ALIASES
  ) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    };
  }
  aliases.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const identityFamily = [
    ...new Set([
      options.customer.lookupCustomerId,
      options.customer.customerId,
      ...aliases.map((alias) => alias.id),
    ]),
  ];
  if (
    revenueCatV2EvidenceIdBytes(options.customer.projectId, identityFamily) >
    REVENUECAT_V2_MAX_EVIDENCE_ID_BYTES
  ) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    };
  }
  const evidence: RevenueCatV2PreflightEvidence = {
    version: 1,
    persisted: true,
    projectId: options.customer.projectId,
    lookupCustomerId: options.customer.lookupCustomerId,
    customerId: options.customer.customerId,
    firstSeenAt: options.customer.firstSeenAt,
    lastSeenAt: options.customer.lastSeenAt,
    aliasSnapshotCompletedAt: options.aliasSnapshotCompletedAt,
    aliasPageCount: options.aliasPages.length,
    aliases,
  };
  if (
    new TextEncoder().encode(JSON.stringify(evidence)).byteLength >
    REVENUECAT_V2_MAX_PREFLIGHT_SERIALIZED_BYTES
  ) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    };
  }
  assertRevenueCatV2PreflightEvidence(evidence);
  return { kind: 'ready', evidence };
}

export function buildRevenueCatV2DeleteRequest(options: {
  evidence: RevenueCatV2PreflightEvidence;
  secretApiKey: string;
}): RevenueCatV2DeleteRequest {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['evidence', 'secretApiKey']) ||
    !boundedExactString(options.secretApiKey, 1_000)
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  assertRevenueCatV2PreflightEvidence(options.evidence);
  const path = revenueCatV2CustomerPath(options.evidence.projectId, options.evidence.customerId);
  return {
    url: `${REVENUECAT_V2_API_BASE}${path.slice(3)}`,
    init: {
      method: 'DELETE',
      redirect: 'error',
      headers: revenueCatV2Headers(options.secretApiKey),
    },
    expectedProjectId: options.evidence.projectId,
    expectedCustomerId: options.evidence.customerId,
  };
}

export function classifyRevenueCatV2DeleteResponse(
  status: number,
  body: unknown,
  evidence: RevenueCatV2PreflightEvidence,
): RevenueCatV2DeletionDisposition {
  assertHttpStatus(status);
  assertRevenueCatV2PreflightEvidence(evidence);
  if (status === 200 || status === 202) {
    const latestProviderTimestamp = Math.max(
      evidence.firstSeenAt,
      ...evidence.aliases.map((alias) => alias.createdAt),
    );
    if (
      !isRecord(body) ||
      !hasExactKeys(body, ['object', 'id', 'deleted_at']) ||
      body.object !== 'customer' ||
      body.id !== evidence.customerId ||
      !nonNegativeSafeInteger(body.deleted_at) ||
      body.deleted_at < latestProviderTimestamp
    ) {
      return {
        kind: 'ambiguous',
        resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
      };
    }
    return {
      kind: 'verification_required',
      resultCode:
        status === 200 ? 'REVENUECAT_V2_DELETE_ACKNOWLEDGED' : 'REVENUECAT_V2_DELETE_QUEUED',
      acknowledgement: {
        mode: status === 200 ? 'completed' : 'queued',
        deletedAt: body.deleted_at,
      },
    };
  }
  if (status === 404 && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'verification_required',
      resultCode: 'REVENUECAT_V2_DELETE_ABSENT_RECONCILE',
      acknowledgement: { mode: 'already_absent', deletedAt: null },
    };
  }
  if (status === 429 && validRevenueCatV2ErrorForStatus(status, body)) {
    return { kind: 'retryable', resultCode: 'REVENUECAT_V2_RATE_LIMITED' };
  }
  if (status === 423 && validRevenueCatV2ErrorForStatus(status, body)) {
    return { kind: 'retryable', resultCode: 'REVENUECAT_V2_RETRY' };
  }
  if ([400, 401, 403, 409, 422].includes(status) && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
    };
  }
  // A malformed success or server failure after DELETE may have taken effect.
  return { kind: 'ambiguous', resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS' };
}

export function classifyRevenueCatV2TransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return phase === 'after_request_started'
    ? { kind: 'ambiguous', resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS' }
    : { kind: 'retryable', resultCode: 'REVENUECAT_V2_RETRY' };
}

export function buildRevenueCatV2ReconciliationRequests(options: {
  evidence: RevenueCatV2PreflightEvidence;
  secretApiKey: string;
}): {
  customers: RevenueCatV2CustomerReconciliationRequest[];
  aliases: RevenueCatV2AliasesReconciliationRequest;
} {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['evidence', 'secretApiKey']) ||
    !boundedExactString(options.secretApiKey, 1_000)
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  assertRevenueCatV2PreflightEvidence(options.evidence);
  const family = revenueCatV2IdentityFamily(options.evidence);
  const customers = family.map<RevenueCatV2CustomerReconciliationRequest>(
    (targetCustomerId, targetIndex) => {
      const path = revenueCatV2CustomerPath(options.evidence.projectId, targetCustomerId);
      return {
        url: `${REVENUECAT_V2_API_BASE}${path.slice(3)}`,
        init: {
          method: 'GET',
          redirect: 'error',
          headers: revenueCatV2Headers(options.secretApiKey),
        },
        expectedProjectId: options.evidence.projectId,
        expectedCanonicalCustomerId: options.evidence.customerId,
        targetCustomerId,
        targetIndex,
      };
    },
  );
  const aliasPath = revenueCatV2AliasesPath(
    options.evidence.projectId,
    options.evidence.customerId,
  );
  return {
    customers,
    aliases: {
      url: `${REVENUECAT_V2_API_BASE}${aliasPath.slice(3)}`,
      init: {
        method: 'GET',
        redirect: 'error',
        headers: revenueCatV2Headers(options.secretApiKey),
      },
      expectedProjectId: options.evidence.projectId,
      expectedCustomerId: options.evidence.customerId,
    },
  };
}

export function classifyRevenueCatV2CustomerReconciliationResponse(
  status: number,
  body: unknown,
  evidence: RevenueCatV2PreflightEvidence,
  targetIndex: number,
  observedAt: string,
): RevenueCatV2CustomerReconciliationDisposition {
  assertHttpStatus(status);
  assertRevenueCatV2PreflightEvidence(evidence);
  const family = revenueCatV2IdentityFamily(evidence);
  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= family.length ||
    !validIsoTimestamp(observedAt)
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  if (status === 404 && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'absent',
      targetIndex,
      targetCustomerId: family[targetIndex],
      observedAt,
    };
  }
  if (status === 200) {
    const customer = parseRevenueCatV2Customer(body, evidence.projectId);
    if (customer !== null && customer.customerId === evidence.customerId) {
      return {
        kind: 'present',
        targetIndex,
        targetCustomerId: family[targetIndex],
        observedAt,
      };
    }
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED',
    };
  }
  if (
    (status === 423 || status === 429 || status === 500 || status === 503) &&
    validRevenueCatV2ErrorForStatus(status, body)
  ) {
    return {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_RECONCILIATION_RETRY',
    };
  }
  if ((status === 401 || status === 403) && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
    };
  }
  return {
    kind: 'action_required',
    resultCode: 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED',
  };
}

export function classifyRevenueCatV2AliasesReconciliationResponse(
  status: number,
  body: unknown,
  evidence: RevenueCatV2PreflightEvidence,
  observedAt: string,
): RevenueCatV2AliasesReconciliationDisposition {
  assertHttpStatus(status);
  assertRevenueCatV2PreflightEvidence(evidence);
  if (!validIsoTimestamp(observedAt)) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  if (status === 404 && validRevenueCatV2ErrorForStatus(status, body)) {
    return { kind: 'absent', customerId: evidence.customerId, observedAt };
  }
  if (status === 200) {
    const page = classifyRevenueCatV2AliasPageResponse(
      status,
      body,
      evidence.projectId,
      evidence.customerId,
      null,
      observedAt,
    );
    return page.kind === 'page'
      ? { kind: 'present', customerId: evidence.customerId, observedAt }
      : {
          kind: 'action_required',
          resultCode: 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED',
        };
  }
  if (
    (status === 423 || status === 429 || status === 500 || status === 503) &&
    validRevenueCatV2ErrorForStatus(status, body)
  ) {
    return {
      kind: 'retryable',
      resultCode: 'REVENUECAT_V2_RECONCILIATION_RETRY',
    };
  }
  if ((status === 401 || status === 403) && validRevenueCatV2ErrorForStatus(status, body)) {
    return {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_CONFIGURATION_REQUIRED',
    };
  }
  return {
    kind: 'action_required',
    resultCode: 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED',
  };
}

export function classifyRevenueCatV2ReconciliationTransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return {
    kind: 'retryable',
    resultCode: 'REVENUECAT_V2_RECONCILIATION_RETRY',
  };
}

export function attestRevenueCatV2Deletion(options: {
  preflightEvidence: RevenueCatV2PreflightEvidence;
  dispatchEvidence: RevenueCatV2DispatchEvidence;
  reconciliationEvidence: RevenueCatV2ReconciliationEvidence;
}): RevenueCatV2TerminalDisposition {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['preflightEvidence', 'dispatchEvidence', 'reconciliationEvidence'])
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  assertRevenueCatV2PreflightEvidence(options.preflightEvidence);
  const dispatch = options.dispatchEvidence;
  const reconciliation = options.reconciliationEvidence;
  const dispatchCodes = [
    'REVENUECAT_V2_DELETE_ACKNOWLEDGED',
    'REVENUECAT_V2_DELETE_QUEUED',
    'REVENUECAT_V2_DELETE_ABSENT_RECONCILE',
    'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
  ] as const;
  if (
    !isRecord(dispatch) ||
    !hasExactKeys(dispatch, ['persisted', 'requestStartedAt', 'resultCode', 'deletedAt']) ||
    dispatch.persisted !== true ||
    !validIsoTimestamp(dispatch.requestStartedAt) ||
    timestampMs(dispatch.requestStartedAt) <
      timestampMs(options.preflightEvidence.aliasSnapshotCompletedAt) ||
    !isOneOf(dispatch.resultCode, dispatchCodes) ||
    (dispatch.resultCode === 'REVENUECAT_V2_DELETE_ACKNOWLEDGED' ||
      dispatch.resultCode === 'REVENUECAT_V2_DELETE_QUEUED') !==
      nonNegativeSafeInteger(dispatch.deletedAt) ||
    (nonNegativeSafeInteger(dispatch.deletedAt) &&
      dispatch.deletedAt <
        Math.max(
          options.preflightEvidence.firstSeenAt,
          ...options.preflightEvidence.aliases.map((alias) => alias.createdAt),
        )) ||
    !isRecord(reconciliation) ||
    !hasExactKeys(reconciliation, ['persisted', 'customerObservations', 'aliasesObservation']) ||
    reconciliation.persisted !== true ||
    !Array.isArray(reconciliation.customerObservations) ||
    !isRecord(reconciliation.aliasesObservation) ||
    !hasExactKeys(reconciliation.aliasesObservation, ['kind', 'customerId', 'observedAt']) ||
    !isOneOf(reconciliation.aliasesObservation.kind, ['absent', 'present'] as const) ||
    reconciliation.aliasesObservation.customerId !== options.preflightEvidence.customerId ||
    !validIsoTimestamp(reconciliation.aliasesObservation.observedAt) ||
    timestampMs(reconciliation.aliasesObservation.observedAt) <
      timestampMs(dispatch.requestStartedAt)
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  const identityFamily = revenueCatV2IdentityFamily(options.preflightEvidence);
  const identityCount = identityFamily.length;
  if (reconciliation.customerObservations.length !== identityCount) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  const targetIndexes = new Set<number>();
  let anyPresent = reconciliation.aliasesObservation.kind === 'present';
  for (const observation of reconciliation.customerObservations) {
    if (
      !isRecord(observation) ||
      !hasExactKeys(observation, ['kind', 'targetIndex', 'targetCustomerId', 'observedAt']) ||
      !isOneOf(observation.kind, ['absent', 'present'] as const) ||
      !Number.isInteger(observation.targetIndex) ||
      observation.targetIndex < 0 ||
      observation.targetIndex >= identityCount ||
      observation.targetCustomerId !== identityFamily[observation.targetIndex] ||
      targetIndexes.has(observation.targetIndex) ||
      !validIsoTimestamp(observation.observedAt) ||
      timestampMs(observation.observedAt) < timestampMs(dispatch.requestStartedAt)
    ) {
      throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
    }
    targetIndexes.add(observation.targetIndex);
    anyPresent ||= observation.kind === 'present';
  }
  if (anyPresent) {
    return {
      kind: 'pending',
      resultCode: 'REVENUECAT_V2_CUSTOMER_STILL_PRESENT',
    };
  }
  if (
    new TextEncoder().encode(JSON.stringify(options)).byteLength >
    REVENUECAT_V2_MAX_DURABLE_EVIDENCE_BYTES
  ) {
    throw new DurableProviderDeletionError('REVENUECAT_V2_EVIDENCE_INVALID');
  }
  return {
    kind: 'succeeded',
    resultCode: 'REVENUECAT_V2_DELETION_VERIFIED',
    receipt: {
      provider: 'revenuecat_v2',
      result: 'deleted_verified',
      scope: 'customer_and_alias_family',
    },
  };
}

export function classifyAppleRevokeResponse(
  response: AppleRevokeResponse,
): AppleRevocationDisposition {
  if (
    !isRecord(response) ||
    !hasExactKeys(response, ['status', 'body', 'responseBytes']) ||
    typeof response.body !== 'string' ||
    !Number.isSafeInteger(response.responseBytes) ||
    response.responseBytes < 0
  ) {
    throw new DurableProviderDeletionError('APPLE_DISPOSITION_INVALID');
  }
  assertHttpStatus(response.status);
  if (response.status === 200 && response.body.length === 0 && response.responseBytes === 0) {
    return {
      kind: 'succeeded',
      resultCode: 'APPLE_REVOKED',
      receipt: { provider: 'apple', result: 'revoked' },
    };
  }
  // Apple documents 200 for newly revoked and already-invalid tokens. The
  // documented success response has no body. The operation is idempotent, so
  // explicit rate limits and server failures retry; all other unverified
  // responses preserve the truthful manual fallback.
  if (response.status === 429 || response.status >= 500) {
    return { kind: 'retryable', resultCode: 'APPLE_REVOKE_RETRY' };
  }
  return appleManualRevocationDisposition();
}

export function appleManualRevocationDisposition(): Extract<
  AppleRevocationDisposition,
  { kind: 'manual_required' }
> {
  return {
    kind: 'manual_required',
    resultCode: 'APPLE_MANUAL_REVOCATION_REQUIRED',
    notice: { action: 'remove_apple_authorization' },
  };
}

export function classifyAppleRevokeTransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return { kind: 'retryable', resultCode: 'APPLE_REVOKE_RETRY' };
}

/**
 * A missing Apple credential becomes a successful deletion step with a durable
 * manual-action notice. It never claims that Apple authorization was revoked.
 */
export function adaptAppleRevocationForDeletionStep(
  disposition: AppleRevocationDisposition,
): AppleDeletionStepDisposition {
  if (!isRecord(disposition) || !exactNonBlank(disposition.kind)) {
    throw new DurableProviderDeletionError('APPLE_DISPOSITION_INVALID');
  }
  if (
    disposition.kind === 'succeeded' &&
    hasExactKeys(disposition, ['kind', 'resultCode', 'receipt']) &&
    disposition.resultCode === 'APPLE_REVOKED' &&
    isRecord(disposition.receipt) &&
    hasExactKeys(disposition.receipt, ['provider', 'result']) &&
    disposition.receipt.provider === 'apple' &&
    disposition.receipt.result === 'revoked'
  ) {
    return disposition;
  }
  if (
    disposition.kind === 'manual_required' &&
    hasExactKeys(disposition, ['kind', 'resultCode', 'notice']) &&
    disposition.resultCode === 'APPLE_MANUAL_REVOCATION_REQUIRED' &&
    isRecord(disposition.notice) &&
    hasExactKeys(disposition.notice, ['action']) &&
    disposition.notice.action === 'remove_apple_authorization'
  ) {
    return {
      kind: 'succeeded',
      resultCode: 'APPLE_MANUAL_REVOCATION_RECORDED',
      receipt: { provider: 'apple', result: 'manual_action_recorded' },
      notice: { action: 'remove_apple_authorization' },
    };
  }
  if (
    disposition.kind === 'retryable' &&
    disposition.resultCode === 'APPLE_REVOKE_RETRY' &&
    hasExactKeys(disposition, ['kind', 'resultCode'])
  ) {
    return disposition;
  }
  throw new DurableProviderDeletionError('APPLE_DISPOSITION_INVALID');
}

export async function buildPostHogPersonLookupRequest(
  options: PostHogRequestOptions & { appUserId: string },
): Promise<PostHogLookupRequest> {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, ['host', 'projectId', 'personalApiKey', 'appUserId'])
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  const host = assertPostHogRequestOptions(options);
  const appUserId = canonicalUuid(options.appUserId);
  if (appUserId === null || appUserId !== options.appUserId) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  const expectedDistinctIds = [await pseudonymousUserId(appUserId), appUserId];
  if (new Set(expectedDistinctIds).size !== expectedDistinctIds.length) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  return {
    url: `${host}/api/projects/${encodeURIComponent(
      options.projectId,
    )}/persons/batch_by_distinct_ids/`,
    init: {
      method: 'POST',
      redirect: 'error',
      headers: postHogHeaders(options.personalApiKey, true),
      body: JSON.stringify({ distinct_ids: expectedDistinctIds }),
    },
    expectedDistinctIds,
  };
}

export function classifyPostHogPersonLookupResponse(
  status: number,
  body: unknown,
  expectedDistinctIds: readonly string[],
): PostHogLookupDisposition {
  assertHttpStatus(status);
  if (status !== 200) return lookupFailure(status);
  if (!isRecord(body) || !hasExactKeys(body, ['results']) || !isRecord(body.results)) {
    return lookupFailure(status);
  }
  if (
    !Array.isArray(expectedDistinctIds) ||
    expectedDistinctIds.length !== 2 ||
    expectedDistinctIds.some((value) => !exactNonBlank(value) || value.length > 500) ||
    new Set(expectedDistinctIds).size !== expectedDistinctIds.length
  ) {
    return { kind: 'action_required', resultCode: 'POSTHOG_LOOKUP_UNATTESTED' };
  }

  const expected = new Set(expectedDistinctIds);
  const personUuids = new Set<string>();
  for (const [distinctId, person] of Object.entries(body.results)) {
    if (!expected.has(distinctId) || !isRecord(person)) {
      return lookupFailure(status);
    }
    const uuid = canonicalUuid(person.uuid);
    if (uuid === null) return lookupFailure(status);
    personUuids.add(uuid);
  }
  return personUuids.size === 0
    ? { kind: 'absent' }
    : { kind: 'found', personUuids: [...personUuids].sort() };
}

export function buildPostHogBulkDeleteRequest(
  options: PostHogRequestOptions & {
    personUuids: readonly string[];
    deleteRecordings: boolean;
    dispatchCutoffAt: string;
  },
): PostHogBulkDeleteRequest {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, [
      'host',
      'projectId',
      'personalApiKey',
      'personUuids',
      'deleteRecordings',
      'dispatchCutoffAt',
    ])
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  const host = assertPostHogRequestOptions(options);
  const ids = canonicalTargetUuids(options.personUuids, {
    requireCanonicalUnique: false,
  });
  if (
    ids === null ||
    typeof options.deleteRecordings !== 'boolean' ||
    !validIsoTimestamp(options.dispatchCutoffAt)
  ) {
    throw new DurableProviderDeletionError('POSTHOG_PERSON_UUID_INVALID');
  }
  return {
    url: `${host}/api/projects/${encodeURIComponent(options.projectId)}/persons/bulk_delete/`,
    init: {
      method: 'POST',
      redirect: 'error',
      headers: postHogHeaders(options.personalApiKey, true),
      body: JSON.stringify({
        ids,
        delete_events: true,
        delete_recordings: options.deleteRecordings,
      }),
    },
    expectedPersonUuids: ids,
    deleteRecordings: options.deleteRecordings,
    dispatchCutoffAt: options.dispatchCutoffAt,
  };
}

export function classifyPostHogBulkDeleteResponse(
  status: number,
  body: unknown,
  expected: {
    personUuids: readonly string[];
    deleteRecordings: boolean;
    dispatchCutoffAt: string;
  },
): PostHogBulkDeleteDisposition {
  assertHttpStatus(status);
  const expectedPersonUuids = canonicalTargetUuids(expected?.personUuids, {
    requireCanonicalUnique: true,
  });
  if (
    expectedPersonUuids === null ||
    !isRecord(expected) ||
    !hasExactKeys(expected, ['personUuids', 'deleteRecordings', 'dispatchCutoffAt']) ||
    typeof expected?.deleteRecordings !== 'boolean' ||
    !validIsoTimestamp(expected?.dispatchCutoffAt)
  ) {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }
  if (
    status === 202 &&
    isRecord(body) &&
    (hasExactKeys(body, [
      'persons_found',
      'persons_deleted',
      'events_queued_for_deletion',
      'recordings_queued_for_deletion',
    ]) ||
      hasExactKeys(body, [
        'persons_found',
        'persons_deleted',
        'events_queued_for_deletion',
        'recordings_queued_for_deletion',
        'deletion_errors',
      ])) &&
    body.persons_found === expectedPersonUuids.length &&
    body.persons_deleted === expectedPersonUuids.length &&
    body.events_queued_for_deletion === true &&
    body.recordings_queued_for_deletion === expected.deleteRecordings &&
    (!Object.hasOwn(body, 'deletion_errors') ||
      (Array.isArray(body.deletion_errors) && body.deletion_errors.length === 0))
  ) {
    return {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      queue: {
        events: true,
        recordings: expected.deleteRecordings,
        dispatchCutoffAt: expected.dispatchCutoffAt,
        targetCount: expectedPersonUuids.length,
      },
    };
  }
  if (status === 429) {
    return { kind: 'retryable', resultCode: 'POSTHOG_DELETE_RATE_LIMITED' };
  }
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return {
      kind: 'action_required',
      resultCode: 'POSTHOG_DELETE_CONFIGURATION_REQUIRED',
    };
  }
  return { kind: 'ambiguous', resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS' };
}

export function classifyPostHogBulkDeleteTransportFailure(
  phase: NetworkRequestPhase,
): ProviderFailureDisposition {
  assertNetworkRequestPhase(phase);
  return phase === 'after_request_started'
    ? { kind: 'ambiguous', resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS' }
    : { kind: 'retryable', resultCode: 'POSTHOG_DELETE_RETRY' };
}

export function buildPostHogDeletionStatusRequest(
  options: PostHogRequestOptions & {
    personUuid: string;
    dispatchCutoffAt: string;
  },
): PostHogDeletionStatusRequest {
  if (
    !isRecord(options) ||
    !hasExactKeys(options, [
      'host',
      'projectId',
      'personalApiKey',
      'personUuid',
      'dispatchCutoffAt',
    ])
  ) {
    throw new DurableProviderDeletionError('PROVIDER_REQUEST_INVALID');
  }
  const host = assertPostHogRequestOptions(options);
  const personUuid = canonicalUuid(options.personUuid);
  if (personUuid === null || !validIsoTimestamp(options.dispatchCutoffAt)) {
    throw new DurableProviderDeletionError('POSTHOG_PERSON_UUID_INVALID');
  }
  const query = new URLSearchParams({
    status: 'all',
    person_uuid: personUuid,
    limit: '100',
    offset: '0',
  });
  return {
    url: `${host}/api/projects/${encodeURIComponent(
      options.projectId,
    )}/persons/deletion_status/?${query}`,
    init: {
      method: 'GET',
      redirect: 'error',
      headers: postHogHeaders(options.personalApiKey, false),
    },
    expectedPersonUuid: personUuid,
    dispatchCutoffAt: options.dispatchCutoffAt,
  };
}

export function classifyPostHogDeletionStatusResponse(
  status: number,
  body: unknown,
  expectedPersonUuid: string,
  dispatchCutoffAt: string,
): PostHogEventStatusDisposition {
  assertHttpStatus(status);
  if (status !== 200) return statusFailure(status);
  const expected = canonicalUuid(expectedPersonUuid);
  if (
    expected === null ||
    expected !== expectedPersonUuid ||
    !validIsoTimestamp(dispatchCutoffAt) ||
    !isRecord(body) ||
    !hasExactKeys(body, ['count', 'next', 'previous', 'results']) ||
    !nonNegativeSafeInteger(body.count) ||
    body.next !== null ||
    body.previous !== null ||
    !Array.isArray(body.results) ||
    body.count !== body.results.length
  ) {
    return statusFailure(status);
  }

  const cutoffMs = timestampMs(dispatchCutoffAt);
  const currentRows: Array<{
    status: 'pending' | 'completed';
    createdAt: string;
    createdAtMs: number;
    verifiedAt: string | null;
    verifiedAtMs: number | null;
  }> = [];
  for (const row of body.results) {
    if (
      !isRecord(row) ||
      !hasExactKeys(row, ['person_uuid', 'created_at', 'status', 'delete_verified_at']) ||
      canonicalUuid(row.person_uuid) !== expected ||
      !validIsoTimestamp(row.created_at)
    ) {
      return statusFailure(status);
    }
    const createdAtMs = timestampMs(row.created_at);
    if (row.status === 'pending' && row.delete_verified_at === null) {
      if (createdAtMs >= cutoffMs) {
        currentRows.push({
          status: 'pending',
          createdAt: row.created_at,
          createdAtMs,
          verifiedAt: null,
          verifiedAtMs: null,
        });
      }
      continue;
    }
    if (row.status === 'completed' && validIsoTimestamp(row.delete_verified_at)) {
      const verifiedAtMs = timestampMs(row.delete_verified_at);
      if (verifiedAtMs < createdAtMs) return statusFailure(status);
      if (createdAtMs >= cutoffMs) {
        currentRows.push({
          status: 'completed',
          createdAt: row.created_at,
          createdAtMs,
          verifiedAt: row.delete_verified_at,
          verifiedAtMs,
        });
      }
      continue;
    }
    return statusFailure(status);
  }
  if (currentRows.length === 0) {
    return { kind: 'missing', resultCode: 'POSTHOG_STATUS_MISSING' };
  }
  if (currentRows.some((row) => row.status === 'pending')) {
    return { kind: 'pending', resultCode: 'POSTHOG_STATUS_PENDING' };
  }

  const latest = currentRows.sort((left, right) => right.createdAtMs - left.createdAtMs)[0];
  if (latest.verifiedAt === null || latest.verifiedAtMs === null) {
    return statusFailure(status);
  }
  return {
    kind: 'completed',
    resultCode: 'POSTHOG_STATUS_COMPLETED',
    transientEvidence: {
      personUuid: expected,
      dispatchCutoffAt,
      createdAt: latest.createdAt,
      verifiedAt: latest.verifiedAt,
    },
  };
}

function propagateLookupFailure(
  lookup: PostHogLookupDisposition,
): ProviderFailureDisposition | null {
  if (
    lookup.kind === 'retryable' &&
    lookup.resultCode === 'POSTHOG_LOOKUP_RETRY' &&
    hasExactKeys(lookup, ['kind', 'resultCode'])
  ) {
    return lookup;
  }
  if (
    lookup.kind === 'action_required' &&
    lookup.resultCode === 'POSTHOG_LOOKUP_UNATTESTED' &&
    hasExactKeys(lookup, ['kind', 'resultCode'])
  ) {
    return lookup;
  }
  if (
    lookup.kind === 'ambiguous' &&
    lookup.resultCode === 'POSTHOG_LOOKUP_UNATTESTED' &&
    hasExactKeys(lookup, ['kind', 'resultCode'])
  ) {
    return lookup;
  }
  return null;
}

function propagateStatusFailure(
  status: PostHogEventStatusDisposition,
): ProviderFailureDisposition | null {
  if (
    status.kind === 'retryable' &&
    status.resultCode === 'POSTHOG_STATUS_RETRY' &&
    hasExactKeys(status, ['kind', 'resultCode'])
  ) {
    return status;
  }
  if (
    (status.kind === 'action_required' || status.kind === 'ambiguous') &&
    status.resultCode === 'POSTHOG_STATUS_UNATTESTED' &&
    hasExactKeys(status, ['kind', 'resultCode'])
  ) {
    return status;
  }
  return null;
}

export function attestPostHogTerminalDeletion(options: {
  latestLookup: PostHogLookupDisposition;
  targetSetEvidence: PostHogTargetSetEvidence;
  eventStatuses: readonly PostHogEventStatusDisposition[];
  dispatchCutoffAt: string;
  captureShutdownAt: string;
  absenceObservations: readonly PostHogAbsenceObservation[];
  minimumAbsenceIntervalSeconds: number;
  noRecordingsEvidence: PostHogNoRecordingsEvidence;
}): PostHogTerminalDisposition {
  if (!isRecord(options)) {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }
  const {
    latestLookup,
    targetSetEvidence,
    eventStatuses,
    dispatchCutoffAt,
    captureShutdownAt,
    absenceObservations,
    minimumAbsenceIntervalSeconds,
    noRecordingsEvidence,
  } = options;
  if (
    !hasExactKeys(options, [
      'latestLookup',
      'targetSetEvidence',
      'eventStatuses',
      'dispatchCutoffAt',
      'captureShutdownAt',
      'absenceObservations',
      'minimumAbsenceIntervalSeconds',
      'noRecordingsEvidence',
    ]) ||
    !isRecord(targetSetEvidence) ||
    !hasExactKeys(targetSetEvidence, ['personUuids', 'persisted', 'capturedAt']) ||
    targetSetEvidence.persisted !== true ||
    !validIsoTimestamp(targetSetEvidence.capturedAt) ||
    !validIsoTimestamp(dispatchCutoffAt) ||
    !validIsoTimestamp(captureShutdownAt) ||
    timestampMs(captureShutdownAt) > timestampMs(dispatchCutoffAt) ||
    !Array.isArray(eventStatuses) ||
    !Array.isArray(absenceObservations) ||
    !Number.isSafeInteger(minimumAbsenceIntervalSeconds) ||
    minimumAbsenceIntervalSeconds < 1 ||
    minimumAbsenceIntervalSeconds > 86_400 ||
    !isRecord(noRecordingsEvidence) ||
    !hasExactKeys(noRecordingsEvidence, [
      'recordingsCollected',
      'durable',
      'evidence',
      'verifiedAt',
    ]) ||
    typeof noRecordingsEvidence.recordingsCollected !== 'boolean' ||
    noRecordingsEvidence.durable !== true ||
    noRecordingsEvidence.evidence !== 'production_capture_disabled_and_storage_audited' ||
    !validIsoTimestamp(noRecordingsEvidence.verifiedAt)
  ) {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }
  const expectedPersonUuids = canonicalTargetUuids(targetSetEvidence.personUuids, {
    requireCanonicalUnique: true,
  });
  if (
    expectedPersonUuids === null ||
    timestampMs(targetSetEvidence.capturedAt) > timestampMs(dispatchCutoffAt)
  ) {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }

  if (!isRecord(latestLookup) || !exactNonBlank(latestLookup.kind)) {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }
  const lookupFailure = propagateLookupFailure(latestLookup);
  if (lookupFailure !== null) return lookupFailure;
  if (latestLookup.kind === 'found') {
    if (!hasExactKeys(latestLookup, ['kind', 'personUuids'])) {
      throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
    }
    const found = canonicalTargetUuids(latestLookup.personUuids, {
      requireCanonicalUnique: true,
    });
    if (found === null) {
      throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
    }
    return { kind: 'pending', resultCode: 'POSTHOG_PERSON_REAPPEARED' };
  }
  if (latestLookup.kind !== 'absent') {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }
  if (!hasExactKeys(latestLookup, ['kind'])) {
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }

  let hasPending = false;
  let hasMissing = false;
  const completedEvidence: PostHogCompletedEventEvidence[] = [];
  for (const eventStatus of eventStatuses) {
    if (!isRecord(eventStatus) || !exactNonBlank(eventStatus.kind)) {
      throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
    }
    const failure = propagateStatusFailure(eventStatus as PostHogEventStatusDisposition);
    if (failure !== null) return failure;
    if (
      eventStatus.kind === 'pending' &&
      eventStatus.resultCode === 'POSTHOG_STATUS_PENDING' &&
      hasExactKeys(eventStatus, ['kind', 'resultCode'])
    ) {
      hasPending = true;
      continue;
    }
    if (
      eventStatus.kind === 'missing' &&
      eventStatus.resultCode === 'POSTHOG_STATUS_MISSING' &&
      hasExactKeys(eventStatus, ['kind', 'resultCode'])
    ) {
      hasMissing = true;
      continue;
    }
    if (
      eventStatus.kind === 'completed' &&
      eventStatus.resultCode === 'POSTHOG_STATUS_COMPLETED' &&
      hasExactKeys(eventStatus, ['kind', 'resultCode', 'transientEvidence']) &&
      isRecord(eventStatus.transientEvidence) &&
      hasExactKeys(eventStatus.transientEvidence, [
        'personUuid',
        'dispatchCutoffAt',
        'createdAt',
        'verifiedAt',
      ])
    ) {
      const evidence = eventStatus.transientEvidence;
      const uuid = canonicalUuid(evidence.personUuid);
      if (
        uuid === null ||
        uuid !== evidence.personUuid ||
        evidence.dispatchCutoffAt !== dispatchCutoffAt ||
        !validIsoTimestamp(evidence.createdAt) ||
        !validIsoTimestamp(evidence.verifiedAt) ||
        timestampMs(evidence.createdAt) < timestampMs(dispatchCutoffAt) ||
        timestampMs(evidence.verifiedAt) < timestampMs(evidence.createdAt)
      ) {
        throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
      }
      completedEvidence.push({
        personUuid: uuid,
        dispatchCutoffAt: evidence.dispatchCutoffAt,
        createdAt: evidence.createdAt,
        verifiedAt: evidence.verifiedAt,
      });
      continue;
    }
    throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
  }
  if (eventStatuses.length !== expectedPersonUuids.length || hasMissing) {
    return { kind: 'ambiguous', resultCode: 'POSTHOG_STATUS_UNATTESTED' };
  }
  if (hasPending) {
    return { kind: 'pending', resultCode: 'POSTHOG_STATUS_PENDING' };
  }
  const completedTargets = completedEvidence.map((evidence) => evidence.personUuid);
  if (
    new Set(completedTargets).size !== completedTargets.length ||
    !sameStringSet(completedTargets, expectedPersonUuids)
  ) {
    return { kind: 'ambiguous', resultCode: 'POSTHOG_STATUS_UNATTESTED' };
  }

  if (noRecordingsEvidence.recordingsCollected) {
    return {
      kind: 'action_required',
      resultCode: 'POSTHOG_RECORDING_VERIFICATION_REQUIRED',
    };
  }

  if (absenceObservations.length < 2) {
    return { kind: 'pending', resultCode: 'POSTHOG_QUIESCENCE_PENDING' };
  }
  const mustFollowMs = Math.max(timestampMs(captureShutdownAt), timestampMs(dispatchCutoffAt));
  const minimumGapMs = minimumAbsenceIntervalSeconds * 1_000;
  let priorObservationMs: number | null = null;
  for (const observation of absenceObservations) {
    if (
      !isRecord(observation) ||
      !hasExactKeys(observation, ['kind', 'observedAt', 'persisted']) ||
      observation.kind !== 'absent' ||
      observation.persisted !== true ||
      !validIsoTimestamp(observation.observedAt)
    ) {
      throw new DurableProviderDeletionError('POSTHOG_STATUS_INPUT_INVALID');
    }
    const observedAtMs = timestampMs(observation.observedAt);
    if (
      observedAtMs <= mustFollowMs ||
      (priorObservationMs !== null && observedAtMs - priorObservationMs < minimumGapMs)
    ) {
      return { kind: 'pending', resultCode: 'POSTHOG_QUIESCENCE_PENDING' };
    }
    priorObservationMs = observedAtMs;
  }
  const firstObservationMs = timestampMs(absenceObservations[0].observedAt);
  const recordingEvidenceMs = timestampMs(noRecordingsEvidence.verifiedAt);
  if (
    recordingEvidenceMs < timestampMs(captureShutdownAt) ||
    recordingEvidenceMs > firstObservationMs
  ) {
    return {
      kind: 'action_required',
      resultCode: 'POSTHOG_RECORDING_VERIFICATION_REQUIRED',
    };
  }

  return {
    kind: 'succeeded',
    resultCode: 'POSTHOG_DELETION_VERIFIED',
    receipt: {
      provider: 'posthog',
      result: 'deleted_verified',
      scope: 'persons_and_events',
      recordings: 'attested_not_collected',
      absenceObservations: absenceObservations.length,
    },
  };
}
