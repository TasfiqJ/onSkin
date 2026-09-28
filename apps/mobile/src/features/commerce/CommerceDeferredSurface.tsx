import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_YOU_ROUTE } from '@/lib/navigation/safeBack';

/** One analytics-free recovery surface for every direct commerce entry. */
export function CommerceDeferredSurface() {
  return (
    <DeferredSurface
      surface="commerce"
      fallbackRoute={APP_YOU_ROUTE}
      fallbackLabel="Back to You"
      fallbackBehavior="replace"
      trackView={false}
    />
  );
}
