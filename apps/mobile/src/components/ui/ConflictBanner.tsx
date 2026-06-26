import { Pressable, View } from 'react-native';

import { colors } from '@/theme/tokens';

import { Text } from './Text';

// Calm, reusable conflict banner (design frame 03, docs/02 §7.2): clay tint not
// red, a resolution-first subhead ("We've set them to alternate nights"), one
// quiet "Review →" action, and an optional inline severity pill. Never an alert
// icon, never red. Used on the Shelf and (night variant) PM Today.
export type ConflictBannerProps = {
  title: string;
  subhead: string;
  /** Inline severity word rendered as a small white pill beside the title
   *  (design frame 03, "Moderate"). */
  severityPill?: string;
  onReview?: () => void;
  tone?: 'light' | 'night';
  className?: string;
};

export function ConflictBanner({
  title,
  subhead,
  severityPill,
  onReview,
  tone = 'light',
  className,
}: ConflictBannerProps) {
  const dark = tone === 'night';
  const titleColor = dark ? colors.cream : colors.clayDeep;
  const subColor = dark ? 'rgba(244,239,231,0.72)' : colors.mutedStrong;
  return (
    <View
      className={className}
      style={{
        borderRadius: 20,
        backgroundColor: dark ? colors.nightSurface : colors.clayTint,
        paddingVertical: 16,
        paddingHorizontal: 18,
      }}>
      <View className="flex-row">
        <View
          className="rounded-full"
          style={{ width: 8, height: 8, marginTop: 6, marginRight: 14, backgroundColor: colors.clay }}
        />
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-sans-bold text-[14.5px]" style={{ color: titleColor }}>
              {title}
            </Text>
            {severityPill ? (
              <View
                className="rounded-full bg-paper-raised"
                style={{ paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text className="font-sans-bold text-[10px]" style={{ color: colors.clayDeep }}>
                  {severityPill}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="mt-1 text-[13px] leading-[19px]" style={{ color: subColor }}>
            {subhead}
            {onReview ? (
              <Text className="font-sans-bold" style={{ color: colors.clayDeep }}>
                {' Review →'}
              </Text>
            ) : null}
          </Text>
        </View>
      </View>
      {onReview ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Review conflict"
          className="absolute inset-0"
          onPress={onReview}
        />
      ) : null}
    </View>
  );
}
