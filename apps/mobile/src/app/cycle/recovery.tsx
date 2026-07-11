import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import { Button, RouteIconButton, Screen, Text } from '@/components/ui';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { backOrReplace } from '@/lib/navigation/safeBack';

// Recovery mode (design screen 06, docs/05 §7). Auto de-escalation. Irritation or
// a procedure → actives paused, barrier repair for ~7-10 days, ease back in. Calm,
// framed as strengthening, never a setback. Non-diagnostic.
export default function RecoveryScreen() {
  const { height } = useWindowDimensions();
  const { data } = useCycle();
  const m = useCycleMutations();
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const rec = data?.recovery;
  const compactScreen = height < 640;

  async function finishRecovery() {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await m.finishRecovery();
      backOrReplace(router);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (!rec?.active) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View className="mt-2">
          <RouteIconButton
            accessibilityLabel="Back"
            disabled={saving}
            onPress={() => backOrReplace(router)}
          />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text variant="body" tone="muted">
            No recovery in progress. Your cycle is running normally.
          </Text>
        </View>
      </Screen>
    );
  }

  const pct = Math.round((rec.day / rec.days) * 100);
  const paused = [
    ...(data?.cycle?.nights.filter((n) => n.productName).map((n) => n.productName!) ?? []),
    ...(data?.cycle?.amDaily.filter((a) => a.className === 'vitamin_c').map((a) => a.name) ?? []),
  ];
  const uniquePaused = [...new Set(paused)];
  const fromIrritation = rec.reason === 'irritation';

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName={compactScreen ? 'pb-5' : 'pb-6'}
      >
        <View className={compactScreen ? 'mt-0' : 'mt-2'}>
          <RouteIconButton
            accessibilityLabel="Back"
            disabled={saving}
            onPress={() => backOrReplace(router)}
          />
        </View>

        <View
          className={
            compactScreen
              ? 'mt-0.5 flex-row items-center gap-2 self-start rounded-pill px-3.5 py-1.5'
              : 'mt-1 flex-row items-center gap-2 self-start rounded-pill px-4 py-2'
          }
          style={{ backgroundColor: '#E6ECE0' }}
        >
          <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: '#4F7A4A' }} />
          <Text className="font-sans-bold text-[12.5px]" style={{ color: '#3F6A3A' }}>
            Recovery mode · day {rec.day} of {rec.days}
          </Text>
        </View>

        <Text
          variant="title"
          className={
            compactScreen ? 'mt-3 text-[29px] leading-[32px]' : 'mt-4 text-[32px] leading-[35px]'
          }
          accessibilityRole="header"
        >
          We&apos;ve eased off for now.
        </Text>
        <Text
          variant="body"
          tone="muted"
          className={compactScreen ? 'mt-1.5 text-[14px] leading-[20px]' : 'mt-2'}
        >
          {fromIrritation
            ? 'You told us your skin felt irritated, so we paused your actives and switched to barrier repair. This isn’t a setback. It’s how skin gets stronger.'
            : 'After your treatment, we paused your actives and switched to barrier repair. We’ll ease back in gently.'}
        </Text>

        {/* Progress */}
        <View
          className={
            compactScreen
              ? 'mt-4 rounded-card border border-hairline bg-paper-raised p-4'
              : 'mt-5 rounded-card border border-hairline bg-paper-raised p-5'
          }
        >
          <View
            className={
              compactScreen
                ? 'mb-2.5 flex-row items-baseline justify-between'
                : 'mb-3 flex-row items-baseline justify-between'
            }
          >
            <Text variant="body" className="font-sans-bold">
              Resting your barrier
            </Text>
            <Text variant="label" style={{ color: '#4F7A4A' }}>
              {rec.day} / {rec.days}
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-pill" style={{ backgroundColor: '#EDE5D8' }}>
            <View
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: '#4F7A4A',
                borderRadius: 4,
              }}
            />
          </View>
          <View
            className={
              compactScreen ? 'mt-2 flex-row justify-between' : 'mt-2.5 flex-row justify-between'
            }
          >
            <Text variant="bodySm" tone="muted">
              Paused actives
            </Text>
            <Text variant="bodySm" tone="muted">
              Reintroduce gradually →
            </Text>
          </View>
        </View>

        {/* Paused actives */}
        {uniquePaused.length ? (
          <View
            className={compactScreen ? 'mt-2.5 rounded-card p-3.5' : 'mt-3.5 rounded-card p-4'}
            style={{ backgroundColor: '#F1ECE3' }}
          >
            <Text variant="bodySm" tone="muted" className="mb-2.5 font-sans-bold">
              Paused until you&apos;re comfortable
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {uniquePaused.map((name) => (
                <View key={name} className="rounded-pill bg-paper-raised px-3 py-1.5">
                  <Text className="font-sans-semibold text-[12px] line-through" tone="muted">
                    {name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View
          className={
            compactScreen
              ? 'mt-2.5 flex-row gap-3 rounded-2xl border border-hairline bg-paper-raised px-3.5 py-3'
              : 'mt-3.5 flex-row gap-3 rounded-2xl border border-hairline bg-paper-raised px-4 py-3.5'
          }
        >
          <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-muted" />
          <Text variant="bodySm" tone="muted" className="flex-1">
            Feeling better already? You can ease back in early. We&apos;ll start with one active.
          </Text>
        </View>

        {saveFailed ? <CycleMutationError /> : null}

        <Button
          className={compactScreen ? 'mt-4' : 'mt-6'}
          disabled={saving}
          label={saving ? 'Resuming cycle...' : saveFailed ? 'Try again' : 'Ease back in'}
          onPress={() => void finishRecovery()}
        />
      </ScrollView>
    </Screen>
  );
}
