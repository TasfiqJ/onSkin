import { View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme/tokens';

export type CommerceLinkFeedback = {
  title: string;
  body: string;
};

export function CommerceLinkNotice({ feedback }: { feedback: CommerceLinkFeedback }) {
  return (
    <View
      accessibilityRole="alert"
      className="mt-3 rounded-xl px-3.5 py-3"
      style={{ backgroundColor: colors.clayTint, borderWidth: 1, borderColor: colors.hairline }}
    >
      <Text className="font-sans-semibold text-[12.5px]" style={{ color: colors.ink }}>
        {feedback.title}
      </Text>
      <Text className="mt-1 text-[11.5px]" tone="muted" style={{ lineHeight: 16 }}>
        {feedback.body}
      </Text>
    </View>
  );
}
