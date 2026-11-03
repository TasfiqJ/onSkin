import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import {
  assertOriginalHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { colors } from '@/theme/tokens';

import {
  loadPlanHistory45,
  PLAN_HISTORY45_CAPACITY,
  savePlanHistory45,
} from './planHistory45';
import type { PlanSourceSnapshot44 } from './planSourceFence44';
import type { RecoverablePlanHookResult } from './usePlan';

type SaveAttempt45 = {
  lease: HealthDataWriteLease;
  snapshot: PlanSourceSnapshot44;
  request: Readonly<{ id: string; createdAt: string }>;
  status: 'saving' | 'failed' | 'conflict' | 'capacity' | 'saved';
};

const sourceLeaseIds = new WeakMap<HealthDataWriteLease, number>();
let nextSourceLeaseId = 0;
function sourceLeaseId(lease: HealthDataWriteLease | undefined): number | 'closed' {
  if (!lease) return 'closed';
  let id = sourceLeaseIds.get(lease);
  if (id === undefined) {
    id = ++nextSourceLeaseId;
    sourceLeaseIds.set(lease, id);
  }
  return id;
}

function authorityCurrent(lease: HealthDataWriteLease | undefined): lease is HealthDataWriteLease {
  if (!lease) return false;
  try {
    assertOriginalHealthDataWriteLease(lease);
    return true;
  } catch {
    return false;
  }
}

function shownFacts(source: RecoverablePlanHookResult): string {
  return JSON.stringify(['am', 'pm'].map((phase) =>
    source.data?.plan[phase as 'am' | 'pm'].map(({ productId, name }) => ({ productId, name })),
  ));
}

function snapshotMatches(snapshot: PlanSourceSnapshot44, source: RecoverablePlanHookResult): boolean {
  return JSON.stringify([snapshot.am, snapshot.pm]) === shownFacts(source);
}

function sourceCurrent(source: RecoverablePlanHookResult, canSave: boolean): boolean {
  return canSave && !source.isExample && source.data?.isExample === false &&
    source.data.activeProductIds.length > 0 && source.sourceReady &&
    source.data.plan.am.length + source.data.plan.pm.length > 0 &&
    !source.isLoading && !source.isRefreshing && !source.isError && source.isSourceCurrent();
}

/** Dated local facts only; neither mounting nor reading appends a version. */
function PlanHistoryForLease45({
  source,
  canSave,
}: {
  source: RecoverablePlanHookResult;
  canSave: boolean;
}) {
  const client = useQueryClient();
  const lease = source.orderLease;
  const admitted = authorityCurrent(lease);
  const ready = admitted && sourceCurrent(source, canSave);
  const [captureRevision, setCaptureRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [preparationFailed, setPreparationFailed] = useState(false);
  const [attempt, setAttempt] = useState<SaveAttempt45 | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const mounted = useRef(false);
  const pending = useRef<object | null>(null);
  const randomId = useRef<(() => string) | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    pending.current = null;
    randomId.current = null;
    return () => {
      mounted.current = false;
      pending.current = null;
    };
  }, [lease]);

  // Include the complete authority tuple; no predecessor query can supply a
  // successor render, including an A-to-B-to-A or same-owner regrant.
  const scope = lease ? [lease.ownerUserId, lease.accountGeneration, lease.epoch,
    lease.generation, lease.expiresAt] : ['closed'];
  const historyKey = ['planHistory45', ...scope] as const;
  const history = useQuery({
    queryKey: historyKey,
    enabled: admitted,
    retry: false,
    networkMode: 'always',
    staleTime: Infinity,
    structuralSharing: false,
    queryFn: async () => {
      if (!authorityCurrent(lease)) throw new Error('PLAN_HISTORY45_AUTHORITY_CLOSED');
      return loadPlanHistory45(lease);
    },
  });
  const capture = useQuery({
    queryKey: ['planHistorySource45', ...scope, sourceLeaseId(lease), shownFacts(source), captureRevision],
    enabled: ready,
    retry: false,
    networkMode: 'always',
    staleTime: Infinity,
    // C44's proof belongs to the EXACT returned object, never a Query merge.
    structuralSharing: false,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!authorityCurrent(lease) || !sourceCurrent(source, canSave)) {
        throw new Error('PLAN_SOURCE44_STALE');
      }
      // Native adapters load only for an admitted current source. Closed
      // history-only screens do not initialize the Shelf/capture dependency.
      const [{ capturePlanSource44 }, crypto] = await Promise.all([
        import('./planSourceFence44'), import('expo-crypto'),
      ]);
      if (!authorityCurrent(lease) || !sourceCurrent(source, canSave)) {
        throw new Error('PLAN_SOURCE44_STALE');
      }
      const snapshot = await capturePlanSource44(lease);
      if (!authorityCurrent(lease) || !sourceCurrent(source, canSave) ||
          !snapshotMatches(snapshot, source)) throw new Error('PLAN_SOURCE44_STALE');
      randomId.current = () => crypto.randomUUID();
      return snapshot;
    },
  });
  const visibleAttempt = admitted && attempt?.lease === lease ? attempt : null;
  const saving = visibleAttempt?.status === 'saving';
  const committed = admitted && !history.isError && !history.isFetching &&
    history.data?.ownerUserId === lease.ownerUserId ? history.data : undefined;
  const atCapacity = (committed?.versions.length ?? 0) >= PLAN_HISTORY45_CAPACITY ||
    visibleAttempt?.status === 'capacity';
  const snapshot = !capture.isError && !capture.isFetching ? capture.data : undefined;
  const saveReady = ready && committed !== undefined && snapshot !== undefined &&
    snapshotMatches(snapshot, source) && !refreshing && !saving;

  async function save(retryAttempt?: SaveAttempt45) {
    if (pending.current || !mounted.current || !authorityCurrent(lease) ||
        !sourceCurrent(source, canSave) || !committed || !randomId.current) return;
    const original = retryAttempt?.snapshot ?? snapshot;
    if (!original || !snapshotMatches(original, source) ||
        (retryAttempt && retryAttempt.lease !== lease) || (!retryAttempt && atCapacity)) return;
    const operation = {};
    pending.current = operation;
    let next: SaveAttempt45;
    try {
      next = retryAttempt ?? {
        lease,
        snapshot: original,
        request: Object.freeze({ id: randomId.current(), createdAt: new Date().toISOString() }),
        status: 'saving',
      };
    } catch {
      pending.current = null;
      setPreparationFailed(true);
      return;
    }
    setPreparationFailed(false);
    setAttempt({ ...next, status: 'saving' });
    try {
      const saved = await savePlanHistory45(original, lease, next.request);
      if (!mounted.current || pending.current !== operation || !authorityCurrent(lease)) return;
      // Domain success includes the native encrypted canonical readback. Do not
      // use a subsequent unlocked read or a cache event to certify persistence.
      client.setQueryData(historyKey, saved);
      setAttempt({ ...next, status: 'saved' });
    } catch (error) {
      if (!mounted.current || pending.current !== operation || !authorityCurrent(lease)) return;
      const code = error instanceof Error ? error.message : '';
      setAttempt({ ...next, status: /CAPACITY/.test(code) ? 'capacity' : /STALE|CONFLICT/.test(code) ? 'conflict' : 'failed' });
    } finally {
      if (pending.current === operation) pending.current = null;
    }
  }

  async function refreshPlan() {
    if (pending.current || !mounted.current || !authorityCurrent(lease)) return;
    const operation = {};
    pending.current = operation;
    setRefreshing(true);
    setRefreshFailed(false);
    try {
      await source.retry();
      if (!mounted.current || pending.current !== operation || !authorityCurrent(lease)) return;
      setAttempt(null);
      // The next render captures under its freshly confirmed source. This does
      // not save, refresh a lease, or substitute a plan in the old Save request.
      setCaptureRevision((value) => value + 1);
    } catch {
      if (mounted.current && pending.current === operation && authorityCurrent(lease)) {
        setRefreshFailed(true);
      }
    } finally {
      if (mounted.current && pending.current === operation) setRefreshing(false);
      if (pending.current === operation) pending.current = null;
    }
  }

  return (
    <View className="mt-4 gap-3 rounded-[22px] border border-hairline bg-paper-raised p-4">
      <Text accessibilityRole="header" className="font-sans-semibold text-[18px]">Saved plans</Text>
      <Text variant="bodySm" tone="muted">
        Dated snapshots of your products and order, not current advice. Saved only on this device.
      </Text>
      {!admitted ? (
        <Text variant="bodySm" tone="muted">Your current account and health consent are required to view or save plans.</Text>
      ) : (
        <>
          <Button
            label={saving ? 'Saving plan…' : 'Save this plan'}
            variant="inverse"
            disabled={!saveReady || atCapacity}
            onPress={() => void save()}
          />
          {!ready ? <Text variant="bodySm" tone="muted">Saving needs a confirmed local profile and a current plan with products from your active Shelf.</Text> : null}
          {ready && capture.isFetching ? <Text variant="bodySm" tone="muted">Confirming this plan for saving…</Text> : null}
          <View accessibilityLiveRegion="polite">
            {visibleAttempt?.status === 'saved' ? <Text variant="bodySm">Plan saved on this device.</Text> : null}
            {preparationFailed ? <Text variant="bodySm" accessibilityRole="alert">This plan could not be prepared for saving. Try again.</Text> : null}
            {visibleAttempt?.status === 'conflict' || capture.isError ? (
              <Text variant="bodySm" accessibilityRole="alert">Your plan could not be confirmed. Refresh it, review the current plan, then save again.</Text>
            ) : null}
            {visibleAttempt?.status === 'failed' ? (
              <>
                <Text variant="bodySm" accessibilityRole="alert">We could not confirm this save. Retry the same save or refresh your plan.</Text>
                <Button label="Retry same save" variant="ghost" disabled={!saveReady} onPress={() => void save(visibleAttempt)} />
              </>
            ) : null}
            {atCapacity ? <Text variant="bodySm">This device has reached its limit of {PLAN_HISTORY45_CAPACITY} saved plans. Existing snapshots are kept unchanged.</Text> : null}
            {refreshFailed ? <Text variant="bodySm" accessibilityRole="alert">Your plan could not be refreshed. Try again.</Text> : null}
          </View>
          {(capture.isError || visibleAttempt?.status === 'conflict' || visibleAttempt?.status === 'failed' || refreshFailed) ? (
            <Button label={refreshing ? 'Refreshing plan…' : 'Refresh plan'} variant="ghost" disabled={refreshing || saving} onPress={() => void refreshPlan()} />
          ) : null}
          {history.isFetching ? <Text variant="bodySm" tone="muted">Loading saved plans…</Text> : history.isError ? (
            <>
              <Text variant="bodySm" accessibilityRole="alert">Saved plans are unavailable. No saved records have been replaced.</Text>
              <Button label="Retry saved plans" variant="ghost" onPress={() => void history.refetch()} />
            </>
          ) : committed?.versions.length === 0 ? <Text variant="bodySm" tone="muted">No saved plans yet.</Text> : committed ? (
            <>
              {[...committed.versions].reverse().slice(0, visibleCount).map((version) => (
                <View key={version.id} className="border-t border-hairline pt-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Saved plan ${version.sequence}, ${version.createdAt}`}
                    accessibilityState={{ expanded: expanded === version.id }}
                    onPress={() => { if (authorityCurrent(lease)) setExpanded(expanded === version.id ? null : version.id); }}
                    className="min-h-[48px] justify-center py-2"
                  >
                    <Text className="font-sans-semibold text-[14px]" style={{ color: colors.clayDeep }}>Plan {version.sequence} · {version.createdAt.slice(0, 10)}</Text>
                    <Text variant="bodySm" tone="muted">Saved {version.createdAt.slice(11, 19)} UTC · {expanded === version.id ? 'Hide details' : 'View snapshot'}</Text>
                  </Pressable>
                  {expanded === version.id ? (
                    <View className="gap-2 pb-2">
                      {(['am', 'pm'] as const).map((phase) => (
                        <View key={phase}>
                          <Text className="font-sans-semibold text-[14px]">{phase === 'am' ? 'Morning snapshot' : 'Evening snapshot'}</Text>
                          {version[phase].length === 0 ? <Text variant="bodySm" tone="muted">No products saved in this phase.</Text> : version[phase].map((step, index) => (
                            <Text key={step.productId} variant="bodySm">{index + 1}. {step.name}</Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
              {committed.versions.length > visibleCount ? <Button label="Show more saved plans" variant="ghost" onPress={() => { if (authorityCurrent(lease)) setVisibleCount((value) => Math.min(value + 5, PLAN_HISTORY45_CAPACITY)); }} /> : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

export function PlanHistoryPanel45(props: {
  source: RecoverablePlanHookResult;
  canSave: boolean;
}) {
  // Reset attempts/details at the authority boundary before rendering a new
  // owner, including a same-owner original-lease replacement.
  return <PlanHistoryForLease45 key={sourceLeaseId(props.source.orderLease)} {...props} />;
}
