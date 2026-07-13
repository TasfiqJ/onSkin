export type TableFilter = { column: string; value: string } | null;

export type ExportTable = {
  table: string;
  filter: TableFilter;
  scope: 'caller_rls' | 'service_role_filtered';
  orderBy: readonly string[];
  selectColumns?: string;
  note?: string;
};

export type ResolvedExportTable = Omit<ExportTable, 'filter'> & {
  clientKind: 'caller' | 'service_role';
  filter: { column: string; value: string } | null;
};

export const SERVICE_ONLY_EXPORT_DENYLIST = [
  'reverse_trial_grants',
  'subscriptions_events',
  'order_attributions',
  'obf_contribution_queue',
  'catalog_import_batches',
  'catalog_quality_reports',
  'community_moderation_events',
  'waitlist_signups',
  'growth_events',
  'edge_rate_limits',
] as const;

export const CALLER_RLS_EXPORT_TABLES: readonly ExportTable[] = [
  {
    table: 'profiles',
    filter: { column: 'id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'skin_profiles',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'user_products',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'routines',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'routine_steps',
    filter: null,
    scope: 'caller_rls',
    orderBy: ['id'],
    note: 'Owned through routines.',
  },
  {
    table: 'routine_completions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'routine_conflicts',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'active_ramp',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'shelf_scans',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'cycles',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'cycle_nights',
    filter: null,
    scope: 'caller_rls',
    orderBy: ['cycle_id', 'night_index'],
    note: 'Owned through cycles.',
  },
  {
    table: 'streak_freezes',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'notification_preferences',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['user_id'],
  },
  {
    table: 'notification_log',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'consents',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'photos',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'entitlements',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['user_id'],
  },
  {
    table: 'recommendation_preferences',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['user_id'],
  },
  {
    table: 'recommendations',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'catalog_corrections',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'catalog_lookup_events',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'commerce_click_events',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'community_blocks',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['user_id', 'blocked_handle'],
  },
  {
    table: 'community_questions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'community_reactions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'community_reports',
    filter: { column: 'reporter_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'photo_trend',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'ask_sessions',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
  {
    table: 'ask_turn_audit',
    filter: null,
    scope: 'caller_rls',
    orderBy: ['id'],
    note: 'Owned through ask_sessions.',
  },
  {
    table: 'ask_safety_audit',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'caller_rls',
    orderBy: ['id'],
  },
];

export const SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES: readonly ExportTable[] = [
  {
    table: 'reverse_trial_grants',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'service_role_filtered',
    orderBy: ['user_id'],
    selectColumns: 'user_id, granted_at, expires_at, source, metadata',
    note: 'Matched only to the user ID verified from the caller JWT.',
  },
  {
    table: 'obf_contribution_queue',
    filter: { column: 'user_id', value: 'USER_ID' },
    scope: 'service_role_filtered',
    orderBy: ['id'],
    selectColumns:
      'id, correction_id, user_id, barcode, payload, status, submitted_at, created_at, updated_at',
    note: 'Matched only to the user ID verified from the caller JWT.',
  },
];

export const SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS = [
  'subscriptions_events',
  'order_attributions',
] as const;

export const SERVICE_ROLE_FILTERED_EXPORTS = Object.freeze([
  SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS[0],
  ...SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES.map((item) => item.table),
  SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS[1],
]);

export const SUBSCRIPTION_EVENT_EXPORT_COLUMNS = [
  'id',
  'rc_event_id',
  'event_type',
  'received_at',
  'environment',
  'store',
  'product_id',
  'provider_event_at',
] as const;

export function subscriptionEventOwnerFilter(verifiedUserId: string): string {
  return [
    `user_id.eq.${verifiedUserId}`,
    `resolved_user_id.eq.${verifiedUserId}`,
    `app_user_id.eq.${verifiedUserId}`,
    `original_app_user_id.eq.${verifiedUserId}`,
    `aliases.cs.{${verifiedUserId}}`,
    `transferred_from.cs.{${verifiedUserId}}`,
    `transferred_to.cs.{${verifiedUserId}}`,
  ].join(',');
}

export function resolveTableFilter(
  filter: TableFilter,
  verifiedUserId: string,
): { column: string; value: string } | null {
  if (!filter) return null;
  return {
    column: filter.column,
    value: filter.value === 'USER_ID' ? verifiedUserId : filter.value,
  };
}

export function buildDirectExportPlans(verifiedUserId: string): readonly ResolvedExportTable[] {
  return [
    ...CALLER_RLS_EXPORT_TABLES.map((item) => ({
      ...item,
      clientKind: 'caller' as const,
      filter: resolveTableFilter(item.filter, verifiedUserId),
    })),
    ...SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES.map((item) => ({
      ...item,
      clientKind: 'service_role' as const,
      filter: resolveTableFilter(item.filter, verifiedUserId),
    })),
  ];
}

export function validateExportRegistry(options?: {
  callerTables?: readonly ExportTable[];
  directServiceTables?: readonly ExportTable[];
  specialServiceTables?: readonly string[];
  serviceOnlyTables?: readonly string[];
}): void {
  const callerTables = options?.callerTables ?? CALLER_RLS_EXPORT_TABLES;
  const directServiceTables =
    options?.directServiceTables ?? SERVICE_ROLE_DIRECT_USER_EXPORT_TABLES;
  const specialServiceTables =
    options?.specialServiceTables ?? SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS;
  const serviceOnlyTables = options?.serviceOnlyTables ?? SERVICE_ONLY_EXPORT_DENYLIST;
  const serviceOnlySet = new Set(serviceOnlyTables);
  const seen = new Set<string>();

  for (const item of callerTables) {
    if (item.scope !== 'caller_rls') {
      throw new Error(`EXPORT_REGISTRY_CALLER_SCOPE:${item.table}`);
    }
    if (serviceOnlySet.has(item.table)) {
      throw new Error(`EXPORT_REGISTRY_SERVICE_ONLY_IN_CALLER:${item.table}`);
    }
    if (seen.has(item.table)) throw new Error(`EXPORT_REGISTRY_DUPLICATE:${item.table}`);
    seen.add(item.table);
  }

  for (const item of directServiceTables) {
    if (item.scope !== 'service_role_filtered') {
      throw new Error(`EXPORT_REGISTRY_SERVICE_SCOPE:${item.table}`);
    }
    if (!serviceOnlySet.has(item.table)) {
      throw new Error(`EXPORT_REGISTRY_NON_SERVICE_DIRECT:${item.table}`);
    }
    if (!item.filter || item.filter.value !== 'USER_ID') {
      throw new Error(`EXPORT_REGISTRY_UNVERIFIED_SERVICE_FILTER:${item.table}`);
    }
    if (!item.selectColumns?.trim()) {
      throw new Error(`EXPORT_REGISTRY_SERVICE_COLUMNS_REQUIRED:${item.table}`);
    }
    if (seen.has(item.table)) throw new Error(`EXPORT_REGISTRY_DUPLICATE:${item.table}`);
    seen.add(item.table);
  }

  for (const table of specialServiceTables) {
    if (!serviceOnlySet.has(table)) {
      throw new Error(`EXPORT_REGISTRY_NON_SERVICE_SPECIAL:${table}`);
    }
    if (seen.has(table)) throw new Error(`EXPORT_REGISTRY_DUPLICATE:${table}`);
    seen.add(table);
  }
}

validateExportRegistry();
