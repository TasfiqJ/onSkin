import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';

/**
 * Keeps the mounted route tree under one stable parent while the durable
 * activation checkpoint changes from pending to released. Changing the root
 * element here remounts Expo Router's web history adapter and can replay an
 * older browser entry.
 */
export function MountedGoalsActivationInterlock({
  children,
  activationPending,
  failed,
  onAcknowledge,
}: {
  children?: ReactNode;
  activationPending: boolean;
  failed: boolean;
  onAcknowledge: () => Promise<void>;
}) {
  // The goals route and its empty providers must commit before the durable
  // pending bit is cleared. The overlay blocks interaction and the process
  // epoch remains closed until this post-mount acknowledgement succeeds.
  useEffect(() => {
    if (!activationPending) return;
    void onAcknowledge();
  }, [activationPending, onAcknowledge]);

  return (
    <View className="flex-1">
      <View
        className="flex-1"
        pointerEvents={activationPending ? 'none' : 'auto'}
        accessibilityElementsHidden={activationPending}
        importantForAccessibility={activationPending ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {activationPending ? (
        <View
          accessibilityViewIsModal
          className="absolute inset-0 items-center justify-center bg-paper px-6"
        >
          <Text variant="eyebrow" tone="clay" className="text-center">
            STARTING FRESH
          </Text>
          <Text variant="title" className="mt-2 text-center">
            Preparing your new health profile
          </Text>
          {failed ? (
            <>
              <Text
                accessibilityRole="alert"
                variant="bodySm"
                tone="muted"
                className="mt-3 text-center"
              >
                The private activation checkpoint was not saved. Health features remain locked.
              </Text>
              <Button
                className="mt-4"
                label="Retry profile activation"
                onPress={() => void onAcknowledge()}
              />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
