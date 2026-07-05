import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { colors } from '@/theme/tokens';

// 02 · Sequencing. Drag reorder + non-blocking nudge (design screen 02, docs/03 §7).
// We sort thinnest-to-thickest by default but never lock it. "guidance, not a
// gate." When a serum sits below moisturiser, a calm nudge offers to fix it.
// NOTE: full drag-and-drop needs react-native-draggable-flatlist (a follow-on);
// the handles + the non-blocking nudge (the doc's actual point) are functional.
const CANONICAL = ['Cream cleanser', 'Vitamin C serum', 'Ceramide moisturizer', 'Mineral SPF 50'];
const REORDERED = ['Cream cleanser', 'Ceramide moisturizer', 'Vitamin C serum', 'Mineral SPF 50'];
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
  const [order, setOrder] = useState<string[]>(REORDERED);
  const violatesOrder = order.join() !== CANONICAL.join();
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const movingIndex = order.indexOf('Vitamin C serum');

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center justify-between">
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text variant="body" tone="muted" className="font-sans-semibold text-[15px]">
            Done
          </Text>
        </Pressable>
        <Text variant="body" className="font-sans-bold text-[15px]">
          Edit morning
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text variant="body" tone="clay" className="font-sans-semibold text-[15px]">
            Save
          </Text>
        </Pressable>
      </View>

      <Text variant="bodySm" tone="muted" className="mt-4 text-[13px]">
        Drag to reorder. We sort thinnest-to-thickest so lighter actives absorb first. But it&apos;s
        your routine.
      </Text>

      <View className="mt-4 gap-2">
        {order.map((name, i) => {
          const moving = violatesOrder && i === movingIndex;
          return (
            <View
              key={name}
              className={cn(
                'flex-row items-center gap-3 rounded-2xl bg-paper-raised p-3.5',
                moving ? 'border-clay' : 'border-hairline',
              )}
              style={{
                borderWidth: moving ? 1.5 : 1,
                ...(moving ? { ...MOVING_SHADOW, transform: [{ translateY: -2 }] } : {}),
              }}
            >
              <Handle active={moving} />
              <Text
                variant="body"
                className={cn(
                  'flex-1 text-[14.5px]',
                  moving ? 'font-sans-bold' : 'font-sans-medium',
                )}
              >
                {name}
              </Text>
              {moving ? (
                <Text className="font-mono text-[10.5px]" style={{ color: colors.clay }}>
                  MOVING
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {violatesOrder && !nudgeDismissed ? (
        <View className="mt-4 rounded-card bg-clay-tint p-4">
          <View className="flex-row gap-2.5">
            <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-clay" />
            <Text variant="bodySm" tone="muted" className="flex-1 text-[13.5px]">
              Most people apply lighter serums before moisturizer so they absorb. Want me to put it
              back?
            </Text>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              className="h-9 flex-1 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: colors.ink }}
              onPress={() => setOrder(CANONICAL)}
            >
              <Text className="font-sans-semibold text-[13px] text-paper">Fix the order</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              className="h-9 flex-1 items-center justify-center rounded-[10px]"
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

      <View className="flex-1" />
    </Screen>
  );
}
