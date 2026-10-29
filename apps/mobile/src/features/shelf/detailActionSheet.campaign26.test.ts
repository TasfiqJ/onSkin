import { randomUUID } from 'node:crypto';
import { createElement, StrictMode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { close26, flush26, grant26, ports26, profile26, reset26 } from './firstValue26TestPorts';
import ProductDetailScreen from '@/app/shelf/[id]';
import ShelfLayout from '@/app/shelf/_layout';
import { IntakeProvider } from './IntakeContext';
import { addProduct, loadShelf } from './store';
import type { useShelf } from './useShelf';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

// Actual route, layout, Query, authority, encrypted Shelf and mutations. Only
// native rendering/storage/router/absent external transport are platform ports.
let client: QueryClient;
let screen: ReactTestRenderer | undefined;
let id: string;
type Source = NonNullable<ReturnType<typeof useShelf>['data']>;
const productName = 'Synthetic long product name '.repeat(4).trim();
function button(label: string): ReactTestInstance {
  const found = screen!.root
    .findAllByType('Pressable' as never)
    .find(
      (node) =>
        node.props.accessibilityLabel === label ||
        node.findAllByType('Text' as never).some((text) => text.props.children === label),
    );
  expect(found, label).toBeDefined();
  return found!;
}
async function press(label: string) {
  await act(async () => {
    button(label).props.onPress();
  });
  await flush26();
}
async function mount() {
  ports26.params = { id };
  ports26.routeName = '[id]';
  ports26.routeChild = createElement(ProductDetailScreen);
  await act(async () => {
    screen = create(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client },
          createElement(IntakeProvider, null, createElement(ShelfLayout)),
        ),
      ),
    );
  });
  for (let n = 0; n < 10 && !client.getQueryData(['shelf']); n++) await flush26();
  await flush26();
}
async function open() {
  await press('More options');
}
async function rows() {
  return loadShelf();
}
beforeEach(async () => {
  client = await reset26();
  await profile26();
  const product = await addProduct({
    operationId: randomUUID(),
    name: productName,
    category: 'moisturiser',
    addedVia: 'manual',
  });
  id = product.id;
});
afterEach(async () => {
  if (screen)
    await act(async () => {
      screen!.unmount();
    });
  screen = undefined;
  vi.restoreAllMocks();
  await close26(client);
});

it.each([
  [360, 640],
  [375, 667],
  [390, 844],
  [430, 932],
  [360, 420],
])(
  'mounts a bounded heading-and-action scroll region with safe area at %ix%i (structure only)',
  async (width, height) => {
    ports26.dimensions = { width, height, fontScale: 2 };
    ports26.insets = { top: 24, bottom: 34, left: 0, right: 0 };
    await mount();
    await open();
    const modal = screen!.root.findByType('Modal' as never);
    expect(modal.props.transparent).toBe(true);
    const scroll = modal
      .findAllByType('ScrollView' as never)
      .find((node) =>
        node
          .findAllByType('Pressable' as never)
          .some((action) => action === button('Remove completely')),
      )!;
    expect(scroll).toBeDefined();
    expect(scroll.props.style).toMatchObject({ flexShrink: 1, minHeight: 0 });
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(
      scroll
        .findAllByType('Text' as never)
        .some((text) => text.props.children === 'Remove from shelf?'),
    ).toBe(true);
    expect(scroll.findAllByType('Pressable' as never)).toContain(button('Close product options'));
    expect(
      modal
        .findAllByType('View' as never)
        .some(
          (node) =>
            node.props.style?.maxHeight <= height - 44 && node.props.style?.paddingBottom >= 52,
        ),
    ).toBe(true);
    expect(modal.findByType('KeyboardAvoidingView' as never).props.behavior).toBe('height');
    expect(await rows()).toHaveLength(1);
  },
);

it.each(['Close product options', 'Dismiss Remove from shelf?'])(
  'retires captured Remove synchronously when %s cancels',
  async (cancel) => {
    await mount();
    await open();
    const oldRemove = button('Remove completely').props.onPress;
    await act(async () => {
      button(cancel).props.onPress();
      oldRemove();
    });
    await flush26();
    expect(await rows()).toHaveLength(1);
    expect(ports26.back).not.toHaveBeenCalled();
    await open();
    await act(async () => {
      oldRemove();
    });
    expect(await rows()).toHaveLength(1);
  },
);

