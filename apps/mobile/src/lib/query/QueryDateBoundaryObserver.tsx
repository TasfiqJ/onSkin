import { useCalendars } from 'expo-localization';
import { useEffect, useMemo } from 'react';

import { reconcileQueryDateBoundary } from './queryDateBoundary';

/** Bridge supported native calendar/time-zone change events into the global coordinator. */
export function QueryDateBoundaryObserver() {
  const calendars = useCalendars();
  const calendarIdentity = useMemo(
    () =>
      calendars
        .map((calendar) => `${calendar.calendar}:${calendar.timeZone}:${calendar.uses24hourClock}`)
        .join('|'),
    [calendars],
  );

  useEffect(() => {
    reconcileQueryDateBoundary();
  }, [calendarIdentity]);

  return null;
}
