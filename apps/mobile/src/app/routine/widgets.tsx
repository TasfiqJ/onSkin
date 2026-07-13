import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_HOME_ROUTE } from '@/lib/navigation/safeBack';

export default function WidgetsScreen() {
  return (
    <DeferredSurface
      surface="widgets"
      fallbackRoute={APP_HOME_ROUTE}
      fallbackLabel="Back to Today"
    />
  );
}
