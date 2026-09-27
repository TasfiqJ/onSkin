import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useEffect } from 'react';
import { BehaviouralTriggers } from '@/features/notifications/BehaviouralTriggers';
import { pendingLifecycleRouteResult } from '@/features/subscription/lifecycle';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isOwnerQueryScopeCurrent } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { colors } from '@/theme/tokens';

function useExpiryReoffer() {
  const { user } = useAuth();
  const ownerScope = useOwnerQueryScope();
  const storeUserId = user?.id ?? null;
  useEffect(() => {
    if (!storeUserId) return;
    let mounted = true;
    void pendingLifecycleRouteResult(new Date().toISOString(), {
      expectedStoreUserId: storeUserId,
    }).then((result) => {
      if (!mounted || result.status !== 'route' || !isOwnerQueryScopeCurrent(ownerScope)) {
        return;
      }
      const { prompt } = result;
      router.push({
        pathname: prompt.route === '/paywall/reoffer' ? '/paywall/upsell' : prompt.route,
        params: { lifecyclePromptId: prompt.promptId },
      });
    });
    return () => {
      mounted = false;
    };
  }, [ownerScope, storeUserId]);
}

export default function TabsLayout() {
  useExpiryReoffer();

  return (
    <>
      <BehaviouralTriggers />
      <NativeTabs
        disableTransparentOnScrollEdge
        minimizeBehavior="onScrollDown"
        tintColor={colors.clay}
      >
        <NativeTabs.Trigger name="today">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md={{ default: 'home', selected: 'home' }}
          />
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="progress">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'chart.line.uptrend.xyaxis', selected: 'chart.line.uptrend.xyaxis' }}
            md={{ default: 'trending_up', selected: 'trending_up' }}
          />
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="shelf">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}
            md={{ default: 'inventory_2', selected: 'inventory_2' }}
          />
          <NativeTabs.Trigger.Label>Shelf</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="you">
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
            md={{ default: 'person', selected: 'person' }}
          />
          <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
