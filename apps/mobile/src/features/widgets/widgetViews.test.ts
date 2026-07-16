import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TodayWidget, { RoutineKindTodayWidgetLayout } from './TodayWidget.ios';
import TonightActivity, { RoutineKindEveningActivityLayout } from './TonightActivity.ios';
import {
  ROUTINE_WIDGET_CHECK_OFF_TARGET,
  ROUTINE_WIDGET_TODAY_DEEP_LINK,
  ROUTINE_WIDGET_TODAY_DEEP_LINKS,
  createRoutineWidgetProps,
  normalizeRoutineWidgetProps,
  type RoutineLiveActivityProps,
  type RoutineWidgetProps,
} from './contract';

vi.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  HStack: 'HStack',
  Image: 'Image',
  Spacer: 'Spacer',
  Text: 'Text',
  VStack: 'VStack',
}));

vi.mock('@expo/ui/swift-ui/modifiers', () => {
  const modifier =
    (name: string) =>
    (...args: unknown[]) => ({ modifier: name, args });
  return {
    activityBackgroundTint: modifier('activityBackgroundTint'),
    buttonStyle: modifier('buttonStyle'),
    containerBackground: modifier('containerBackground'),
    controlSize: modifier('controlSize'),
    font: modifier('font'),
    foregroundStyle: modifier('foregroundStyle'),
    monospacedDigit: modifier('monospacedDigit'),
    padding: modifier('padding'),
    privacySensitive: modifier('privacySensitive'),
    tint: modifier('tint'),
    widgetURL: modifier('widgetURL'),
  };
});

vi.mock('expo-widgets', () => ({
  createWidget: (name: string, layout: unknown) => ({ kind: 'widget', name, layout }),
  createLiveActivity: (name: string, layout: unknown) => ({ kind: 'activity', name, layout }),
}));

const TOKEN_ONE = '00000000-0000-4000-8000-000000000001';
const TOKEN_TWO = '00000000-0000-4000-8000-000000000002';
const TOKEN_THREE = '00000000-0000-4000-8000-000000000003';

type ModifierMarker = { modifier: string; args: unknown[] };

function propsOf(element: ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

function collectElements(node: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(collectElements);
  if (isValidElement(node)) {
    return [node, ...collectElements(propsOf(node).children)];
  }
  if (node && typeof node === 'object') {
    return Object.values(node).flatMap(collectElements);
  }
  return [];
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isValidElement(node)) return textContent(propsOf(node).children as ReactNode);
  return '';
}

function modifiersOf(element: ReactElement): ModifierMarker[] {
  const modifiers = propsOf(element).modifiers;
  return Array.isArray(modifiers) ? (modifiers as ModifierMarker[]) : [];
}

function environment(
  widgetFamily: 'systemSmall' | 'systemMedium' | 'accessoryRectangular' | 'accessoryInline',
) {
  return {
    date: new Date(2_000),
    widgetFamily,
    colorScheme: 'light' as const,
    configuration: undefined,
  };
}

