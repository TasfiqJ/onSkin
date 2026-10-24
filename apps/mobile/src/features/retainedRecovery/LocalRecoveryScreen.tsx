import { router, useFocusEffect, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { useRoutineClock } from '@/features/today/useRoutineClock';
import { subscribeShelfMirrorOutboxChanges } from '@/features/shelf/store';
import { subscribeCompletionSyncOutboxChanges } from '@/features/today/completionsStore';
import { subscribePhotoDeleteChanges } from '@/features/photos/photoDeleteJournal';
import { captureHealthDataWriteLease, assertHealthDataWriteLease, type HealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';
import { activeHealthProcessingLeaseSnapshot, subscribeActiveHealthProcessingLeaseChanges } from '@/lib/consent/healthProcessingEpoch';
import { APP_YOU_ROUTE, backOrReplace } from '@/lib/navigation/safeBack';

import { LocalRecoveryAccessClosed, readLocalRecoveryEvidence, RECOVERY_DOMAINS, type LocalEvidence, type RecoveryDomain } from './localEvidence';

const LABELS = {
  saved: 'Saved on this device', needs_confirmation: 'Needs confirmation', unavailable: 'Unavailable',
  not_configured: 'Not configured', no_pending_cleanup: 'No pending cleanup',
};
const DOMAINS: Record<RecoveryDomain, { title: string; route: Href; action: string }> = {
  shelf: { title: 'Shelf', route: '/(tabs)/shelf', action: 'Open Shelf' },
  today: { title: 'Today check-offs', route: '/(tabs)/today', action: 'Open Today' },
  reminders: { title: 'Reminder choices', route: '/settings/notifications', action: 'Review reminder setup' },
  photoCleanup: { title: 'Photo cleanup', route: '/(tabs)/progress', action: 'Review photo cleanup in Progress' },
};
const EMPTY = { shelf: null, today: null, reminders: null, photoCleanup: null };

function LocalRecoveryPanel({ accepted, day, onRetryAccess }: {
  accepted: HealthDataWriteLease; day: string; onRetryAccess: () => void;
}) {
  const [evidence, setEvidence] = useState<Record<RecoveryDomain, LocalEvidence | null>>(EMPTY);
  const [closed, setClosed] = useState(false);
  const queryClient = useQueryClient();
  const mounted = useRef(false);
  const flights = useRef(new Map<RecoveryDomain, Promise<void>>());
  const revisions = useRef({ shelf: 0, today: 0, reminders: 0, photoCleanup: 0 });
  const retry = useCallback((domain: RecoveryDomain): Promise<void> => {
    const existing = flights.current.get(domain);
    if (existing) return existing;
    if (!mounted.current) return Promise.resolve();
    try { assertHealthDataWriteLease(accepted); } catch { return Promise.resolve(); }
    const pending = Promise.resolve().then(async () => {
      let revision: number;
      do {
        revision = revisions.current[domain];
        if (!mounted.current) return;
        try {
          assertHealthDataWriteLease(accepted);
          setEvidence(previous => ({ ...previous, [domain]: null }));
          const next = await readLocalRecoveryEvidence(domain, day, accepted);
          assertHealthDataWriteLease(accepted);
          if (mounted.current && revisions.current[domain] === revision) setEvidence(previous => ({ ...previous, [domain]: next }));
        } catch (error) {
          try { assertHealthDataWriteLease(accepted); } catch { return; }
          if (!mounted.current) return;
          if (error instanceof LocalRecoveryAccessClosed) { setClosed(true); return; }
          if (revisions.current[domain] === revision) setEvidence(previous => ({ ...previous, [domain]: {
            status: 'unavailable', message: 'Device records could not be read. Try checking again or open the feature’s recovery controls.',
          } }));
        }
        // A feature-owned change signal retires a pre-write read. Coalesce
        // signals and reread, without ever publishing that older snapshot.
      } while (mounted.current && revisions.current[domain] !== revision);
    }).finally(() => {
      if (flights.current.get(domain) === pending) flights.current.delete(domain);
    });
    flights.current.set(domain, pending);
    return pending;
  }, [accepted, day]);
  useEffect(() => {
    mounted.current = true;
    const changed = (domain: RecoveryDomain) => {
      if (!mounted.current) return;
      try { assertHealthDataWriteLease(accepted); } catch { return; }
      revisions.current[domain] += 1;
      setEvidence(previous => ({ ...previous, [domain]: null }));
      void retry(domain);
    };
    const unsubscribe = [
      subscribeShelfMirrorOutboxChanges(() => changed('shelf')),
      subscribeCompletionSyncOutboxChanges(() => changed('today')),
      subscribePhotoDeleteChanges(() => changed('photoCleanup')),
      queryClient.getQueryCache().subscribe(event => {
        if (event.type !== 'updated') return;
        if (event.query.queryKey[0] === 'notifPrefs') changed('reminders');
        if (event.query.queryKey[0] === 'progress') changed('today');
      }),
    ];
    for (const domain of RECOVERY_DOMAINS) void retry(domain);
    return () => { mounted.current = false; for (const stop of unsubscribe) stop(); };
  }, [accepted, queryClient, retry]);
  if (closed) return (
    <View accessibilityRole="alert" className="rounded-card bg-paper-raised p-4">
      <Text variant="body">Local recovery is unavailable until your age, consent, and account checks are current.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Check local recovery access again"
        onPress={onRetryAccess} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text variant="bodySm" className="font-sans-semibold">Check access again</Text>
      </Pressable>
    </View>
  );
  return RECOVERY_DOMAINS.map(domain => {
    const row = DOMAINS[domain];
    const result = evidence[domain];
    const checking = result === null;
    return (
      <View key={domain} className="mb-4 rounded-card bg-paper-raised p-4" accessibilityState={{ busy: checking }}>
        <Text variant="label">{row.title}</Text>
        <View accessibilityLiveRegion="polite" accessibilityRole={result?.status === 'unavailable' ? 'alert' : undefined}>
          <Text variant="body" className="mt-1 font-sans-semibold">{result ? LABELS[result.status] : 'Checking device…'}</Text>
          <Text variant="bodySm" tone="muted" className="mt-2">{result?.message ?? 'Reading existing local evidence.'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Check ${row.title} again`}
          accessibilityState={{ disabled: checking, busy: checking }} disabled={checking}
          onPress={() => { void retry(domain); }} style={{ minHeight: 48, justifyContent: 'center', marginTop: 8 }}>
          <Text variant="bodySm" className="font-sans-semibold">{checking ? 'Checking…' : 'Check again'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={row.action}
          onPress={() => { try { assertHealthDataWriteLease(accepted); router.push(row.route); } catch { /* retired view */ } }}
          style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text variant="bodySm" className="font-sans-semibold">{row.action}</Text>
        </Pressable>
      </View>
    );
  });
}

export default function LocalRecoveryScreen() {
  const published = useSyncExternalStore(subscribeActiveHealthProcessingLeaseChanges, activeHealthProcessingLeaseSnapshot, () => null);
  const [, checkExpiry] = useState(0);
  const [focused, setFocused] = useState(false);
  const [visit, setVisit] = useState(0);
  const clock = useRoutineClock();
  const day = clock.localDate;
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    if (published?.expiresAt == null) return;
    const timer = setTimeout(() => checkExpiry(value => value + 1), Math.max(0, published.expiresAt - Date.now()) + 1);
    return () => clearTimeout(timer);
  }, [published]);
  const accepted = useMemo(() => {
    if (!published) return null;
    try { return captureHealthDataWriteLease(); } catch { return null; }
  }, [published]);
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-4 flex-row items-center gap-3 pt-2">
          <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router, APP_YOU_ROUTE)} />
          <Text variant="title" style={{ flexShrink: 1 }}>Local recovery</Text>
        </View>
        <Text variant="bodySm" tone="muted" className="mb-4">
          Check what can be read on this device. Cloud status not verified. Each feature keeps its own recovery controls.
        </Text>
        {focused && accepted ? <LocalRecoveryPanel key={`${accepted.generation}:${clock.now.getTime()}:${visit}`}
          accepted={accepted} day={day} onRetryAccess={() => setVisit(value => value + 1)} /> : (
          <Text variant="bodySm">Local recovery is unavailable until your age, consent, and account checks are current.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}
