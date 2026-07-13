import { describe, expect, it } from 'vitest';

import { OWNER_QUERY_NAMESPACE, type OwnerQueryScope } from '@/lib/query/queryKeys';

import { commitCycleConfigForOwner } from './cycleMutationCoordinator';
import type { CycleConfig } from './cycleStore';

const SCOPE: OwnerQueryScope = { generation: 7 };
const CONFIG = {
  schemaVersion: 1,
  variant: 'classic',
  anchorISO: '2026-07-13',
  pausedFrom: null,
  pauseReason: null,
  recovery: null,
  skips: [],
  stagingOverrides: [],
  customCycle: null,
} satisfies CycleConfig;

describe('cycle mutation cache publication', () => {
  it('publishes to the boundary observed after a mutation spanning midnight', async () => {
    let boundary = {
      localDate: '2026-07-13',
      timeZone: 'America/Toronto|offset:240',
    };
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const published: { key: readonly unknown[]; value: CycleConfig }[] = [];

    const pending = commitCycleConfigForOwner({
      cancel: async () => {},
      isOwnerCurrent: () => true,
      operation: async () => {
        await gate;
        return CONFIG;
      },
      publish: (key, value) => published.push({ key, value }),
      readBoundary: () => boundary,
      scope: SCOPE,
    });

    boundary = {
      localDate: '2026-07-14',
      timeZone: 'America/Toronto|offset:240',
    };
    release();
    await pending;

    expect(published).toEqual([
      {
        key: [
          'cycleConfig',
          OWNER_QUERY_NAMESPACE,
          SCOPE.generation,
          'local-day',
          '2026-07-14',
          'America/Toronto|offset:240',
        ],
        value: CONFIG,
      },
    ]);
  });

  it('does not publish after its captured owner becomes stale', async () => {
    const published: unknown[] = [];

    await commitCycleConfigForOwner({
      cancel: async () => {},
      isOwnerCurrent: () => false,
      operation: async () => CONFIG,
      publish: (...args) => published.push(args),
      scope: SCOPE,
    });

    expect(published).toEqual([]);
  });
});
