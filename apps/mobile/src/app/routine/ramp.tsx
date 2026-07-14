import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { useRamp } from '@/features/routine/useRamp';
import { track } from '@/lib/analytics/track';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// Retinoid ramp offer flow (docs/03 section 4). The app only ever offers a
// step-up, never auto-escalates, and de-escalates on reported irritation.
// Now driven by the persisted ramp state (useRamp): the target, the offer gate
// (shouldOfferStepUp), and the accept action are real; the chart is the design's
// illustrative nights-per-week ramp.
const BARS = [
  { label: 'wk1', height: 46, color: '#E3D8C9', striped: false, accent: false },
  { label: 'wk2', height: 46, color: '#E3D8C9', striped: false, accent: false },
  { label: 'wk3', height: 46, color: colors.clayBright, striped: false, accent: false },
  { label: 'now', height: 72, color: colors.clay, striped: false, accent: true },
  { label: 'next?', height: 72, color: 'transparent', striped: true, accent: false },
];

export default function RampScreen() {
  const { items, isLoading, isError, isFetching, retry, acceptStepUp } = useRamp();
  // The primary ramping active (first retinoid/exfoliant). The screen paces one at a time.
  const item = items[0] ?? null;
  const state = item?.state ?? null;
  const paused = state?.toleranceState === 'paused_irritation';
  const [accepting, setAccepting] = useState(false);
  const [acceptFailed, setAcceptFailed] = useState(false);

  useEffect(() => {
    if (item?.offerStepUp) track('ramp_step_up_offered', { source: 'routine_ramp' });
  }, [item?.offerStepUp, item?.productId]);

  async function acceptOfferedStepUp() {
    if (!item || accepting) return;
    setAccepting(true);
    setAcceptFailed(false);
    try {
      await acceptStepUp(item.productId);
      track('ramp_step_up_accepted', { source: 'routine_ramp' });
      backOrReplace(router);
    } catch {
      setAcceptFailed(true);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center">
        <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router)} />
      </View>
      <View className="flex-1 pt-4">
        <Text variant="label" tone="clay" className="font-mono">
          RETINOID · RAMP-UP
        </Text>
        <Text variant="title" className="mt-2 text-[32px] leading-[35px]">
          Low and slow, on your terms.
        </Text>
        <Text variant="bodySm" tone="muted" className="mt-1.5 text-[14px]">
          Consistency matters more than frequency. We only ever{' '}
          <Text variant="bodySm" italic tone="muted">
            offer
          </Text>{' '}
          a step-up. Never increase it for you.
        </Text>

        {isError ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            className="mt-6 rounded-[22px] bg-paper-raised p-5"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <Text variant="body" className="font-sans-semibold">
              Ramp progress unavailable
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-1.5 text-[13.5px] leading-5">
              Your saved pace wasn&apos;t reset. Step-ups are paused until OnSkin can read it
              safely.
            </Text>
            <Pressable
              accessibilityLabel="Retry loading ramp progress"
              accessibilityRole="button"
              accessibilityState={{ disabled: isFetching }}
              disabled={isFetching}
              className="mt-4 min-h-[48px] items-center justify-center rounded-pill bg-ink px-5 py-3"
              style={{ opacity: isFetching ? 0.5 : 1 }}
              onPress={() => void retry()}
            >
              <Text className="font-sans-semibold text-[15px]" style={{ color: colors.paper }}>
                {isFetching ? 'Trying...' : 'Try again'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!item && !isLoading && !isError ? (
          <View
            className="mt-6 rounded-[22px] bg-paper-raised p-5"
            style={{ borderWidth: 1, borderColor: colors.hairline }}
          >
            <Text variant="body" tone="muted" className="text-[14px]">
              No actives are ramping yet. Add a retinoid or an acid to your shelf and we&apos;ll
              pace it gently.
            </Text>
          </View>
        ) : null}

        {item && state ? (
          <>
            {/* Ramp chart card (illustrative nights-per-week ramp toward the real target) */}
            <View
              className="mt-6 rounded-[22px] bg-paper-raised p-5"
              style={{ borderWidth: 1, borderColor: colors.hairline }}
            >
              <View className="mb-4 flex-row items-center justify-between">
                <Text variant="body" className="font-sans-bold text-[14px]">
                  Nights per week
                </Text>
                <Text variant="label" tone="muted" className="font-mono">
                  {state.freqPerWeek} of {state.targetPerWeek}
                </Text>
              </View>
              <View className="h-[108px] flex-row items-end gap-2.5">
                {BARS.map((b) => (
                  <View key={b.label} className="flex-1 items-center">
                    <View
                      className="w-full rounded-md"
                      style={{
                        height: b.height,
                        backgroundColor: b.striped ? '#F1ECE3' : b.color,
                        ...(b.striped
                          ? {
                              borderWidth: 1.5,
                              borderColor: 'rgba(165,105,75,0.4)',
                              borderStyle: 'dashed',
                            }
                          : {}),
                      }}
                    />
                    <Text
                      className="mt-1.5 font-mono text-[10px]"
                      style={{ color: b.accent ? colors.clay : colors.mutedFaint }}
                    >
                      {b.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Offer card (dark). Shown only when the persisted state earns a step-up. */}
            {item.offerStepUp ? (
              <View className="mt-4 rounded-[22px] p-5" style={{ backgroundColor: colors.ink }}>
                <Text className="font-sans-semibold text-[15px]" style={{ color: colors.paper }}>
                  You&apos;ve held steady at {state.freqPerWeek} nights a week.
                </Text>
                <Text className="mt-1 text-[13.5px]" style={{ color: 'rgba(250,247,242,0.6)' }}>
                  Skin felt comfortable. Want to try a {state.freqPerWeek + 1}
                  {state.freqPerWeek + 1 === 3 ? 'rd' : 'th'} night?
                </Text>
                {acceptFailed ? (
                  <Text
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    className="mt-3 text-[13px]"
                    style={{ color: colors.cream }}
                  >
                    That change wasn&apos;t confirmed. Your previous pace is still active.
                  </Text>
                ) : null}
                <View className="mt-4 flex-row gap-2.5">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: accepting }}
                    disabled={accepting}
                    className="min-h-[48px] flex-1 items-center justify-center rounded-xl"
                    style={{ backgroundColor: colors.clay, opacity: accepting ? 0.6 : 1 }}
                    onPress={() => void acceptOfferedStepUp()}
                  >
                    <Text
                      className="font-sans-semibold text-[14.5px]"
                      style={{ color: colors.paper }}
                    >
                      {accepting ? 'Saving...' : acceptFailed ? 'Try again' : 'Add a night'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: accepting }}
                    disabled={accepting}
                    className="min-h-[48px] flex-1 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: 'rgba(250,247,242,0.1)',
                      opacity: accepting ? 0.6 : 1,
                    }}
                    onPress={() => backOrReplace(router)}
                  >
                    <Text
                      className="font-sans-semibold text-[14.5px]"
                      style={{ color: colors.paper }}
                    >
                      Not yet
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* Calm status when no step-up is on offer (still building, or eased off). */
              <View
                className="mt-4 rounded-[22px] bg-paper-raised p-5"
                style={{ borderWidth: 1, borderColor: colors.hairline }}
              >
                <Text variant="body" className="font-sans-medium text-[14.5px]">
                  {paused
                    ? 'Easing off after some irritation. We will rebuild gently.'
                    : `You're at ${state.freqPerWeek} of ${state.targetPerWeek} nights a week.`}
                </Text>
                <Text variant="bodySm" tone="muted" className="mt-1 text-[13px]">
                  {paused
                    ? 'Barrier support first. No step-up while you recover.'
                    : 'We will check in as your skin settles, and offer a step-up only when it is comfortable.'}
                </Text>
              </View>
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
