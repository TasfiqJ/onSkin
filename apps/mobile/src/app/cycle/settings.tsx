import type { CycleVariant } from '@onskin/types';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
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
  { id: 'classic', label: 'Classic', sub: '4 nights' },
  { id: 'advanced', label: 'Advanced', sub: 'fewer rest' },
];

export default function CycleSettingsScreen() {
  const { data } = useCycle();
  const m = useCycleMutations();
  const cycle = data?.cycle;
  const selected: CycleVariant | null =
    data?.config.variant && data.config.variant !== 'auto'
      ? data.config.variant
      : (cycle?.variant ?? null);

  const potentNights = (cycle?.nights ?? []).filter(
    (n) => n.slot === 'exfoliate' || n.slot === 'retinoid',
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <Text variant="bodySm" tone="muted" onPress={() => backOrReplace(router)}>
          Done
        </Text>
        <Text variant="body" className="font-sans-semibold">
          Cycle settings
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <Text variant="eyebrow" tone="muted" className="mb-2.5 mt-4">
          Variant
        </Text>
        <View className="flex-row gap-2">
          {VARIANTS.map((v) => {
            const isSel = selected === v.id;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                onPress={() => {
                  haptics.select();
                  void m.setVariant(v.id);
                }}
                className={cn(
                  'flex-1 items-center rounded-[14px] bg-paper-raised px-2 py-3',
                  isSel ? 'border-2 border-clay' : 'border border-hairline-strong',
                )}
              >
                <Text className="font-sans-bold text-[13.5px]" tone={isSel ? 'ink' : 'muted'}>
                  {v.label}
                </Text>
                <Text variant="label" tone="muted" className="mt-0.5">
                  {v.sub}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {cycle ? (
          <>
            <Text variant="eyebrow" tone="muted" className="mb-2.5 mt-6">
              Actives on your nights
            </Text>
            <View className="gap-2">
              {potentNights.map((n) => (
                <View
                  key={n.index}
                  className="flex-row items-center gap-3 rounded-[14px] border border-hairline bg-paper-raised px-3.5 py-3"
                >
                  <View
                    className="rounded-md px-2 py-1"
                    style={{ backgroundColor: n.slot === 'retinoid' ? '#A5694B' : '#F3E7DF' }}
                  >
                    <Text
                      className="font-mono text-[11px]"
                      style={{ color: n.slot === 'retinoid' ? '#FAF7F2' : '#8A5239' }}
                    >
                      N{n.index}
                    </Text>
                  </View>
                  <Text variant="bodySm" className="flex-1 font-sans-semibold">
                    {n.productName}{' '}
                    <Text variant="label" tone="muted">
                      {slotLabel(n.slot).toLowerCase()}
                    </Text>
                  </Text>
                  {/* Drag handle. True drag-and-drop reorder is B-DRAG-DND (shared with the routine reorder). */}
                  <View className="gap-[3px]">
                    <View className="h-[1.5px] w-3.5 bg-greige-deep" />
                    <View className="h-[1.5px] w-3.5 bg-greige-deep" />
                    <View className="h-[1.5px] w-3.5 bg-greige-deep" />
                  </View>
                </View>
              ))}
            </View>

            {/* The firm rule, framed calmly (docs/05 §6.2 / §8). */}
            <View className="mt-4 rounded-[18px] bg-clay-tint p-4">
              <View className="flex-row gap-3">
                <View className="mt-1.5 h-[7px] w-[7px] rounded-full bg-clay" />
                <Text variant="bodySm" tone="muted" className="flex-1">
                  We keep acids and retinol on separate nights to protect your barrier. The one rule
                  we hold firm. Everything else is a recommendation you can change.
                </Text>
              </View>
            </View>

            <Text variant="bodySm" tone="muted" className="mt-4">
              Drag-to-reassign nights arrives with the reorder gesture. For now we keep your cabinet
              barrier-safe automatically.
            </Text>
          </>
        ) : (
          <Text variant="bodySm" tone="muted" className="mt-6">
            Add a retinoid or an exfoliating acid to your shelf and we&apos;ll build your cycle
            here.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
