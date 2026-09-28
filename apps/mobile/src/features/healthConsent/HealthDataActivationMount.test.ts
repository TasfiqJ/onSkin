import { createElement, useEffect, useState } from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MountedGoalsActivationInterlock } from './HealthDataActivationMount';

const mocks = vi.hoisted(() => ({
  slotMounts: 0,
  slotUnmounts: 0,
}));

vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@/components/ui', () => ({ Button: 'Button', Text: 'Text' }));
vi.mock('@/features/widgets/RoutineWidgetLifecycleHost', async () => {
  const React = await import('react');
  return {
    RoutineWidgetLifecycleSlot: (props: unknown) => {
      React.useEffect(() => {
        mocks.slotMounts += 1;
        return () => {
          mocks.slotUnmounts += 1;
        };
      }, []);
      return React.createElement('RoutineWidgetLifecycleSlot', props as object);
    },
  };
});

let renderer: ReactTestRenderer | null = null;
let mounts = 0;
let unmounts = 0;

function StatefulRouteChild() {
  const [value, setValue] = useState(0);
  useEffect(() => {
    mounts += 1;
    return () => {
      unmounts += 1;
    };
  }, []);
  return createElement(View, {
    testID: 'route-child',
    accessibilityLabel: String(value),
    onTouchEnd: () => setValue((current) => current + 1),
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mounts = 0;
  unmounts = 0;
  mocks.slotMounts = 0;
  mocks.slotUnmounts = 0;
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('mounted goals activation interlock', () => {
  it('releases the barrier without remounting or resetting the route child', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      renderer = create(
        createElement(
          MountedGoalsActivationInterlock,
          {
            activationPending: true,
            failed: false,
            routineWidgetAuthority: null,
            onAcknowledge: acknowledge,
          },
          createElement(StatefulRouteChild),
        ),
      );
      await Promise.resolve();
    });

    const pendingViews = renderer!.root.findAllByType(View);
    expect(pendingViews[1]!.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(renderer!.root.findAllByProps({ accessibilityViewIsModal: true })).toHaveLength(1);
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);

    await act(async () => {
      renderer!.root.findByProps({ testID: 'route-child' }).props.onTouchEnd();
    });
    expect(renderer!.root.findByProps({ testID: 'route-child' }).props.accessibilityLabel).toBe(
      '1',
    );

    await act(async () => {
      renderer!.update(
        createElement(
          MountedGoalsActivationInterlock,
          {
            activationPending: false,
            failed: false,
            routineWidgetAuthority: {
              ownerUserId: 'owner-a',
              processingEpoch: 1,
            },
            onAcknowledge: acknowledge,
          },
          createElement(StatefulRouteChild),
        ),
      );
    });

    const releasedViews = renderer!.root.findAllByType(View);
    expect(releasedViews[1]!.props).toMatchObject({
      pointerEvents: 'auto',
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
    });
    expect(renderer!.root.findAllByProps({ accessibilityViewIsModal: true })).toHaveLength(0);
    expect(renderer!.root.findByProps({ testID: 'route-child' }).props.accessibilityLabel).toBe(
      '1',
    );
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
  });

  it('retains the route and widget host while privacy blocking overlays change', async () => {
    const acknowledge = vi.fn().mockResolvedValue(undefined);
    const renderInterlock = (privacyCheckMessage: string | null) =>
      createElement(
        MountedGoalsActivationInterlock,
        {
          activationPending: false,
          failed: false,
          routineWidgetAuthority: { ownerUserId: 'owner-a', processingEpoch: 1 },
          privacyCheckMessage,
          onAcknowledge: acknowledge,
        },
        createElement(StatefulRouteChild),
      );

    await act(async () => {
      renderer = create(renderInterlock(null));
    });
    expect(mounts).toBe(1);
    expect(mocks.slotMounts).toBe(1);

    await act(async () => {
      renderer!.update(renderInterlock('Securing recent routine updates'));
    });
    expect(renderer!.root.findAllByProps({ accessibilityViewIsModal: true })).toHaveLength(1);
    expect(renderer!.root.findAllByType(View)[1]!.props).toMatchObject({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(mocks.slotMounts).toBe(1);
    expect(mocks.slotUnmounts).toBe(0);

    await act(async () => {
      renderer!.update(renderInterlock('Revalidating health-data access'));
    });
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(mocks.slotMounts).toBe(1);
    expect(mocks.slotUnmounts).toBe(0);

    await act(async () => {
      renderer!.update(renderInterlock(null));
    });
    expect(renderer!.root.findAllByProps({ accessibilityViewIsModal: true })).toHaveLength(0);
    expect(renderer!.root.findAllByType(View)[1]!.props).toMatchObject({
      pointerEvents: 'auto',
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
    });
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(mocks.slotMounts).toBe(1);
    expect(mocks.slotUnmounts).toBe(0);
  });
});
