import { DeferredSurface } from '@/components/launch/DeferredSurface';
import { APP_SHELF_ROUTE } from '@/lib/navigation/safeBack';

// CORE-07A is intentionally zero-admission. This route does not parse private
// identifiers, mount Shelf data, render a card, create a link, capture a view,
// write a temporary file, or invoke native sharing.
export default function ShareConflictScreen() {
  return (
    <DeferredSurface
      surface="shareCard"
      fallbackRoute={APP_SHELF_ROUTE}
      fallbackLabel="Back to Shelf"
    />
  );
}
