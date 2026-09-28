import { photoPathBelongsToUser } from '../_shared/storagePath.ts';
import { listStoragePathsVerified } from '../data-export/exportCore.ts';
import {
  GRANULAR_DB_MAX_ROWS_PER_SCOPE,
  GRANULAR_PHOTO_MAX_STORAGE_DEPTH,
  GRANULAR_PHOTO_MAX_STORAGE_OBJECTS,
  GRANULAR_PHOTO_MAX_STORAGE_PAGE_REQUESTS,
  GRANULAR_PHOTO_MAX_STORAGE_PREFIXES,
  GRANULAR_PHOTO_STORAGE_BATCH_SIZE,
  type GranularWithdrawalOperation,
  runAskLayerwellCleanup,
  runBoundedRowDelete,
  runDataSharingCleanup,
  runGranularPhotoCaptureCleanup,
  runGranularPhotoCloudCleanup,
} from './granularWithdrawalCore.ts';

// Supabase's ungenerated Edge client deliberately has no table schema generic.
// deno-lint-ignore no-explicit-any
export type DependentCleanupSupabaseClient = any;

export const DEPENDENT_PHOTO_CLEANUP_REQUIRES_WORKER =
  'DEPENDENT_PHOTO_CLEANUP_REQUIRES_WORKER';

export class DependentPhotoCleanupRequiresWorkerError extends Error {
  constructor() {
    super(DEPENDENT_PHOTO_CLEANUP_REQUIRES_WORKER);
    this.name = 'DependentPhotoCleanupRequiresWorkerError';
  }
}

async function deleteUserRowsBounded(
  supabase: DependentCleanupSupabaseClient,
  table: string,
  column: string,
  userId: string,
): Promise<number> {
  return (await deleteUserRowsBoundedResult(supabase, table, column, userId))
    .deleted;
}

function deleteUserRowsBoundedResult(
  supabase: DependentCleanupSupabaseClient,
  table: string,
  column: string,
  userId: string,
) {
  return runBoundedRowDelete({
    listRows: (limit) =>
      supabase
        .from(table)
        .select('id')
        .eq(column, userId)
        .order('id', { ascending: true })
        .limit(limit),
    deleteRows: (ids) =>
      supabase.from(table).delete().in('id', ids).select('id'),
    findRows: (ids) => supabase.from(table).select('id').in('id', ids).limit(1),
  });
}

async function verifiedPhotoStoragePaths(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
): Promise<string[]> {
  const inventory = await listStoragePathsVerified({
    userId,
    bucket: supabase.storage.from('photos'),
    pageSize: GRANULAR_PHOTO_STORAGE_BATCH_SIZE,
    maxObjects: GRANULAR_PHOTO_MAX_STORAGE_OBJECTS,
    maxDepth: GRANULAR_PHOTO_MAX_STORAGE_DEPTH,
    maxPrefixes: GRANULAR_PHOTO_MAX_STORAGE_PREFIXES,
    maxPageRequests: GRANULAR_PHOTO_MAX_STORAGE_PAGE_REQUESTS,
  });
  if (inventory.paths.some((path) => !photoPathBelongsToUser(userId, path))) {
    throw new Error('CONSENT_WITHDRAWAL_CLEANUP_FAILED');
  }
  return inventory.paths;
}

function withdrawPhotoCloudBackup(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
) {
  return runGranularPhotoCloudCleanup(userId, {
    countPhotoRows: () =>
      supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .or('local_only.eq.false,storage_path.not.is.null'),
    listPhotoRows: (limit) =>
      supabase
        .from('photos')
        .select('id, storage_path')
        .eq('user_id', userId)
        .or('local_only.eq.false,storage_path.not.is.null')
        .order('id', { ascending: true })
        .limit(limit),
    listVerifiedStoragePaths: () => verifiedPhotoStoragePaths(supabase, userId),
    removeStorage: (paths) => supabase.storage.from('photos').remove(paths),
    relocalizePhotoRows: (ids) =>
      ids.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase
        .from('photos')
        .update({ local_only: true, storage_path: null })
        .eq('user_id', userId)
        .in('id', ids)
        .select('id'),
  });
}

function withdrawPhotoCapture(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
) {
  return runGranularPhotoCaptureCleanup(userId, {
    countPhotoRows: () =>
      supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    listPhotoRows: (limit) =>
      supabase
        .from('photos')
        .select('id, storage_path')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .limit(limit),
    listVerifiedStoragePaths: () => verifiedPhotoStoragePaths(supabase, userId),
    removeStorage: (paths) => supabase.storage.from('photos').remove(paths),
    deletePhotoRows: (ids) =>
      ids.length === 0 ? Promise.resolve({ data: [], error: null }) : supabase
        .from('photos')
        .delete()
        .eq('user_id', userId)
        .in('id', ids)
        .select('id'),
  });
}

