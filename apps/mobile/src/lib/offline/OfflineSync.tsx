import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { isOwnerQueryScopeCurrent, ownerQueryPrefixes } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { markStartupPhase } from '@/lib/observability/operationTiming';

import { flushCompletions } from './completionQueue';
import { flushOutbox } from './outbox';

// Drains the legacy check-off queue and the transactional outbox on mount,
// foreground, and connectivity recovery. Successful drains refresh only the
// owner-scoped queries backed by those server projections.
// Renders nothing; mounted once at the app root inside the query + auth providers.
//
// The live v1 check-off path is the local-first log in completionsStore; this
// flush is the deferred server-sync half (B-SUPABASE / B-ROUTINE-PERSIST) and
// no-ops until there is a session + server routine/step ids to insert.
export function OfflineSync() {
  const qc = useQueryClient();
  const ownerScope = useOwnerQueryScope();
  useEffect(() => {
    const run = () => {
      void Promise.all([flushCompletions(), flushOutbox()])
        .then(async ([{ flushed }, outbox]) => {
          if (flushed > 0 && isOwnerQueryScopeCurrent(ownerScope)) {
            await Promise.all([
              qc.invalidateQueries({
                queryKey: ownerQueryPrefixes.completions(ownerScope),
              }),
              qc.invalidateQueries({ queryKey: ownerQueryPrefixes.progress(ownerScope) }),
            ]);
          }
          if (outbox.flushedByEntity.shelfProducts > 0 && isOwnerQueryScopeCurrent(ownerScope)) {
            await qc.invalidateQueries({ queryKey: ownerQueryPrefixes.shelf(ownerScope) });
          }
          if (
            outbox.flushedByEntity.notificationPreferences > 0 &&
            isOwnerQueryScopeCurrent(ownerScope)
          ) {
            await qc.invalidateQueries({
              queryKey: ownerQueryPrefixes.notificationPreferences(ownerScope),
            });
          }
          if (isOwnerQueryScopeCurrent(ownerScope)) {
            markStartupPhase('startup_reconciliation_complete');
          }
        })
        .catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (online) run();
    });
    return () => {
      sub.remove();
      unsubscribeOnline();
    };
  }, [ownerScope, qc]);
  return null;
}