function interactiveProps(): RoutineWidgetProps {
  const base = createRoutineWidgetProps({
    phase: 'PM',
    localDate: '2026-07-16',
    completedCount: 1,
    totalCount: 3,
    actionTokens: [TOKEN_TWO, TOKEN_THREE],
    deepLink: ROUTINE_WIDGET_TODAY_DEEP_LINK,
    updatedAtMs: 1_000,
    staleAtMs: 10_000,
  });
  const normalized = normalizeRoutineWidgetProps({
    ...base,
    pendingActionTokens: [TOKEN_ONE],
    interactionRevision: 1,
  });
  if (!normalized) throw new Error('test fixture must be valid');
  return normalized;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RoutineKind Today WidgetKit view', () => {
  it('registers exactly the configured widget kind', () => {
    expect(TodayWidget as unknown).toMatchObject({
      kind: 'widget',
      name: 'RoutineKindToday',
    });
  });

  it('uses the WidgetKit container background and exact static Today URL', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const root = RoutineKindTodayWidgetLayout(interactiveProps(), environment('systemMedium'));
    const rootModifiers = modifiersOf(root);

    expect(rootModifiers).toContainEqual({
      modifier: 'containerBackground',
      args: ['#F5F1EA', 'widget'],
    });
    expect(rootModifiers).toContainEqual({
      modifier: 'widgetURL',
      args: [ROUTINE_WIDGET_TODAY_DEEP_LINK],
    });
    expect(rootModifiers).toContainEqual({ modifier: 'privacySensitive', args: [] });
  });

  it('uses and preserves each validated build-variant URL', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000);
    for (const deepLink of Object.values(ROUTINE_WIDGET_TODAY_DEEP_LINKS)) {
      const props = normalizeRoutineWidgetProps({ ...interactiveProps(), deepLink });
      expect(props).not.toBeNull();
      const root = RoutineKindTodayWidgetLayout(props!, environment('systemMedium'));
      expect(modifiersOf(root)).toContainEqual({ modifier: 'widgetURL', args: [deepLink] });
      const button = collectElements(root).find((element) => element.type === 'Button');
      expect(button).toBeDefined();
      now.mockReturnValue(3_000);
      expect((propsOf(button!).onPress as () => RoutineWidgetProps)().deepLink).toBe(deepLink);
      now.mockReturnValue(2_000);
    }
  });

  it('persists an optimistic check-off as a closed-schema pending outbox transition', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const root = RoutineKindTodayWidgetLayout(interactiveProps(), environment('systemMedium'));
    const button = collectElements(root).find((element) => element.type === 'Button');
    expect(button).toBeDefined();
    expect(propsOf(button!).target).toBe(ROUTINE_WIDGET_CHECK_OFF_TARGET);

    now.mockReturnValue(3_000);
    const onPress = propsOf(button!).onPress as () => RoutineWidgetProps;
    const next = onPress();

    expect(next).toMatchObject({
      status: 'ready',
      completedCount: 2,
      totalCount: 3,
      actionTokens: [TOKEN_THREE],
      pendingActionTokens: [TOKEN_ONE, TOKEN_TWO],
      interactionRevision: 2,
      deepLink: ROUTINE_WIDGET_TODAY_DEEP_LINK,
      updatedAtMs: 3_000,
    });
    expect(next.actionTokens).toHaveLength(next.totalCount - next.completedCount);
    expect(next.pendingActionTokens).toHaveLength(2);
    expect(Object.keys(next).sort()).toEqual(
      [
        'actionTokens',
        'completedCount',
        'deepLink',
        'interactionRevision',
        'localDate',
        'pendingActionTokens',
        'phase',
        'schemaVersion',
        'staleAtMs',
        'status',
        'totalCount',
        'updatedAtMs',
      ].sort(),
    );
  });

  it('fails a boundary-time press closed without dropping the existing outbox', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const root = RoutineKindTodayWidgetLayout(interactiveProps(), environment('systemSmall'));
    const button = collectElements(root).find((element) => element.type === 'Button');
    expect(button).toBeDefined();

    now.mockReturnValue(10_000);
    const stale = (propsOf(button!).onPress as () => RoutineWidgetProps)();
    expect(stale).toMatchObject({
      status: 'stale',
      phase: 'none',
      completedCount: 0,
      totalCount: 0,
      actionTokens: [],
      pendingActionTokens: [TOKEN_ONE],
      interactionRevision: 1,
    });
    expect(stale.pendingActionTokens).not.toContain(TOKEN_TWO);
  });

  it('fails clock rollback and an overlong display lease closed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(999);
    const rollback = RoutineKindTodayWidgetLayout(interactiveProps(), environment('systemMedium'));
    expect(textContent(rollback)).toContain('Open RoutineKind to refresh');
    expect(collectElements(rollback).some((element) => element.type === 'Button')).toBe(false);
    expect(textContent(rollback)).not.toContain('1 of 3');

    now.mockReturnValue(2_000);
    const overlong = RoutineKindTodayWidgetLayout(
      { ...interactiveProps(), staleAtMs: 301_001 },
      environment('systemMedium'),
    );
    expect(textContent(overlong)).toContain('Open RoutineKind to refresh');
    expect(collectElements(overlong).some((element) => element.type === 'Button')).toBe(false);
    expect(textContent(overlong)).not.toContain('1 of 3');
  });

  it('treats an explicit stale status as generic even before its timestamp expires', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const stale = createRoutineWidgetProps({
      status: 'stale',
      localDate: '2026-07-16',
      deepLink: ROUTINE_WIDGET_TODAY_DEEP_LINK,
      updatedAtMs: 1_000,
      staleAtMs: 10_000,
    });
    const root = RoutineKindTodayWidgetLayout(stale, environment('systemSmall'));

    expect(textContent(root)).toContain('Open RoutineKind to refresh');
    expect(textContent(root)).not.toContain('Morning routine');
    expect(textContent(root)).not.toContain('Evening routine');
    expect(collectElements(root).some((element) => element.type === 'Button')).toBe(false);
  });

  it('never renders an interactive control in accessory families and marks counts private', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    for (const family of ['accessoryInline', 'accessoryRectangular'] as const) {
      const root = RoutineKindTodayWidgetLayout(interactiveProps(), environment(family));
      const elements = collectElements(root);
      expect(elements.some((element) => element.type === 'Button')).toBe(false);
      const count = elements.find(
        (element) => element.type === 'Text' && textContent(element).includes('1 of 3'),
      );
      expect(count).toBeDefined();
      expect(modifiersOf(count!).some((modifier) => modifier.modifier === 'privacySensitive')).toBe(
        true,
      );
    }
  });

  it('rejects unknown App Group fields without rendering injected detail or a button', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const injected = { ...interactiveProps(), productName: 'Secret retinoid' };
    const root = RoutineKindTodayWidgetLayout(injected, environment('systemMedium'));
    const elements = collectElements(root);

    expect(elements.some((element) => element.type === 'Button')).toBe(false);
    expect(textContent(root)).toContain('Open RoutineKind to refresh');
    expect(textContent(root)).not.toContain('Secret retinoid');
    expect(textContent(root)).not.toContain('1 of 3');
  });

  it('fails null or non-object App Group state closed without throwing', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    for (const value of [null, [], 'bad']) {
      expect(() =>
        RoutineKindTodayWidgetLayout(
          value as unknown as RoutineWidgetProps,
          environment('systemSmall'),
        ),
      ).not.toThrow();
      const root = RoutineKindTodayWidgetLayout(
        value as unknown as RoutineWidgetProps,
        environment('systemSmall'),
      );
      expect(textContent(root)).toContain('Open RoutineKind to refresh');
      expect(collectElements(root).some((element) => element.type === 'Button')).toBe(false);
    }
  });
});

