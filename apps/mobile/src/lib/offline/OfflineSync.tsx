import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  activeHealthProcessingLeaseSnapshot,
  subscribeActiveHealthProcessingLeaseChanges,
} from '@/lib/consent/healthProcessingEpoch';
import { subscribeShelfMirrorOutboxChanges } from '@/features/shelf/store';
import { subscribeCompletionSyncOutboxChanges } from '@/features/today/completionsStore';

import {
  drainCatalogLookupQueue,
  maintainCatalogLookupQueue,
  subscribeCatalogLookupQueueChanges,
  type CatalogLookupQueueSchedule,
} from './catalogLookupQueue';
import { flushCompletions } from './completionQueue';
import { flushShelfMirrorQueue } from './shelfMirrorQueue';

const SHELF_RETRY_BASE_MS = 1_000;
const SHELF_RETRY_MAX_MS = 60_000;
const COMPLETION_RETRY_BASE_MS = 1_000;
const COMPLETION_RETRY_MAX_MS = 60_000;

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
    let shelfRunVersion = 0;
    let shelfRetryAttempt = 0;
    let shelfWakeTimer: ReturnType<typeof setTimeout> | null = null;
    let completionRunVersion = 0;
    let completionRetryAttempt = 0;
    let completionWakeTimer: ReturnType<typeof setTimeout> | null = null;

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

    const clearShelfWake = () => {
      if (shelfWakeTimer !== null) clearTimeout(shelfWakeTimer);
      shelfWakeTimer = null;
    };

    const clearCompletionWake = () => {
      if (completionWakeTimer !== null) clearTimeout(completionWakeTimer);
      completionWakeTimer = null;
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

    const scheduleShelfWake = (
      admittedLease: NonNullable<ReturnType<typeof activeHealthProcessingLeaseSnapshot>>,
      runVersion: number,
    ) => {
      if (
        disposed ||
        !appIsActive ||
        !onlineManager.isOnline() ||
        runVersion !== shelfRunVersion ||
        !sameLease(admittedLease)
      ) {
        return;
      }
      const delay = Math.min(
        SHELF_RETRY_BASE_MS * 2 ** Math.min(shelfRetryAttempt, 6),
        SHELF_RETRY_MAX_MS,
      );
      shelfRetryAttempt += 1;
      shelfWakeTimer = setTimeout(() => {
        shelfWakeTimer = null;
        if (
          !disposed &&
          appIsActive &&
          onlineManager.isOnline() &&
          runVersion === shelfRunVersion &&
          sameLease(admittedLease)
        ) {
          runShelf();
        }
      }, delay);
    };

    const runShelf = () => {
      const runVersion = ++shelfRunVersion;
      clearShelfWake();
      if (disposed || !appIsActive || !onlineManager.isOnline()) return;
      const admittedLease = activeHealthProcessingLeaseSnapshot();
      if (admittedLease === null || admittedLease.ownerUserId === null) return;
      void flushShelfMirrorQueue()
        .then(({ flushed, remaining, retryable }) => {
          if (
            disposed ||
            !appIsActive ||
            runVersion !== shelfRunVersion ||
            !sameLease(admittedLease)
          ) {
            return;
          }
          if (remaining > 0 && retryable) {
            if (flushed > 0) shelfRetryAttempt = 0;
            scheduleShelfWake(admittedLease, runVersion);
          } else {
            shelfRetryAttempt = 0;
          }
          if (remaining > 0) return;
          // Shelf identity is a dependency of routine completion references.
          // Attempt its FIFO first, then let the completion worker proceed
          // under the same still-current processing lease.
          runCompletions();
        })
        .catch(() => {
          if (
            disposed ||
            !appIsActive ||
            runVersion !== shelfRunVersion ||
            !sameLease(admittedLease)
          ) {
            return;
          }
          scheduleShelfWake(admittedLease, runVersion);
        });
    };

    const scheduleCompletionWake = (
      admittedLease: NonNullable<ReturnType<typeof activeHealthProcessingLeaseSnapshot>>,
      runVersion: number,
    ) => {
      if (
        disposed ||
        !appIsActive ||
        !onlineManager.isOnline() ||
        runVersion !== completionRunVersion ||
        !sameLease(admittedLease)
      ) {
        return;
      }
      const delay = Math.min(
        COMPLETION_RETRY_BASE_MS * 2 ** Math.min(completionRetryAttempt, 6),
        COMPLETION_RETRY_MAX_MS,
      );
      completionRetryAttempt += 1;
      completionWakeTimer = setTimeout(() => {
        completionWakeTimer = null;
        if (
          !disposed &&
          appIsActive &&
          onlineManager.isOnline() &&
          runVersion === completionRunVersion &&
          sameLease(admittedLease)
        ) {
          runShelf();
        }
      }, delay);
    };

    const runCompletions = () => {
      const runVersion = ++completionRunVersion;
      clearCompletionWake();
      if (disposed || !appIsActive || !onlineManager.isOnline()) return;
      const admittedLease = activeHealthProcessingLeaseSnapshot();
      if (admittedLease === null || admittedLease.ownerUserId === null) return;
      void flushCompletions()
        .then(({ flushed, remaining }) => {
          // Withdrawal, lease expiry, foreground revalidation, or an account
          // boundary may close processing while the asynchronous drain settles.
          // Never publish its completion into a later closed lifecycle.
          if (disposed || runVersion !== completionRunVersion || !sameLease(admittedLease)) {
            return;
          }
          if (flushed > 0) {
            void qc.invalidateQueries({ queryKey: ['completions'] });
            void qc.invalidateQueries({ queryKey: ['progress'] });
          }
          // The flush first promotes any timezone-blocked local evidence. This
          // query must refresh even when authentication leaves the new outbox
          // pending and `flushed` is still zero.
          void qc.invalidateQueries({ queryKey: ['completion-sync-unsynced'] });
          if (remaining > 0) {
            if (flushed > 0) completionRetryAttempt = 0;
            scheduleCompletionWake(admittedLease, runVersion);
          } else {
            completionRetryAttempt = 0;
          }
        })
        .catch(() => {
          if (!disposed && runVersion === completionRunVersion && sameLease(admittedLease)) {
            scheduleCompletionWake(admittedLease, runVersion);
          }
        });
    };

    const run = () => {
      runCatalog();
      runShelf();
    };

    const unsubscribeHealthLease = subscribeActiveHealthProcessingLeaseChanges(() => {
      catalogRunVersion += 1;
      shelfRunVersion += 1;
      shelfRetryAttempt = 0;
      completionRunVersion += 1;
      completionRetryAttempt = 0;
      clearCatalogWake();
      clearShelfWake();
      clearCompletionWake();
      if (!disposed && appIsActive) run();
    });
    run();
    const sub = AppState.addEventListener('change', (s) => {
      appIsActive = s === 'active';
      if (appIsActive) run();
      else {
        catalogRunVersion += 1;
        shelfRunVersion += 1;
        shelfRetryAttempt = 0;
        completionRunVersion += 1;
        completionRetryAttempt = 0;
        clearCatalogWake();
        clearShelfWake();
        clearCompletionWake();
      }
    });
    const unsubscribeOnline = onlineManager.subscribe((online) => {
      if (disposed || !appIsActive) return;
      shelfRunVersion += 1;
      shelfRetryAttempt = 0;
      completionRunVersion += 1;
      completionRetryAttempt = 0;
      clearShelfWake();
      clearCompletionWake();
      if (online) run();
      else runCatalog();
    });
    const unsubscribeQueue = subscribeCatalogLookupQueueChanges(() => {
      if (appIsActive) runCatalog();
    });
    const unsubscribeCompletions = subscribeCompletionSyncOutboxChanges(() => {
      completionRetryAttempt = 0;
      if (appIsActive && onlineManager.isOnline()) runShelf();
    });
    const unsubscribeShelf = subscribeShelfMirrorOutboxChanges(() => {
      shelfRetryAttempt = 0;
      if (appIsActive && onlineManager.isOnline()) runShelf();
    });
    return () => {
      disposed = true;
      catalogRunVersion += 1;
      shelfRunVersion += 1;
      completionRunVersion += 1;
      clearCatalogWake();
      clearShelfWake();
      clearCompletionWake();
      sub.remove();
      unsubscribeHealthLease();
      unsubscribeOnline();
      unsubscribeQueue();
      unsubscribeCompletions();
      unsubscribeShelf();
    };
  }, [qc]);
  return null;
}
