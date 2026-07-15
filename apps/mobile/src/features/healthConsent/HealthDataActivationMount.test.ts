import { createElement, useEffect, useState } from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MountedGoalsActivationInterlock } from './HealthDataActivationMount';

vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@/components/ui', () => ({ Button: 'Button', Text: 'Text' }));

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
          { activationPending: true, failed: false, onAcknowledge: acknowledge },
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
          { activationPending: false, failed: false, onAcknowledge: acknowledge },
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
});
