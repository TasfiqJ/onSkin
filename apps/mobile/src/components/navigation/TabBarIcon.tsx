import { View } from 'react-native';
import { colors } from '@/theme/tokens';

type TabName = 'today' | 'progress' | 'shelf' | 'you';

const paths: Record<TabName, { outline: string; filled: string }> = {
  today: {
    outline: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    filled:
      '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" fill="currentColor"/>',
  },
  progress: {
    outline:
      '<rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
    filled:
      '<g fill="currentColor"><rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></g>',
  },
  shelf: {
    outline:
      '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    filled:
      '<g fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></g>',
  },
  you: {
    outline: '<circle cx="12" cy="7.5" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/>',
    filled:
      '<circle cx="12" cy="7.5" r="4" fill="currentColor"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" fill="currentColor"/>',
  },
};

/** Web dock icons. Device tabs use their platform's SF/Material symbols. */
export function TabBarIcon({
  name,
  focused,
  dark,
}: {
  name: TabName;
  focused: boolean;
  dark: boolean;
}) {
  const color = focused
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
      <svg
        aria-hidden="true"
        focusable="false"
        width={23}
        height={23}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        color={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: paths[name][focused ? 'filled' : 'outline'] }}
      />
    </View>
  );
}
