import { createElement, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import TabsLayout from '@/app/(tabs)/_layout';
import { colors } from '@/theme/tokens';

const ports = vi.hoisted(() => ({ bottom: 0, phase: 'AM', path: '/shelf' }));
vi.mock('react-native', () => ({ Text: 'Text' }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: ports.bottom }) }));
vi.mock('expo-router', async () => {
  const { createElement } = await import('react');
  const Tabs = Object.assign((props: Record<string, unknown>) => createElement('Tabs', props), {
    Screen: (props: Record<string, unknown>) => createElement('TabScreen', props),
  });
  return { Tabs, router: { push: vi.fn() }, usePathname: () => ports.path };
});
vi.mock('@/features/today/useRoutineClock', () => ({ useRoutineClock: () => ({ phase: ports.phase }) }));
vi.mock('@/features/notifications/BehaviouralTriggers', () => ({ BehaviouralTriggers: () => null }));
vi.mock('@/features/subscription/lifecycle', () => ({ pendingLifecycleRoute: vi.fn() }));
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/auth/accountGeneration', () => ({ runAccountGenerationOperation: vi.fn() }));
vi.mock('./DockMotion', () => ({ DockButton: 'DockButton', FloatingDock: 'FloatingDock' }));
vi.mock('./TabBarIcon', () => ({ TabBarIcon: 'TabBarIcon' }));

let rendered: ReactTestRenderer;
function options() {
  return rendered.root.findByType('Tabs' as never).props.screenOptions;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.bottom = 0; ports.phase = 'AM'; ports.path = '/shelf';
});
afterEach(async () => { await act(async () => rendered?.unmount()); });

it('measures wrapped enlarged labels and returns to normal height with matching scene reserve', async () => {
  await act(async () => { rendered = create(createElement(TabsLayout)); });
  expect(options().tabBarStyle.height).toBe(72);
  expect(options().sceneStyle.paddingBottom).toBe(96);
  const label = options().tabBarLabel({ children: 'Progress', color: colors.ink }) as ReactElement<{
    allowFontScaling: boolean; numberOfLines?: number; maxFontSizeMultiplier?: number;
    onLayout: (event: { nativeEvent: { layout: { height: number } } }) => void;
  }>;
  expect(label.props.allowFontScaling).toBe(true);
  expect(label.props.numberOfLines).toBeUndefined();
  expect(label.props.maxFontSizeMultiplier).toBeUndefined();
  await act(async () => { label.props.onLayout({ nativeEvent: { layout: { height: 64 } } }); });
  expect(options().tabBarStyle.height).toBe(120);
  expect(options().sceneStyle.paddingBottom).toBe(144);
  expect(options().tabBarItemStyle.minHeight).toBeGreaterThanOrEqual(48);
  await act(async () => { label.props.onLayout({ nativeEvent: { layout: { height: 16 } } }); });
  expect(options().tabBarStyle.height).toBe(72);
});

it('retains all four tab identities and PM colors while reserving the safe area', async () => {
  ports.bottom = 34; ports.phase = 'PM'; ports.path = '/today';
  await act(async () => { rendered = create(createElement(TabsLayout)); });
  expect(rendered.root.findAllByType('TabScreen' as never).map(node => [node.props.name, node.props.options.title]))
    .toEqual([['today', 'Today'], ['progress', 'Progress'], ['shelf', 'Shelf'], ['you', 'You']]);
  expect(options().sceneStyle.paddingBottom).toBe(118);
  expect(options().tabBarInactiveTintColor).toBe(colors.mutedLight);
  expect(options().tabBarActiveTintColor).toBe(colors.cream);
});
