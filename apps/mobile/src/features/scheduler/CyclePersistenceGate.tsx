import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { APP_HOME_ROUTE } from '@/lib/navigation/safeBack';

import { useCycleConfig } from './useCycle';

/** Do not let a failed cycle read look like an empty editor or an unpaused cycle. */
export function CyclePersistenceGate({ children }: { children: ReactNode }) {
  // Existing exact professional-review gates still own their closed surfaces.
  if (!canUseRoutineCadence()) return <>{children}</>;
  return <AdmittedCyclePersistenceGate>{children}</AdmittedCyclePersistenceGate>;
}

function AdmittedCyclePersistenceGate({ children }: { children: ReactNode }) {
  const query = useCycleConfig();
  if (!query.isLoading && !query.isError && query.data !== undefined) return <>{children}</>;

  return (
    <Screen>
      <View className="flex-1 justify-center gap-4">
        <Text variant="title" accessibilityRole={query.isError ? 'alert' : 'header'}>
          {query.isError ? 'Your saved cycle could not be loaded.' : 'Loading your saved cycle...'}
        </Text>
        {query.isError ? (
          <>
            <Text variant="body" tone="muted">
              We cannot confirm the saved cycle right now. Reload to check it before making changes.
            </Text>
            <Button label="Reload saved cycle" onPress={() => void query.refetch()} />
          </>
        ) : null}
        <Button label="Back to Today" onPress={() => router.replace(APP_HOME_ROUTE)} />
      </View>
    </Screen>
  );
}
