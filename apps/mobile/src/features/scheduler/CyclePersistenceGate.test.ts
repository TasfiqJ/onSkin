import { createElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CyclePersistenceGate } from './CyclePersistenceGate';

// Presentation-only tests: query states are fixtures here. Exact authority and
// storage readiness are exercised by cyclePersistence.regression.test.ts.
const mocks = vi.hoisted(() => ({
  cadence: true,
  isLoading: false,
  isError: false,
  data: undefined as object | undefined,
  refetch: vi.fn(async () => undefined),
  query: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('./useCycle', () => ({
  useCycleConfig: () => {
    mocks.query();
    return {
      isLoading: mocks.isLoading, isError: mocks.isError,
      data: mocks.data, refetch: mocks.refetch,
    };
  },
}));
vi.mock('@/features/routine/reviewGate', () => ({ canUseRoutineCadence: () => mocks.cadence }));
vi.mock('expo-router', () => ({ router: { replace: mocks.replace } }));
vi.mock('@/lib/navigation/safeBack', () => ({ APP_HOME_ROUTE: '/today' }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@/components/ui', async () => {
  const { createElement: element } = await import('react');
  const component = (name: string) => (props: { children?: ReactNode; label?: string }) =>
    element(name, props, props.children ?? props.label);
  return { Screen: component('Screen'), Text: component('Text'), Button: component('Button') };
});

let renderer: ReactTestRenderer | null = null;
async function mount() {
  await act(async () => {
    renderer = create(createElement(
      CyclePersistenceGate,
      null,
      createElement('Editor', { testID: 'cycle-editor' }),
    ));
  });
}
function editorCount() {
  return renderer?.root.findAllByProps({ testID: 'cycle-editor' }).length ?? 0;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.cadence = true; mocks.isLoading = false; mocks.isError = false; mocks.data = undefined;
  mocks.refetch.mockClear(); mocks.query.mockClear(); mocks.replace.mockClear();
});
afterEach(async () => {
  if (renderer) await act(async () => { renderer?.unmount(); });
  renderer = null;
});

describe('cycle persistence gate presentation', () => {
  it('keeps the existing closed professional-review surface in control', async () => {
    mocks.cadence = false; await mount();
    expect(editorCount()).toBe(1); expect(mocks.query).not.toHaveBeenCalled();
  });
  it('never mounts an editor while the authoritative read is loading', async () => {
    mocks.isLoading = true; await mount(); expect(editorCount()).toBe(0);
  });
  it('shows read failure and invokes reload without mounting an empty editor', async () => {
    mocks.isError = true; await mount(); expect(editorCount()).toBe(0);
    const reload = renderer!.root.findAllByProps({ label: 'Reload saved cycle' })[0]!;
    await act(async () => { await reload.props.onPress(); });
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it('does not treat retained data on an errored query as readiness', async () => {
    mocks.isError = true; mocks.data = {}; await mount(); expect(editorCount()).toBe(0);
  });
  it('mounts children only after the read has succeeded', async () => {
    mocks.data = {}; await mount(); expect(editorCount()).toBe(1);
  });
});
