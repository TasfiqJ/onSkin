import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';

import {
  drainCatalogLookupQueue,
  maintainCatalogLookupQueue,
  subscribeCatalogLookupQueueChanges,
  type CatalogLookupQueueSchedule,
} from './catalogLookupQueue';
import { flushCompletions } from './completionQueue';

// Drains the offline check-off queue (docs/01 §6) on mount and whenever the app
// returns to the foreground: a dependency-free "queue-and-retry". On a successful
// flush we refresh the Today completion and progress queries so synced server state
// replaces the optimistic local state.
// Renders nothing; mounted once at the app root inside the query + auth providers.
//
// The live v1 check-off path is the local-first log in completionsStore; this
// flush is the deferred server-sync half (B-SUPABASE / B-ROUTINE-PERSIST) and
// no-ops until there is a session + server routine/step ids to insert.
export function OfflineSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let disposed = false;
    let appIsActive =
      AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let catalogRunVersion = 0;
    let catalogWakeTimer: ReturnType<typeof setTimeout> | null = null;

    const sameLease = (
      expected: NonNullable<ReturnType<typeof activeHealthProcessingLeaseSnapshot>>,
    ) => {
      const current = activeHealthProcessingLeaseSnapshot();
      return (
        current?.generation === expected.generation &&
        current.epoch === expected.epoch &&
        current.ownerUserId === expected.ownerUserId &&
        current.accountGeneration === expected.accountGeneration
      );
    };

    const clearCatalogWake = () => {
      if (catalogWakeTimer !== null) clearTimeout(catalogWakeTimer);
      catalogWakeTimer = null;
    };

    const scheduleCatalogWake = (
      schedule: CatalogLookupQueueSchedule,
      admittedLease: NonNullable<ReturnType<typeof activeHealthProcessingLeaseSnapshot>>,
      runVersion: number,
    ) => {
      if (
        disposed ||
        !appIsActive ||
        runVersion !== catalogRunVersion ||
        !sameLease(admittedLease)
      ) {
        return;
      }
      const candidates = [
        schedule.nextExpiryAt,
        ...(onlineManager.isOnline() ? [schedule.nextRetryAt] : []),
      ].flatMap((value) => {
        if (value === null) return [];
        const milliseconds = Date.parse(value);
        return Number.isFinite(milliseconds) ? [milliseconds] : [];
      });
      if (candidates.length === 0) return;
      const wakeAt = Math.min(...candidates);
      catalogWakeTimer = setTimeout(
        () => {
          catalogWakeTimer = null;
          if (!disposed && appIsActive && runVersion === catalogRunVersion) runCatalog();
        },
        Math.max(0, wakeAt - Date.now()),
      );
    };

    const runCatalog = () => {
      const runVersion = ++catalogRunVersion;
      clearCatalogWake();
      if (disposed || !appIsActive) return;
      const admittedLease = activeHealthProcessingLeaseSnapshot();
      if (admittedLease === null || admittedLease.ownerUserId === null) return;
      // The catalog queue persists only a bounded reviewed candidate. It never
      // mutates Shelf data; a later surface must ask the user to accept it.
      const operation = onlineManager.isOnline()
        ? drainCatalogLookupQueue()
        : maintainCatalogLookupQueue();
      void operation
        .then((result) => {
          if (
            disposed ||
            !appIsActive ||
            runVersion !== catalogRunVersion ||
            !sameLease(admittedLease)
          ) {
            return;
          }
          const readyCount =
            'ready' in result && typeof result.ready === 'number' ? result.ready : 0;
          if (result.expired > 0 || readyCount > 0) {
            void qc.invalidateQueries({ queryKey: ['catalog-lookup-ready'] });
          }
          scheduleCatalogWake(result, admittedLease, runVersion);
        })
        .catch(() => undefined);
    };

    const runCompletions = () => {
      const admittedLease = activeHealthProcessingLeaseSnapshot();
      if (admittedLease === null || admittedLease.ownerUserId === null) return;
      void flushCompletions()
        .then(({ flushed }) => {
          // Withdrawal, lease expiry, foreground revalidation, or an account
          // boundary may close processing while the asynchronous drain settles.
          // Never publish its completion into a later closed lifecycle.
          if (!disposed && sameLease(admittedLease) && flushed > 0) {
            void qc.invalidateQueries({ queryKey: ['completions'] });
            void qc.invalidateQueries({ queryKey: ['progress'] });
          }
        })
        .catch(() => undefined);
    };

    const run = () => {
      runCatalog();
      runCompletions();
    };

    const unsubscribeHealthLease = subscribeActiveHealthProcessingLeaseChanges(() => {
      catalogRunVersion += 1;
      clearCatalogWake();
      if (!disposed && appIsActive) run();
    });
    run();
    const sub = AppState.addEventListener('change', (s) => {
      appIsActive = s === 'active';
      if (appIsActive) run();
      else {
        catalogRunVersion += 1;
        clearCatalogWake();
      }
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (disposed || !appIsActive) return;
      if (online) run();
      else runCatalog();
    });
    const unsubscribeQueue = subscribeCatalogLookupQueueChanges(() => {
      if (appIsActive) runCatalog();
    });
    return () => {
      disposed = true;
      catalogRunVersion += 1;
      clearCatalogWake();
      sub.remove();
      unsubscribeHealthLease();
      unsubscribeOnline();
      unsubscribeQueue();
    };
  }, [qc]);
  return null;
}
