import { describe, expect, it } from 'vitest';

import {
  OUTBOX_LEGACY_SCHEMA_VERSIONS,
  OUTBOX_SCHEMA_VERSION,
  OUTBOX_STORAGE_KEY,
} from '@/lib/offline/outbox.pure';
import {
  PRIVATE_KV_TRANSACTION_JOURNAL_KEY,
  PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION,
  PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
} from '@/lib/storage/privateKVTransactionCore';

import {
  LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
  LOCAL_PRIVATE_CONTROL_KEYS,
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_EXPORT_SPECS,
  LOCAL_PRIVATE_KEY_REGISTRY,
  LOCAL_PRIVATE_METADATA_KEYS,
  LOCAL_PRIVATE_SECURE_STORE_KEYS,
  localPrivateRegistryGaps,
  validateLocalPrivateKeyRegistry,
  type LocalPrivateKeyDescriptor,
} from './localPrivateDataRegistry';

describe('local private-data contract registry', () => {
  it('is structurally valid and assigns every export destination once', () => {
    expect(validateLocalPrivateKeyRegistry()).toEqual([]);
    expect(LOCAL_PRIVATE_KEY_REGISTRY).toHaveLength(49);
    expect(LOCAL_PRIVATE_DATA_KEYS).toHaveLength(39);
    expect(LOCAL_PRIVATE_SECURE_STORE_KEYS).toHaveLength(2);
    expect(LOCAL_PRIVATE_METADATA_KEYS).toHaveLength(5);
    expect(LOCAL_PRIVATE_CONTROL_KEYS).toHaveLength(3);
  });

  it('has no unresolved per-key contract gaps', () => {
    expect(localPrivateRegistryGaps()).toEqual([]);
  });

  it('binds the transactional outbox descriptor to the live codec versions', () => {
    const outbox = LOCAL_PRIVATE_KEY_REGISTRY.find((entry) => entry.key === OUTBOX_STORAGE_KEY);

    expect(outbox?.codec).toEqual({
      status: 'enforced',
      codecId: 'transactional_outbox',
      currentVersion: OUTBOX_SCHEMA_VERSION,
      legacyVersions: OUTBOX_LEGACY_SCHEMA_VERSIONS,
    });
  });

  it('binds the private-KV transaction journal to V2 with V1 recovery', () => {
    const journal = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === PRIVATE_KV_TRANSACTION_JOURNAL_KEY,
    );

    expect(journal?.codec).toEqual({
      status: 'enforced',
      codecId: 'private_kv_transaction_journal',
      currentVersion: PRIVATE_KV_TRANSACTION_SCHEMA_VERSION,
      legacyVersions: [PRIVATE_KV_TRANSACTION_LEGACY_SCHEMA_VERSION],
    });
  });

  it('records the retired cloud-backup flag codec without restoring a live reader', () => {
    const cloudBackup = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.photos.cloudBackup',
    );

    expect(cloudBackup).toMatchObject({
      lifecycle: 'legacy_retained',
      discovery: 'retained_inventory',
      codec: {
        status: 'enforced',
        codecId: 'private_boolean',
        currentVersion: 'legacy_boolean',
        legacyVersions: [],
      },
      typedRead: { status: 'not_applicable' },
      mutation: { status: 'enforced', mode: 'read_only' },
    });
  });

  it('keeps the never-written trend-state key reserved for deletion only', () => {
    const trendState = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.trendState.v1',
    )!;

    expect(trendState).toMatchObject({
      lifecycle: 'reserved',
      codec: { status: 'not_applicable' },
      typedRead: { status: 'not_applicable' },
      mutation: { status: 'enforced', mode: 'read_only' },
      recovery: { status: 'enforced', mode: 'explicit_domain_delete' },
    });

    const invalidReserved = {
      ...trendState,
      codec: {
        status: 'enforced',
        codecId: 'invented_trend_state',
        currentVersion: 1,
        legacyVersions: [],
      },
    } as LocalPrivateKeyDescriptor;
    expect(validateLocalPrivateKeyRegistry([invalidReserved])).toContain(
      'reserved_codec:onskin.trendState.v1',
    );
  });

  it('keeps the subscription prompt legacy scalar export-compatible', () => {
    const prompt = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.subscription.promptedExpiry',
    );

    expect(prompt?.export).toMatchObject({
      status: 'enforced',
      mode: 'include',
      transform: 'safe_scalar_or_json',
    });
    expect(prompt?.codec).toEqual({
      status: 'enforced',
      codecId: 'subscription_prompt',
      currentVersion: 3,
      legacyVersions: [0, 1, 2],
    });
  });

  it('registers rollback-readable proof and sidecar codecs only on known cleanup keys', () => {
    const proof = LOCAL_PRIVATE_KEY_REGISTRY.find((entry) => entry.key === 'onskin.entitlement.v2');
    const sidecar = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.entitlement.v1',
    );

    expect(proof).toMatchObject({
      lifecycle: 'current',
      codec: {
        codecId: 'entitlement_cache_rollback_bridge',
        currentVersion: 0,
        legacyVersions: [1],
      },
    });
    expect(sidecar).toMatchObject({
      lifecycle: 'current',
      codec: {
        codecId: 'entitlement_legacy_or_revenuecat_sidecar',
        currentVersion: 2,
        legacyVersions: [0, 1],
      },
      ownerBinding: { status: 'enforced', mode: 'private_kv_account_boundary' },
      cleanup: { status: 'enforced', mode: 'authorized_private_kv_bulk' },
    });
    expect(
      LOCAL_PRIVATE_KEY_REGISTRY.some(
        (entry) => entry.key === ('onskin.entitlement.revenuecatEmpty.v1' as never),
      ),
    ).toBe(false);
  });

  it('tracks durable Ask operation identities in codec v2 while retaining v0/v1 readers', () => {
    const askTurns = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.ask.groundedTurns.v1',
    );

    expect(askTurns?.codec).toEqual({
      status: 'enforced',
      codecId: 'ask_grounded_turns',
      currentVersion: 2,
      legacyVersions: [0, 1],
    });
  });

  it('registers owner-bound cycle-night analytics receipts for at-most-once publication', () => {
    const receipts = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.cycleNightAnalytics.v1',
    );

    expect(receipts).toMatchObject({
      lifecycle: 'current',
      codec: {
        status: 'enforced',
        codecId: 'cycle_night_analytics_receipts',
        currentVersion: 1,
        legacyVersions: [],
      },
      typedRead: { status: 'enforced', mode: 'domain_result' },
      mutation: { status: 'enforced', mode: 'private_kv_atomic_transform' },
      ownerBinding: { status: 'enforced', mode: 'private_kv_account_boundary' },
      export: {
        status: 'enforced',
        mode: 'include',
        section: 'activity_and_app_state',
        field: 'cycle_night_analytics_receipts',
        transform: 'structured_json',
      },
      cleanup: { status: 'enforced', mode: 'authorized_private_kv_bulk' },
    });
  });

  it('declares the installed-base bare photo consent proof as a legacy codec', () => {
    const photoConsent = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.photos.captureConsent.v1',
    );

    expect(photoConsent?.codec).toEqual({
      status: 'enforced',
      codecId: 'photo_capture_consent',
      currentVersion: 1,
      legacyVersions: [0],
    });
  });

  it('declares the installed-base raw owner hash as a read-only legacy codec', () => {
    const ownerMarker = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'routinekind.localDataOwnerHash.v1',
    );

    expect(ownerMarker?.codec).toEqual({
      status: 'enforced',
      codecId: 'owner_hash_control',
      currentVersion: 'v1',
      legacyVersions: ['raw_sha256'],
    });
  });

  it('registers the nonce-bound owner-claim records used for authenticated write repair', () => {
    const intent = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'routinekind.localDataOwnerClaimIntent.v1',
    );
    const nonce = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'routinekind.localDataOwnerClaimNonce.v1',
    );

    expect(intent).toMatchObject({
      codec: {
        status: 'enforced',
        codecId: 'owner_claim_intent_control',
        currentVersion: 'v1:<claim_sha256>',
        legacyVersions: [],
      },
      recovery: { status: 'enforced', mode: 'authenticated_claim_repair' },
    });
    expect(nonce).toMatchObject({
      codec: {
        status: 'enforced',
        codecId: 'owner_claim_nonce_control',
        currentVersion: 'v1:<sha256>',
        legacyVersions: [],
      },
      recovery: { status: 'enforced', mode: 'authenticated_claim_repair' },
    });
  });

  it('declares the strict photo key-history marker with its read-only legacy scalar', () => {
    const photoKeyMarker = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'onskin.photo.content_key_created.v1',
    );

    expect(photoKeyMarker).toMatchObject({
      codec: {
        status: 'enforced',
        codecId: 'photo_key_presence_marker',
        currentVersion: 'v1:created:<sha256>|v1:pending:<sha256>',
        legacyVersions: ['1', 'v1:created'],
      },
      typedRead: { status: 'enforced', mode: 'control_state_machine' },
      mutation: { status: 'enforced', mode: 'replace_only_control' },
      recovery: {
        status: 'enforced',
        mode: 'pending_key_fingerprint_reconciliation',
      },
    });
  });

  it('declares the tombstone-aware Shelf v3 codec and product-only export transform', () => {
    const shelf = LOCAL_PRIVATE_KEY_REGISTRY.find((entry) => entry.key === 'onskin.shelf.v1');

    expect(shelf).toMatchObject({
      codec: {
        status: 'enforced',
        codecId: 'shelf_state',
        currentVersion: 3,
        legacyVersions: [0, 1, 2],
      },
      mutation: { status: 'enforced', mode: 'private_kv_atomic_transform' },
      ownerBinding: { status: 'enforced', mode: 'private_kv_account_boundary' },
      export: {
        status: 'enforced',
        mode: 'include',
        section: 'shelf_and_routine',
        field: 'shelf_products',
        transform: 'shelf_products',
      },
      recovery: { status: 'enforced', mode: 'preserve_bytes_and_retry' },
    });
  });

  it('declares exact cleanup-authority bytes and the installed-base legacy scalar', () => {
    const cleanupMarker = LOCAL_PRIVATE_KEY_REGISTRY.find(
      (entry) => entry.key === 'routinekind.localDataCleanupRequired.v1',
    );

    expect(cleanupMarker?.codec).toEqual({
      status: 'enforced',
      codecId: 'cleanup_required_presence_marker',
      currentVersion: 'v1:required',
      legacyVersions: ['1'],
    });
  });

  it('derives export and destructive cleanup sets from one registry', () => {
    for (const derived of [
      LOCAL_PRIVATE_DATA_KEYS,
      LOCAL_PRIVATE_SECURE_STORE_KEYS,
      LOCAL_PRIVATE_METADATA_KEYS,
      LOCAL_PRIVATE_CONTROL_KEYS,
      LOCAL_PRIVATE_BULK_CLEANUP_KEYS,
      LOCAL_PRIVATE_EXPORT_SPECS,
    ]) {
      expect(Object.isFrozen(derived)).toBe(true);
    }
    expect(LOCAL_PRIVATE_EXPORT_SPECS.map((spec) => spec.key).sort()).toEqual(
      [...LOCAL_PRIVATE_DATA_KEYS].sort(),
    );
    expect([...LOCAL_PRIVATE_BULK_CLEANUP_KEYS].sort()).toEqual(
      [...LOCAL_PRIVATE_DATA_KEYS, ...LOCAL_PRIVATE_METADATA_KEYS].sort(),
    );
    for (const key of LOCAL_PRIVATE_CONTROL_KEYS) {
      expect(LOCAL_PRIVATE_BULK_CLEANUP_KEYS).not.toContain(key);
    }
    for (const key of LOCAL_PRIVATE_SECURE_STORE_KEYS) {
      const entry = LOCAL_PRIVATE_KEY_REGISTRY.find((candidate) => candidate.key === key)!;
      expect(entry.export).toMatchObject({ status: 'enforced', mode: 'exclude' });
    }
  });

  it('rejects duplicate keys, duplicate destinations, and destructive control registration', () => {
    const first = LOCAL_PRIVATE_KEY_REGISTRY[0] as LocalPrivateKeyDescriptor;
    const second = LOCAL_PRIVATE_KEY_REGISTRY[1] as LocalPrivateKeyDescriptor;
    const duplicateDestination = {
      ...second,
      export: first.export,
    } as LocalPrivateKeyDescriptor;
    const destructiveControl = {
      ...(LOCAL_PRIVATE_KEY_REGISTRY.at(-1) as LocalPrivateKeyDescriptor),
      cleanup: {
        status: 'enforced',
        mode: 'authorized_private_kv_bulk',
        handler: 'unsafeBulkDelete',
      },
    } as LocalPrivateKeyDescriptor;

    expect(validateLocalPrivateKeyRegistry([first, first])).toContain(`duplicate_key:${first.key}`);
    expect(validateLocalPrivateKeyRegistry([first, duplicateDestination])).toContain(
      'duplicate_export_destination:account_and_privacy:age_verified',
    );
    expect(validateLocalPrivateKeyRegistry([destructiveControl])).toContain(
      `control_bulk_cleanup:${destructiveControl.key}`,
    );
  });

  it('allows registry-only retention only for the explicitly unavailable legacy preference', () => {
    expect(
      (LOCAL_PRIVATE_KEY_REGISTRY as readonly LocalPrivateKeyDescriptor[])
        .filter((entry) => entry.discovery === 'retained_inventory')
        .map((entry) => entry.key),
    ).toEqual(['onskin.photos.cloudBackup']);
  });
});
