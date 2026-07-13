import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_PROGRESS_ROUTE } from '@/lib/navigation/safeBack';

// The trend engine is launch-blocked. A release with no engine must not ask for
// consent to run it, even when an environment flag or stale deep link is present.
export default function TrendOptInScreen() {
  return (
    <DeferredSurface
      surface="trend"
      fallbackRoute={APP_PROGRESS_ROUTE}
      fallbackLabel="Back to Progress"
    />
  );
}
