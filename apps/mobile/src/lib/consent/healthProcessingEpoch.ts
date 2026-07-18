const HEALTH_EPOCH_HEADER = 'x-health-processing-epoch';
const HEALTH_EPOCH_CLIENT_INFO_KEY = 'health-processing-epoch';
const HEALTH_EPOCH_CLIENT_INFO_PREFIX = `${HEALTH_EPOCH_CLIENT_INFO_KEY}=`;
export const CATALOG_HEALTH_EPOCH_FUNCTION_NAMES = [
  'catalog-lookup',
  'catalog-report',
  'catalog-search',
] as const;

/** Tables whose RLS consumes the exact mobile processing epoch. */
export const HEALTH_PROCESSING_POSTGREST_TABLES = [
  'active_ramp',
  'ask_safety_audit',
  'ask_sessions',
  'ask_turn_audit',
  'catalog_lookup_events',
  'commerce_click_events',
  'community_blocks',
  'community_questions',
  'community_reactions',
  'community_reports',
  'cycle_nights',
  'cycles',
  'notification_log',
  'notification_preferences',
  'photo_trend',
  'photos',
  // Mixed account/health table: mobile health-context reads must still carry
  // the epoch even though non-health profile fields have separate purposes.
  'profiles',
  'recommendation_preferences',
  'recommendations',
  'routine_completions',
  'routine_conflicts',
  'routine_steps',
  'routines',
  'skin_profiles',
  'streak_freezes',
  'user_products',
] as const;

const CATALOG_HEALTH_EPOCH_FUNCTIONS = new Set<string>(CATALOG_HEALTH_EPOCH_FUNCTION_NAMES);
const HEALTH_PROCESSING_POSTGREST_TABLE_SET = new Set<string>(HEALTH_PROCESSING_POSTGREST_TABLES);

export const HEALTH_PROCESSING_STATUS_LEASE_MS = 5 * 60 * 1_000;
export const HEALTH_PROCESSING_SERVER_CLOCK_SKEW_MS = 60 * 1_000;
export const HEALTH_PROCESSING_RESULT_STALE = 'HEALTH_PROCESSING_RESULT_STALE';

type ActiveHealthProcessingLease = Readonly<{
  generation: number;
  epoch: number;
  ownerUserId: string | null;
  ownerBinding: string | null;
  accountGeneration: number | null;
  identityGeneration: number | null;
  expiresAt: number | null;
}>;

export type ActiveHealthProcessingLeaseSnapshot = ActiveHealthProcessingLease;

type ActiveHealthProcessingLeaseChangeListener = (
  lease: ActiveHealthProcessingLeaseSnapshot | null,
) => void;

let activeLease: ActiveHealthProcessingLease | null = null;
let nextLeaseGeneration = 0;
const activeLeaseChangeListeners = new Set<ActiveHealthProcessingLeaseChangeListener>();

function sameVisibleLease(
  left: ActiveHealthProcessingLeaseSnapshot | null,
  right: ActiveHealthProcessingLeaseSnapshot | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.generation === right.generation;
}

function publishActiveLeaseChange(lease: ActiveHealthProcessingLeaseSnapshot | null): void {
  for (const listener of [...activeLeaseChangeListeners]) {
    try {
      listener(lease);
    } catch {
      // A worker listener must never interrupt the consent authority transition.
    }
  }
}

export function subscribeActiveHealthProcessingLeaseChanges(
  listener: ActiveHealthProcessingLeaseChangeListener,
): () => void {
  activeLeaseChangeListeners.add(listener);
  return () => activeLeaseChangeListeners.delete(listener);
}

function currentActiveLease(): ActiveHealthProcessingLease | null {
  const lease = activeLease;
  if (lease === null) return null;
  if (lease.expiresAt !== null && Date.now() >= lease.expiresAt) {
    return null;
  }
  return lease;
}

