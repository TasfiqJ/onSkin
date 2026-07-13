import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_COMMUNITY_ROUTE } from '@/lib/navigation/safeBack';

// There is no reviewed, consented aggregate dataset in this release. Do not
// render an illustrative pattern as though it came from real people.
export default function PeopleLikeYouScreen() {
  return (
    <DeferredSurface
      surface="communityPosting"
      fallbackRoute={APP_COMMUNITY_ROUTE}
      fallbackLabel="Back to Skin Notes"
    />
  );
}
