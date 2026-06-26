import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { flushCompletions } from './completionQueue';

// Drains the offline check-off queue (docs/01 §6) on mount and whenever the app
// returns to the foreground: a dependency-free "queue-and-retry". On a successful
// flush we refresh Today so the synced server state replaces the optimistic one.
// Renders nothing; mounted once at the app root inside the query + auth providers.
//
// The live v1 check-off path is the local-first log in completionsStore; this
// flush is the deferred server-sync half (B-SUPABASE / B-ROUTINE-PERSIST) and
// no-ops until there is a session + server routine/step ids to insert.
export function OfflineSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const run = () => {
      void flushCompletions().then(({ flushed }) => {
        if (flushed > 0) void qc.invalidateQueries({ queryKey: ['today'] });
      });
    };
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [qc]);
  return null;
}
