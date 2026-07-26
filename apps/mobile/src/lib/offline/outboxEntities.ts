type OutboxEntityContractEntry = Readonly<{
  flushCountKey:
    | 'conflictChoices'
    | 'notificationDeliveries'
    | 'notificationPreferences'
    | 'photoDeletes'
    | 'recommendationPreferences'
    | 'shelfProducts'
    | 'shelfScans';
  immutableEvent: boolean;
  operationKinds: readonly ('delete' | 'upsert')[];
  priority: number;
  rpc:
    | 'apply_conflict_choice_outbox_batch'
    | 'apply_notification_delivery_outbox_batch'
    | 'apply_notification_preferences_outbox_batch'
    | 'apply_photo_delete_outbox_batch'
    | 'apply_recommendation_preferences_outbox_batch'
    | 'apply_shelf_outbox_batch'
    | 'apply_shelf_scan_outbox_batch';
}>;

/**
 * One executable contract for codec admission, lease ordering, RPC routing,
 * immutable-event behavior, and content-free flush diagnostics.
 */
export const OUTBOX_ENTITY_CONTRACT = Object.freeze({
  photo_delete: Object.freeze({
    priority: 0,
    rpc: 'apply_photo_delete_outbox_batch',
    flushCountKey: 'photoDeletes',
    immutableEvent: false,
    operationKinds: Object.freeze(['delete'] as const),
  }),
  shelf_product: Object.freeze({
    priority: 1,
    rpc: 'apply_shelf_outbox_batch',
    flushCountKey: 'shelfProducts',
    immutableEvent: false,
    operationKinds: Object.freeze(['upsert', 'delete'] as const),
  }),
  conflict_choice: Object.freeze({
    priority: 2,
    rpc: 'apply_conflict_choice_outbox_batch',
    flushCountKey: 'conflictChoices',
    immutableEvent: false,
    operationKinds: Object.freeze(['upsert'] as const),
  }),
  notification_preferences: Object.freeze({
    priority: 3,
    rpc: 'apply_notification_preferences_outbox_batch',
    flushCountKey: 'notificationPreferences',
    immutableEvent: false,
    operationKinds: Object.freeze(['upsert'] as const),
  }),
  recommendation_preferences: Object.freeze({
    priority: 4,
    rpc: 'apply_recommendation_preferences_outbox_batch',
    flushCountKey: 'recommendationPreferences',
    immutableEvent: false,
    operationKinds: Object.freeze(['upsert'] as const),
  }),
  notification_delivery: Object.freeze({
    priority: 5,
    rpc: 'apply_notification_delivery_outbox_batch',
    flushCountKey: 'notificationDeliveries',
    immutableEvent: true,
    operationKinds: Object.freeze(['upsert'] as const),
  }),
  shelf_scan: Object.freeze({
    priority: 6,
    rpc: 'apply_shelf_scan_outbox_batch',
    flushCountKey: 'shelfScans',
    immutableEvent: true,
    operationKinds: Object.freeze(['upsert'] as const),
  }),
} as const satisfies Readonly<Record<string, OutboxEntityContractEntry>>);

export type OutboxEntityType = keyof typeof OUTBOX_ENTITY_CONTRACT;
export type OutboxOperationKind =
  (typeof OUTBOX_ENTITY_CONTRACT)[OutboxEntityType]['operationKinds'][number];
export type OutboxFlushCountKey =
  (typeof OUTBOX_ENTITY_CONTRACT)[OutboxEntityType]['flushCountKey'];

export const OUTBOX_ENTITY_TYPES = Object.freeze(
  Object.keys(OUTBOX_ENTITY_CONTRACT) as OutboxEntityType[],
);

export function isOutboxEntityType(value: unknown): value is OutboxEntityType {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(OUTBOX_ENTITY_CONTRACT, value)
  );
}

export function isOutboxOperationKind(
  entityType: unknown,
  operationKind: unknown,
): operationKind is OutboxOperationKind {
  return (
    isOutboxEntityType(entityType) &&
    typeof operationKind === 'string' &&
    (OUTBOX_ENTITY_CONTRACT[entityType].operationKinds as readonly string[]).includes(operationKind)
  );
}
