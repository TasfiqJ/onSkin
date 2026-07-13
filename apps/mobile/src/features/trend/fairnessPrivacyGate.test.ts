import { createRequire } from 'node:module';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TrendLayout from '../../app/trend/_layout';
import FairnessScreen from '../../app/trend/fairness';

type DeferredTrendProps = {
  surface: string;
  fallbackRoute: string;
  fallbackLabel: string;
  fallbackBehavior: string;
};

type StackProps = {
  screenLayout: (props: { children: ReactElement }) => ReactElement;
};

const mocks = vi.hoisted(() => ({
  deferredSurface: vi.fn((_props: DeferredTrendProps) => null),
  matchedRouteChild: vi.fn(() => {
    throw new Error('disabled Trend layout mounted its matched child scene');
  }),
  stack: vi.fn((_props: StackProps): ReactNode => null),
  stackScreen: vi.fn((_props: { name: string }): ReactNode => null),
  useMonkBand: vi.fn(() => {
    throw new Error('disabled Trend route queried the private Monk band');
  }),
}));

vi.mock('expo-router', () => ({
  router: {},
  Stack: Object.assign(mocks.stack, { Screen: mocks.stackScreen }),
}));
vi.mock('react-native', () => ({ ScrollView: 'ScrollView', View: 'View' }));
vi.mock('@/components/launch/DeferredSurface', () => ({
  DeferredSurface: mocks.deferredSurface,
}));
vi.mock('@/components/ui', () => ({
  RouteIconButton: 'RouteIconButton',
  Screen: 'Screen',
  Text: 'Text',
}));
vi.mock('@/features/trend/useTrend', () => ({ useMonkBand: mocks.useMonkBand }));
vi.mock('@/lib/launch/phase7', () => ({ phase7Flags: { trend: false } }));
vi.mock('@/lib/navigation/safeBack', () => ({
  APP_PROGRESS_ROUTE: '/(tabs)/progress',
  APP_TREND_OPTIN_ROUTE: '/trend/optin',
  backOrReplace: vi.fn(),
}));
vi.mock('@/theme/tokens', () => ({ colors: {} }));

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup(node: ReactNode): string;
};

describe('Trend fairness privacy gate', () => {
  beforeEach(() => {
    mocks.deferredSurface.mockClear();
    mocks.matchedRouteChild.mockClear();
    mocks.stack.mockReset();
    mocks.stack.mockImplementation(({ screenLayout }) =>
      screenLayout({ children: createElement(mocks.matchedRouteChild) }),
    );
    mocks.stackScreen.mockClear();
    mocks.useMonkBand.mockClear();
  });

  it('keeps the Stack mounted while withholding its disabled matched child scene', () => {
    expect(() => renderToStaticMarkup(createElement(TrendLayout))).not.toThrow();

    expect(mocks.stack).toHaveBeenCalledOnce();
    expect(mocks.stack.mock.calls[0]?.[0].screenLayout).toBeTypeOf('function');
    expect(mocks.matchedRouteChild).not.toHaveBeenCalled();
    expect(mocks.deferredSurface).toHaveBeenCalledOnce();
    expect(mocks.deferredSurface.mock.calls[0]?.[0]).toEqual({
      surface: 'trend',
      fallbackRoute: '/(tabs)/progress',
      fallbackLabel: 'Back to Progress',
      fallbackBehavior: 'replace',
    });
  });

  it('does not mount the Monk-band hook on a disabled direct entry', () => {
    expect(() => renderToStaticMarkup(createElement(FairnessScreen))).not.toThrow();

    expect(mocks.useMonkBand).not.toHaveBeenCalled();
    expect(mocks.deferredSurface).toHaveBeenCalledOnce();
    expect(mocks.deferredSurface.mock.calls[0]?.[0]).toEqual({
      surface: 'trend',
      fallbackRoute: '/(tabs)/progress',
      fallbackLabel: 'Back to Progress',
      fallbackBehavior: 'replace',
    });
  });
});
