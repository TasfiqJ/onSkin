import { QueryClient } from '@tanstack/react-query';

// v1 offline/data layer (docs/01 §6): TanStack Query + optimistic updates +
// (added in the routine slice) a persisted mutation queue, so bathroom check-offs
// succeed offline and sync later. Legend-State/PowerSync deferred.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 min — local-first feel
      retry: 2,
    },
  },
});
