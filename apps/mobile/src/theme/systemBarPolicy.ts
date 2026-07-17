export type SystemSurfaceTone = 'paper' | 'night';

/**
 * The launch app is light-only, with a small set of intentional night routes.
 * Keep status-bar contrast tied to the rendered surface instead of the device
 * appearance so route transitions remain deterministic.
 */
export function statusBarStyleForSurface(tone: SystemSurfaceTone): 'dark' | 'light' {
  return tone === 'night' ? 'light' : 'dark';
}
