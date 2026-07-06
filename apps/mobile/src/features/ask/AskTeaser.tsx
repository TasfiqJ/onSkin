import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { BRAND } from '@/lib/brand';
import { haptics } from '@/theme/haptics';
import { colors } from '@/theme/tokens';

import { ASK_COPY } from './copy';

// A calm Today entry into Ask (docs/13 §9. The first-session moat taste). Routes
// into the DETERMINISTIC, on-device, $0 advisor (the free moat taste); never "AI" hype.
export function AskTeaser() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${BRAND.askName}`}
      onPress={() => {
        haptics.select();
        router.push('/ask');
      }}
      className="mt-4 flex-row items-center gap-4 rounded-card bg-paper-raised p-5"
      style={{ borderWidth: 1, borderColor: colors.hairline }}
    >
      <View
        className="h-[38px] w-[38px] items-center justify-center rounded-[11px]"
        style={{ backgroundColor: colors.ink }}
      >
        <Text style={{ color: colors.clayBright, fontSize: 16 }}>✦</Text>
      </View>
      <View className="flex-1">
        <Text variant="body" className="font-sans-semibold text-[15px]">
          {ASK_COPY.todayCard.title}
        </Text>
        <Text variant="bodySm" tone="muted" className="text-[13px]">
          {ASK_COPY.todayCard.body}
        </Text>
      </View>
      <Text style={{ color: colors.mutedLight, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}