export function healthProcessingStatusLeaseExpiresAt(
  serverVerifiedAt: string,
  now = Date.now(),
): number | null {
  const verifiedAt = Date.parse(serverVerifiedAt);
  if (
    !Number.isFinite(verifiedAt) ||
    !Number.isFinite(now) ||
    verifiedAt > now + HEALTH_PROCESSING_SERVER_CLOCK_SKEW_MS
  ) {
    return null;
  }
  return verifiedAt + HEALTH_PROCESSING_STATUS_LEASE_MS;
}

export function isHealthProcessingStatusLeaseCurrent(
  serverVerifiedAt: string | null,
  now = Date.now(),
): boolean {
  if (serverVerifiedAt === null) return false;
  const expiresAt = healthProcessingStatusLeaseExpiresAt(serverVerifiedAt, now);
  return expiresAt !== null && now < expiresAt;
}

export function setActiveHealthProcessingEpoch(
  epoch: number,
  options: {
    ownerUserId?: string | null;
    ownerBinding?: string | null;
    accountGeneration?: number | null;
    identityGeneration?: number | null;
    serverVerifiedAt?: string | null;
  } = {},
): ActiveHealthProcessingLeaseSnapshot {
  if (!Number.isSafeInteger(epoch) || epoch < 1) {
    throw new Error('HEALTH_PROCESSING_EPOCH_INVALID');
  }
  const accountGeneration = options.accountGeneration ?? null;
  if (
    accountGeneration !== null &&
    (!Number.isSafeInteger(accountGeneration) || accountGeneration < 0)
  ) {
    throw new Error('HEALTH_PROCESSING_ACCOUNT_GENERATION_INVALID');
  }
  const ownerUserId = options.ownerUserId ?? null;
  if (
    ownerUserId !== null &&
    (!ownerUserId || ownerUserId !== ownerUserId.trim() || ownerUserId.length > 128)
  ) {
    throw new Error('HEALTH_PROCESSING_EPOCH_OWNER_INVALID');
  }
  if (ownerUserId !== null && accountGeneration === null) {
    throw new Error('HEALTH_PROCESSING_ACCOUNT_GENERATION_REQUIRED');
  }
  const ownerBinding = options.ownerBinding ?? null;
  const identityGeneration = options.identityGeneration ?? null;
  if (
    identityGeneration !== null &&
    (!Number.isSafeInteger(identityGeneration) || identityGeneration < 0)
  ) {
    throw new Error('HEALTH_PROCESSING_IDENTITY_GENERATION_INVALID');
  }
  if (ownerUserId !== null && ownerBinding !== null && identityGeneration === null) {
    throw new Error('HEALTH_PROCESSING_IDENTITY_GENERATION_REQUIRED');
  }
  if (ownerBinding !== null && (ownerUserId === null || !/^[a-f0-9]{64}$/u.test(ownerBinding))) {
    throw new Error('HEALTH_PROCESSING_OWNER_BINDING_INVALID');
  }
  const serverVerifiedAt = options.serverVerifiedAt ?? null;
  const expiresAt =
    serverVerifiedAt === null ? null : healthProcessingStatusLeaseExpiresAt(serverVerifiedAt);
  const current = currentActiveLease();
  const generation =
    current !== null &&
    current.epoch === epoch &&
    current.ownerUserId === ownerUserId &&
    current.ownerBinding === ownerBinding &&
    current.accountGeneration === accountGeneration &&
    current.identityGeneration === identityGeneration &&
    current.expiresAt === (serverVerifiedAt === null ? null : (expiresAt ?? 0))
      ? current.generation
      : ++nextLeaseGeneration;
  // Invalid/future verification time is represented as an already closed
  // lease, never as an unbounded grant.
  const published = Object.freeze({
    generation,
    epoch,
    ownerUserId,
    ownerBinding,
    accountGeneration,
    identityGeneration,
    expiresAt: serverVerifiedAt === null ? null : (expiresAt ?? 0),
  });
  activeLease = published;
  const visiblePublished = currentActiveLease();
  if (!sameVisibleLease(current, visiblePublished)) publishActiveLeaseChange(visiblePublished);
  return published;
}

export type HealthProcessingLeaseClearExpectation = Readonly<{
  ownerUserId: string;
  generation?: number;
  accountGeneration?: number;
}>;

