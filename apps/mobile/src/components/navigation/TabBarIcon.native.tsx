import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';

const symbols: Record<'today' | 'progress' | 'shelf' | 'you', [SFSymbol, SFSymbol]> = {
  today: ['house', 'house.fill'],
  progress: ['chart.bar', 'chart.bar.fill'],
  shelf: ['square.grid.2x2', 'square.grid.2x2.fill'],
  you: ['person', 'person.fill'],
};

export function TabBarIcon({
  name,
  focused,
  dark,
}: {
  name: keyof typeof symbols;
  focused: boolean;
  dark: boolean;
}) {
  const tint = focused
    ? dark
      ? colors.clayBright
      : colors.clayDeep
    : dark
      ? colors.mutedLight
      : colors.mutedStrong;
  return (
    <View
      accessible={false}
      style={{
        width: 48,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? (dark ? colors.nightElevated : colors.clayTint) : 'transparent',
      }}
    >
      <SymbolView
        name={symbols[name][focused ? 1 : 0]}
        size={23}
        tintColor={tint}
        style={{ width: 23, height: 23 }}
      />
    </View>
  );
}
