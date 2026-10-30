import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  AsyncStorage,
  beforeRaw28,
  button28,
  cleanup28,
  client28,
  holdRead28,
  holdWrite28,
  id28,
  KEY28,
  mount28,
  ports26,
  press28,
  retire28,
  screen28,
  setup28,
  settle28,
  state28,
  waitEntered28,
} from './destructiveCommit28TestPorts';
import { subscribeShelfMirrorOutboxChanges } from './store';

beforeEach(setup28);
afterEach(cleanup28);

async function assertCommitted28(label: string, originalOutbox: unknown[]) {
  const state = await state28();
  expect(state.mirrorOutbox.slice(0, originalOutbox.length)).toEqual(originalOutbox);
  expect(state.mirrorOutbox).toHaveLength(originalOutbox.length + 1);
  const operation = state.mirrorOutbox.at(-1)!;
  if (label === 'Remove completely') {
    expect(state.products).toEqual([]);
    expect(operation).toMatchObject({ kind: 'delete', productId: id28 });
  } else {
    expect(state.products).toHaveLength(1);
    expect(state.products[0]).toMatchObject({ id: id28, status: 'discarded' });
    expect(operation).toMatchObject({ kind: 'upsert', payload: { id: id28, status: 'discarded' } });
  }
}

for (const label of ['Remove completely', 'Mark discarded']) {
  it(`${label}: valid explicit confirmation persists exactly one item/outbox change and confirms canonical readback`, async () => {
    const originalOutbox = (await state28()).mirrorOutbox;
    await mount28();
    await press28('More options');
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    await press28(label);
    await settle28();
    await assertCommitted28(label, originalOutbox);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
    expect(client28.getQueryState(['shelf'])?.status).toBe('success');
    expect(ports26.back).toHaveBeenCalledTimes(1);
  });

  for (const storeBeforeSettlement of [false, true]) {
    it.each(['query-replacement', 'query-ABA', 'unmount'])(
      `${label}: suppresses stale %s publication after native invocation (stored=${storeBeforeSettlement}) without UI rollback`,
      async (retirement) => {
        const originalOutbox = (await state28()).mirrorOutbox;
        await mount28();
        await press28('More options');
        const notify = vi.fn();
        const unsubscribe = subscribeShelfMirrorOutboxChanges(notify);
        try {
          const gate = holdWrite28(storeBeforeSettlement);
          await act(async () => {
            button28(label).props.onPress();
          });
          await waitEntered28(gate);
          expect(ports26.bytes.get(KEY28) === beforeRaw28).toBe(!storeBeforeSettlement);
          await retire28(retirement);
          gate.release();
          await settle28();
          await assertCommitted28(label, originalOutbox);
          expect(gate.spy.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
          expect(notify).toHaveBeenCalledTimes(1);
          expect(ports26.back).not.toHaveBeenCalled();
        } finally {
          unsubscribe();
        }
      },
    );
  }

  it.each([
    'query-replacement',
    'query-ABA',
    'snapshot-replacement',
    'refetch-restarted',
    'unmount',
  ])(
    `${label}: refuses stale %s publication during canonical refetch while preserving committed item/outbox`,
    async (retirement) => {
      const originalOutbox = (await state28()).mirrorOutbox;
      await mount28();
      await press28('More options');
      const gate = holdRead28(KEY28, 3);
      const writes = vi.spyOn(AsyncStorage, 'setItem');
      await act(async () => {
        button28(label).props.onPress();
      });
      await waitEntered28(gate);
      expect(ports26.bytes.get(KEY28)).not.toBe(beforeRaw28);
      expect(ports26.back).not.toHaveBeenCalled();
      await retire28(retirement);
      gate.release();
      await settle28();
      await assertCommitted28(label, originalOutbox);
      expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
      expect(ports26.back).not.toHaveBeenCalled();
    },
  );

  it(`${label}: permits an idempotent reinvalidation that produces no Query transition while its canonical readback is pending`, async () => {
    const originalOutbox = (await state28()).mirrorOutbox;
    await mount28();
    await press28('More options');
    const gate = holdRead28(KEY28, 3);
    await act(async () => {
      button28(label).props.onPress();
    });
    await waitEntered28(gate);
    const query = client28.getQueryCache().find({ queryKey: ['shelf'], exact: true })!;
    const before = query.state;
    const transitions = vi.fn();
    const unsubscribe = client28.getQueryCache().subscribe((event) => {
      if (event.query === query && (event.type === 'updated' || event.type === 'removed'))
        transitions(event);
    });
    try {
      await retire28('invalidation');
      expect(query.state).toBe(before);
      expect(transitions).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
    gate.release();
    await settle28();
    await assertCommitted28(label, originalOutbox);
    expect(ports26.back).toHaveBeenCalledTimes(1);
  });

  it(`${label}: joins duplicate taps while native write is unsettled and retains one outbox event`, async () => {
    const originalOutbox = (await state28()).mirrorOutbox;
    await mount28();
    await press28('More options');
    const callback = button28(label).props.onPress;
    const gate = holdWrite28(true);
    await act(async () => {
      callback();
      callback();
      callback();
    });
    await waitEntered28(gate);
    await act(async () => {
      callback();
    });
    gate.release();
    await settle28();
    await assertCommitted28(label, originalOutbox);
    expect(gate.spy.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
    expect(ports26.back).toHaveBeenCalledTimes(1);
  });

  it(`${label}: permits one fresh confirmation after a previously confirmed private-read operation retires`, async () => {
    const originalOutbox = (await state28()).mirrorOutbox;
    await mount28();
    await press28('More options');
    const oldCallback = button28(label).props.onPress;
    const gate = holdRead28();
    const writes = vi.spyOn(AsyncStorage, 'setItem');
    await act(async () => {
      oldCallback();
    });
    await waitEntered28(gate);
    await retire28('snapshot-replacement');
    gate.release();
    await settle28();
    expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
    expect((await state28()).mirrorOutbox).toEqual(originalOutbox);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
    expect(ports26.back).not.toHaveBeenCalled();
    await press28('Close product options');
    await press28('More options');
    await act(async () => {
      oldCallback();
    });
    await settle28();
    expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(0);
    await press28(label);
    await settle28();
    await assertCommitted28(label, originalOutbox);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
    expect(ports26.back).toHaveBeenCalledTimes(1);
  });

  it.each(['same-owner-regrant', 'owner-ABA'])(
    `${label}: retains original health compensation after %s while native storage is unsettled`,
    async (retirement) => {
      await mount28();
      await press28('More options');
      const notify = vi.fn();
      const unsubscribe = subscribeShelfMirrorOutboxChanges(notify);
      try {
        const gate = holdWrite28(true);
        await act(async () => {
          button28(label).props.onPress();
        });
        await waitEntered28(gate);
        expect(ports26.bytes.get(KEY28)).not.toBe(beforeRaw28);
        await retire28(retirement);
        gate.release();
        await settle28();
        expect(ports26.bytes.get(KEY28)).toBe(beforeRaw28);
        expect(gate.spy.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(2);
        expect(notify).not.toHaveBeenCalled();
        expect(ports26.back).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it(`${label}: keeps committed bytes and truthful unconfirmed state when canonical readback fails`, async () => {
    const originalOutbox = (await state28()).mirrorOutbox;
    await mount28();
    await press28('More options');
    const original = AsyncStorage.setItem;
    const writes = vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
      await original(key, raw);
      if (key === KEY28) ports26.failRead = KEY28;
    });
    await press28(label);
    await settle28();
    expect(client28.getQueryState(['shelf'])?.status).toBe('error');
    expect(ports26.back).not.toHaveBeenCalled();
    if (screen28?.root.findAllByType('Modal' as never).length) {
      expect(
        screen28.root
          .findAllByType('Text' as never)
          .some((node) => node.props.accessibilityRole === 'alert'),
      ).toBe(true);
    }
    ports26.failRead = null;
    await assertCommitted28(label, originalOutbox);
    expect(writes.mock.calls.filter(([key]) => key === KEY28)).toHaveLength(1);
  });
}
