import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './Text';

// Calm, reusable conflict banner (docs/02 §7.2): clay tint not red, a resolution-
// first subhead ("We've placed them on alternate nights"), one quiet action.
// Never an alert icon, never red. Used on the Shelf and (night variant) PM Today.
export type ConflictBannerProps = {
  title: string;
  subhead: string;
  onReview?: () => void;
  tone?: 'light' | 'night';
  className?: string;
};

export function ConflictBanner({ title, subhead, onReview, tone = 'light', className }: ConflictBannerProps) {
  const dark = tone === 'night';
  return (
    <View className={cn('rounded-card bg-clay/10 p-4', className)}>
      <View className="flex-row">
        <View className="mr-3 mt-1.5 h-1.5 w-1.5 rounded-full bg-clay" />
        <View className="flex-1">
          <Text variant="body" tone={dark ? 'inverse' : 'ink'} className="font-sans-semibold">
            {title}
          </Text>
          <Text variant="bodySm" tone={dark ? 'inverseMuted' : 'muted'} className="mt-1">
            {subhead}
          </Text>
          {onReview ? (
            <Pressable accessibilityRole="button" className="mt-2 self-start py-1" onPress={onReview}>
              <Text variant="bodySm" tone="clay" className="font-sans-semibold">
                Review →
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
