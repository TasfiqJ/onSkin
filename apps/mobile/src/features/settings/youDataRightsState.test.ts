import { describe, expect, it } from 'vitest';

import {
  beginDataRightsConfirmation,
  beginDataRightsOperation,
  cancelDataRightsConfirmation,
  IDLE_DATA_RIGHTS_STATE,
  settleDataRightsOperation,
} from './youDataRightsState';

describe('You data-rights state machine', () => {
  it('accepts exactly one export until its matching operation settles', () => {
    const running = beginDataRightsOperation(IDLE_DATA_RIGHTS_STATE, 'export', 1);

    expect(running).toEqual({ phase: 'running', action: 'export', operationId: 1 });
    expect(beginDataRightsOperation(running!, 'export', 2)).toBeNull();
    expect(beginDataRightsConfirmation(running!, 'delete_account')).toBeNull();
    expect(settleDataRightsOperation(running!, 2)).toBeNull();
    expect(settleDataRightsOperation(running!, 1)).toBe(IDLE_DATA_RIGHTS_STATE);
  });

  it('requires an exact destructive confirmation and rejects duplicate execution', () => {
    const confirmation = beginDataRightsConfirmation(
      IDLE_DATA_RIGHTS_STATE,
      'withdraw_health_data',
    );

    expect(beginDataRightsOperation(confirmation!, 'delete_account', 1)).toBeNull();
    const running = beginDataRightsOperation(confirmation!, 'withdraw_health_data', 1);
    expect(running).toEqual({
      phase: 'running',
      action: 'withdraw_health_data',
      operationId: 1,
    });
    expect(beginDataRightsOperation(running!, 'withdraw_health_data', 2)).toBeNull();
  });

  it('rejects a competing confirmation and export while confirmation is open', () => {
    const confirmation = beginDataRightsConfirmation(IDLE_DATA_RIGHTS_STATE, 'delete_account');

    expect(beginDataRightsConfirmation(confirmation!, 'withdraw_health_data')).toBeNull();
    expect(beginDataRightsConfirmation(confirmation!, 'delete_account')).toBeNull();
    expect(beginDataRightsOperation(confirmation!, 'export', 1)).toBeNull();
  });

  it('cancels only a confirmation and leaves running work immutable', () => {
    const confirmation = beginDataRightsConfirmation(IDLE_DATA_RIGHTS_STATE, 'delete_account');
    const running = beginDataRightsOperation(confirmation!, 'delete_account', 7);

    expect(cancelDataRightsConfirmation(confirmation!)).toBe(IDLE_DATA_RIGHTS_STATE);
    expect(cancelDataRightsConfirmation(IDLE_DATA_RIGHTS_STATE)).toBeNull();
    expect(cancelDataRightsConfirmation(running!)).toBeNull();
  });
});
