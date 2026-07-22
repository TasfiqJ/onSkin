import { createElement } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import NoMatchScreen from '../../app/shelf/no-match';
import CatalogSearchScreen from '../../app/shelf/search';

const h = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  reportCatalogIssue: vi.fn(),
  searchCatalog: vi.fn(),
  reset: vi.fn(),
  clear: vi.fn(),
  sessionId: null as string | null,
}));

vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn() },
  useLocalSearchParams: () => h.params,
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  View: 'View',
  useWindowDimensions: () => ({ height: 844, width: 390 }),
}));
vi.mock('@/components/ui', () => ({
  Button: 'Button',
  RouteIconButton: 'RouteIconButton',
  Screen: 'Screen',
  Sheet: 'Sheet',
  Text: 'Text',
}));
vi.mock('@/features/catalog/client', () => ({
  catalogIntakeProvenance: () => ({
    expiryDate: null,
    paoMonths: null,
    paoSource: 'unknown',
  }),
  isCatalogProductId: (value: unknown) =>
    typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value),
  reportCatalogIssue: (...args: unknown[]) => h.reportCatalogIssue(...args),
  searchCatalog: (...args: unknown[]) => h.searchCatalog(...args),
}));
vi.mock('@/features/catalog/copy', () => ({
  catalogQualityLabel: () => 'Usable',
  sourceDisplayName: () => 'Reviewed catalog',
}));
vi.mock('@/features/catalog/ingredientParser', () => ({ parseIngredientText: vi.fn() }));
vi.mock('@/features/shelf/analytics', () => ({ trackProductAddStarted: vi.fn() }));
vi.mock('@/features/shelf/categories', () => ({ PRODUCT_CATEGORIES: [{ id: 'cleanser' }] }));
vi.mock('@/features/shelf/IntakeContext', () => ({
  isCurrentIntakeSession: (current: string | null, requested: string | null | undefined) =>
    current != null && current === requested,
  useIntake: () => ({
    clear: h.clear,
    draft: { barcode: null },
    reset: h.reset,
    sessionId: h.sessionId,
  }),
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/brand', () => ({ BRAND: { appName: 'RoutineKind' } }));
vi.mock('@/lib/cn', () => ({ cn: (...values: unknown[]) => values.filter(Boolean).join(' ') }));
vi.mock('@/lib/navigation/safeBack', () => ({
  APP_SHELF_ROUTE: '/shelf',
  backOrReplace: vi.fn(),
}));
vi.mock('@/theme/haptics', () => ({ haptics: { select: vi.fn() } }));
vi.mock('@/theme/tokens', () => ({
  colors: { clayDeep: '#000', mutedLight: '#999', sageMuted: '#999' },
}));

let renderer: ReactTestRenderer | null = null;

function textOf(node: ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

function findPressable(label: string): ReactTestInstance {
  if (!renderer) throw new Error('Renderer is not mounted');
  const button = renderer.root
    .findAll((candidate) => String(candidate.type) === 'Pressable')
    .find((candidate) => textOf(candidate).includes(label));
  if (!button) throw new Error(`Missing Pressable with label: ${label}`);
  return button;
}

function findButton(label: string): ReactTestInstance {
  if (!renderer) throw new Error('Renderer is not mounted');
  const button = renderer.root
    .findAll((candidate) => String(candidate.type) === 'Button')
    .find((candidate) => candidate.props.label === label);
  if (!button) throw new Error(`Missing Button with label: ${label}`);
  return button;
}

function renderedText(): string {
  if (!renderer) return '';
  return renderer.root
    .findAll((candidate) => String(candidate.type) === 'Text')
    .map(textOf)
    .join(' ');
}

async function flushUpdates(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 3; index += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  h.params = {};
  h.reportCatalogIssue.mockReset();
  h.searchCatalog.mockReset();
  h.reset.mockReset().mockReturnValue('intake-session');
  h.clear.mockReset();
  h.sessionId = null;
});

afterEach(async () => {
  if (renderer) await act(async () => renderer?.unmount());
  renderer = null;
});

describe('catalog recovery async behavior', () => {
  it('keeps a stale search response from replacing a newer query result', async () => {
    let resolveOlder!: (value: unknown) => void;
    let resolveNewer!: (value: unknown) => void;
    h.searchCatalog
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveNewer = resolve;
          }),
      );

    await act(async () => {
      renderer = create(createElement(CatalogSearchScreen));
    });
    const input = renderer!.root.findByProps({ accessibilityLabel: 'Catalog search query' });

    await act(async () => input.props.onChangeText('older query'));
    await act(async () => {
      void findPressable('Search').props.onPress();
      await Promise.resolve();
    });
    expect(findPressable('Search').props.accessibilityState.busy).toBe(true);

    await act(async () => input.props.onChangeText('newer query'));
    await act(async () => {
      void findPressable('Search').props.onPress();
      await Promise.resolve();
    });
    expect(h.searchCatalog.mock.calls.map(([query]) => query)).toEqual([
      'older query',
      'newer query',
    ]);

    resolveNewer({
      products: [
        {
          id: 'newer',
          name: 'Newer Product',
          source: 'reviewed',
          quality_grade: 'usable',
        },
      ],
      result: 'match',
    });
    await flushUpdates();
    expect(renderedText()).toContain('Newer Product');

    resolveOlder({
      products: [
        {
          id: 'older',
          name: 'Older Product',
          source: 'reviewed',
          quality_grade: 'usable',
        },
      ],
      result: 'match',
    });
    await flushUpdates();
    expect(renderedText()).toContain('Newer Product');
    expect(renderedText()).not.toContain('Older Product');
  });

  it('recovers the search and wrong-match controls when their promises reject', async () => {
    h.searchCatalog.mockRejectedValueOnce(new Error('network unavailable'));

    await act(async () => {
      renderer = create(createElement(CatalogSearchScreen));
    });
    const input = renderer!.root.findByProps({ accessibilityLabel: 'Catalog search query' });
    await act(async () => input.props.onChangeText('ceramide cleanser'));
    await act(async () => findPressable('Search').props.onPress());
    await flushUpdates();

    expect(findPressable('Search').props.accessibilityState).toMatchObject({
      busy: false,
      disabled: false,
    });
    expect(renderedText()).toContain("Couldn't reach the product catalog");

    h.searchCatalog.mockResolvedValueOnce({
      products: [
        {
          id: '00000000-0000-4000-8000-000000000201',
          name: 'Candidate Product',
          source: 'reviewed',
          quality_grade: 'usable',
        },
      ],
      result: 'match',
    });
    await act(async () => findPressable('Search').props.onPress());
    await flushUpdates();

    let rejectReport!: (reason?: unknown) => void;
    h.reportCatalogIssue.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectReport = reject;
        }),
    );
    await act(async () => {
      void findPressable('Not this product').props.onPress();
      await Promise.resolve();
    });
    expect(h.reportCatalogIssue).not.toHaveBeenCalled();
    expect(renderedText()).toContain('Confirm catalog report');
    expect(renderedText()).toContain('Catalog product ID');
    expect(renderedText()).toContain('RoutineKind account ID');
    expect(renderedText()).toContain('Open Beauty Facts');

    await act(async () => {
      void findPressable('Send report').props.onPress();
      await Promise.resolve();
    });
    expect(findPressable('Sending report...').props.disabled).toBe(true);

    rejectReport(new Error('report unavailable'));
    await flushUpdates();
    expect(findPressable('Not this product').props.disabled).toBe(false);
    expect(renderedText()).toContain('Report not sent');
    expect(renderedText()).toContain("We couldn't confirm delivery");
  });

  it('recovers the search missing-product report control when the promise rejects', async () => {
    h.searchCatalog.mockResolvedValueOnce({ products: [], result: 'no_match' });

    await act(async () => {
      renderer = create(createElement(CatalogSearchScreen));
    });
    const input = renderer!.root.findByProps({ accessibilityLabel: 'Catalog search query' });
    await act(async () => input.props.onChangeText('unlisted product'));
    await act(async () => findPressable('Search').props.onPress());
    await flushUpdates();

    let rejectReport!: (reason?: unknown) => void;
    h.reportCatalogIssue.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectReport = reject;
        }),
    );
    await act(async () => {
      void findPressable('Report missing product').props.onPress();
      await Promise.resolve();
    });
    expect(h.reportCatalogIssue).not.toHaveBeenCalled();
    expect(renderedText()).toContain('Confirm or edit the name printed on the product');
    const productNameInput = renderer!.root.findByProps({
      accessibilityLabel: 'Product name for report',
    });
    await act(async () => productNameInput.props.onChangeText('Confirmed product name'));
    await act(async () => {
      void findPressable('Send report').props.onPress();
      await Promise.resolve();
    });
    expect(findPressable('Sending report...').props.disabled).toBe(true);

    rejectReport(new Error('report unavailable'));
    await flushUpdates();
    expect(findPressable('Report missing product').props.disabled).toBe(false);
    expect(renderedText()).toContain('Report not sent');
    expect(renderedText()).toContain("We couldn't confirm delivery");
    expect(h.reportCatalogIssue).toHaveBeenCalledWith(
      expect.objectContaining({ proposedPayload: { productName: 'Confirmed product name' } }),
    );
  });

  it('recovers the no-match report control when the report promise rejects', async () => {
    h.params = { barcode: '012345678905' };
    let rejectReport!: (reason?: unknown) => void;
    h.reportCatalogIssue.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectReport = reject;
        }),
    );

    await act(async () => {
      renderer = create(createElement(NoMatchScreen));
    });
    await act(async () => {
      void findButton('Report missing product').props.onPress();
      await Promise.resolve();
    });
    expect(h.reportCatalogIssue).not.toHaveBeenCalled();
    expect(renderedText()).toContain('Confirm catalog report');
    expect(renderedText()).toContain('Barcode: 012345678905');
    expect(renderedText()).toContain("RoutineKind's catalog-review team and authorized operators");
    expect(renderedText()).toContain('Nothing is sent to Open Beauty Facts');

    await act(async () => {
      void findPressable('Send report').props.onPress();
      void findPressable('Send report').props.onPress();
      await Promise.resolve();
    });
    expect(h.reportCatalogIssue).toHaveBeenCalledTimes(1);
    expect(findPressable('Sending report...').props.disabled).toBe(true);

    rejectReport(new Error('report unavailable'));
    await flushUpdates();
    expect(findButton('Report missing product').props.disabled).toBe(false);
    expect(renderedText()).toContain('Report not sent');
    expect(renderedText()).toContain("We couldn't confirm delivery");

    h.reportCatalogIssue.mockResolvedValueOnce({
      result: 'success',
      correction: {
        id: '00000000-0000-4000-8000-000000000901',
        status: 'open',
        createdAt: '2026-07-18T12:00:00.000Z',
        created: false,
      },
    });
    await act(async () => findButton('Report missing product').props.onPress());
    await act(async () => findPressable('Send report').props.onPress());
    await flushUpdates();

    expect(h.reportCatalogIssue).toHaveBeenCalledTimes(2);
    expect(h.reportCatalogIssue.mock.calls[0]?.[0]?.reportRequestId).toBe(
      h.reportCatalogIssue.mock.calls[1]?.[0]?.reportRequestId,
    );
    expect(renderedText()).toContain('Report already received');
  });

  it('does not offer an owner report from an identifier-free direct entry', async () => {
    await act(async () => {
      renderer = create(createElement(NoMatchScreen));
    });

    expect(renderer!.root.findAll((candidate) => String(candidate.type) === 'Button')).toHaveLength(
      0,
    );
    expect(renderedText()).toContain('Search catalog');
    expect(renderedText()).toContain('Add ingredients');
    expect(renderedText()).toContain('Add it by hand');
    expect(renderedText()).not.toContain('Report missing product');
  });
});
