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
    expect(LOCAL_PRIVATE_KEY_REGISTRY).toHaveLength(44);
    expect(LOCAL_PRIVATE_DATA_KEYS).toHaveLength(37);
    expect(LOCAL_PRIVATE_SECURE_STORE_KEYS).toHaveLength(2);
    expect(LOCAL_PRIVATE_METADATA_KEYS).toHaveLength(2);
    expect(LOCAL_PRIVATE_CONTROL_KEYS).toHaveLength(3);
  });

  it('keeps the exact known contract gaps visible until their store migrations land', () => {
    expect(localPrivateRegistryGaps()).toEqual([
      'onskin.ask.groundedTurns.v1:typedRead',
      'onskin.milestones.v1:typedRead',
      'onskin.notifPrefs.v1:typedRead',
      'onskin.notiflog.v1:typedRead',
      'onskin.photos.captureConsent.v1:typedRead',
      'onskin.photos.captureConsent:typedRead',
      'onskin.photos.cloudBackup:codec',
      'onskin.photos.v1:typedRead',
      'onskin.recDismissed.v1:typedRead',
      'onskin.recPrefs.v1:typedRead',
      'onskin.reviewPrompt.v1:typedRead',
      'onskin.subscription.promptedExpiry:typedRead',
      'onskin.trendState.v1:codec',
      'routinekind.routineActivation.v1:typedRead',
    ]);
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