it('keeps native Escape a cancellation and refuses its old destructive callback', async () => {
  await mount();
  await open();
  const remove = button('Remove completely').props.onPress;
  await act(async () => {
    screen!.root.findByType('Modal' as never).props.onRequestClose();
    remove();
  });
  await flush26();
  expect(await rows()).toHaveLength(1);
  expect(ports26.back).not.toHaveBeenCalled();
});

it('removes only after explicit confirmation and confirms the real canonical readback', async () => {
  await mount();
  await open();
  expect(await rows()).toHaveLength(1);
  await press('Remove completely');
  await flush26();
  expect(await rows()).toEqual([]);
  expect(client.getQueryData<Source>(['shelf'])?.items).toEqual([]);
  expect(ports26.back).toHaveBeenCalledTimes(1);
});

it('archives through the real store instead of deleting on discard confirmation', async () => {
  await mount();
  await open();
  await press('Mark discarded');
  await flush26();
  const stored = await rows();
  expect(stored).toHaveLength(1);
  expect(stored[0]?.status).toBe('discarded');
  expect(client.getQueryData<Source>(['shelf'])?.archive[0]?.id).toBe(id);
  expect(ports26.back).toHaveBeenCalledTimes(1);
});

it('joins duplicate explicit confirmations while actual private storage is pending', async () => {
  await mount();
  await open();
  const remove = button('Remove completely').props.onPress;
  ports26.holdRead = 'layerwell.shelf.v1';
  await act(async () => {
    remove();
    remove();
    remove();
  });
  await flush26();
  expect(ports26.back).not.toHaveBeenCalled();
  expect(button('Remove completely').props.disabled).toBe(true);
  ports26.release?.();
  await flush26();
  await flush26();
  expect(await rows()).toEqual([]);
  expect(ports26.back).toHaveBeenCalledTimes(1);
});

it.each(['same-owner', 'owner-ABA', 'withdrawal'])(
  'refuses a captured Remove after %s retirement',
  async (retirement) => {
    await mount();
    await open();
    const remove = button('Remove completely').props.onPress;
    const before = ports26.bytes.get('layerwell.shelf.v1');
    await act(async () => {
      if (retirement === 'owner-ABA') await grant26('synthetic-first-value-b');
      if (retirement === 'withdrawal') clearActiveHealthProcessingEpoch();
      else await grant26();
      remove();
    });
    await flush26();
    expect(ports26.bytes.get('layerwell.shelf.v1')).toBe(before);
    expect(ports26.back).not.toHaveBeenCalled();
  },
);

it.each(['invalidated', 'replaced-query', 'replaced-snapshot'])(
  'refuses the captured confirmation when canonical source is %s',
  async (mode) => {
    await mount();
    await open();
    const remove = button('Remove completely').props.onPress;
    const before = ports26.bytes.get('layerwell.shelf.v1');
    const data = client.getQueryData<Source>(['shelf'])!;
    await act(async () => {
      if (mode === 'invalidated')
        await client.invalidateQueries({ queryKey: ['shelf'], refetchType: 'none' });
      else if (mode === 'replaced-query') {
        client.removeQueries({ queryKey: ['shelf'] });
        client.setQueryData(['shelf'], data);
      } else
        client.setQueryData(
          ['shelf'],
          { ...data, sourceDate: '2099-01-01' },
          { updatedAt: Date.now() + 1 },
        );
      remove();
    });
    await flush26();
    expect(ports26.bytes.get('layerwell.shelf.v1') === before).toBe(true);
    expect(ports26.back).not.toHaveBeenCalled();
  },
);

it('refuses the queued old confirmation during a genuine failed read and retry', async () => {
  await mount();
  await open();
  const remove = button('Remove completely').props.onPress;
  const before = ports26.bytes.get('layerwell.shelf.v1');
  ports26.failRead = 'layerwell.shelf.v1';
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'] });
    remove();
  });
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  ports26.failRead = null;
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'] });
    remove();
  });
  await flush26();
  expect(ports26.bytes.get('layerwell.shelf.v1')).toBe(before);
  expect(ports26.back).not.toHaveBeenCalled();
});

