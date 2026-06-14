/** Local calendar day as YYYY-MM-DD (the user's day. D-012). Pure; mirrors
 *  `localDateString` in features/today/useToday without that module's supabase
 *  import, so the photo helpers/tests stay dependency-free. */
export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** AM (before 5pm) → 'morning', else 'evening'. The time-of-day consistency
 *  hint (docs/06 §3). */
export function timeOfDayNow(d = new Date()): 'morning' | 'evening' {
  return d.getHours() < 17 ? 'morning' : 'evening';
}
