import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

export type NextVisitRoute = '/routine/streak' | '/settings/notifications';

/** Optional orientation after local confirmation; no extra reads or stored state. */
export function NextVisitCard({ phase, onNavigate }: {
  phase: 'AM' | 'PM'; onNavigate: (route: NextVisitRoute) => void;
}) {
  const dark = phase === 'PM';
  const color = dark ? colors.cream : colors.ink;
  return (
    <View className="mt-4 rounded-card p-5" style={{ backgroundColor: dark ? colors.nightSurface : colors.greigeChip }}>
      <Text variant="body" className="font-sans-semibold" style={{ color }}>For your next visit</Text>
      <Text variant="bodySm" className="mt-2" style={{ color }}>
        {phase === 'AM' ? 'Morning' : 'Evening'} check-offs saved on this device.
        {phase === 'AM'
          ? ' Come back after 5 PM for your evening routine.'
          : ' Return when you’re ready for your morning routine.'}
      </Text>
      <Text variant="bodySm" className="mt-2" style={{ color }}>If you’d like, review your week or choose reminder options.</Text>
      {([
        ['Review this week', '/routine/streak'],
        ['Reminder options', '/settings/notifications'],
      ] as const).map(([label, route]) => (
        <Pressable key={route} accessibilityRole="button" accessibilityLabel={label}
          onPress={() => onNavigate(route)}
          style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 12 }}>
          <Text variant="bodySm" className="font-sans-semibold" style={{ color }}>{label} →</Text>
        </Pressable>
      ))}
    </View>
  );
}