it('refuses captured actions after unmount', async () => {
  await mount();
  await open();
  const remove = button('Remove completely').props.onPress;
  await act(async () => {
    screen!.unmount();
  });
  screen = undefined;
  await act(async () => {
    remove();
  });
  expect(await rows()).toHaveLength(1);
  expect(ports26.back).not.toHaveBeenCalled();
});

it('keeps a refused encrypted write truthful and permits a fresh explicit retry', async () => {
  await mount();
  await open();
  ports26.failWrite = 'layerwell.shelf.v1';
  await press('Remove completely');
  await flush26();
  expect(await rows()).toHaveLength(1);
  expect(ports26.back).not.toHaveBeenCalled();
  expect(
    screen!.root
      .findAllByType('Text' as never)
      .some((text) => text.props.accessibilityRole === 'alert'),
  ).toBe(true);
  ports26.failWrite = null;
  await press('Remove completely');
  await flush26();
  expect(await rows()).toEqual([]);
  expect(ports26.back).toHaveBeenCalledTimes(1);
});

it('cancels an explicitly confirmed pending store write when the health grant retires', async () => {
  await mount();
  await open();
  const before = ports26.bytes.get('layerwell.shelf.v1');
  ports26.holdRead = 'layerwell.shelf.v1';
  await act(async () => {
    button('Remove completely').props.onPress();
  });
  await flush26();
  expect(ports26.release).not.toBeNull();
  await act(async () => {
    await grant26();
    ports26.release?.();
  });
  await flush26();
  expect(ports26.bytes.get('layerwell.shelf.v1') === before).toBe(true);
  expect(ports26.back).not.toHaveBeenCalled();
});

it('does not report success when a committed removal cannot be read back canonically', async () => {
  await mount();
  await open();
  vi.spyOn(ports26.bytes, 'set').mockImplementation((key, raw) => {
    Map.prototype.set.call(ports26.bytes, key, raw);
    if (key === 'layerwell.shelf.v1') ports26.failRead = key;
    return ports26.bytes;
  });
  await press('Remove completely');
  await flush26();
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  expect(ports26.back).not.toHaveBeenCalled();
  ports26.failRead = null;
  expect(await rows()).toEqual([]);
});

it('requires a fresh confirmation after genuine refetch reuses the same canonical snapshot', async () => {
  await mount();
  await open();
  const oldRemove = button('Remove completely').props.onPress;
  const data = client.getQueryData(['shelf']);
  const before = ports26.bytes.get('layerwell.shelf.v1');
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'] });
    expect(client.getQueryData(['shelf'])).toBe(data);
    oldRemove();
  });
  await flush26();
  expect(ports26.bytes.get('layerwell.shelf.v1') === before).toBe(true);
  expect(ports26.back).not.toHaveBeenCalled();
  await press('Close product options');
  await open();
  await press('Remove completely');
  await flush26();
  expect(await rows()).toEqual([]);
  expect(ports26.back).toHaveBeenCalledTimes(1);
});

it('cannot revive an old confirmation through Query reset and identical snapshot/count restoration', async () => {
  await mount();
  await open();
  const remove = button('Remove completely').props.onPress;
  const query = client.getQueryCache().find({ queryKey: ['shelf'], exact: true })!;
  const data = client.getQueryData(['shelf']);
  const admittedCount = query.state.dataUpdateCount;
  const before = ports26.bytes.get('layerwell.shelf.v1');
  await act(async () => {
    query.reset();
    for (let n = 0; n < admittedCount; n++) client.setQueryData(['shelf'], data);
    expect(query.state.dataUpdateCount).toBe(admittedCount);
    expect(client.getQueryData(['shelf'])).toBe(data);
    remove();
  });
  await flush26();
  expect(ports26.bytes.get('layerwell.shelf.v1') === before).toBe(true);
  expect(ports26.back).not.toHaveBeenCalled();
  await press('Close product options');
  await open();
  await press('Remove completely');
  await flush26();
  expect(await rows()).toEqual([]);
  expect(ports26.back).toHaveBeenCalledTimes(1);
});
