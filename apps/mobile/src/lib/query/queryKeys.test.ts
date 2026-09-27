import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { focusManager, onlineManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  awaitAccountGenerationLease,
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import {
  createLocalDateBoundaryStore,
  type LocalDateBoundaryIdentity,
} from './localDateBoundaryStore';
import {
  DATE_SENSITIVE_QUERY_PREFIXES,
  LOCAL_DAY_QUERY_NAMESPACE,
  OWNER_QUERY_NAMESPACE,
  createOwnerQueryScope,
  isOwnerQueryScopeCurrent,
  ownerQueryPrefixes,
  queryKeys,
  queryKeyMatchesLocalDateBoundary,
  queryPrefixes,
  runOwnerQueryOperation,
  settleOwnerQueryOperations,
  shouldRefetchCurrentLocalDayQuery,
} from './queryKeys';
import { readLocalDateBoundarySnapshot } from './queryDateBoundaryCore';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const TORONTO_DAY = {
  localDate: '2026-07-13',
  timeZone: 'America/Toronto|offset:240',
} as const;

describe('owner-scoped query keys', () => {
  it('uses a root-first opaque owner namespace and explicit local-day identity', () => {
    const scope = createOwnerQueryScope();
    const generation = scope.generation;
    const localDay = [LOCAL_DAY_QUERY_NAMESPACE, TORONTO_DAY.localDate, TORONTO_DAY.timeZone];

    expect(queryKeys.shelf(scope, TORONTO_DAY)).toEqual([
      'shelf',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
    ]);
    expect(queryKeys.progress(scope, TORONTO_DAY)).toEqual([
      'progress',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
    ]);
    expect(queryKeys.cycleAnchor(scope, TORONTO_DAY)).toEqual([
      'cycleAnchor',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
    ]);
    expect(queryKeys.cycleConfig(scope, TORONTO_DAY)).toEqual([
      'cycleConfig',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
    ]);
    expect(queryKeys.completions(scope, TORONTO_DAY)).toEqual([
      'completions',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
    ]);
    expect(queryKeys.photos(scope, TORONTO_DAY, 'front')).toEqual([
      'photos',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
      'front',
    ]);
    expect(queryKeys.ramp(scope, TORONTO_DAY, 'product-a,product-b')).toEqual([
      'ramp',
      OWNER_QUERY_NAMESPACE,
      generation,
      ...localDay,
      'product-a,product-b',
    ]);
    expect(queryKeys.entitlement(scope)).toEqual([
      'entitlement',
      OWNER_QUERY_NAMESPACE,
      generation,
    ]);
    expect(queryKeys.notificationPreferences(scope)).toEqual([
      'notifPrefs',
      OWNER_QUERY_NAMESPACE,
      generation,
    ]);
    expect(queryKeys.photoDeleteOutboxStatus(scope, 7)).toEqual([
      'photoDeleteOutboxStatus',
      OWNER_QUERY_NAMESPACE,
      generation,
      7,
    ]);
    expect(queryKeys.skinProfile(scope)).toEqual([
      'skinProfileBits',
      OWNER_QUERY_NAMESPACE,
      generation,
    ]);
    expect(queryKeys.consents(scope)).toEqual(['consents', OWNER_QUERY_NAMESPACE, generation]);
    expect(queryKeys.commerceConsent(scope)).toEqual([
      'commerceConsent',
      OWNER_QUERY_NAMESPACE,
      generation,
    ]);
    expect(queryKeys.commerceConsentWithdrawalPending(scope)).toEqual([
      'commerceConsentWithdrawalPending',
      OWNER_QUERY_NAMESPACE,
      generation,
    ]);
    expect(queryKeys.trendConsent(scope)).toEqual([
      'trendConsent',
      OWNER_QUERY_NAMESPACE,
      generation,
    ]);
    expect(queryKeys.monkBand(scope)).toEqual(['monkBand', OWNER_QUERY_NAMESPACE, generation]);
    expect(queryKeys.whereToBuy(scope, 'cleanser')).toEqual([
      'whereToBuy',
      OWNER_QUERY_NAMESPACE,
      generation,
      'cleanser',
    ]);
    expect(queryKeys.routineOrder(scope)).toEqual([
      'routineOrder',
      OWNER_QUERY_NAMESPACE,
      generation,
      'v1',
    ]);
    expect(queryKeys.askGroundedTurns(scope, '2026-07')).toEqual([
      'askGroundedTurns',
      OWNER_QUERY_NAMESPACE,
      generation,
      '2026-07',
    ]);
    expect(queryKeys.noteHelped(scope, 'note-a')).toEqual([
      'noteHelped',
      OWNER_QUERY_NAMESPACE,
      generation,
      'note-a',
    ]);
  });

  it('keeps captured scopes stable for same-user work and fails closed during a boundary', async () => {
    const before = createOwnerQueryScope();
    await runAccountGenerationOperation((lease) => lease.assertCurrent());
    expect(createOwnerQueryScope()).toEqual(before);
    expect(isOwnerQueryScopeCurrent(before)).toBe(true);

    beginAccountGenerationBoundary();
    try {
      expect(() => createOwnerQueryScope()).toThrow('ACCOUNT_GENERATION_CHANGED');
      expect(isOwnerQueryScopeCurrent(before)).toBe(false);
    } finally {
      endAccountGenerationBoundary();
    }

    const after = createOwnerQueryScope();
    expect(after.generation).toBe(before.generation + 1);
    expect(isOwnerQueryScopeCurrent(before)).toBe(false);
    expect(isOwnerQueryScopeCurrent(after)).toBe(true);
  });

  it('prevents delayed owner-A work from publishing after an account boundary', async () => {
    const scopeA = createOwnerQueryScope();
    const published: string[] = [];
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = runOwnerQueryOperation(scopeA, async (lease) => {
      markStarted();
      await gate;
      lease.assertCurrent();
      published.push('owner-a');
    });
    await started;

    beginAccountGenerationBoundary();
    try {
      release();
      await expect(pending).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
      expect(published).toEqual([]);
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('cancels siblings on the first owner-query failure and stays tracked until they acknowledge it', async () => {
    const scopeA = createOwnerQueryScope();
    let siblingSawAbort = false;
    let releaseAbortAcknowledgement!: () => void;
    const abortAcknowledged = new Promise<void>((resolve) => {
      releaseAbortAcknowledgement = resolve;
    });
    const pending = runOwnerQueryOperation(scopeA, async (lease) => {
      const operations = [
        () => Promise.reject(new Error('owner read failed')),
        (childLease: Parameters<typeof awaitAccountGenerationLease>[0]) =>
          new Promise<string>((_resolve, reject) => {
            childLease.signal.addEventListener(
              'abort',
              () => {
                siblingSawAbort = true;
                void abortAcknowledged.then(() => reject(new Error('sibling cancelled')));
              },
              { once: true },
            );
          }),
      ] as const;
      return settleOwnerQueryOperations(lease, operations);
    });
    let parentSettled = false;
    void pending.then(
      () => {
        parentSettled = true;
      },
      () => {
        parentSettled = true;
      },
    );

    await vi.waitFor(() => expect(siblingSawAbort).toBe(true));
    await Promise.resolve();
    expect(parentSettled).toBe(false);

    releaseAbortAcknowledgement();
    await expect(pending).rejects.toThrow('owner read failed');
    await waitForAccountGenerationOperationsToSettle();
    expect(parentSettled).toBe(true);
  });

  it('does not invoke deferred owner-query factories after a boundary starts', async () => {
    const scopeA = createOwnerQueryScope();
    const invoked = vi.fn();
    const pending = runOwnerQueryOperation(scopeA, (lease) =>
      settleOwnerQueryOperations(lease, [
        () => {
          invoked();
          return Promise.resolve('owner-a');
        },
      ] as const),
    );

    beginAccountGenerationBoundary();
    try {
      await waitForAccountGenerationOperationsToSettle();
      await expect(pending).rejects.toThrow('ACCOUNT_GENERATION_CHANGED');
      expect(invoked).not.toHaveBeenCalled();
    } finally {
      endAccountGenerationBoundary();
    }
  });

  it('isolates owner-prefix invalidation across a genuine account boundary', async () => {
    const client = new QueryClient();
    const scopeA = createOwnerQueryScope();
    const keyA = queryKeys.shelf(scopeA, TORONTO_DAY);

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    const scopeB = createOwnerQueryScope();
    const keyB = queryKeys.shelf(scopeB, TORONTO_DAY);
    client.setQueryData(keyA, 'owner-a');
    client.setQueryData(keyB, 'owner-b');

    await client.invalidateQueries({
      queryKey: ownerQueryPrefixes.shelf(scopeA),
      refetchType: 'none',
    });

    expect(client.getQueryState(keyA)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keyB)?.isInvalidated).toBe(false);

    await client.invalidateQueries({ queryKey: queryPrefixes.shelf, refetchType: 'none' });
    expect(client.getQueryState(keyB)?.isInvalidated).toBe(true);
    client.clear();
  });

  it('isolates every owner-only sensitive domain across generations', async () => {
    const scopeA = createOwnerQueryScope();
    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();
    const scopeB = createOwnerQueryScope();
    const domains = [
      {
        keyA: queryKeys.askConsent(scopeA),
        keyB: queryKeys.askConsent(scopeB),
        prefixA: ownerQueryPrefixes.askConsent(scopeA),
      },
      {
        keyA: queryKeys.commerceConsent(scopeA),
        keyB: queryKeys.commerceConsent(scopeB),
        prefixA: ownerQueryPrefixes.commerceConsent(scopeA),
      },
      {
        keyA: queryKeys.commerceConsentWithdrawalPending(scopeA),
        keyB: queryKeys.commerceConsentWithdrawalPending(scopeB),
        prefixA: ownerQueryPrefixes.commerceConsentWithdrawalPending(scopeA),
      },
      {
        keyA: queryKeys.consents(scopeA),
        keyB: queryKeys.consents(scopeB),
        prefixA: ownerQueryPrefixes.consents(scopeA),
      },
      {
        keyA: queryKeys.communityGate(scopeA),
        keyB: queryKeys.communityGate(scopeB),
        prefixA: ownerQueryPrefixes.communityGate(scopeA),
      },
      {
        keyA: queryKeys.cycleAnchor(scopeA, TORONTO_DAY),
        keyB: queryKeys.cycleAnchor(scopeB, TORONTO_DAY),
        prefixA: ownerQueryPrefixes.cycleAnchor(scopeA),
      },
      {
        keyA: queryKeys.cycleConfig(scopeA, TORONTO_DAY),
        keyB: queryKeys.cycleConfig(scopeB, TORONTO_DAY),
        prefixA: ownerQueryPrefixes.cycleConfig(scopeA),
      },
      {
        keyA: queryKeys.entitlement(scopeA),
        keyB: queryKeys.entitlement(scopeB),
        prefixA: ownerQueryPrefixes.entitlement(scopeA),
      },
      {
        keyA: queryKeys.monkBand(scopeA),
        keyB: queryKeys.monkBand(scopeB),
        prefixA: ownerQueryPrefixes.monkBand(scopeA),
      },
      {
        keyA: queryKeys.notificationPreferences(scopeA),
        keyB: queryKeys.notificationPreferences(scopeB),
        prefixA: ownerQueryPrefixes.notificationPreferences(scopeA),
      },
      {
        keyA: queryKeys.noteHelped(scopeA, 'note-a'),
        keyB: queryKeys.noteHelped(scopeB, 'note-a'),
        prefixA: ownerQueryPrefixes.noteHelped(scopeA),
      },
      {
        keyA: queryKeys.onboarded(scopeA),
        keyB: queryKeys.onboarded(scopeB),
        prefixA: ownerQueryPrefixes.onboarded(scopeA),
      },
      {
        keyA: queryKeys.photoDeleteOutboxStatus(scopeA, 1),
        keyB: queryKeys.photoDeleteOutboxStatus(scopeB, 1),
        prefixA: ownerQueryPrefixes.photoDeleteOutboxStatus(scopeA),
      },
      {
        keyA: queryKeys.recommendationPreferences(scopeA),
        keyB: queryKeys.recommendationPreferences(scopeB),
        prefixA: ownerQueryPrefixes.recommendationPreferences(scopeA),
      },
      {
        keyA: queryKeys.recommendationPreferencesOutboxStatus(scopeA, 1),
        keyB: queryKeys.recommendationPreferencesOutboxStatus(scopeB, 1),
        prefixA: ownerQueryPrefixes.recommendationPreferencesOutboxStatus(scopeA),
      },
      {
        keyA: queryKeys.recommendations(scopeA),
        keyB: queryKeys.recommendations(scopeB),
        prefixA: ownerQueryPrefixes.recommendations(scopeA),
      },
      {
        keyA: queryKeys.routineOrder(scopeA),
        keyB: queryKeys.routineOrder(scopeB),
        prefixA: ownerQueryPrefixes.routineOrder(scopeA),
      },
      {
        keyA: queryKeys.skinProfile(scopeA),
        keyB: queryKeys.skinProfile(scopeB),
        prefixA: ownerQueryPrefixes.skinProfile(scopeA),
      },
      {
        keyA: queryKeys.trendConsent(scopeA),
        keyB: queryKeys.trendConsent(scopeB),
        prefixA: ownerQueryPrefixes.trendConsent(scopeA),
      },
      {
        keyA: queryKeys.subscriptionOffering(scopeA),
        keyB: queryKeys.subscriptionOffering(scopeB),
        prefixA: ownerQueryPrefixes.subscriptionOffering(scopeA),
      },
    ];

    for (const { keyA, keyB, prefixA } of domains) {
      const client = new QueryClient();
      client.setQueryData(keyA, 'owner-a');
      client.setQueryData(keyB, 'owner-b');
      await client.invalidateQueries({ queryKey: prefixA, refetchType: 'none' });
      expect(client.getQueryState(keyA)?.isInvalidated).toBe(true);
      expect(client.getQueryState(keyB)?.isInvalidated).toBe(false);
      client.clear();
    }
  });

  it('rotates active query keys before broad invalidation without refetching the old day', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const scope = createOwnerQueryScope();
    const nextDay = { ...TORONTO_DAY, localDate: '2026-07-14' } as const;
    const store = createLocalDateBoundaryStore(TORONTO_DAY);
    const fetches = { oldDay: 0, nextDay: 0 };
    const optionsFor = (boundary: LocalDateBoundaryIdentity) => ({
      queryKey: queryKeys.shelf(scope, boundary),
      queryFn: async () => {
        if (boundary.localDate === TORONTO_DAY.localDate) fetches.oldDay += 1;
        else fetches.nextDay += 1;
        return boundary.localDate;
      },
    });
    const observer = new QueryObserver(client, optionsFor(store.getSnapshot()));
    const unsubscribeStore = store.subscribe(() => {
      observer.setOptions(optionsFor(store.getSnapshot()));
    });
    const unsubscribeObserver = observer.subscribe(() => undefined);

    await vi.waitFor(() => expect(fetches.oldDay).toBe(1));
    expect(store.publish(nextDay)).toBe(true);
    await client.invalidateQueries({ queryKey: queryPrefixes.shelf, refetchType: 'none' });
    await vi.waitFor(() => expect(fetches.nextDay).toBe(1));
    expect(fetches.oldDay).toBe(1);

    unsubscribeObserver();
    unsubscribeStore();
    client.clear();
  });

  it('blocks an old-day active observer from refetching on reconnect or focus', async () => {
    const currentSnapshot = readLocalDateBoundarySnapshot();
    const currentBoundary = {
      localDate: currentSnapshot.localDate,
      timeZone: currentSnapshot.timeZone,
    };
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate() - 1);
    const previousSnapshot = readLocalDateBoundarySnapshot(previousDate);
    const previousBoundary = {
      localDate: previousSnapshot.localDate,
      timeZone: previousSnapshot.timeZone,
    };
    const scope = createOwnerQueryScope();
    const oldKey = queryKeys.shelf(scope, previousBoundary);
    const currentKey = queryKeys.shelf(scope, currentBoundary);

    expect(queryKeyMatchesLocalDateBoundary(oldKey, currentBoundary)).toBe(false);
    expect(queryKeyMatchesLocalDateBoundary(currentKey, currentBoundary)).toBe(true);
    expect(shouldRefetchCurrentLocalDayQuery({ queryKey: oldKey })).toBe(false);
    expect(shouldRefetchCurrentLocalDayQuery({ queryKey: currentKey })).toBe(true);

    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.mount();
    let fetches = 0;
    const observer = new QueryObserver(client, {
      queryKey: oldKey,
      queryFn: async () => ++fetches,
      refetchOnReconnect: shouldRefetchCurrentLocalDayQuery,
      refetchOnWindowFocus: shouldRefetchCurrentLocalDayQuery,
    });
    const unsubscribe = observer.subscribe(() => undefined);

    try {
      await vi.waitFor(() => expect(fetches).toBe(1));
      await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
      focusManager.setFocused(false);
      onlineManager.setOnline(false);
      await client.invalidateQueries({ queryKey: oldKey, refetchType: 'none' });

      onlineManager.setOnline(true);
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(focusManager.isFocused()).toBe(false);
      expect(fetches).toBe(1);

      focusManager.setFocused(true);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(fetches).toBe(1);
    } finally {
      unsubscribe();
      client.unmount();
      client.clear();
      focusManager.setFocused(undefined);
      onlineManager.setOnline(true);
    }
  });

  it('blocks a current-day key from refetching after its owner generation is stale', () => {
    const snapshot = readLocalDateBoundarySnapshot();
    const boundary = { localDate: snapshot.localDate, timeZone: snapshot.timeZone };
    const scope = createOwnerQueryScope();
    const staleKey = queryKeys.shelf(scope, boundary);

    beginAccountGenerationBoundary();
    endAccountGenerationBoundary();

    expect(shouldRefetchCurrentLocalDayQuery({ queryKey: staleKey })).toBe(false);
  });

  it('registers only date-derived high-value roots for central boundary invalidation', () => {
    expect(DATE_SENSITIVE_QUERY_PREFIXES).toEqual([
      queryPrefixes.askGroundedTurns,
      queryPrefixes.completions,
      queryPrefixes.cycleAnchor,
      queryPrefixes.cycleConfig,
      queryPrefixes.photos,
      queryPrefixes.progress,
      queryPrefixes.ramp,
      queryPrefixes.shelf,
    ]);
  });

  it('wires high-value consumers to captured owner scopes and central date identity', () => {
    const read = (path: string) => readFileSync(`${SRC_DIR}/${path}`, 'utf8');
    const shelf = read('features/shelf/useShelf.ts');
    const progress = read('features/routine/useProgress.ts');
    const ramp = read('features/routine/useRamp.ts');
    const cycle = read('features/scheduler/useCycle.ts');
    const photos = read('features/photos/usePhotos.ts');
    const entitlement = read('features/subscription/useEntitlement.ts');
    const today = read('app/(tabs)/today.tsx');
    const todayViewModel = read('features/today/useTodayViewModel.ts');
    const dateBoundary = read('lib/query/queryDateBoundary.ts');
    const queryClient = read('lib/query/queryClient.ts');
    const root = read('app/_layout.tsx');

    expect(shelf).toContain('queryKeys.shelf(ownerScope, boundary)');
    expect(progress).toContain('queryKeys.progress(ownerScope, boundary)');
    expect(cycle).toContain('queryKeys.cycleConfig(ownerScope, boundary)');
    expect(photos).toContain('queryKeys.photos(ownerScope, boundary, series)');
    expect(entitlement).toContain('queryKeys.entitlement(ownerScope)');
    expect(todayViewModel).toContain('queryKeys.completions(ownerScope, boundary)');
    expect(dateBoundary).toContain("refetchType: 'none'");
    for (const source of [progress, photos]) {
      expect(source).toContain('refetchOnReconnect: (query');
      expect(source).toContain('refetchOnWindowFocus: (query');
      expect(
        source.match(
          /query\.state\.status !== 'error' && shouldRefetchCurrentLocalDayQuery\(query\)/g,
        ),
      ).toHaveLength(2);
    }
    expect(today).toContain('const boundary = useLocalDateBoundary();');
    expect(todayViewModel).toContain('refetchOnReconnect: (query) =>');
    expect(todayViewModel).toContain('refetchOnWindowFocus: (query) =>');
    expect(
      todayViewModel.match(
        /query\.state\.status !== 'error' && shouldRefetchCurrentLocalDayQuery\(query\)/g,
      ),
    ).toHaveLength(2);
    expect(shelf).toContain('refetchOnReconnect: (activeQuery) =>');
    expect(shelf).toContain('refetchOnWindowFocus: (activeQuery) =>');
    expect(
      shelf.match(
        /activeQuery\.state\.status !== 'error' && shouldRefetchCurrentLocalDayQuery\(activeQuery\)/g,
      ),
    ).toHaveLength(2);
    expect(ramp).toContain('refetchOnReconnect: (query) =>');
    expect(ramp).toContain('refetchOnWindowFocus: (query) =>');
    expect(
      ramp.match(/query\.state\.status !== 'error' && shouldRefetchCurrentLocalDayQuery\(query\)/g),
    ).toHaveLength(2);
    expect(cycle).not.toContain("AppState.addEventListener('change'");
    expect(cycle).not.toContain('millisecondsUntilNextLocalDay');
    expect(root).toContain('<QueryDateBoundaryObserver />');

    const dateBoundaryIndex = queryClient.indexOf('configureQueryDateBoundary(queryClient);');
    const lifecycleIndex = queryClient.indexOf('configureQueryLifecycle();');
    expect(dateBoundaryIndex).toBeGreaterThan(-1);
    expect(lifecycleIndex).toBeGreaterThan(dateBoundaryIndex);
  });

  it('wires residual sensitive caches and delayed mutation callbacks to owner scopes', () => {
    const read = (path: string) => readFileSync(`${SRC_DIR}/${path}`, 'utf8');
    const notifications = read('features/notifications/useNotifications.ts');
    const profile = read('features/scheduler/profile.ts');
    const you = read('app/(tabs)/you.tsx');
    const commerce = read('features/commerce/useCommerce.ts');
    const commerceConsentQuery = read('features/commerce/consentQuery.ts');
    const plan = read('features/routine/usePlan.ts');
    const reorder = read('app/routine/reorder.tsx');
    const settingsProfile = read('app/settings/skin-profile.tsx');
    const askConsent = read('app/ask/consent.tsx');
    const askConsentQuery = read('features/ask/consentQuery.ts');
    const ask = read('features/ask/useAsk.ts');
    const askGroundedTurns = read('features/ask/groundedTurnsQuery.ts');
    const recommendationPreferences = read('app/recommendations/preferences.tsx');
    const recommendations = read('features/recommendations/useRecommendations.ts');
    const recommendationInputsQuery = read('features/recommendations/recommendationInputsQuery.ts');
    const note = read('app/community/note/[id].tsx');
    const community = read('features/community/useCommunity.ts');
    const communityGateQuery = read('features/community/communityGateQuery.ts');
    const latestConsentsQuery = read('lib/consent/consentQuery.ts');
    const cycleAnchor = read('features/routine/cycleAnchor.ts');
    const onboarded = read('app/index.tsx');
    const onboardingStatusQuery = read('features/onboarding/onboardingStatusQuery.ts');
    const offering = read('features/subscription/useSubscriptionOffering.ts');

    expect(notifications).toContain('queryKeys.notificationPreferences(ownerScope)');
    expect(notifications).toContain('ownerQueryPrefixes.notificationPreferences(ownerScope)');
    expect(notifications).toContain('if (!isOwnerQueryScopeCurrent(ownerScope)) return;');
    expect(profile).toContain('queryKeys.skinProfile(ownerScope)');
    expect(you).toContain('queryKeys.consents(ownerScope)');
    expect(you).toContain('queryKeys.commerceConsent(ownerScope)');
    expect(you).toContain('queryKeys.commerceConsentWithdrawalPending(ownerScope)');
    expect(you).toContain('latestConsentsQueryOptions(ownerScope)');
    expect(you).toContain('commerceConsentQueryOptions(ownerScope)');
    expect(latestConsentsQuery).toContain('queryKeys.consents(ownerScope)');
    expect(latestConsentsQuery).toContain('runOwnerQueryOperation(ownerScope');
    expect(commerce).toContain('commerceConsentQueryOptions(ownerScope)');
    expect(commerceConsentQuery).toContain('queryKeys.commerceConsent(ownerScope)');
    expect(commerceConsentQuery).toContain('runOwnerQueryOperation(ownerScope');
    expect(plan).toContain('queryKeys.routineOrder(ownerScope)');
    expect(reorder).toContain(
      'queryClient.setQueryData(queryKeys.routineOrder(ownerScope), saved)',
    );
    expect(settingsProfile).toContain('qc.setQueryData(queryKeys.skinProfile(ownerScope), next)');
    expect(askConsent).toContain('queryKeys.askConsent(ownerScope)');
    expect(askConsent).toContain('askConsentQueryOptions(ownerScope)');
    expect(askConsentQuery).toContain('queryKeys.askConsent(ownerScope)');
    expect(askConsentQuery).toContain('runOwnerQueryOperation(ownerScope');
    expect(ask).toContain('groundedTurnsQueryOptions(ownerScope, period, trialQuotaRequired)');
    expect(askGroundedTurns).toContain('queryKeys.askGroundedTurns(ownerScope, period)');
    expect(askGroundedTurns).toContain('runOwnerQueryOperation(ownerScope');
    expect(recommendationPreferences).toContain('recommendationInputsQueryOptions(ownerScope)');
    expect(recommendations).toContain('recommendationInputsQueryOptions(ownerScope)');
    expect(recommendationInputsQuery).toContain('queryKeys.recommendations(ownerScope)');
    expect(note).toContain('queryKeys.noteHelped(ownerScope, id)');
    expect(community).toContain('communityGateQueryOptions(ownerScope)');
    expect(communityGateQuery).toContain('queryKeys.communityGate(ownerScope)');
    expect(communityGateQuery).toContain('runOwnerQueryOperation(ownerScope');
    expect(cycleAnchor).toContain('queryKeys.cycleAnchor(ownerScope, boundary)');
    expect(onboarded).toContain('onboardingStatusQueryOptions(ownerScope)');
    expect(onboardingStatusQuery).toContain('queryKeys.onboarded(ownerScope)');
    expect(onboardingStatusQuery).toContain('runOwnerQueryOperation(ownerScope');
    expect(offering).toContain('queryKeys.subscriptionOffering(ownerScope)');
    expect(offering).not.toContain("user?.id ?? 'anonymous'");

    for (const source of [
      notifications,
      profile,
      you,
      commerce,
      commerceConsentQuery,
      plan,
      reorder,
      askConsent,
      askConsentQuery,
      ask,
      recommendationPreferences,
      recommendations,
      recommendationInputsQuery,
      note,
      community,
      communityGateQuery,
      latestConsentsQuery,
      cycleAnchor,
      onboarded,
      onboardingStatusQuery,
      offering,
    ]) {
      expect(source).not.toMatch(
        /queryKey:\s*\['(?:notifPrefs|skinProfileBits|consents|commerceConsent|trendConsent|monkBand|routineOrder|ask_onskin|askGroundedTurns|recPreferences|recPrefsAndDismissed|noteHelped|communityGate|cycleAnchor|onboarded|subscription-offering)'/,
      );
    }
  });
});
