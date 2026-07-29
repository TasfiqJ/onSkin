import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_PROGRESS_ROUTE } from '@/lib/navigation/safeBack';

// PHOTO-05A: this direct entry is unconditionally deferred. It does not mount the
// former Monk/profile observer, inspect legacy consent/history, or emit Trend
// analytics while the validated engine is unavailable.
export default function FairnessScreen() {
  return (
    <DeferredSurface
      surface="trend"
      fallbackRoute={APP_PROGRESS_ROUTE}
      fallbackLabel="Back to Progress"
      fallbackBehavior="replace"
      trackView={false}
    />
  );
}
