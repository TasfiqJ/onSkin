import type { RoutineWidgetLifecycleAuthorityInput } from './lifecycleCoordinator';

export { mountRoutineWidgetLifecycle } from './lifecycleCoordinator';

export const ROUTINE_WIDGET_RECONCILIATION_HEADROOM_MS = 0;
export const ROUTINE_WIDGET_PRE_CLOSE_DRAIN_TIMEOUT_MS = 1_000;

export type RoutineWidgetPreCloseDrainResult = Readonly<{
  status: 'drained' | 'failed' | 'skipped' | 'timed_out';
}>;

/** Non-iOS stays cleanup-only and never imports the native publication graph. */
export function drainRoutineWidgetOutboxBeforeHealthLeaseClose(
  _input: RoutineWidgetLifecycleAuthorityInput,
): Promise<RoutineWidgetPreCloseDrainResult> {
  return Promise.resolve(Object.freeze({ status: 'skipped' }));
}
