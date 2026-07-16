import { resolveEdgeAppEnvironment, type EdgeEnvironmentReader } from './env.ts';

export const STAGING_TRAFFIC_FREEZE_ERROR = 'DB06_STAGING_TRAFFIC_FROZEN';
export const STAGING_TRAFFIC_FREEZE_INVALID = 'DB06_TRAFFIC_FREEZE_INVALID';

export function stagingTrafficFreezeResponse(
  read: EdgeEnvironmentReader = (name) => Deno.env.get(name),
): Response | null {
  const appEnvironment = resolveEdgeAppEnvironment(read('APP_ENV'), read('EXPO_PUBLIC_APP_ENV'));
  const freeze = read('DB06_TRAFFIC_FREEZE')?.trim().toLowerCase();
  if (freeze !== undefined && freeze !== '' && freeze !== 'frozen' && freeze !== 'open') {
    if (appEnvironment !== 'staging') {
      throw new Error(STAGING_TRAFFIC_FREEZE_INVALID);
    }
  }
  if (freeze === 'frozen' || (appEnvironment === 'staging' && freeze !== 'open')) {
    return new Response(JSON.stringify({ error: STAGING_TRAFFIC_FREEZE_ERROR }), {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
  return null;
}
