import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => {
  type Effect = () => void | (() => void);
  type Slot =
    | { kind: 'state'; value: unknown }
    | { kind: 'ref'; value: { current: unknown } }
    | {
        kind: 'effect';
        cleanup?: () => void;
        deps: readonly unknown[] | undefined;
      };

  let cursor = 0;
  let slots: Slot[] = [];
  let pendingEffects: { index: number; effect: Effect }[] = [];

  function sameDeps(
    left: readonly unknown[] | undefined,
    right: readonly unknown[] | undefined,
  ): boolean {
    if (left === undefined || right === undefined || left.length !== right.length) return false;
    return left.every((value, index) => Object.is(value, right[index]));
  }

  return {
    beginRender() {
      cursor = 0;
      pendingEffects = [];
    },
    useState<T>(initial: T | (() => T)) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = {
          kind: 'state',
          value: typeof initial === 'function' ? (initial as () => T)() : initial,
        };
      }
      const slot = slots[index];
      if (slot.kind !== 'state') throw new Error(`Hook ${index} is not state`);
      const setState = (next: T | ((current: T) => T)) => {
        const current = slot.value as T;
        slot.value = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      };
      return [slot.value as T, setState] as const;
    },
    useRef<T>(initial: T) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: 'ref', value: { current: initial } };
      const slot = slots[index];
      if (slot.kind !== 'ref') throw new Error(`Hook ${index} is not a ref`);
      return slot.value as { current: T };
    },
    useEffect(effect: Effect, deps?: readonly unknown[]) {
      const index = cursor++;
      const previous = slots[index];
      if (previous?.kind === 'effect' && sameDeps(previous.deps, deps)) return;
      previous?.kind === 'effect' && previous.cleanup?.();
      slots[index] = { kind: 'effect', deps };
      pendingEffects.push({ index, effect });
    },
    flushEffects() {
      for (const pending of pendingEffects) {
        const cleanup = pending.effect();
        const slot = slots[pending.index];
        if (slot?.kind === 'effect') slot.cleanup = cleanup ?? undefined;
      }
      pendingEffects = [];
    },
    unmount() {
      for (const slot of slots) {
        if (slot?.kind === 'effect') slot.cleanup?.();
      }
      slots = [];
      pendingEffects = [];
      cursor = 0;
    },
  };
});

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: hooks.useEffect,
    useRef: hooks.useRef,
    useState: hooks.useState,
  };
});

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@/components/ui', () => ({ Text: 'Text' }));
vi.mock('@/features/photos/usePhotos', () => ({ usePhotos: vi.fn() }));
vi.mock('@/theme/tokens', () => ({
  colors: {
    clayDeep: '#000',
    cream: '#fff',
    hairlineStrong: '#000',
    ink: '#000',
    muted: '#777',
    paper: '#fff',
    paperRaised: '#eee',
  },
}));

type Boundary = typeof import('./PhotoStorageGate').PhotoStorageBoundary;
type BoundaryProps = Parameters<Boundary>[0];

let PhotoStorageBoundary: Boundary;

beforeAll(async () => {
  ({ PhotoStorageBoundary } = await import('./PhotoStorageGate'));
});

beforeEach(() => {
  hooks.unmount();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function renderBoundary(props: BoundaryProps): ReturnType<Boundary> {
  hooks.beginRender();
  return PhotoStorageBoundary(props);
}

async function settleValidation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function findHostElement(node: unknown, type: string): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === type && element.props) return { props: element.props };
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findHostElement(child, type);
    if (match) return match;
  }
  return null;
}

function queryWith(
  refetch: () => Promise<{ isError: boolean }>,
  state: Partial<
    Pick<BoundaryProps['query'], 'isError' | 'isFetchedAfterMount' | 'isFetching' | 'isPending'>
  > = {},
): BoundaryProps['query'] {
  return {
    isError: false,
    isFetchedAfterMount: false,
    isFetching: false,
    isPending: false,
    refetch,
    ...state,
  } as BoundaryProps['query'];
}

