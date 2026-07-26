import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  OUTBOX_ENTITY_CONTRACT,
  OUTBOX_ENTITY_TYPES,
  isOutboxEntityType,
  isOutboxOperationKind,
  type OutboxEntityType,
} from './outboxEntities';
import { SHELF_PRODUCT_OUTBOX_PAYLOAD_KEYS } from './outbox.pure';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const MIGRATION_DIRECTORY = join(REPOSITORY_ROOT, 'supabase', 'migrations');
const OUTBOX_SOURCE = readFileSync(fileURLToPath(new URL('./outbox.ts', import.meta.url)), 'utf8');

const RPC_MIGRATIONS = {
  shelf_product: '20260718000046_shelf_outbox_rpc.sql',
  notification_preferences: '20260718000047_notification_preferences_outbox_rpc.sql',
  recommendation_preferences: '20260718000048_recommendation_preferences_outbox_rpc.sql',
  notification_delivery: '20260718000049_notification_delivery_outbox_rpc.sql',
  shelf_scan: '20260718000050_shelf_scan_outbox_rpc.sql',
  conflict_choice: '20260718000051_conflict_choice_outbox_rpc.sql',
} as const satisfies Readonly<Record<OutboxEntityType, string>>;

const WIRE_KEYS = Object.freeze([
  'operation_id',
  'entity_type',
  'entity_id',
  'operation_kind',
  'payload',
  'client_revision',
  'idempotency_key',
]);

function readMigration(entityType: OutboxEntityType): string {
  return readFileSync(join(MIGRATION_DIRECTORY, RPC_MIGRATIONS[entityType]), 'utf8');
}

function quotedValues(value: string): string[] {
  return [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]!);
}

function requiredWireKeys(sql: string): string[] {
  const match = /v_operation\s+\?&\s+array\s*\[([\s\S]*?)\]/.exec(sql);
  expect(match, 'RPC must require an exact operation object').not.toBeNull();
  return quotedValues(match![1]!);
}

function requiredShelfPayloadKeys(sql: string): string[] {
  const match = /v_payload\s+\?&\s+array\s*\[([\s\S]*?)\]/.exec(sql);
  expect(match, 'Shelf RPC must require an exact payload object').not.toBeNull();
  return quotedValues(match![1]!);
}

