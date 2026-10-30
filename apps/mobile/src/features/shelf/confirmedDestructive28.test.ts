import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  AsyncStorage,
  beforeRaw28,
  button28,
  cleanup28,
  CONTENT_KEY28,
  grant26,
  holdRead28,
  KEY28,
  mount28,
  ports26,
  press28,
  retire28,
  setup28,
  settle28,
  waitEntered28,
} from './destructiveCommit28TestPorts';
import { subscribeShelfMirrorOutboxChanges } from './store';
import { updatePrivateItem } from '@/lib/storage/privateKV';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import { setActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

beforeEach(setup28);
afterEach(cleanup28);

// These controls measure cancellable preparation. They require zero native
// Shelf writes, exact prior encrypted/outbox bytes and no success navigation.
for (const label of ['Remove completely', 'Mark discarded']) {
  it(`${label}: retires a queued write before it acquires the per-key slot`, async () => {
    await mount28();
    await press28('More options');
    const gate = holdRead28();
    const blocker = updatePrivateItem(KEY28, (raw) => raw);
    await waitEntered28(gate);
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    await act(async () => {
      button28(label).props.onPress();
    });
    await retire28('query-replacement');
    gate.release();
    await blocker;
    await settle28();
    expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
    expect(ports26.back).not.toHaveBeenCalled();
  });

  it(`${label}: preserves bytes across a real account-generation transition while private read is pending`, async () => {
    await mount28();
    await press28('More options');
    const gate = holdRead28();
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    await act(async () => {
      button28(label).props.onPress();
    });
    await waitEntered28(gate);
    await act(async () => {
      beginAccountGenerationBoundary();
      endAccountGenerationBoundary();
      await grant26();
    });
    gate.release();
    await settle28();
    expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
    expect(ports26.back).not.toHaveBeenCalled();
  });

  it(`${label}: refuses an expired current grant before native invocation`, async () => {
    const generation = await runAccountGenerationOperation((lease) => lease.generation);
    setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-first-value-a',
      accountGeneration: generation,
      serverVerifiedAt: new Date().toISOString(),
    });
    await mount28();
    await press28('More options');
    const gate = holdRead28();
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    await act(async () => {
      button28(label).props.onPress();
    });
    await waitEntered28(gate);
    const expiredNow = Date.now() + 6 * 60 * 1000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(expiredNow);
    gate.release();
    await settle28();
    clock.mockRestore();
    expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
    expect(ports26.back).not.toHaveBeenCalled();
  });
  for (const stage of ['private-read', 'conflict-read', 'content-key']) {
    it.each([
      'query-replacement',
      'query-ABA',
      'unmount',
      'same-owner-regrant',
      'owner-ABA',
      'withdrawal',
    ])(`${label}: denies %s during ${stage} before native write`, async (retirement) => {
      await mount28();
      await press28('More options');
      const notify = vi.fn();
      const unsubscribe = subscribeShelfMirrorOutboxChanges(notify);
      try {
        const gate =
          stage === 'content-key'
            ? holdRead28(CONTENT_KEY28)
            : holdRead28(KEY28, stage === 'conflict-read' ? 2 : 1);
        const writes = vi.spyOn(AsyncStorage, 'setItem');
        await act(async () => {
          button28(label).props.onPress();
        });
        await waitEntered28(gate);
        expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
        await retire28(retirement);
        gate.release();
        await settle28();
        expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
        expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
        expect(notify).not.toHaveBeenCalled();
        expect(ports26.back).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    });
  }

  it.each(['query-replacement', 'query-ABA', 'snapshot-replacement', 'invalidation', 'unmount'])(
    `${label}: refuses %s before dispatch and never revives the captured callback`,
    async (retirement) => {
      await mount28();
      await press28('More options');
      const callback = button28(label).props.onPress;
      const writes = vi.spyOn(AsyncStorage, 'setItem');
      await retire28(retirement);
      await act(async () => {
        callback();
        callback();
      });
      await settle28();
      expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
      expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
      expect(ports26.back).not.toHaveBeenCalled();
    },
  );
}