describe('PhotoStorageBoundary entry validation', () => {
  it('keeps seeded cached children hidden until the mount-specific refetch succeeds', async () => {
    const validation = deferred<{ isError: boolean }>();
    const refetch = vi.fn(() => validation.promise);
    const query = queryWith(refetch);
    const props = { children: 'sensitive timeline', query } satisfies BoundaryProps;

    expect(renderBoundary(props)).not.toBe('sensitive timeline');
    hooks.flushEffects();
    expect(refetch).toHaveBeenCalledOnce();
    expect(renderBoundary(props)).not.toBe('sensitive timeline');

    validation.resolve({ isError: false });
    await settleValidation();

    expect(renderBoundary(props)).toBe('sensitive timeline');

    query.isFetching = true;
    expect(renderBoundary(props)).toBe('sensitive timeline');

    query.isFetching = false;
    query.isError = true;
    expect(renderBoundary(props)).not.toBe('sensitive timeline');
  });

  it('revalidates cached data after remount and only reveals it after a failed entry retry succeeds', async () => {
    const firstMount = deferred<{ isError: boolean }>();
    const failedRemount = deferred<{ isError: boolean }>();
    const successfulRetry = deferred<{ isError: boolean }>();
    const refetch = vi
      .fn<() => Promise<{ isError: boolean }>>()
      .mockImplementationOnce(() => firstMount.promise)
      .mockImplementationOnce(() => failedRemount.promise)
      .mockImplementationOnce(() => successfulRetry.promise);
    const query = queryWith(refetch);
    const props = { children: 'cached private photos', query } satisfies BoundaryProps;

    expect(renderBoundary(props)).not.toBe('cached private photos');
    hooks.flushEffects();
    firstMount.resolve({ isError: false });
    await settleValidation();
    expect(renderBoundary(props)).toBe('cached private photos');

    hooks.unmount();

    expect(renderBoundary(props)).not.toBe('cached private photos');
    hooks.flushEffects();
    expect(refetch).toHaveBeenCalledTimes(2);
    failedRemount.resolve({ isError: true });
    await settleValidation();

    const recovery = renderBoundary(props);
    expect(recovery).not.toBe('cached private photos');
    const retryButton = findHostElement(recovery, 'Pressable');
    expect(retryButton).not.toBeNull();
    (retryButton?.props.onPress as () => void)();
    expect(refetch).toHaveBeenCalledTimes(3);
    expect(renderBoundary(props)).not.toBe('cached private photos');

    successfulRetry.resolve({ isError: false });
    await settleValidation();

    expect(renderBoundary(props)).toBe('cached private photos');
  });

  it('uses a cold query fetch as entry validation and leaves its failure for explicit retry', async () => {
    const retry = deferred<{ isError: boolean }>();
    const refetch = vi.fn(() => retry.promise);
    const query = queryWith(refetch, { isFetching: true, isPending: true });
    const props = { children: 'cold private photos', query } satisfies BoundaryProps;

    expect(renderBoundary(props)).not.toBe('cold private photos');
    hooks.flushEffects();
    expect(refetch).not.toHaveBeenCalled();

    query.isPending = false;
    query.isFetching = false;
    query.isError = true;
    query.isFetchedAfterMount = true;
    expect(renderBoundary(props)).not.toBe('cold private photos');
    hooks.flushEffects();
    await settleValidation();
    const recovery = renderBoundary(props);
    expect(recovery).not.toBe('cold private photos');
    expect(refetch).not.toHaveBeenCalled();

    const retryButton = findHostElement(recovery, 'Pressable');
    (retryButton?.props.onPress as () => void)();
    expect(refetch).toHaveBeenCalledOnce();

    query.isError = false;
    retry.resolve({ isError: false });
    await settleValidation();
    expect(renderBoundary(props)).toBe('cold private photos');
  });

  it('waits for a cached stale query refetch and fails closed when that fetch fails', async () => {
    const refetch = vi.fn<() => Promise<{ isError: boolean }>>();
    const query = queryWith(refetch, { isFetching: true });
    const props = { children: 'stale cached photos', query } satisfies BoundaryProps;

    expect(renderBoundary(props)).not.toBe('stale cached photos');
    hooks.flushEffects();
    expect(refetch).not.toHaveBeenCalled();

    query.isFetching = false;
    query.isError = true;
    query.isFetchedAfterMount = true;
    expect(renderBoundary(props)).not.toBe('stale cached photos');
    hooks.flushEffects();
    await settleValidation();
    expect(renderBoundary(props)).not.toBe('stale cached photos');
    expect(refetch).not.toHaveBeenCalled();
  });

  it('does not accept a same-mount publication until the entry fetch settles', async () => {
    const refetch = vi.fn<() => Promise<{ isError: boolean }>>();
    const query = queryWith(refetch, { isFetching: true });
    const props = { children: 'entry-race private photos', query } satisfies BoundaryProps;

    expect(renderBoundary(props)).not.toBe('entry-race private photos');
    hooks.flushEffects();

    query.isFetchedAfterMount = true;
    expect(renderBoundary(props)).not.toBe('entry-race private photos');
    hooks.flushEffects();
    await settleValidation();
    expect(renderBoundary(props)).not.toBe('entry-race private photos');

    query.isFetching = false;
    expect(renderBoundary(props)).not.toBe('entry-race private photos');
    hooks.flushEffects();
    await settleValidation();
    expect(renderBoundary(props)).toBe('entry-race private photos');

    query.isFetching = true;
    expect(renderBoundary(props)).toBe('entry-race private photos');
    expect(refetch).not.toHaveBeenCalled();
  });
});