describe('outbox entity contract', () => {
  it('defines the complete ordered runtime contract without ambiguous metadata', () => {
    expect(OUTBOX_ENTITY_TYPES).toEqual([
      'shelf_product',
      'conflict_choice',
      'notification_preferences',
      'recommendation_preferences',
      'notification_delivery',
      'shelf_scan',
    ]);
    expect(OUTBOX_ENTITY_CONTRACT).toEqual({
      shelf_product: {
        priority: 0,
        rpc: 'apply_shelf_outbox_batch',
        flushCountKey: 'shelfProducts',
        immutableEvent: false,
        operationKinds: ['upsert', 'delete'],
      },
      conflict_choice: {
        priority: 1,
        rpc: 'apply_conflict_choice_outbox_batch',
        flushCountKey: 'conflictChoices',
        immutableEvent: false,
        operationKinds: ['upsert'],
      },
      notification_preferences: {
        priority: 2,
        rpc: 'apply_notification_preferences_outbox_batch',
        flushCountKey: 'notificationPreferences',
        immutableEvent: false,
        operationKinds: ['upsert'],
      },
      recommendation_preferences: {
        priority: 3,
        rpc: 'apply_recommendation_preferences_outbox_batch',
        flushCountKey: 'recommendationPreferences',
        immutableEvent: false,
        operationKinds: ['upsert'],
      },
      notification_delivery: {
        priority: 4,
        rpc: 'apply_notification_delivery_outbox_batch',
        flushCountKey: 'notificationDeliveries',
        immutableEvent: true,
        operationKinds: ['upsert'],
      },
      shelf_scan: {
        priority: 5,
        rpc: 'apply_shelf_scan_outbox_batch',
        flushCountKey: 'shelfScans',
        immutableEvent: true,
        operationKinds: ['upsert'],
      },
    });

    const entries = OUTBOX_ENTITY_TYPES.map((entityType) => OUTBOX_ENTITY_CONTRACT[entityType]);
    expect(new Set(entries.map(({ priority }) => priority)).size).toBe(entries.length);
    expect(new Set(entries.map(({ rpc }) => rpc)).size).toBe(entries.length);
    expect(new Set(entries.map(({ flushCountKey }) => flushCountKey)).size).toBe(entries.length);
    expect(entries.map(({ priority }) => priority)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('uses the registry for entity and operation admission', () => {
    for (const entityType of OUTBOX_ENTITY_TYPES) {
      expect(isOutboxEntityType(entityType)).toBe(true);
      for (const operationKind of ['upsert', 'delete'] as const) {
        expect(isOutboxOperationKind(entityType, operationKind)).toBe(
          (OUTBOX_ENTITY_CONTRACT[entityType].operationKinds as readonly string[]).includes(
            operationKind,
          ),
        );
      }
    }
    expect(isOutboxEntityType('future_entity')).toBe(false);
    expect(isOutboxOperationKind('future_entity', 'upsert')).toBe(false);
  });

  it('matches the schema-head receipt constraint exactly', () => {
    const schemaHead = readMigration('conflict_choice');
    const constraint =
      /mobile_outbox_receipts_entity_type_check[\s\S]*?check\s*\(\s*entity_type\s+in\s*\(([\s\S]*?)\)\s*\)/.exec(
        schemaHead,
      );
    expect(constraint, 'schema head must define the receipt entity constraint').not.toBeNull();
    expect(new Set(quotedValues(constraint![1]!))).toEqual(new Set(OUTBOX_ENTITY_TYPES));
  });

  it('binds every entity to an authenticated, bounded, exact-wire RPC', () => {
    for (const entityType of OUTBOX_ENTITY_TYPES) {
      const contract = OUTBOX_ENTITY_CONTRACT[entityType];
      const sql = readMigration(entityType);

      expect(sql).toContain(`create or replace function public.${contract.rpc}(`);
      expect(sql).toContain('auth.uid()');
      expect(sql).toMatch(/jsonb_array_length\(p_operations\)\s*>\s*25/);
      expect(new Set(requiredWireKeys(sql))).toEqual(new Set(WIRE_KEYS));
      expect(sql).toContain(`v_operation ->> 'entity_type' = '${entityType}'`);

      if ((contract.operationKinds as readonly string[]).includes('delete')) {
        expect(sql).toMatch(/v_operation\s*->>\s*'operation_kind'\s+in\s*\('upsert',\s*'delete'\)/);
      } else {
        expect(sql).toContain(`v_operation ->> 'operation_kind' = 'upsert'`);
      }
      if (contract.immutableEvent) {
        expect(sql).toContain(`v_operation ->> 'client_revision' = '1'`);
      }
    }
  });

  it('binds the Shelf client payload keys to the exact RPC payload', () => {
    expect(new Set(requiredShelfPayloadKeys(readMigration('shelf_product')))).toEqual(
      new Set(SHELF_PRODUCT_OUTBOX_PAYLOAD_KEYS),
    );
    expect(SHELF_PRODUCT_OUTBOX_PAYLOAD_KEYS).toHaveLength(17);
  });

  it('routes and counts through the registry instead of a permissive RPC fallback', () => {
    expect(OUTBOX_SOURCE).toContain('const rpc = OUTBOX_ENTITY_CONTRACT[entityType].rpc;');
    expect(OUTBOX_SOURCE).toContain('for (const entityType of OUTBOX_ENTITY_TYPES)');
    expect(OUTBOX_SOURCE).not.toMatch(/apply_[a-z_]+_outbox_batch/);
  });
});
