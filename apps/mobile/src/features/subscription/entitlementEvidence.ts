import type { StoredEntitlement } from './entitlement';

export const ENTITLEMENT_CACHE_SCHEMA_VERSION = 3 as const;

export const MAX_SERVER_PROJECTION_REVISION = '9223372036854775807';

/** SQL bigint is lossless on the wire; neither Number nor a local clock is a revision. */
export function isServerProjectionRevision(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) &&
    (value.length < MAX_SERVER_PROJECTION_REVISION.length ||
      value <= MAX_SERVER_PROJECTION_REVISION);
}

export function compareServerProjectionRevisions(left: string, right: string): -1 | 0 | 1 {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return compareText(left, right);
}

export type RevenueCatSnapshotCursor = Readonly<{
  kind: 'revenuecat_snapshot';
  requestDate: string;
  fingerprint: string;
}>;

export type RevenueCatWebhookCursor = Readonly<{
  kind: 'revenuecat_webhook';
  eventAt: string;
  priority: number;
  eventId: string;
}>;

export type StoreEvidenceCursor = RevenueCatSnapshotCursor | RevenueCatWebhookCursor;
export type ServerProjectionCursor = Readonly<{
  kind: 'server_projection';
  version: 1;
  streamId: string;
  revision: string;
  provider: StoreEvidenceCursor;
}>;
export type StoreEvidenceState = 'active' | 'inactive' | 'empty';
export type StoreEvidenceProvenance =
  | 'revenuecat_verified'
  | 'revenuecat_verified_on_device'
  | 'server_snapshot'
  | 'server_webhook';

export type StoreDefinitiveProof = Readonly<{
  cursor: StoreEvidenceCursor;
  state: StoreEvidenceState;
  entitlement: StoredEntitlement | null;
  priorEntitlement: StoredEntitlement | null;
  provenance: Exclude<StoreEvidenceProvenance, 'revenuecat_verified_on_device'>;
  fingerprint: string;
}>;

export type StoreProvisionalProof = Readonly<{
  cursor: RevenueCatSnapshotCursor;
  entitlement: StoredEntitlement;
  provenance: 'revenuecat_verified_on_device';
  fingerprint: string;
}>;

export type StoreConflict = Readonly<{
  providerAt: string;
  leftFingerprint: string;
  rightFingerprint: string;
  leftProvenance: StoreEvidenceProvenance;
  rightProvenance: StoreEvidenceProvenance;
}>;

export type ServerProjectionProof = Readonly<{
  cursor: ServerProjectionCursor;
  state: StoreEvidenceState;
  entitlement: StoredEntitlement | null;
  priorEntitlement: StoredEntitlement | null;
  fingerprint: string;
}>;

export type ServerProjectionConflict = Readonly<{
  streamId: string;
  revision: string;
  leftFingerprint: string;
  rightFingerprint: string;
}>;

export type AppGrantProof = Readonly<{
  grantAt: string;
  entitlement: StoredEntitlement;
  fingerprint: string;
}>;

export type AppGrantConflict = Readonly<{
  grantAt: string;
  leftFingerprint: string;
  rightFingerprint: string;
}>;

export type LegacyPositiveProof = Readonly<{
  provenance: 'server_missing_cursor';
  entitlement: StoredEntitlement;
  fingerprint: string;
}>;

export type EntitlementCacheEnvelopeV3 = Readonly<{
  version: typeof ENTITLEMENT_CACHE_SCHEMA_VERSION;
  ownerBinding: string;
  revision: number;
  clockAnchor: string | null;
  store: Readonly<{
    definitive: StoreDefinitiveProof | null;
    provisionalActive: StoreProvisionalProof | null;
    conflict: StoreConflict | null;
    serverProjection: ServerProjectionProof | null;
    serverConflict: ServerProjectionConflict | null;
    serverProtocolRejected: boolean;
  }>;
  appGrant: Readonly<{
    definitive: AppGrantProof | null;
    conflict: AppGrantConflict | null;
  }>;
  legacy: LegacyPositiveProof | null;
}>;

