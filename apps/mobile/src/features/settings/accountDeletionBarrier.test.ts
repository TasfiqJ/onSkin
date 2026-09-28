import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  beginAccountDeletionIntakeHold,
  isAccountActivityBlockedForDeletion,
  isAccountActivityDurablyBlockedForDeletion,
  isAccountDeletionIntakeHoldActive,
  setAccountActivityBlockedForDeletion,
  subscribeToAccountDeletionActivityBlock,
  subscribeToAccountDeletionIntakeHold,
} from './accountDeletionBarrier';

afterEach(() => {
  setAccountActivityBlockedForDeletion(true);
});

describe('temporary account-deletion intake hold', () => {
  it('keeps effective admission closed until every temporary owner releases', () => {
    setAccountActivityBlockedForDeletion(false);
    const blocked = vi.fn();
    const lifecycle = vi.fn();
    const unsubscribeBlocked = subscribeToAccountDeletionActivityBlock(blocked);
    const unsubscribeLifecycle = subscribeToAccountDeletionIntakeHold(lifecycle);

    const releaseFirst = beginAccountDeletionIntakeHold();
    const releaseSecond = beginAccountDeletionIntakeHold();

    expect(isAccountActivityDurablyBlockedForDeletion()).toBe(false);
    expect(isAccountDeletionIntakeHoldActive()).toBe(true);
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
    expect(blocked).toHaveBeenCalledOnce();
    expect(lifecycle).toHaveBeenCalledExactlyOnceWith(true);

    releaseFirst();
    releaseFirst();
    expect(isAccountDeletionIntakeHoldActive()).toBe(true);
    expect(isAccountActivityBlockedForDeletion()).toBe(true);
    expect(lifecycle).toHaveBeenCalledTimes(1);

    releaseSecond();
    expect(isAccountDeletionIntakeHoldActive()).toBe(false);
    expect(isAccountActivityBlockedForDeletion()).toBe(false);
    expect(lifecycle).toHaveBeenNthCalledWith(2, false);

    unsubscribeBlocked();
    unsubscribeLifecycle();
  });

  it('hands a temporary hold to durable authority without an admission-open edge', () => {
    setAccountActivityBlockedForDeletion(false);
    const observed: boolean[] = [];
    const release = beginAccountDeletionIntakeHold();

    observed.push(isAccountActivityBlockedForDeletion());
    setAccountActivityBlockedForDeletion(true);
    observed.push(isAccountActivityBlockedForDeletion());
    release();
    observed.push(isAccountActivityBlockedForDeletion());

    expect(observed).toEqual([true, true, true]);
    expect(isAccountDeletionIntakeHoldActive()).toBe(false);
    expect(isAccountActivityDurablyBlockedForDeletion()).toBe(true);
  });
});
