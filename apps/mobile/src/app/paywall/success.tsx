import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, View, useWindowDimensions } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { PAYWALL_COPY } from '@/features/subscription/copy';
import type { SubscriptionState } from '@/features/subscription/entitlement';
import {
  admittedSuccessState,
  monotonicSuccessClockMs,
  successEvidenceBoundaryMs,
} from '@/features/subscription/successAdmission';
import { buildPaywallSuccessPresentation } from '@/features/subscription/successPresentation';
import { useEntitlement } from '@/features/subscription/useEntitlement';
import { useAuth } from '@/lib/auth/AuthProvider';
import { colors } from '@/theme/tokens';

// Purchase success (design 05, docs/08 §3.3). A calm confirmation with honest
// renewal terms, routing straight into the value (Day-0 is decisive). The copy
// branches on whether this is a carded TRIAL (14 days, will convert) or an
// immediate PAID entitlement (win-back / direct buy, no trial), so we never tell a
// paid win-back user they are in a free trial that will convert. Direct or stale
// navigation cannot invent either state: the confirmation mounts only from
// current active entitlement evidence with an exact end date.
function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function SuccessScreen() {
  const entitlement = useEntitlement({ refetchOnMount: 'always' });
  const { data, dataUpdatedAt, refetch } = entitlement;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const clockRef = useRef(nowMs);
  // A response can complete after the clock captured at mount. Query's update
  // timestamp advances on that response without making render impure, so stale
  // delayed evidence cannot be admitted before the scheduling effect runs.
  const liveNowMs = monotonicSuccessClockMs(nowMs, dataUpdatedAt);
  const confirmedState = admittedSuccessState(entitlement, liveNowMs);
  const evidenceBoundaryMs = successEvidenceBoundaryMs(data);

  useEffect(() => {
    const observedNowMs = Date.now();
    const schedulingNowMs = monotonicSuccessClockMs(clockRef.current, observedNowMs);
    clockRef.current = schedulingNowMs;
    const boundaryMs = evidenceBoundaryMs;
    if (boundaryMs === null) return;
    const remainingMs = boundaryMs - schedulingNowMs;
    if (remainingMs <= 0) return;
    const timer = setTimeout(
      () => {
        setNowMs((current) => {
          const advanced = monotonicSuccessClockMs(current, Math.max(Date.now(), boundaryMs + 1));
          clockRef.current = advanced;
          return advanced;
        });
        void refetch();
      },
      Math.min(remainingMs + 25, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [evidenceBoundaryMs, refetch]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      setNowMs((current) => {
        const advanced = monotonicSuccessClockMs(current, Date.now());
        clockRef.current = advanced;
        return advanced;
      });
      void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  if (!confirmedState) {
    const checking =
      !entitlement.isError &&
      (entitlement.isLoading || entitlement.isFetching || !entitlement.isFetchedAfterMount);
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center px-2">
          <Text variant="title" className="text-center">
            {checking ? 'Confirming Pro access' : 'Pro access not confirmed'}
          </Text>
          <Text
            variant="body"
            tone="muted"
            className="mt-3 text-center"
            accessibilityRole={checking ? undefined : 'alert'}
            style={{ lineHeight: 24, maxWidth: 330 }}
          >
            {checking
              ? 'We will show purchase details only after active access is verified.'
              : 'We did not find active Pro access for this account. This page did not charge you or unlock Pro.'}
          </Text>
        </View>
        <View className="gap-2 pb-4">
          <Button
            label={checking ? 'Checking access...' : 'Check access again'}
            disabled={checking}
            onPress={() => void refetch()}
          />
          <Button
            label="Subscription options"
            variant="ghost"
            onPress={() => router.replace('/settings/subscription')}
          />
        </View>
      </Screen>
    );
  }

  return <ConfirmedSuccessScreen state={confirmedState} />;
}

function ConfirmedSuccessScreen({ state }: { state: SubscriptionState }) {
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const compactPhone = height < 640;
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(' ')[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    null;

  const endDate = fmt(state.expiresAt!);
  const presentation = buildPaywallSuccessPresentation(state, endDate);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center">
        <View
          className="mb-7 h-[72px] w-[72px] items-center justify-center rounded-full"
          style={{ backgroundColor: colors.clay }}
        >
          <Text
            style={{
              color: colors.paper,
              fontSize: 34,
              includeFontPadding: false,
              lineHeight: 38,
              textAlign: 'center',
            }}
          >
            {'\u2713'}
          </Text>
        </View>
        <Text variant="display" className="text-center" style={{ fontSize: 42, lineHeight: 45 }}>
          {PAYWALL_COPY.success.titleFor(firstName)}
        </Text>
        <Text
          variant="body"
          tone="muted"
          className="mt-3.5 text-center"
          style={{ lineHeight: 25, maxWidth: 320 }}
        >
          {presentation.body}
        </Text>
        <View
          className="mt-4 w-full max-w-[272px] rounded-card px-4 py-3"
          style={{ backgroundColor: colors.greige, borderColor: colors.hairline, borderWidth: 1 }}
        >
          {presentation.metaRows.map((row) => (
            <Text
              key={row}
              variant="label"
              tone="muted"
              className="text-center"
              style={{ lineHeight: 18 }}
            >
              {row}
            </Text>
          ))}
        </View>
      </View>
      <View className={compactPhone ? 'pb-4' : 'pb-2'}>
        <Button label={PAYWALL_COPY.success.cta} onPress={() => router.replace('/(tabs)/today')} />
      </View>
    </Screen>
  );
}
