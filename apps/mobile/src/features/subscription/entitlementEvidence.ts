import type { StoredEntitlement } from './entitlement';

export const ENTITLEMENT_CACHE_SCHEMA_VERSION = 2 as const;

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

export type EntitlementCacheEnvelopeV2 = Readonly<{
  version: typeof ENTITLEMENT_CACHE_SCHEMA_VERSION;
  ownerBinding: string;
  revision: number;
  clockAnchor: string | null;
  store: Readonly<{
    definitive: StoreDefinitiveProof | null;
    provisionalActive: StoreProvisionalProof | null;
    conflict: StoreConflict | null;
  }>;
  appGrant: Readonly<{
    definitive: AppGrantProof | null;
    conflict: AppGrantConflict | null;
  }>;
  legacy: LegacyPositiveProof | null;
}>;

export type EntitlementEvidence =
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
  envelope: EntitlementCacheEnvelopeV2;
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

export function emptyEntitlementEnvelope(ownerBinding: string): EntitlementCacheEnvelopeV2 {
  return {
    version: ENTITLEMENT_CACHE_SCHEMA_VERSION,
    ownerBinding,
    revision: 0,
    clockAnchor: null,
    store: { definitive: null, provisionalActive: null, conflict: null },
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

function maxISO(left: string | null, right: string): string {
  return left === null || left < right ? right : left;
}

function priorStoreEntitlement(envelope: EntitlementCacheEnvelopeV2): StoredEntitlement | null {
  return (
    envelope.store.definitive?.entitlement ??
    envelope.store.definitive?.priorEntitlement ??
    envelope.store.provisionalActive?.entitlement ??
    envelope.legacy?.entitlement ??
    null
  );
}

function withRevision(
  current: EntitlementCacheEnvelopeV2,
  next: Omit<EntitlementCacheEnvelopeV2, 'revision'>,
): EntitlementCacheEnvelopeV2 {
  if (!Number.isSafeInteger(current.revision) || current.revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('ENTITLEMENT_CACHE_REVISION_EXHAUSTED');
  }
  return { ...next, revision: current.revision + 1 };
}

function hasConflict(envelope: EntitlementCacheEnvelopeV2): boolean {
  return envelope.store.conflict !== null || envelope.appGrant.conflict !== null;
}

function mergeStoreDefinitive(
  current: EntitlementCacheEnvelopeV2,
  evidence: Extract<EntitlementEvidence, { kind: 'store_definitive' }>,
): PureEntitlementMergeResult {
  const providerAt = storeCursorProviderAt(evidence.cursor);
  const fingerprint = entitlementEvidenceFingerprint(evidence.state, evidence.entitlement);
  const existingConflict = current.store.conflict;

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
    disposition: 'applied',
    requiresUncachedRefresh: envelope.appGrant.conflict !== null,
  };
}

function mergeStoreProvisional(
  current: EntitlementCacheEnvelopeV2,
  evidence: Extract<EntitlementEvidence, { kind: 'store_provisional_active' }>,
): PureEntitlementMergeResult {
  const providerAt = storeCursorProviderAt(evidence.cursor);
  const fingerprint = entitlementEvidenceFingerprint('active', evidence.entitlement);
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
  current: EntitlementCacheEnvelopeV2,
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
    requiresUncachedRefresh: envelope.store.conflict !== null,
  };
}

function mergeLegacyPositive(
  current: EntitlementCacheEnvelopeV2,
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
  if (current.store.definitive || current.store.provisionalActive || current.store.conflict) {
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
  current: EntitlementCacheEnvelopeV2,
  evidence: EntitlementEvidence,
): PureEntitlementMergeResult {
  switch (evidence.kind) {
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
  envelope: EntitlementCacheEnvelopeV2,
  nowISO: string,
): { active: StoredEntitlement | null; prior: StoredEntitlement | null } {
  const definitive = envelope.store.definitive;
  const provisional = envelope.store.provisionalActive;
  const prior =
    definitive?.entitlement ??
    definitive?.priorEntitlement ??
    provisional?.entitlement ??
    envelope.legacy?.entitlement ??
    null;
  if (envelope.store.conflict) return { active: null, prior };

  const definitiveActive =
    definitive?.state === 'active' && isLive(definitive.entitlement, nowISO)
      ? definitive.entitlement
      : null;
  const provisionalActive = isLive(provisional?.entitlement ?? null, nowISO)
    ? provisional!.entitlement
    : null;

  if (provisionalActive) {
    const definitiveAt = definitive ? storeCursorProviderAt(definitive.cursor) : null;
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
  envelope: EntitlementCacheEnvelopeV2,
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
  current: EntitlementCacheEnvelopeV2,
  observedAtISO: string,
): EntitlementCacheEnvelopeV2 {
  if (current.clockAnchor !== null && current.clockAnchor >= observedAtISO) return current;
  return withRevision(current, { ...current, clockAnchor: observedAtISO });
}