async function withdrawAskLayerwell(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
) {
  const safety = await deleteUserRowsBoundedResult(
    supabase,
    'ask_safety_audit',
    'user_id',
    userId,
  );
  if (safety.more_pending) {
    return {
      ask_safety_audit_deleted: safety.deleted,
      ask_turn_audit_deleted: 0,
      ask_sessions_deleted: 0,
      more_pending: true,
    };
  }

  const graph = await runAskLayerwellCleanup({
    listSessionRows: (limit) =>
      supabase
        .from('ask_sessions')
        .select('id')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .limit(limit),
    listTurnRows: (sessionIds, limit) =>
      supabase
        .from('ask_turn_audit')
        .select('id, session_id')
        .in('session_id', sessionIds)
        .order('id', { ascending: true })
        .limit(limit),
    findSafetyRowsForTurns: (turnIds) =>
      supabase
        .from('ask_safety_audit')
        .select('id')
        .in('turn_audit_id', turnIds)
        .limit(GRANULAR_DB_MAX_ROWS_PER_SCOPE),
    deleteTurnRows: (ids) =>
      supabase
        .from('ask_turn_audit')
        .delete()
        .in('id', ids)
        .select('id, session_id'),
    findTurnRows: (ids) =>
      supabase
        .from('ask_turn_audit')
        .select('id, session_id')
        .in('id', ids)
        .limit(GRANULAR_DB_MAX_ROWS_PER_SCOPE),
    deleteSessionRows: (ids) =>
      supabase
        .from('ask_sessions')
        .delete()
        .eq('user_id', userId)
        .in('id', ids)
        .select('id'),
    findSessionRows: (ids) =>
      supabase
        .from('ask_sessions')
        .select('id')
        .eq('user_id', userId)
        .in('id', ids)
        .limit(GRANULAR_DB_MAX_ROWS_PER_SCOPE),
  });
  return {
    ask_safety_audit_deleted: safety.deleted,
    ...graph,
  };
}

async function withdrawTrendInsights(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
) {
  return {
    photo_trend_deleted: await deleteUserRowsBounded(
      supabase,
      'photo_trend',
      'user_id',
      userId,
    ),
  };
}

async function withdrawCommunityParticipation(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
) {
  const reportsDeleted = await deleteUserRowsBounded(
    supabase,
    'community_reports',
    'reporter_id',
    userId,
  );
  const reactionsDeleted = await deleteUserRowsBounded(
    supabase,
    'community_reactions',
    'user_id',
    userId,
  );
  const questionsDeleted = await deleteUserRowsBounded(
    supabase,
    'community_questions',
    'user_id',
    userId,
  );
  const blocksDeleted = await deleteUserRowsBounded(
    supabase,
    'community_blocks',
    'user_id',
    userId,
  );
  return {
    community_reports_deleted: reportsDeleted,
    community_reactions_deleted: reactionsDeleted,
    community_questions_deleted: questionsDeleted,
    community_blocks_deleted: blocksDeleted,
  };
}

function withdrawDataSharing(
  supabase: DependentCleanupSupabaseClient,
  userId: string,
) {
  return runDataSharingCleanup({
    listClickRows: (limit) =>
      supabase
        .from('commerce_click_events')
        .select('id, click_token')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .limit(limit),
    listAttributionRows: (clickTokens, limit) =>
      supabase
        .from('order_attributions')
        .select('id')
        .in('click_token', clickTokens)
        .order('id', { ascending: true })
        .limit(limit),
    detachAttributions: (ids) =>
      supabase
        .from('order_attributions')
        .update({ click_token: null })
        .in('id', ids)
        .select('id'),
    findAttributions: (clickTokens) =>
      supabase
        .from('order_attributions')
        .select('id')
        .in('click_token', clickTokens)
        .limit(GRANULAR_DB_MAX_ROWS_PER_SCOPE + 1),
    deleteClickRows: (ids) =>
      supabase.from('commerce_click_events').delete().in('id', ids).select(
        'id',
      ),
    findClickRows: (ids) =>
      supabase.from('commerce_click_events').select('id').in('id', ids).limit(
        1,
      ),
  });
}

/** Shared by the authenticated request and scheduled lost-device lanes. */
export async function runHealthDependentCleanup(
  supabase: DependentCleanupSupabaseClient,
  operation: GranularWithdrawalOperation,
): Promise<Record<string, number | boolean>> {
  const userId = operation.userId;
  switch (operation.consentType) {
    case 'photo_capture': {
      const photos = await withdrawPhotoCapture(supabase, userId);
      const trend = await withdrawTrendInsights(supabase, userId);
      return { ...photos, ...trend };
    }
    case 'photo_cloud_backup':
      return await withdrawPhotoCloudBackup(supabase, userId);
    case 'ask_layerwell':
      return await withdrawAskLayerwell(supabase, userId);
    case 'photo_trend_insights':
      return await withdrawTrendInsights(supabase, userId);
    case 'community_participation':
      return await withdrawCommunityParticipation(supabase, userId);
    case 'data_sharing':
      return await withdrawDataSharing(supabase, userId);
  }
}

/**
 * The authenticated caller has no dependent-operation worker lease and cannot
 * use the database's authoritative Storage ownership inventory. A canonical
 * user prefix is insufficient when legacy owner/owner_id metadata conflicts,
 * so photo Storage work always remains pending for the leased scheduled lane.
 * The mobile client independently performs its local-device cleanup as soon as
 * it records the durable withdrawal tombstone.
 */
export async function runAuthenticatedHealthDependentCleanup(
  supabase: DependentCleanupSupabaseClient,
  operation: GranularWithdrawalOperation,
): Promise<Record<string, number | boolean>> {
  if (
    operation.consentType === 'photo_capture' ||
    operation.consentType === 'photo_cloud_backup'
  ) {
    throw new DependentPhotoCleanupRequiresWorkerError();
  }
  return await runHealthDependentCleanup(supabase, operation);
}
