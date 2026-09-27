import { Stack } from 'expo-router';
import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_HOME_ROUTE } from '@/lib/navigation/safeBack';

function DeferredScreen() {
  return (
    <DeferredSurface
      surface="communityPosting"
      fallbackRoute={APP_HOME_ROUTE}
      fallbackLabel="Back to Today"
      trackView={false}
    />
  );
}

export default function DeferredLayout() {
  return <Stack screenOptions={{ headerShown: false }} screenLayout={DeferredScreen} />;
}