export type EntitlementEvidence =
  | Readonly<{
      kind: 'server_projection';
      cursor: ServerProjectionCursor;
      state: StoreEvidenceState;
      entitlement: StoredEntitlement | null;
    }>
  | Readonly<{
      kind: 'store_definitive';
      cursor: StoreEvidenceCursor;
      state: StoreEvidenceState;
      entitlement: StoredEntitlement | null;
      provenance: 'revenuecat_verified' | 'server_snapshot' | 'server_webhook';
    }>
  | Readonly<{
      kind: 'store_provisional_active';
      cursor: RevenueCatSnapshotCursor;
      entitlement: StoredEntitlement;
      provenance: 'revenuecat_verified_on_device';
    }>
  | Readonly<{
      kind: 'app_grant';
      grantAt: string;
      entitlement: StoredEntitlement;
    }>
  | Readonly<{
      kind: 'legacy_positive';
      provenance: LegacyPositiveProof['provenance'];
      entitlement: StoredEntitlement;
    }>;

export type EntitlementMergeDisposition =
  | 'applied'
  | 'conflict'
  | 'duplicate'
  | 'stale'
  | 'ignored';

export type PureEntitlementMergeResult = Readonly<{
  envelope: EntitlementCacheEnvelopeV3;
  changed: boolean;
  disposition: EntitlementMergeDisposition;
  requiresUncachedRefresh: boolean;
}>;

export type EffectiveEntitlementProjection = Readonly<{
  entitlement: StoredEntitlement | null;
  activeStoreEntitlement: StoredEntitlement | null;
  activeAppGrantEntitlement: StoredEntitlement | null;
  priorEntitlement: StoredEntitlement | null;
  hasConflict: boolean;
}>;

export function emptyEntitlementEnvelope(ownerBinding: string): EntitlementCacheEnvelopeV3 {
  return {
    version: ENTITLEMENT_CACHE_SCHEMA_VERSION,
    ownerBinding,
    revision: 0,
    clockAnchor: null,
    store: {
      definitive: null, provisionalActive: null, conflict: null,
      serverProjection: null, serverConflict: null,
      serverProtocolRejected: false,
    },
    appGrant: { definitive: null, conflict: null },
    legacy: null,
  };
}

export function storeCursorProviderAt(cursor: StoreEvidenceCursor): string {
  return cursor.kind === 'revenuecat_snapshot' ? cursor.requestDate : cursor.eventAt;
}

