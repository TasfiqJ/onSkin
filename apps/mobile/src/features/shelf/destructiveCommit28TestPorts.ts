// Campaign28 tests reuse the existing native-only ports. Query, route, leases,
// codecs, encryption, Shelf mutations and outbox are the actual modules.
import { randomUUID } from 'node:crypto';
import { createElement, StrictMode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { expect, vi } from 'vitest';

import { close26, flush26, grant26, ports26, profile26, reset26 } from './firstValue26TestPorts';
import ProductDetailScreen from '@/app/shelf/[id]';
import ShelfLayout from '@/app/shelf/_layout';
import { IntakeProvider } from './IntakeContext';
import { addProduct, loadShelf, type ShelfMirrorOperation, type ShelfProduct } from './store';
import type { useShelf } from './useShelf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPrivateItem } from '@/lib/storage/privateKV';
import { clearActiveHealthProcessingEpoch } from '@/lib/consent/healthProcessingEpoch';

export { act, AsyncStorage, flush26, grant26, ports26 };
export const KEY28 = 'layerwell.shelf.v1';
export const CONTENT_KEY28 = 'layerwell.private_kv.content_key.v1';
export type Source28 = NonNullable<ReturnType<typeof useShelf>['data']>;
export let client28: QueryClient;
export let screen28: ReactTestRenderer | undefined;
export let id28: string;
export let beforeRaw28: string;
const pendingGates28 = new Set<() => void>();

export async function setup28() {
  client28 = await reset26();
  await profile26();
  id28 = (
    await addProduct({
      operationId: randomUUID(),
      name: 'Synthetic destructive boundary product',
      category: 'moisturiser',
      addedVia: 'manual',
    })
  ).id;
  beforeRaw28 = ports26.bytes.get(KEY28)!;
}
export async function mount28() {
  ports26.params = { id: id28 };
  ports26.routeName = '[id]';
  ports26.routeChild = createElement(ProductDetailScreen);
  await act(async () => {
    screen28 = create(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client: client28 },
          createElement(IntakeProvider, null, createElement(ShelfLayout)),
        ),
      ),
    );
  });
  for (let n = 0; n < 10 && !client28.getQueryData(['shelf']); n++) await flush26();
  await flush26();
}
export function button28(label: string): ReactTestInstance {
  const found = screen28!.root
    .findAllByType('Pressable' as never)
    .find(
      (node) =>
        node.props.accessibilityLabel === label ||
        node.findAllByType('Text' as never).some((text) => text.props.children === label),
    );
  expect(found, label).toBeDefined();
  return found!;
}
export async function press28(label: string) {
  await act(async () => {
    button28(label).props.onPress();
  });
  await flush26();
}
export async function unmount28() {
  if (screen28)
    await act(async () => {
      screen28!.unmount();
    });
  screen28 = undefined;
}
export async function cleanup28() {
  for (const release of pendingGates28) release();
  pendingGates28.clear();
  await settle28();
  await unmount28();
  vi.restoreAllMocks();
  await close26(client28);
}
export const rows28 = () => loadShelf();
export async function state28() {
  return JSON.parse((await getPrivateItem(KEY28))!) as {
    products: ShelfProduct[];
    mirrorOutbox: ShelfMirrorOperation[];
  };
}
export async function settle28() {
  await flush26();
  await flush26();
}

export function holdRead28(key = KEY28, occurrence = 1) {
  const original = AsyncStorage.getItem;
  let count = 0;
  let release: (() => void) | undefined;
  pendingGates28.add(() => release?.());
  vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (storageKey) => {
    const raw = await original(storageKey);
    if (storageKey === key && ++count === occurrence)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return raw;
  });
  return {
    entered: () => release !== undefined,
    release: () => {
      expect(release).toBeTypeOf('function');
      release!();
    },
  };
}
export function holdWrite28(storeBeforeSettlement: boolean) {
  const original = AsyncStorage.setItem;
  let release: (() => void) | undefined;
  pendingGates28.add(() => release?.());
  let held = false;
  const spy = vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, raw) => {
    if (key !== KEY28 || held) return original(key, raw);
    held = true;
    if (storeBeforeSettlement) await original(key, raw);
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    if (!storeBeforeSettlement) await original(key, raw);
  });
  return {
    spy,
    entered: () => release !== undefined,
    release: () => {
      expect(release).toBeTypeOf('function');
      release!();
    },
  };
}
export async function waitEntered28(gate: { entered: () => boolean }) {
  for (let n = 0; n < 12 && !gate.entered(); n++) await flush26();
  expect(gate.entered()).toBe(true);
}
export async function retire28(mode: string) {
  await act(async () => {
    if (mode === 'unmount') {
      await unmount28();
      return;
    }
    if (mode === 'same-owner-regrant') {
      await grant26();
      return;
    }
    if (mode === 'owner-ABA') {
      await grant26('synthetic-first-value-b');
      await grant26();
      return;
    }
    if (mode === 'withdrawal') {
      clearActiveHealthProcessingEpoch();
      return;
    }
    const query = client28.getQueryCache().find({ queryKey: ['shelf'], exact: true })!;
    const data = query.state.data;
    if (mode === 'query-replacement') {
      client28.removeQueries({ queryKey: ['shelf'], exact: true });
      client28.setQueryData(['shelf'], data);
    } else if (mode === 'query-ABA') {
      const count = query.state.dataUpdateCount;
      query.reset();
      for (let n = 0; n < count; n++) client28.setQueryData(['shelf'], data);
    } else if (mode === 'snapshot-replacement') {
      client28.setQueryData(['shelf'], { ...(data as object), sourceDate: '2099-01-01' });
    } else if (mode === 'invalidation') {
      await client28.invalidateQueries({ queryKey: ['shelf'], refetchType: 'none' });
    } else if (mode === 'refetch-restarted') {
      await client28.cancelQueries({ queryKey: ['shelf'] });
      void client28.refetchQueries({ queryKey: ['shelf'] });
    } else throw new Error('UNKNOWN_TEST_RETIREMENT');
  });
}
