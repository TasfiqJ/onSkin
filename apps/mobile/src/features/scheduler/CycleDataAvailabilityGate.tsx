import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button, RouteIconButton, Screen, StateLoading } from '@/components/ui';
import { canUseRoutineCadence } from '@/features/routine/reviewGate';
import { backOrReplace } from '@/lib/navigation/safeBack';

import { ActiveScheduleUnavailableNotice } from './ActiveScheduleUnavailableNotice';
import { useCycle } from './useCycle';

export function CycleDataAvailabilityGate({ children }: { children: ReactNode }) {
  const query = useCycle();

  // When the launch review gate is closed, nested routes own the reviewed-cadence
  // explanation and keep daily AM/PM guidance available without consulting ramps.
  if (!canUseRoutineCadence()) return children;
  if (!query.isLoading && !query.isError) return children;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="mt-2 flex-row items-center">
        <RouteIconButton accessibilityLabel="Back" onPress={() => backOrReplace(router)} />
      </View>
      <View className="flex-1 justify-center pb-12">
        {query.isError ? (
          <ActiveScheduleUnavailableNotice
            onRetry={() => void query.retry()}
            retrying={query.isFetching}
          />
        ) : (
          <StateLoading label="Opening your active schedule..." className="px-6 py-12" />
        )}
      </View>
      <Button
        label="Back to Today"
        variant="ghost"
        className="mb-2 min-h-[48px] py-3"
        onPress={() => router.replace('/today')}
      />
    </Screen>
  );
}