export function clearActiveHealthProcessingEpoch(
  expected?: HealthProcessingLeaseClearExpectation,
): boolean {
  if (expected) {
    // Compare the raw slot so an expiry timer can claim and clear the exact
    // generation after it has become unavailable to readers. A renewed lease
    // occupies the slot with a different generation and makes stale CAS fail.
    const current = activeLease;
    if (
      current === null ||
      current.ownerUserId !== expected.ownerUserId ||
      (expected.generation !== undefined && current.generation !== expected.generation) ||
      (expected.accountGeneration !== undefined &&
        current.accountGeneration !== expected.accountGeneration)
    ) {
      return false;
    }
  }
  const previous = currentActiveLease();
  activeLease = null;
  if (previous !== null) publishActiveLeaseChange(null);
  return true;
}

export function activeHealthProcessingEpoch(expectedOwnerUserId?: string): number | null {
  const lease = currentActiveLease();
  if (lease === null) return null;
  if (expectedOwnerUserId !== undefined && lease.ownerUserId !== expectedOwnerUserId) return null;
  return lease.epoch;
}

export function activeHealthProcessingOwnerUserId(): string | null {
  return currentActiveLease()?.ownerUserId ?? null;
}

/**
 * Immutable identity for the currently-authorized health-processing window.
 * A later clear + re-grant gets a new generation even when owner and epoch are
 * numerically identical, so an in-flight continuation can never inherit it.
 */
export function activeHealthProcessingLeaseSnapshot(
  expectedOwnerUserId?: string,
): ActiveHealthProcessingLeaseSnapshot | null {
  const lease = currentActiveLease();
  if (lease === null) return null;
  if (expectedOwnerUserId !== undefined && lease.ownerUserId !== expectedOwnerUserId) return null;
  return lease;
}

type DependentTransportConsentType =
  | 'photo_cloud_backup'
  | 'photo_trend_insights'
  | 'ask_onskin'
  | 'community_participation'
  | 'data_sharing';

type HealthEpochTransportRoute = Readonly<{
  kind: 'postgrest' | 'catalog_edge';
  dependentConsentType: DependentTransportConsentType | null;
}> | null;

type DependentConsentTransportSnapshot = Readonly<{
  type: DependentTransportConsentType;
  generation: number;
  processGeneration: number;
  assertCurrent: () => void;
}>;

let dependentConsentTransportSnapshotProvider:
  | ((type: DependentTransportConsentType) => DependentConsentTransportSnapshot | null)
  | null = null;

export function registerDependentConsentTransportSnapshotProvider(
  provider: (type: DependentTransportConsentType) => DependentConsentTransportSnapshot | null,
): void {
  dependentConsentTransportSnapshotProvider = provider;
}

type RemoteRequestAuthoritySnapshot = Readonly<{
  state: string;
  generation: number;
  subject: string | null;
  sessionId: string | null;
}>;

type HealthEpochTransportAuthority = Readonly<{
  healthLease: Readonly<{
    ownerUserId: string;
    epoch: number;
    generation: number;
    accountGeneration: number;
  }>;
  remoteAuthority: RemoteRequestAuthoritySnapshot;
  dependentConsent: DependentConsentTransportSnapshot | null;
}>;

const DEPENDENT_POSTGREST_TABLES: Readonly<
  Partial<
    Record<(typeof HEALTH_PROCESSING_POSTGREST_TABLES)[number], DependentTransportConsentType>
  >
> = Object.freeze({
  ask_safety_audit: 'ask_onskin',
  ask_sessions: 'ask_onskin',
  ask_turn_audit: 'ask_onskin',
  commerce_click_events: 'data_sharing',
  community_blocks: 'community_participation',
  community_questions: 'community_participation',
  community_reactions: 'community_participation',
  community_reports: 'community_participation',
  photo_trend: 'photo_trend_insights',
});

function requestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input instanceof Request ? input.url : null;
}

