import type { GatedFeature } from '@onskin/types';

const REMINDERS_ROUTINE_ROUTES = new Set(['streak', 'welcome-back']);

export function routineGateFeatureForPath(pathname: string): GatedFeature | null {
  const pathOnly = pathname.split(/[?#]/, 1)[0] ?? '';
  const routeName = pathOnly.split('/').filter(Boolean).at(-1);

  if (routeName === 'widgets') return null;

  return routeName && REMINDERS_ROUTINE_ROUTES.has(routeName)
    ? 'reminders_widgets'
    : 'full_routine';
}
