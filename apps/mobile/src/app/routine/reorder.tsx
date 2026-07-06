import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { usePlan } from '@/features/routine/usePlan';
import { cn } from '@/lib/cn';
import { backOrReplace } from '@/lib/navigation/safeBack';
import { colors } from '@/theme/tokens';

// 02 · Sequencing. Drag reorder + non-blocking nudge (design screen 02, docs/03 §7).
// We sort thinnest-to-thickest by default but never lock it. "guidance, not a
// gate." When a serum sits below moisturiser, a calm nudge offers to fix it.
// NOTE: full drag-and-drop needs react-native-draggable-flatlist (a follow-on);
// the handles + the non-blocking nudge (the doc's actual point) stay functional
// against the generated plan instead of fixed demo product names.
const MOVING_SHADOW =
  Platform.OS === 'web'
    ? { boxShadow: '0 12px 28px rgba(32, 27, 21, 0.18)' }
    : {
        shadowColor: '#201B15',
        shadowOpacity: 0.18,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
      };

function Handle({ active }: { active: boolean }) {
  const c = active ? colors.clay : colors.mutedFaint;
  return (
    <View className="gap-1">
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 16, height: 1.5, backgroundColor: c }} />
      ))}
    </View>
  );
}

export default function ReorderScreen() {
  const { data, isLoading } = usePlan();
  const canonical = useMemo(() => data?.plan.am.map((step) => step.name) ?? [], [data?.plan.am]);
  const canonicalKey = canonical.join('\u0000');

  return (
    <ReorderEditor
      key={canonicalKey}
      canonical={canonical}
      isExample={Boolean(data?.isExample)}
      isLoading={isLoading}
    />
  );
}

function ReorderEditor({
  canonical,
  isExample,
  isLoading,
}: {
  canonical: string[];
  isExample: boolean;
  isLoading: boolean;
}) {
  const canonicalKey = canonical.join('\u0000');
  const [order, setOrder] = useState<string[]>(canonical);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const violatesOrder = canonical.length > 0 && order.join('\u0000') !== canonicalKey;
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const movingIndex = order.findIndex((name, index) => name !== canonical[index]);
  const selectedName = selectedIndex == null ? null : order[selectedIndex];

  function moveSelected(direction: -1 | 1) {
    if (selectedIndex == null) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;

    setOrder((current) => {
      const next = [...current];
      const [item] = next.splice(selectedIndex, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return next;
    });
    setSelectedIndex(nextIndex);
    setNudgeDismissed(false);
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-6"
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
            onPress={() => backOrReplace(router)}
          >
            <Text variant="body" tone="muted" className="font-sans-semibold text-[15px]">
              Done
            </Text>
          </Pressable>
          <Text variant="body" className="font-sans-bold text-[15px]">
            {isExample ? 'Example morning' : 'Edit morning'}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="min-h-[48px] min-w-[48px] items-center justify-center px-2"
            onPress={() => backOrReplace(router)}
          >
            <Text variant="body" tone="clay" className="font-sans-semibold text-[15px]">
              Save
            </Text>
          </Pressable>
        </View>

        <Text variant="bodySm" tone="muted" className="mt-4 text-[13px]">
          {isExample
            ? 'This example shows how ordering guidance works. Add products to your shelf for your routine.'
            : 'Tap a step, then move it earlier or later. We sort thinnest-to-thickest, but it is your routine.'}
        </Text>

        <View className="mt-4 gap-2">
          {isLoading ? (
            <View className="rounded-2xl bg-paper-raised p-4">
              <Text variant="bodySm" tone="muted">
                Loading your generated routine.
              </Text>
            </View>
          ) : null}
          {!isLoading && order.length === 0 ? (
            <View className="rounded-2xl bg-paper-raised p-4">
              <Text variant="bodySm" tone="muted">
                Add products to your shelf and we will build an editable morning order here.
              </Text>
            </View>
          ) : null}
          {order.map((name, i) => {
            const moving = violatesOrder && i === movingIndex;
            const selected = selectedIndex === i;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={cn(
                  'flex-row items-center gap-3 rounded-2xl bg-paper-raised p-3.5',
                  moving || selected ? 'border-clay' : 'border-hairline',
                )}
                onPress={() => setSelectedIndex(selected ? null : i)}
                style={{
                  borderWidth: moving || selected ? 1.5 : 1,
                  ...(moving ? { ...MOVING_SHADOW, transform: [{ translateY: -2 }] } : {}),
                }}
              >
                <Handle active={moving || selected} />
                <Text
                  variant="body"
                  className={cn(
                    'flex-1 text-[14.5px]',
                    moving || selected ? 'font-sans-bold' : 'font-sans-medium',
                  )}
                >
                  {name}
                </Text>
                {moving ? (
                  <Text className="font-mono text-[10.5px]" style={{ color: colors.clay }}>
                    MOVING
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {selectedName ? (
          <View className="mt-3 rounded-card bg-paper-raised p-3">
            <Text variant="bodySm" tone="muted" className="text-[13px]">
              Move {selectedName}
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                disabled={selectedIndex === 0}
                className="h-[48px] flex-1 items-center justify-center rounded-[10px]"
                style={{
                  backgroundColor: selectedIndex === 0 ? colors.greige : colors.paper,
                  borderColor: colors.hairline,
                  borderWidth: 1,
                  opacity: selectedIndex === 0 ? 0.55 : 1,
                }}
                onPress={() => moveSelected(-1)}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.ink }}>
                  Earlier
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={selectedIndex === order.length - 1}
                className="h-[48px] flex-1 items-center justify-center rounded-[10px]"
                style={{
                  backgroundColor:
                    selectedIndex === order.length - 1 ? colors.greige : colors.paper,
                  borderColor: colors.hairline,
                  borderWidth: 1,
                  opacity: selectedIndex === order.length - 1 ? 0.55 : 1,
                }}
                onPress={() => moveSelected(1)}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.ink }}>
                  Later
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {violatesOrder && !nudgeDismissed ? (
          <View className="mt-4 rounded-card bg-clay-tint p-4">
            <View className="flex-row gap-2.5">
              <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-clay" />
              <Text variant="bodySm" tone="muted" className="flex-1 text-[13.5px]">
                Most people apply lighter serums before moisturizer so they absorb. Want me to put
                it back?
              </Text>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                className="h-[48px] flex-1 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: colors.ink }}
                onPress={() => setOrder(canonical)}
              >
                <Text className="font-sans-semibold text-[13px] text-paper">Fix the order</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                className="h-[48px] flex-1 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}
                onPress={() => setNudgeDismissed(true)}
              >
                <Text className="font-sans-semibold text-[13px]" style={{ color: colors.muted }}>
                  Keep mine
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