function healthEpochTransportRoute(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  supabaseOrigin: string,
  basePath: string,
): HealthEpochTransportRoute {
  const rawUrl = requestUrl(input);
  if (rawUrl === null) return null;

  let url: URL;
  try {
    // Relative and malformed inputs are deliberately ineligible. The
    // Supabase SDK emits absolute URLs; resolving caller input against the
    // project URL could otherwise turn a lookalike into an admitted route.
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.origin !== supabaseOrigin) return null;

  const restRoot = `${basePath}/rest/v1`;
  if (url.pathname.startsWith(`${restRoot}/`)) {
    const table = url.pathname.slice(restRoot.length + 1).split('/', 1)[0];
    if (!table || !HEALTH_PROCESSING_POSTGREST_TABLE_SET.has(table)) {
      return null;
    }
    const requestMethod = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const dependentConsentType =
      table === 'photos' && requestMethod !== 'DELETE'
        ? 'photo_cloud_backup'
        : (DEPENDENT_POSTGREST_TABLES[
            table as (typeof HEALTH_PROCESSING_POSTGREST_TABLES)[number]
          ] ?? null);
    return {
      kind: 'postgrest',
      dependentConsentType,
    };
  }

  const functionsRoot = `${basePath}/functions/v1/`;
  if (!url.pathname.startsWith(functionsRoot)) return null;
  const functionName = url.pathname.slice(functionsRoot.length);
  return CATALOG_HEALTH_EPOCH_FUNCTIONS.has(functionName)
    ? { kind: 'catalog_edge', dependentConsentType: null }
    : null;
}

function mergedRequestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  const overrides = new Headers(init?.headers);
  overrides.forEach((value, key) => headers.set(key, value));
  return headers;
}

function captureHealthEpochTransportAuthority(
  active: ActiveHealthProcessingLease | null,
  remote: RemoteRequestAuthoritySnapshot,
  route: HealthEpochTransportRoute,
): HealthEpochTransportAuthority | null {
  if (
    active === null ||
    active.ownerUserId === null ||
    active.accountGeneration === null ||
    remote.state !== 'active' ||
    remote.subject !== active.ownerUserId
  ) {
    return null;
  }
  const dependentConsent = route?.dependentConsentType
    ? (dependentConsentTransportSnapshotProvider?.(route.dependentConsentType) ?? null)
    : null;
  if (route?.dependentConsentType && dependentConsent === null) return null;
  return Object.freeze({
    healthLease: Object.freeze({
      ownerUserId: active.ownerUserId,
      epoch: active.epoch,
      generation: active.generation,
      accountGeneration: active.accountGeneration,
    }),
    remoteAuthority: Object.freeze({
      state: remote.state,
      generation: remote.generation,
      subject: remote.subject,
      sessionId: remote.sessionId,
    }),
    dependentConsent,
  });
}

function assertHealthEpochTransportAuthority(
  captured: HealthEpochTransportAuthority,
  remoteRequestSnapshot: () => RemoteRequestAuthoritySnapshot,
): void {
  const current = currentActiveLease();
  const expectedHealth = captured.healthLease;
  const remote = remoteRequestSnapshot();
  const expectedRemote = captured.remoteAuthority;
  captured.dependentConsent?.assertCurrent();
  if (
    current === null ||
    current.ownerUserId !== expectedHealth.ownerUserId ||
    current.epoch !== expectedHealth.epoch ||
    current.generation !== expectedHealth.generation ||
    current.accountGeneration !== expectedHealth.accountGeneration ||
    remote.state !== expectedRemote.state ||
    remote.generation !== expectedRemote.generation ||
    remote.subject !== expectedRemote.subject ||
    remote.sessionId !== expectedRemote.sessionId
  ) {
    throw new Error(HEALTH_PROCESSING_RESULT_STALE);
  }
}

