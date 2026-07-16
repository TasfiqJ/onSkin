export type PendingDataRightsAction = 'withdraw_health_data' | 'delete_account';
export type DataRightsAction = 'export' | PendingDataRightsAction;

export type DataRightsState =
  | Readonly<{ phase: 'idle' }>
  | Readonly<{ phase: 'confirming'; action: PendingDataRightsAction }>
  | Readonly<{ phase: 'running'; action: DataRightsAction; operationId: number }>;

export const IDLE_DATA_RIGHTS_STATE: DataRightsState = Object.freeze({ phase: 'idle' });

export function beginDataRightsConfirmation(
  current: DataRightsState,
  action: PendingDataRightsAction,
): DataRightsState | null {
  if (current.phase !== 'idle') return null;
  return Object.freeze({ phase: 'confirming', action });
}

export function cancelDataRightsConfirmation(current: DataRightsState): DataRightsState | null {
  return current.phase === 'confirming' ? IDLE_DATA_RIGHTS_STATE : null;
}

export function beginDataRightsOperation(
  current: DataRightsState,
  action: DataRightsAction,
  operationId: number,
): DataRightsState | null {
  const canStartExport = action === 'export' && current.phase === 'idle';
  const canStartConfirmedAction =
    action !== 'export' && current.phase === 'confirming' && current.action === action;
  if (!canStartExport && !canStartConfirmedAction) return null;
  return Object.freeze({ phase: 'running', action, operationId });
}

export function settleDataRightsOperation(
  current: DataRightsState,
  operationId: number,
): DataRightsState | null {
  if (current.phase !== 'running' || current.operationId !== operationId) return null;
  return IDLE_DATA_RIGHTS_STATE;
}
