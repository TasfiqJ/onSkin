import type { CycleVariant } from '@onskin/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { RouteIconButton, Screen, Text } from '@/components/ui';
import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { CycleMutationError } from '@/features/scheduler/CycleMutationError';
import { slotLabel } from '@/features/scheduler/projection';
import { useCycle, useCycleMutations } from '@/features/scheduler/useCycle';
import { cn } from '@/lib/cn';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { haptics } from '@/theme/haptics';

// Cycle settings (design screen 03, docs/05 §6.2). Choose the variant, see the
// per-night assignment, with a calm non-blocking rule explainer. Edits that
// violate a rule get a gentle nudge. Guidance, not gates (docs/05 §6.2). Except
// the harm-relevant retinoid×exfoliant separation, which we hold firm.
const VARIANTS: { id: CycleVariant; label: string; sub: string }[] = [
  { id: 'gentle', label: 'Gentle', sub: 'more recovery' },
  { id: 'classic', label: 'Classic', sub: 'balanced rest' },
  { id: 'advanced', label: 'Advanced', sub: 'fewer rest' },
];

export default function CycleSettingsScreen() {
  const { data } = useCycle();
  const m = useCycleMutations();
  const [savingVariant, setSavingVariant] = useState<CycleVariant | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const cadenceReady = canUseRoutineCadence();
  const cycle = data?.cycle;
  const selected: CycleVariant | null =
    data?.config.variant && data.config.variant !== 'auto'
      ? data.config.variant
      : (cycle?.variant ?? null);

  const potentNights = (cycle?.nights ?? []).filter(
    (n) => n.slot === 'exfoliate' || n.slot === 'retinoid',
  );

  async function chooseVariant(variant: CycleVariant) {
    if (savingVariant) return;
    setSavingVariant(variant);
    setSaveFailed(false);
    try {
      await m.setVariant(variant);
    } catch {
      setSaveFailed(true);
    } finally {
      setSavingVariant(null);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <RouteIconButton
          accessibilityLabel="Done"
          glyph="x"
          disabled={savingVariant != null}
          onPress={() => backOrReplace(router)}
        />
        <Text variant="body" className="font-sans-semibold">
          Cycle settings
        </Text>
        <View className="w-[44px]" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        {!cadenceReady ? (
          <View className="mt-6 rounded-[18px] bg-paper-raised p-5">
            <Text variant="body" className="font-sans-semibold">
              Cycle settings open after review.
            </Text>
            <Text variant="bodySm" tone="muted" className="mt-2">
              Your routine can still be used daily. Skin-cycling cadence and ramp settings stay
              hidden in production until clinical and cosmetic-chemistry review closes.
            </Text>
          </View>
        ) : (
          <>
            <Text variant="eyebrow" tone="muted" className="mb-2.5 mt-4">
              Variant
            </Text>
            <View className="flex-row gap-2">
              {VARIANTS.map((v) => {
                const isSel = selected === v.id;
                const sub = isSel && cycle ? `${cycle.lengthNights} nights generated` : v.sub;
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.label}. ${sub}`}
                    accessibilityState={{ disabled: savingVariant != null, selected: isSel }}
                    disabled={savingVariant != null}
                    onPress={() => {
                      haptics.select();
                      void chooseVariant(v.id);
                    }}
                    className={cn(
                      'flex-1 items-center rounded-[14px] bg-paper-raised px-2 py-3',
                      isSel ? 'border-2 border-clay' : 'border border-hairline-strong',
                    )}
                    style={{ opacity: savingVariant != null ? 0.55 : 1 }}
                  >
                    <Text className="font-sans-bold text-[13.5px]" tone={isSel ? 'ink' : 'muted'}>
                      {v.label}
                    </Text>
                    <Text variant="label" tone="muted" className="mt-0.5">
                      {sub}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {saveFailed ? <CycleMutationError /> : null}

            {cycle ? (
              <>
                <Text variant="eyebrow" tone="muted" className="mb-2.5 mt-6">
                  Actives on your nights
                </Text>
                <View className="gap-2">
                  {potentNights.map((n) => {
                    const cycleNightNumber = n.index + 1;
                    const cycleNightLabel = formatCycleNightLabel(cycleNightNumber);

                    return (
                      <View
                        key={n.index}
                        className="flex-row items-center gap-3 rounded-[14px] border border-hairline bg-paper-raised px-3.5 py-3"
                      >
                        <View
                          className="rounded-md px-2 py-1"
                          style={{ backgroundColor: n.slot === 'retinoid' ? '#A5694B' : '#F3E7DF' }}
                        >
                          <Text
                            className="font-sans-semibold text-[10.5px]"
                            style={{ color: n.slot === 'retinoid' ? '#FAF7F2' : '#8A5239' }}
                          >
                            {cycleNightLabel}
                          </Text>
                        </View>
                        <Text variant="bodySm" className="flex-1 font-sans-semibold">
                          {n.productName}{' '}
                          <Text variant="label" tone="muted">
                            {slotLabel(n.slot).toLowerCase()}
                          </Text>
                        </Text>
                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{ backgroundColor: 'rgba(32,27,21,0.06)' }}
                        >
                          <Text variant="label" tone="muted" style={{ fontSize: 10.5 }}>
                            Scheduled
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* The firm rule, framed calmly (docs/05 §6.2 / §8). */}
                <View className="mt-4 rounded-[18px] bg-clay-tint p-4">
                  <View className="flex-row gap-3">
                    <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-clay" />
                    <Text variant="bodySm" tone="muted" className="flex-1">
                      We keep acids and retinol on separate nights to protect your barrier. The one
                      rule we hold firm. Everything else is a recommendation you can change.
                    </Text>
                  </View>
                </View>

                <Text variant="bodySm" tone="muted" className="mt-4">
                  Variant changes recalculate your active nights from the products on your shelf. We
                  keep the barrier-safety rule firm in every version.
                </Text>
              </>
            ) : (
              <Text variant="bodySm" tone="muted" className="mt-6">
                Add a retinoid or an exfoliating acid to your shelf and we&apos;ll build your cycle
                here.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function formatCycleNightLabel(cycleNightNumber: number): string {
  return `Night ${cycleNightNumber}`;
}
