import { QueryClient } from '@tanstack/react-query';

import { configureQueryDateBoundary } from './queryDateBoundary';
import { configureQueryLifecycle } from './queryLifecycle';
import { queryClientDefaultPolicy } from './queryPolicies';

// v1 data layer (docs/01 §6): TanStack Query + optimistic updates. The persisted
// offline write queue for bathroom check-offs (so they succeed offline and sync
// later) lives in lib/offline/completionQueue.ts and is drained by lib/offline/
// OfflineSync.tsx on foreground. Read-side offline persistence (persistQueryClient)
// and Legend-State/PowerSync remain deferred upgrades.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: queryClientDefaultPolicy,
  },
});

configureQueryDateBoundary(queryClient);
configureQueryLifecycle();
