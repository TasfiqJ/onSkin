import type { GatedFeature } from '@onskin/types';

const REMINDERS_WIDGETS_ROUTINE_ROUTES = new Set(['streak', 'welcome-back', 'widgets']);

export function routineGateFeatureForPath(pathname: string): GatedFeature {
  const pathOnly = pathname.split(/[?#]/, 1)[0] ?? '';
  const routeName = pathOnly.split('/').filter(Boolean).at(-1);

  return routeName && REMINDERS_WIDGETS_ROUTINE_ROUTES.has(routeName)
    ? 'reminders_widgets'
    : 'full_routine';
}