describe('RoutineKind passive Evening Live Activity view', () => {
  const props: RoutineLiveActivityProps = {
    schemaVersion: 1,
    status: 'in_progress',
    completedCount: 1,
    totalCount: 3,
    updatedAtMs: 1_000,
    staleAtMs: 10_000,
  };

  it('registers one factory with the runtime-only Live Activity name', () => {
    expect(TonightActivity as unknown).toMatchObject({
      kind: 'activity',
      name: 'RoutineKindEvening',
    });
  });

  it('renders only generic evening copy and privacy-sensitive counts with no controls', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const layout = RoutineKindEveningActivityLayout(props, {
      colorScheme: 'light',
      isLuminanceReduced: false,
    });
    const elements = collectElements(layout);
    const countElements = elements.filter(
      (element) => element.type === 'Text' && /1(?: of |\/)3/.test(textContent(element)),
    );

    expect(textContent(layout.banner)).toContain('Evening routine');
    expect(elements.some((element) => element.type === 'Button')).toBe(false);
    expect(countElements.length).toBeGreaterThan(0);
    for (const element of countElements) {
      expect(
        modifiersOf(element).some((modifier) => modifier.modifier === 'privacySensitive'),
      ).toBe(true);
    }
    for (const root of [layout.banner, layout.bannerSmall, layout.expandedCenter]) {
      expect(modifiersOf(root).some((modifier) => modifier.modifier === 'privacySensitive')).toBe(
        true,
      );
    }
    const statusElements = elements.filter(
      (element) => element.type === 'Text' && textContent(element) === 'In progress',
    );
    expect(statusElements.length).toBeGreaterThan(0);
    for (const element of statusElements) {
      expect(
        modifiersOf(element).some((modifier) => modifier.modifier === 'privacySensitive'),
      ).toBe(true);
    }
  });

  it('fails clock rollback, overlong leases, and stale non-zero counts closed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(999);
    const rollback = RoutineKindEveningActivityLayout(props, {
      colorScheme: 'light',
    });
    expect(textContent(rollback.banner)).toContain('Open RoutineKind to refresh');
    expect(textContent(rollback.banner)).not.toMatch(/1(?: of |\/)3/);

    now.mockReturnValue(2_000);
    const overlong = RoutineKindEveningActivityLayout(
      { ...props, staleAtMs: 301_001 },
      { colorScheme: 'light' },
    );
    expect(textContent(overlong.banner)).toContain('Open RoutineKind to refresh');
    expect(textContent(overlong.banner)).not.toMatch(/1(?: of |\/)3/);

    const malformedStale = RoutineKindEveningActivityLayout(
      { ...props, status: 'stale' },
      { colorScheme: 'light' },
    );
    expect(textContent(malformedStale.banner)).toContain('Open RoutineKind to refresh');
    expect(textContent(malformedStale.banner)).not.toMatch(/1(?: of |\/)3/);
  });

  it('keeps valid stale zero-count state generic before its expiry timestamp', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    const stale = RoutineKindEveningActivityLayout(
      { ...props, status: 'stale', completedCount: 0, totalCount: 0 },
      { colorScheme: 'light' },
    );
    const allText = Object.values(stale)
      .map((node) => textContent(node))
      .join(' ');
    expect(allText).toContain('Open RoutineKind to refresh');
    expect(allText).not.toMatch(/\d+(?: of |\/)\d+/);
  });

  it('fails unknown or expired state closed and hides its counts', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const injected = { ...props, productName: 'Secret acid' };
    const layout = RoutineKindEveningActivityLayout(injected, {
      colorScheme: 'dark',
      isLuminanceReduced: true,
    });
    const allText = Object.values(layout)
      .map((node) => textContent(node))
      .join(' ');

    expect(allText).toContain('Open RoutineKind to refresh');
    expect(allText).not.toContain('Secret acid');
    expect(allText).not.toMatch(/1(?: of |\/)3/);
  });

  it('fails null Live Activity state closed without throwing', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    expect(() =>
      RoutineKindEveningActivityLayout(null as unknown as RoutineLiveActivityProps, {
        colorScheme: 'light',
      }),
    ).not.toThrow();
    const layout = RoutineKindEveningActivityLayout(null as unknown as RoutineLiveActivityProps, {
      colorScheme: 'light',
    });
    expect(textContent(layout.banner)).toContain('Open RoutineKind to refresh');
  });
});
