import { View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';

// Progress — guided photo capture + slider comparison + timeline (design spec
// p.10/11). BLOCKED: needs Document 6 (guided photo capture). Photos are
// local-only by default; no AI claims. Honest placeholder until that doc lands.
export default function ProgressScreen() {
  return (
    <Screen edges={['top']}>
      <Text variant="title" className="mt-2">
        Progress
      </Text>
      <View className="flex-1 justify-center">
        <Card>
          <Text variant="titleSm">On-device photo timeline</Text>
          <Text variant="bodySm" tone="muted" className="mt-2">
            Guided capture (alignment + lighting checks, all on your device) and the slider
            comparison are build-order #6. No scores, no AI grades — photos stay on this phone by
            default.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
