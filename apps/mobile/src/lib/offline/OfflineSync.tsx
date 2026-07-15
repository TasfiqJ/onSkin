import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { activeHealthProcessingLeaseSnapshot } from '@/lib/consent/healthProcessingEpoch';

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
    const run = () => {
      const admittedLease = activeHealthProcessingLeaseSnapshot();
      if (admittedLease === null || admittedLease.ownerUserId === null) return;
      void flushCompletions().then(({ flushed }) => {
        // Withdrawal, lease expiry, foreground revalidation, or an account
        // boundary may close processing while the asynchronous drain settles.
        // Never publish its completion into a later closed lifecycle.
        const currentLease = activeHealthProcessingLeaseSnapshot();
        if (
          currentLease?.generation === admittedLease.generation &&
          currentLease.epoch === admittedLease.epoch &&
          currentLease.ownerUserId === admittedLease.ownerUserId &&
          currentLease.accountGeneration === admittedLease.accountGeneration &&
          flushed > 0
        ) {
          void qc.invalidateQueries({ queryKey: ['completions'] });
          void qc.invalidateQueries({ queryKey: ['progress'] });
        }
      }).catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [qc]);
  return null;
}