async function bufferAndReassertHealthEpochResponse(
  responsePromise: Promise<Response>,
  captured: HealthEpochTransportAuthority,
  remoteRequestSnapshot: () => RemoteRequestAuthoritySnapshot,
): Promise<Response> {
  const response = await responsePromise;
  // Clone before consuming: the original branch is drained completely so no
  // response byte can escape the old authority window, while the clone keeps
  // the Fetch Response metadata and an equivalent, unread body for Supabase.
  const equivalentResponse = response.clone();
  await response.arrayBuffer();
  assertHealthEpochTransportAuthority(captured, remoteRequestSnapshot);
  return equivalentResponse;
}

/**
 * Adds the current health-processing epoch only to transports that consume it.
 *
 * Hosted Supabase REST CORS does not admit arbitrary request headers. REST
 * therefore carries the epoch as an opaque `x-client-info` metadata field,
 * which is on Supabase's canonical browser allow-list. The three catalog Edge
 * functions explicitly admit and forward the dedicated header. Auth, Storage,
 * and every other Edge function receive neither marker. A future cloud-photo
 * Storage writer must add its own reviewed admission path before it can ship.
 */
export function createHealthEpochFetch(
  fetchImplementation: typeof fetch,
  supabaseUrl: string,
  remoteRequestSnapshot: () => RemoteRequestAuthoritySnapshot,
): typeof fetch {
  const endpoint = new URL(supabaseUrl);
  const supabaseOrigin = endpoint.origin;
  const basePath = endpoint.pathname.replace(/\/+$/u, '');

  return (input, init) => {
    const route = healthEpochTransportRoute(input, init, supabaseOrigin, basePath);
    const active = currentActiveLease();
    const remoteAuthority = remoteRequestSnapshot();
    const transportAuthority = captureHealthEpochTransportAuthority(active, remoteAuthority, route);
    const epoch = transportAuthority?.healthLease.epoch ?? null;
    const headers = mergedRequestHeaders(input, init);
    let changed = false;

    // The process-wide lease is the only authority for this marker. Strip a
    // caller-supplied or stale value even on routes that must never receive it.
    if (headers.has(HEALTH_EPOCH_HEADER)) {
      headers.delete(HEALTH_EPOCH_HEADER);
      changed = true;
    }

    let clientInfo = headers.get('x-client-info');
    if (clientInfo?.toLowerCase().includes(HEALTH_EPOCH_CLIENT_INFO_KEY)) {
      // Reserved metadata is never inherited from a Request or init override.
      // Dropping the colliding diagnostic header is safer than trying to
      // normalize attacker-controlled delimiters into an admitted marker.
      headers.delete('x-client-info');
      clientInfo = null;
      changed = true;
    }

    if (route?.dependentConsentType && transportAuthority === null) {
      return Promise.reject(new Error('HEALTH_DEPENDENT_CONSENT_CLOSED'));
    }

    if (epoch !== null && route?.kind === 'postgrest') {
      const marker = `${HEALTH_EPOCH_CLIENT_INFO_PREFIX}${epoch}`;
      const dependentMarker = transportAuthority?.dependentConsent
        ? `health-consent-generation=${transportAuthority.dependentConsent.type}:${transportAuthority.dependentConsent.generation}`
        : null;
      const markers = [marker, dependentMarker].filter((value): value is string => value !== null);
      headers.set(
        'x-client-info',
        clientInfo ? `${clientInfo}; ${markers.join('; ')}` : markers.join('; '),
      );
      changed = true;
    } else if (epoch !== null && route?.kind === 'catalog_edge') {
      headers.set(HEALTH_EPOCH_HEADER, String(epoch));
      changed = true;
    }

    const response = changed
      ? fetchImplementation(input, { ...init, headers })
      : fetchImplementation(input, init);
    // Only an actually marked health request is buffered. Auth, Storage,
    // unclassified Edge functions, and closed/unbound health routes retain the
    // existing direct transport promise and Response identity.
    return epoch !== null && route !== null && transportAuthority !== null
      ? bufferAndReassertHealthEpochResponse(response, transportAuthority, remoteRequestSnapshot)
      : response;
  };
}

export const healthProcessingEpochHeader = HEALTH_EPOCH_HEADER;
export const healthProcessingEpochClientInfoKey = HEALTH_EPOCH_CLIENT_INFO_KEY;
