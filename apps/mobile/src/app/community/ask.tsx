import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_COMMUNITY_ROUTE } from '@/lib/navigation/safeBack';

// Question submission is not implemented: there is no staffed moderation desk,
// reviewed consent, persistence path, or appeal workflow. Keep the direct route
// non-actionable until those capabilities replace this file together.
export default function AskScreen() {
  return (
    <DeferredSurface
      surface="communityPosting"
      fallbackRoute={APP_COMMUNITY_ROUTE}
      fallbackLabel="Back to Skin Notes"
    />
  );
}
