import { describe, expect, it } from 'vitest';

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
    expect(LOCAL_PRIVATE_KEY_REGISTRY).toHaveLength(46);
    expect(LOCAL_PRIVATE_DATA_KEYS).toHaveLength(37);
    expect(LOCAL_PRIVATE_SECURE_STORE_KEYS).toHaveLength(2);
    expect(LOCAL_PRIVATE_METADATA_KEYS).toHaveLength(4);
    expect(LOCAL_PRIVATE_CONTROL_KEYS).toHaveLength(3);
  });

  it('has no unresolved per-key contract gaps', () => {
    expect(localPrivateRegistryGaps()).toEqual([]);
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