function compareText(left: string, right: string): -1 | 0 | 1 {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Compare only provider ordering fields. Processing timestamps and the local
 * clock are deliberately absent. Event ids are constrained to printable ASCII
 * by the codec so this ordering matches Postgres UTF-8 byte ordering.
 */
export function compareStoreEvidenceCursors(
  left: StoreEvidenceCursor,
  right: StoreEvidenceCursor,
): -1 | 0 | 1 {
  const providerTime = compareText(storeCursorProviderAt(left), storeCursorProviderAt(right));
  if (providerTime !== 0) return providerTime;
  if (left.kind !== 'revenuecat_webhook' || right.kind !== 'revenuecat_webhook') return 0;
  if (left.priority !== right.priority) return left.priority < right.priority ? -1 : 1;
  return compareText(left.eventId, right.eventId);
}

export function entitlementEvidenceFingerprint(
  state: StoreEvidenceState | 'app_grant' | 'legacy',
  entitlement: StoredEntitlement | null,
): string {
  if (!entitlement) return JSON.stringify({ state });
  return JSON.stringify({
    state,
    tier: entitlement.tier,
    isActive: entitlement.isActive,
    periodType: entitlement.periodType,
    store: entitlement.store,
    productId: entitlement.productId,
    expiresAt: entitlement.expiresAt,
    willRenew: entitlement.willRenew,
    grantedAt: entitlement.grantedAt,
  });
}

/** Every field published under a server revision is immutable, including provenance/freshness. */
export function serverProjectionFingerprint(
  cursor: ServerProjectionCursor,
  state: StoreEvidenceState,
  entitlement: StoredEntitlement | null,
): string {
  return JSON.stringify({
    cursor,
    evidence: entitlementEvidenceFingerprint(state, entitlement),
    source: entitlement?.source ?? null,
    environment: entitlement?.environment ?? null,
    managementUrl: entitlement?.managementUrl ?? null,
    verifiedAt: entitlement?.verifiedAt ?? null,
    offeringId: entitlement?.offeringId ?? null,
    packageId: entitlement?.packageId ?? null,
    storeUserId: entitlement?.storeUserId ?? null,
    priceLabel: entitlement?.priceLabel ?? null,
  });
}

function maxISO(left: string | null, right: string): string {
  return left === null || left < right ? right : left;
}

function priorStoreEntitlement(envelope: EntitlementCacheEnvelopeV3): StoredEntitlement | null {
  return (
    envelope.store.serverProjection?.entitlement ??
    envelope.store.serverProjection?.priorEntitlement ??
    envelope.store.definitive?.entitlement ??
    envelope.store.definitive?.priorEntitlement ??
    envelope.store.provisionalActive?.entitlement ??
    envelope.legacy?.entitlement ??
    null
  );
}

function withRevision(
  current: EntitlementCacheEnvelopeV3,
  next: Omit<EntitlementCacheEnvelopeV3, 'revision'>,
): EntitlementCacheEnvelopeV3 {
  if (!Number.isSafeInteger(current.revision) || current.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('ENTITLEMENT_CACHE_REVISION_EXHAUSTED');
  }
  return { ...next, revision: current.revision + 1 };
}

function relevantStoreConflict(envelope: EntitlementCacheEnvelopeV3): boolean {
  const conflict = envelope.store.conflict;
  if (!conflict) return false;
  const projection = envelope.store.serverProjection;
  if (!projection) return true;
  // A new materialization supersedes old webhook/snapshot representations. A
  // genuinely newer conflicting SDK observation still requires provider recovery.
  return (conflict.leftProvenance === 'revenuecat_verified' ||
    conflict.leftProvenance === 'revenuecat_verified_on_device' ||
    conflict.rightProvenance === 'revenuecat_verified' ||
    conflict.rightProvenance === 'revenuecat_verified_on_device') &&
    conflict.providerAt >= storeCursorProviderAt(projection.cursor.provider);
}

function mixedStoreConflict(envelope: EntitlementCacheEnvelopeV3): boolean {
  const projection = envelope.store.serverProjection;
  const sdk = envelope.store.definitive;
  return !!projection && sdk?.provenance === 'revenuecat_verified' &&
    storeCursorProviderAt(sdk.cursor) === storeCursorProviderAt(projection.cursor.provider) &&
    sdk.fingerprint !== entitlementEvidenceFingerprint(projection.state, projection.entitlement);
}

function hasConflict(envelope: EntitlementCacheEnvelopeV3): boolean {
  return relevantStoreConflict(envelope) || mixedStoreConflict(envelope) ||
    envelope.store.serverConflict !== null || envelope.store.serverProtocolRejected ||
    envelope.appGrant.conflict !== null;
}

/** Negative-only local knowledge: an authenticated response could not be decoded.
 * Retain all useful proofs and high watermarks, but do not reuse them offline
 * until a valid publication re-establishes this exact owner's protocol. */
export function quarantineServerProjection(current: EntitlementCacheEnvelopeV3): EntitlementCacheEnvelopeV3 {
  return current.store.serverProtocolRejected ? current : withRevision(current, {
    ...current, store: { ...current.store, serverProtocolRejected: true },
  });
}

function mergeServerProjection(
  current: EntitlementCacheEnvelopeV3,
  evidence: Extract<EntitlementEvidence, { kind: 'server_projection' }>,
  serverProtocolRecoveryAuthorized: boolean,
): PureEntitlementMergeResult {
  const existing = current.store.serverProjection;
  const fingerprint = serverProjectionFingerprint(evidence.cursor, evidence.state, evidence.entitlement);
  if (existing) {
    // A changed stream under one exact owner is an invalid protocol transition,
    // not a newly privileged lane. The authenticated adapter also checks owner binding.
    const sameStream = existing.cursor.streamId === evidence.cursor.streamId;
    const order = sameStream
      ? compareServerProjectionRevisions(evidence.cursor.revision, existing.cursor.revision)
      : 0;
    if (order < 0 || (sameStream && order === 0 && current.store.serverConflict)) {
      return { envelope: current, changed: false, disposition: 'stale', requiresUncachedRefresh: hasConflict(current) };
    }
    if (order === 0) {
      if (sameStream && fingerprint === existing.fingerprint) {
        const envelope = current.store.serverProtocolRejected && serverProtocolRecoveryAuthorized ? withRevision(current, {
          ...current, store: { ...current.store, serverProtocolRejected: false },
        }) : current;
        return { envelope, changed: envelope !== current, disposition: 'duplicate', requiresUncachedRefresh: hasConflict(envelope) };
      }
      const serverConflict: ServerProjectionConflict = {
        streamId: existing.cursor.streamId,
        revision: existing.cursor.revision,
        leftFingerprint: existing.fingerprint,
        rightFingerprint: fingerprint,
      };
      const envelope = withRevision(current, {
        ...current, store: { ...current.store, serverConflict },
      });
      return { envelope, changed: true, disposition: 'conflict', requiresUncachedRefresh: true };
    }
  }
  const proof: ServerProjectionProof = {
    cursor: evidence.cursor,
    state: evidence.state,
    entitlement: evidence.entitlement,
    priorEntitlement: evidence.state === 'empty' ? priorStoreEntitlement(current) : evidence.entitlement,
    fingerprint,
  };
  const envelope = withRevision(current, {
    ...current,
    // Only the authentic provider timestamp advances this expiry rollback guard.
    // Publication revision does not change verifiedAt, paid expiry or offline TTL.
    clockAnchor: maxISO(current.clockAnchor, storeCursorProviderAt(evidence.cursor.provider)),
    store: {
      ...current.store,
      definitive: current.store.definitive?.provenance === 'revenuecat_verified'
        ? current.store.definitive : null,
      serverProjection: proof,
      serverConflict: null,
      serverProtocolRejected: current.store.serverProtocolRejected && !serverProtocolRecoveryAuthorized,
    },
  });
  return {
    envelope, changed: true, disposition: mixedStoreConflict(envelope) ? 'conflict' : 'applied',
    requiresUncachedRefresh: hasConflict(envelope),
  };
}

function mergeStoreDefinitive(
  current: EntitlementCacheEnvelopeV3,
  evidence: Extract<EntitlementEvidence, { kind: 'store_definitive' }>,
): PureEntitlementMergeResult {
  if (current.store.serverProjection && evidence.provenance !== 'revenuecat_verified') {
    return { envelope: current, changed: false, disposition: 'stale', requiresUncachedRefresh: hasConflict(current) };
  }
  const providerAt = storeCursorProviderAt(evidence.cursor);
  const fingerprint = entitlementEvidenceFingerprint(evidence.state, evidence.entitlement);
  const server = current.store.serverProjection;
  if (server) {
    const serverAt = storeCursorProviderAt(server.cursor.provider);
    if (providerAt < serverAt) {
      return { envelope: current, changed: false, disposition: 'stale', requiresUncachedRefresh: hasConflict(current) };
    }
    if (providerAt === serverAt &&
        fingerprint === entitlementEvidenceFingerprint(server.state, server.entitlement)) {
      return { envelope: current, changed: false, disposition: 'duplicate', requiresUncachedRefresh: hasConflict(current) };
    }
  }
  const existingConflict = relevantStoreConflict(current) ? current.store.conflict : null;

  // An equal-time contradiction is intentionally sticky. Only a later
  // definitive provider snapshot can resolve it.
  if (existingConflict && providerAt <= existingConflict.providerAt) {
    return {
      envelope: current,
      changed: false,
      disposition: 'stale',
      requiresUncachedRefresh: true,
    };
  }

  const existing = current.store.definitive;
  if (existing) {
    const order = compareStoreEvidenceCursors(evidence.cursor, existing.cursor);
    if (order < 0) {
      return {
        envelope: current,
        changed: false,
        disposition: 'stale',
        requiresUncachedRefresh: hasConflict(current),
      };
    }
    if (order === 0) {
      if (fingerprint === existing.fingerprint) {
        return {
          envelope: current,
          changed: false,
          disposition: 'duplicate',
          requiresUncachedRefresh: hasConflict(current),
        };
      }
      const conflict: StoreConflict = {
        providerAt,
        leftFingerprint: existing.fingerprint,
        rightFingerprint: fingerprint,
        leftProvenance: existing.provenance,
        rightProvenance: evidence.provenance,
      };
      const envelope = withRevision(current, {
        ...current,
        clockAnchor: maxISO(current.clockAnchor, providerAt),
        store: { ...current.store, conflict },
      });
      return {
        envelope,
        changed: true,
        disposition: 'conflict',
        requiresUncachedRefresh: true,
      };
    }
  }

  const proof: StoreDefinitiveProof = {
    cursor: evidence.cursor,
    state: evidence.state,
    entitlement: evidence.entitlement,
    priorEntitlement:
      evidence.state === 'empty' ? priorStoreEntitlement(current) : evidence.entitlement,
    provenance: evidence.provenance,
    fingerprint,
  };
  const provisionalAt = current.store.provisionalActive
    ? storeCursorProviderAt(current.store.provisionalActive.cursor)
    : null;
  const envelope = withRevision(current, {
    ...current,
    clockAnchor: maxISO(current.clockAnchor, providerAt),
    store: {
      ...current.store,
      definitive: proof,
      provisionalActive:
        provisionalAt !== null && provisionalAt > providerAt
          ? current.store.provisionalActive
          : null,
      conflict: null,
    },
  });
  return {
    envelope,
    changed: true,
    disposition: mixedStoreConflict(envelope) ? 'conflict' : 'applied',
    requiresUncachedRefresh: hasConflict(envelope),
  };
}

function mergeStoreProvisional(
  current: EntitlementCacheEnvelopeV3,
  evidence: Extract<EntitlementEvidence, { kind: 'store_provisional_active' }>,
): PureEntitlementMergeResult {
  const providerAt = storeCursorProviderAt(evidence.cursor);
  const fingerprint = entitlementEvidenceFingerprint('active', evidence.entitlement);
  const server = current.store.serverProjection;
  if (server && (server.state !== 'active' || providerAt <= storeCursorProviderAt(server.cursor.provider))) {
    return { envelope: current, changed: false, disposition: 'stale', requiresUncachedRefresh: hasConflict(current) };
  }
  const definitive = current.store.definitive;
  if (definitive && storeCursorProviderAt(definitive.cursor) >= providerAt) {
    return {
      envelope: current,
      changed: false,
      disposition: 'stale',
      requiresUncachedRefresh: hasConflict(current),
    };
  }

  const existing = current.store.provisionalActive;
  if (existing) {
    const order = compareStoreEvidenceCursors(evidence.cursor, existing.cursor);
    if (order < 0) {
      return {
        envelope: current,
        changed: false,
        disposition: 'stale',
        requiresUncachedRefresh: hasConflict(current),
      };
    }
    if (order === 0) {
      if (existing.fingerprint === fingerprint) {
        return {
          envelope: current,
          changed: false,
          disposition: 'duplicate',
          requiresUncachedRefresh: hasConflict(current),
        };
      }
      const conflict: StoreConflict = {
        providerAt,
        leftFingerprint: existing.fingerprint,
        rightFingerprint: fingerprint,
        leftProvenance: existing.provenance,
        rightProvenance: evidence.provenance,
      };
      const envelope = withRevision(current, {
        ...current,
        clockAnchor: maxISO(current.clockAnchor, providerAt),
        store: { ...current.store, conflict },
      });
      return {
        envelope,
        changed: true,
        disposition: 'conflict',
        requiresUncachedRefresh: true,
      };
    }
  }

  const proof: StoreProvisionalProof = {
    cursor: evidence.cursor,
    entitlement: evidence.entitlement,
    provenance: evidence.provenance,
    fingerprint,
  };
  const envelope = withRevision(current, {
    ...current,
    clockAnchor: maxISO(current.clockAnchor, providerAt),
    store: { ...current.store, provisionalActive: proof },
  });
  return {
    envelope,
    changed: true,
    disposition: 'applied',
    requiresUncachedRefresh: hasConflict(envelope),
  };
}

function mergeAppGrant(
  current: EntitlementCacheEnvelopeV3,
  evidence: Extract<EntitlementEvidence, { kind: 'app_grant' }>,
): PureEntitlementMergeResult {
  const fingerprint = entitlementEvidenceFingerprint('app_grant', evidence.entitlement);
  const conflict = current.appGrant.conflict;
  if (conflict && evidence.grantAt <= conflict.grantAt) {
    return {
      envelope: current,
      changed: false,
      disposition: 'stale',
      requiresUncachedRefresh: true,
    };
  }

  const existing = current.appGrant.definitive;
  if (existing) {
    if (evidence.grantAt < existing.grantAt) {
      return {
        envelope: current,
        changed: false,
        disposition: 'stale',
        requiresUncachedRefresh: hasConflict(current),
      };
    }
    if (evidence.grantAt === existing.grantAt) {
      if (fingerprint === existing.fingerprint) {
        return {
          envelope: current,
          changed: false,
          disposition: 'duplicate',
          requiresUncachedRefresh: hasConflict(current),
        };
      }
      const appGrantConflict: AppGrantConflict = {
        grantAt: evidence.grantAt,
        leftFingerprint: existing.fingerprint,
        rightFingerprint: fingerprint,
      };
      const envelope = withRevision(current, {
        ...current,
        clockAnchor: maxISO(current.clockAnchor, evidence.grantAt),
        appGrant: { ...current.appGrant, conflict: appGrantConflict },
      });
      return {
        envelope,
        changed: true,
        disposition: 'conflict',
        requiresUncachedRefresh: true,
      };
    }
  }

  const proof: AppGrantProof = {
    grantAt: evidence.grantAt,
    entitlement: evidence.entitlement,
    fingerprint,
  };
  const envelope = withRevision(current, {
    ...current,
    clockAnchor: maxISO(current.clockAnchor, evidence.grantAt),
    appGrant: { definitive: proof, conflict: null },
  });
  return {
    envelope,
    changed: true,
    disposition: 'applied',
    requiresUncachedRefresh: hasConflict(envelope),
  };
}

function mergeLegacyPositive(
  current: EntitlementCacheEnvelopeV3,
  evidence: Extract<EntitlementEvidence, { kind: 'legacy_positive' }>,
): PureEntitlementMergeResult {
  if (evidence.provenance !== 'server_missing_cursor') {
    return {
      envelope: current,
      changed: false,
      disposition: 'ignored',
      requiresUncachedRefresh: false,
    };
  }
  if (current.store.definitive || current.store.provisionalActive || current.store.conflict ||
      current.store.serverProjection || current.store.serverConflict || current.store.serverProtocolRejected) {
    return {
      envelope: current,
      changed: false,
      disposition: 'ignored',
      requiresUncachedRefresh: hasConflict(current),
    };
  }
  const fingerprint = entitlementEvidenceFingerprint('legacy', evidence.entitlement);
  if (current.legacy) {
    return {
      envelope: current,
      changed: false,
      disposition: current.legacy.fingerprint === fingerprint ? 'duplicate' : 'ignored',
      requiresUncachedRefresh: false,
    };
  }
  const legacy: LegacyPositiveProof = {
    provenance: evidence.provenance,
    entitlement: evidence.entitlement,
    fingerprint,
  };
  const envelope = withRevision(current, { ...current, legacy });
  return {
    envelope,
    changed: true,
    disposition: 'applied',
    requiresUncachedRefresh: false,
  };
}

export function mergeEntitlementEnvelope(
  current: EntitlementCacheEnvelopeV3,
  evidence: EntitlementEvidence,
  // Only the authenticated adapter's still-current local read lease can clear
  // protocol rejection. Neither a duplicate nor a greater server revision can
  // order an undecodable response on its own.
  serverProtocolRecoveryAuthorized = false,
): PureEntitlementMergeResult {
  switch (evidence.kind) {
    case 'server_projection':
      return mergeServerProjection(current, evidence, serverProtocolRecoveryAuthorized);
    case 'store_definitive':
      return mergeStoreDefinitive(current, evidence);
    case 'store_provisional_active':
      return mergeStoreProvisional(current, evidence);
    case 'app_grant':
      return mergeAppGrant(current, evidence);
    case 'legacy_positive':
      return mergeLegacyPositive(current, evidence);
  }
}

function isLive(
  entitlement: StoredEntitlement | null,
  nowISO: string,
): entitlement is StoredEntitlement {
  if (!entitlement?.isActive || !entitlement.tier) return false;
  return !entitlement.expiresAt || entitlement.expiresAt > nowISO;
}

function storeProjection(
  envelope: EntitlementCacheEnvelopeV3,
  nowISO: string,
): { active: StoredEntitlement | null; prior: StoredEntitlement | null } {
  const server = envelope.store.serverProjection;
  const sdk = envelope.store.definitive;
  // A fully VERIFIED snapshot describes provider knowledge through requestDate.
  // That real timestamp can outrank the server's fact horizon; the revision
  // cannot. Keep the independent server watermark even when SDK evidence wins.
  const definitive = server && !(sdk?.provenance === 'revenuecat_verified' &&
    storeCursorProviderAt(sdk.cursor) > storeCursorProviderAt(server.cursor.provider))
    ? server
    : sdk;
  const provisional = envelope.store.provisionalActive;
  const prior =
    definitive?.entitlement ??
    definitive?.priorEntitlement ??
    provisional?.entitlement ??
    envelope.legacy?.entitlement ??
    null;
  if (relevantStoreConflict(envelope) || mixedStoreConflict(envelope) ||
      envelope.store.serverConflict || envelope.store.serverProtocolRejected) return { active: null, prior };

  const definitiveActive =
    definitive?.state === 'active' && isLive(definitive.entitlement, nowISO)
      ? definitive.entitlement
      : null;
  const provisionalActive = isLive(provisional?.entitlement ?? null, nowISO)
    ? provisional!.entitlement
    : null;

  // Positive-only on-device verification is insufficient to undo a definitive
  // server revocation, regardless of callback order or its request timestamp.
  if (provisionalActive && (!server || server.state === 'active')) {
    const definitiveAt = definitive ? storeCursorProviderAt(
      definitive.cursor.kind === 'server_projection' ? definitive.cursor.provider : definitive.cursor,
    ) : null;
    const provisionalAt = storeCursorProviderAt(provisional!.cursor);
    if (definitiveAt === null || provisionalAt > definitiveAt) {
      return { active: provisionalActive, prior };
    }
  }
  if (definitiveActive) return { active: definitiveActive, prior };
  if (!definitive && !provisional && isLive(envelope.legacy?.entitlement ?? null, nowISO)) {
    return { active: envelope.legacy!.entitlement, prior };
  }
  return { active: null, prior };
}

function inactiveCopy(entitlement: StoredEntitlement | null): StoredEntitlement | null {
  return entitlement ? { ...entitlement, isActive: false, willRenew: false } : null;
}

function preferActive(
  storeEntitlement: StoredEntitlement | null,
  appGrantEntitlement: StoredEntitlement | null,
): StoredEntitlement | null {
  if (!storeEntitlement) return appGrantEntitlement;
  if (!appGrantEntitlement) return storeEntitlement;
  if (appGrantEntitlement.tier === 'pro_plus' && storeEntitlement.tier !== 'pro_plus') {
    return appGrantEntitlement;
  }
  return storeEntitlement;
}

/** Project the effective union. Conflicted lanes never grant access. */
export function effectiveEntitlementProjection(
  envelope: EntitlementCacheEnvelopeV3,
  observedAtISO: string,
): EffectiveEntitlementProjection {
  const nowISO = maxISO(envelope.clockAnchor, observedAtISO);
  const store = storeProjection(envelope, nowISO);
  const appGrantProof = envelope.appGrant.conflict ? null : envelope.appGrant.definitive;
  const activeAppGrant = isLive(appGrantProof?.entitlement ?? null, nowISO)
    ? appGrantProof!.entitlement
    : null;
  const active = preferActive(store.active, activeAppGrant);
  const prior = store.prior ?? appGrantProof?.entitlement ?? null;
  return {
    entitlement: active ?? inactiveCopy(prior),
    activeStoreEntitlement: store.active,
    activeAppGrantEntitlement: activeAppGrant,
    priorEntitlement: inactiveCopy(prior),
    hasConflict: hasConflict(envelope),
  };
}

export function advanceEntitlementClock(
  current: EntitlementCacheEnvelopeV3,
  observedAtISO: string,
): EntitlementCacheEnvelopeV3 {
  if (current.clockAnchor !== null && current.clockAnchor >= observedAtISO) return current;
  return withRevision(current, { ...current, clockAnchor: observedAtISO });
}
