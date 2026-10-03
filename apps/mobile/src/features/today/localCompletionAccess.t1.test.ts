import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import {
  completionQueryScope,
  completionActionStateForLease,
  createCompletionActionState,
  createCompletionViewLifecycle,
  runWithCompletionLease,
} from './localCompletionAccess';

function grant(ownerUserId = 't1-owner') {
  setActiveHealthProcessingEpoch(1, { ownerUserId, accountGeneration: 0 });
  return captureHealthDataWriteLease();
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { clearActiveHealthProcessingEpoch(); grant(); });
afterEach(() => { clearActiveHealthProcessingEpoch(); });

describe('T1 exact local completion authority', () => {
  it('separates every owner/account/consent generation, even an identical epoch re-grant', () => {
    const a = captureHealthDataWriteLease();
    const changed: HealthDataWriteLease[] = [
      { ...a, ownerUserId: 'other' },
      { ...a, accountGeneration: a.accountGeneration + 1 },
      { ...a, generation: a.generation + 1 },
      { ...a, epoch: a.epoch + 1 },
    ];
    for (const lease of changed) expect(completionQueryScope(lease)).not.toEqual(completionQueryScope(a));
    clearActiveHealthProcessingEpoch();
    expect(completionQueryScope(grant())).not.toEqual(completionQueryScope(a));
    expect(completionQueryScope(undefined)).toEqual(['closed']);
  });

  it('rejects a closed or stale captured query before invoking private storage', async () => {
    const read = vi.fn(async () => new Set(['AM:private']));
    await expect(runWithCompletionLease(undefined, read)).rejects.toThrow();
    const expected = captureHealthDataWriteLease();
    clearActiveHealthProcessingEpoch();
    grant('other');
    await expect(runWithCompletionLease(expected, read)).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  it.each(['owner', 'withdrawal', 'regrant'] as const)(
    'does not return a private snapshot after an in-flight %s transition', async (transition) => {
      const expected = captureHealthDataWriteLease();
      const gate = deferred();
      const read = vi.fn(async () => { await gate.promise; return new Set(['AM:private']); });
      const pending = runWithCompletionLease(expected, read);
      // Attach rejection handling before releasing the async boundary.
      const rejected = expect(pending).rejects.toThrow();
      await Promise.resolve();
      clearActiveHealthProcessingEpoch();
      if (transition !== 'withdrawal') grant(transition === 'owner' ? 'other' : 't1-owner');
      gate.resolve();
      await rejected;
    },
  );

  it('returns a successful current-authority snapshot without network access', async () => {
    const expected = captureHealthDataWriteLease();
    const data = new Set(['AM:local']);
    await expect(runWithCompletionLease(expected, () => data)).resolves.toBe(data);
  });
});

describe('T1 synchronous action and recovery barrier', () => {
  it('admits exactly one tap before React can render pending state', () => {
    const state = createCompletionActionState();
    expect(state.begin('AM:a')).toBe(true);
    expect(state.begin('AM:a')).toBe(false);
    expect(state.begin('AM:b')).toBe(false);
    expect(state.begin('reload', true)).toBe(false);
    expect(state.pendingKey).toBe('AM:a');
    state.finish();
    expect(state.begin('AM:b')).toBe(true);
  });

  it('keeps failed and ambiguous writes blocked until explicit successful recovery', () => {
    const state = createCompletionActionState();
    expect(state.begin('AM:a')).toBe(true);
    state.requireRecovery();
    state.finish();
    expect(state.begin('AM:a')).toBe(false);
    expect(state.begin('reload', true)).toBe(true);
    state.finish(); // A failed retry is NOT a successful recovery.
    expect(state.failed).toBe(true);
    expect(state.begin('AM:b')).toBe(false);
    expect(state.begin('PM:b')).toBe(false); // A presentation phase cannot clear failure.
    expect(state.begin('reload', true)).toBe(true);
    state.confirmRecovery();
    state.finish();
    expect(state.begin('AM:b')).toBe(true);
  });

  it('refuses stale authority rather than treating unsubscribe as authority closure', () => {
    let current = true;
    const state = createCompletionActionState('scope', () => current);
    const detach = state.subscribe(vi.fn());
    detach();
    expect(state.begin('AM:a')).toBe(true);
    current = false;
    expect(state.active).toBe(false);
    const before = state.getSnapshot();
    state.requireRecovery(); state.confirmRecovery(); state.finish();
    expect(state.getSnapshot()).toBe(before);
    expect(state.begin('reload', true)).toBe(false);
  });
});

// The registry owns one instance per exact storage lease, not a mounted route.
it('keys the gate only to storage authority and retains failure across midnight and AM/PM', () => {
  const storageKey = JSON.stringify(completionQueryScope(captureHealthDataWriteLease()));
  const state = createCompletionActionState(storageKey);
  expect(state.storageKey).toBe(storageKey);
  expect(state.begin('AM:product')).toBe(true);
  expect(state.begin('PM:product')).toBe(false);
  state.requireRecovery();
  state.finish();
  expect(state.pendingKey).toBeNull();
  expect(state.failed).toBe(true);
  expect(state.begin('PM:product')).toBe(false);
  expect(state.begin('reload', true)).toBe(true);
  state.confirmRecovery();
  state.finish();
  expect(state.begin('PM:product')).toBe(true);
});


describe('T1-R4 coordinator ownership and subscriptions', () => {
  it('reuses the exact coordinator across reacquisition and lease object copies', () => {
    const lease = captureHealthDataWriteLease();
    const state = completionActionStateForLease(lease);
    state.begin('AM:product');
    const detach = state.subscribe(vi.fn()); detach();
    const replacement = completionActionStateForLease({ ...lease });
    expect(replacement).toBe(state);
    expect(replacement.pendingKey).toBe('AM:product');
    expect(replacement.begin('PM:product')).toBe(false);
    state.finish();
  });

  it('retains failed settlement with no subscribers until post-settlement recovery', () => {
    const lease = captureHealthDataWriteLease();
    const state = completionActionStateForLease(lease);
    const detach = state.subscribe(vi.fn()); state.begin('AM:product'); detach();
    state.requireRecovery(); state.finish();
    const replacement = completionActionStateForLease(lease);
    expect(replacement.failed).toBe(true);
    expect(replacement.begin('PM:product')).toBe(false);
    expect(replacement.begin('reload', true)).toBe(true);
    replacement.confirmRecovery(); replacement.finish();
    expect(replacement.failed).toBe(false);
  });

  it('notifies replacement observers but never a detached view, including StrictMode resubscription', () => {
    const state = completionActionStateForLease(captureHealthDataWriteLease());
    const old = vi.fn(), replacement = vi.fn();
    const detachOld = state.subscribe(old); detachOld(); detachOld();
    const detachReplacement = state.subscribe(replacement);
    state.begin('AM:product'); state.requireRecovery(); state.finish();
    expect(old).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(3);
    detachReplacement();
  });

  it('provides immutable stable snapshots and emits only actual changes', () => {
    const state = createCompletionActionState(); const changed = vi.fn();
    const detach = state.subscribe(changed); const first = state.getSnapshot();
    expect(state.getSnapshot()).toBe(first); expect(Object.isFrozen(first)).toBe(true);
    state.finish(); state.confirmRecovery(); expect(changed).not.toHaveBeenCalled();
    state.begin('AM:product'); const pending = state.getSnapshot();
    expect(pending).not.toBe(first); expect(first.pendingKey).toBeNull();
    expect(Object.isFrozen(pending)).toBe(true);
    state.begin('AM:product'); expect(changed).toHaveBeenCalledTimes(1); detach();
  });

  it('isolates throwing and detached-during-notification observers', () => {
    const state = createCompletionActionState(); const next = vi.fn();
    let detachNext: () => void = () => undefined;
    const detachThrowing = state.subscribe(() => { detachNext(); throw new Error('observer'); });
    detachNext = state.subscribe(next); const stable = vi.fn(); const detachStable = state.subscribe(stable);
    expect(() => state.begin('AM:product')).not.toThrow();
    expect(next).not.toHaveBeenCalled(); expect(stable).toHaveBeenCalledTimes(1);
    detachThrowing(); detachStable();
  });

  it.each(['owner', 'epoch', 'account', 'regrant'] as const)(
    'isolates an old coordinator across %s changes and rejects stale lookup without evicting the successor', (change) => {
      const lease = captureHealthDataWriteLease(); const old = completionActionStateForLease(lease);
      old.begin('AM:product');
      clearActiveHealthProcessingEpoch();
      setActiveHealthProcessingEpoch(change === 'epoch' ? 2 : 1, {
        ownerUserId: change === 'owner' ? 'other' : 't1-owner',
        accountGeneration: change === 'account' ? 1 : 0,
      });
      const nextLease = captureHealthDataWriteLease(); const next = completionActionStateForLease(nextLease);
      expect(next).not.toBe(old); expect(next.begin('PM:product')).toBe(true);
      const snapshot = next.getSnapshot();
      old.requireRecovery(); old.confirmRecovery(); old.finish();
      expect(next.getSnapshot()).toBe(snapshot);
      expect(completionActionStateForLease(lease).active).toBe(false);
      expect(completionActionStateForLease(nextLease)).toBe(next);
      expect(next.pendingKey).toBe('PM:product'); next.finish();
    },
  );

  it('closes on withdrawal and keeps the closed sentinel permanently non-actionable', () => {
    const old = completionActionStateForLease(captureHealthDataWriteLease()); old.begin('AM:a');
    clearActiveHealthProcessingEpoch(); const closed = completionActionStateForLease(undefined);
    expect(old.active).toBe(false); expect(closed.begin('reload', true)).toBe(false);
    closed.confirmRecovery(); closed.finish(); expect(closed.active).toBe(false);
    const next = completionActionStateForLease(grant()); expect(next).not.toBe(old);
    expect(next.pendingKey).toBeNull(); expect(next.failed).toBe(false);
  });
});


describe('T1-R5 per-view lifecycle without mutable hook values', () => {
  it('starts inactive with an immutable handle and no publicly writable active bit', () => {
    const view = createCompletionViewLifecycle('storage-scope');
    expect(view.isActive()).toBe(false);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.hasOwn(view, 'active')).toBe(false);
    expect(Reflect.set(view, 'storageKey', 'transplanted')).toBe(false);
    expect(view.storageKey).toBe('storage-scope');
    view.activate(); expect(view.isActive()).toBe(true);
    view.deactivate(); expect(view.isActive()).toBe(false);
  });

  it('cleanup affects only its captured view while a same-authority replacement stays active', () => {
    const state = completionActionStateForLease(captureHealthDataWriteLease());
    const oldView = createCompletionViewLifecycle(state.storageKey);
    const oldCallback = () => oldView.isActive();
    const cleanup = () => oldView.deactivate();
    oldView.activate(); expect(oldCallback()).toBe(true);
    cleanup();
    const nextView = createCompletionViewLifecycle(state.storageKey);
    nextView.activate(); cleanup();
    expect(nextView).not.toBe(oldView);
    expect(oldCallback()).toBe(false);
    expect(nextView.isActive()).toBe(true);
    expect(nextView.storageKey).toBe(oldView.storageKey);
  });

  it('permits StrictMode setup-cleanup-setup without changing another view or the storage gate', () => {
    const state = completionActionStateForLease(captureHealthDataWriteLease());
    state.begin('AM:product');
    const before = state.getSnapshot();
    const view = createCompletionViewLifecycle(state.storageKey);
    const other = createCompletionViewLifecycle(state.storageKey);
    other.activate(); view.activate(); view.deactivate(); view.activate();
    expect(view.isActive()).toBe(true);
    expect(other.isActive()).toBe(true);
    expect(state.getSnapshot()).toBe(before);
    view.deactivate(); other.deactivate(); state.finish();
  });

  it.each(['owner', 'epoch', 'account', 'regrant'] as const)(
    'a %s successor cannot reactivate or transplant the old view or release its own pending gate', (change) => {
      const lease = captureHealthDataWriteLease();
      const old = completionActionStateForLease(lease);
      const oldView = createCompletionViewLifecycle(old.storageKey);
      const oldCallback = () => oldView.isActive() && old.active;
      const cleanup = () => oldView.deactivate();
      oldView.activate(); old.begin('AM:product'); cleanup();
      clearActiveHealthProcessingEpoch();
      setActiveHealthProcessingEpoch(change === 'epoch' ? 2 : 1, {
        ownerUserId: change === 'owner' ? 'other' : 't1-owner',
        accountGeneration: change === 'account' ? 1 : 0,
      });
      const next = completionActionStateForLease(captureHealthDataWriteLease());
      const nextView = createCompletionViewLifecycle(next.storageKey);
      nextView.activate(); next.begin('PM:product'); const snapshot = next.getSnapshot();
      cleanup(); old.requireRecovery(); old.finish();
      expect(oldCallback()).toBe(false);
      expect(oldView.isActive()).toBe(false);
      expect(nextView.isActive()).toBe(true);
      expect(oldView.storageKey).toBe(old.storageKey);
      expect(oldView.storageKey).not.toBe(nextView.storageKey);
      expect(next.getSnapshot()).toBe(snapshot);
      nextView.deactivate(); next.finish();
    },
  );

  it('view detach leaves pending and recovery intact until storage settlement and explicit recovery', () => {
    const lease = captureHealthDataWriteLease();
    const state = completionActionStateForLease(lease);
    const view = createCompletionViewLifecycle(state.storageKey);
    view.activate(); state.begin('AM:product'); const pending = state.getSnapshot();
    view.deactivate(); expect(state.getSnapshot()).toBe(pending);
    const next = createCompletionViewLifecycle(state.storageKey); next.activate();
    expect(completionActionStateForLease(lease)).toBe(state);
    expect(state.begin('PM:product')).toBe(false);
    state.requireRecovery(); state.finish(); const failed = state.getSnapshot();
    next.deactivate(); next.activate();
    expect(state.getSnapshot()).toBe(failed);
    expect(state.begin('PM:product')).toBe(false);
    expect(state.begin('reload', true)).toBe(true);
    state.confirmRecovery(); state.finish(); next.deactivate();
    expect(state.failed).toBe(false);
  });
});
