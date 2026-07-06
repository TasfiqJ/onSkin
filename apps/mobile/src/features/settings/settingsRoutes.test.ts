import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function expectTouchableRouteIcon(route: string): void {
  const source = readAppRoute(route);

  expect(source, `${route} should use the shared 44pt route icon button`).toContain(
    'RouteIconButton',
  );
  expect(
    source,
    `${route} should not rely on small hit slop for the visible Back control`,
  ).not.toContain('hitSlop={8}');
}

describe('Settings route contracts', () => {
  it('keeps direct-entry exits safe for account and reminder settings', () => {
    for (const route of [
      'settings/subscription.tsx',
      'settings/notifications.tsx',
      'settings/timing.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should use backOrReplace for direct-entry exits`).not.toContain(
        'router.back()',
      );
      expect(source, `${route} should return direct entries to the You tab`).toContain(
        'APP_YOU_ROUTE',
      );
      expect(source, `${route} should guard native back with a fallback`).toContain(
        'backOrReplace(router, APP_YOU_ROUTE)',
      );
    }
  });

  it('keeps settings route exits touchable on phones', () => {
    for (const route of [
      'settings/subscription.tsx',
      'settings/notifications.tsx',
      'settings/timing.tsx',
    ]) {
      expectTouchableRouteIcon(route);
    }
  });

  it('keeps reminder timing controls comfortably above 44px on phones', () => {
    const timing = readAppRoute('settings/timing.tsx');
    const notifications = readAppRoute('settings/notifications.tsx');

    expect(timing).toContain('min-h-[48px] flex-row items-center justify-between py-2.5');
    expect(timing).toContain('min-h-[48px] min-w-[72px] items-center justify-center rounded-[8px]');
    expect(timing).toContain("flexWrap: 'wrap'");
    expect(timing).toContain('style={{ flexShrink: 1, minWidth: 0 }}');
    expect(notifications).toContain('min-h-[56px] flex-row items-center justify-between py-3.5');
    expect(notifications).toContain('min-h-[48px] flex-1 justify-center pr-3');
    expect(notifications).not.toContain('min-h-[44px] flex-1 justify-center pr-3');
    expect(notifications).toContain('ToggleSwitch');
    expect(notifications).toContain('accessibilityLabel={title}');
  });

  it('keeps You tab privacy and security switches on the 44px shared control', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain('ToggleSwitch');
    expect(source).toContain('accessibilityLabel="App lock"');
    expect(source).toContain('accessibilityLabel="Encrypted cloud backup"');
    expect(source).toContain('accessibilityLabel="Marketing emails"');
    expect(source).not.toContain('<Switch');
    expect(source).not.toContain('onValueChange');
  });

  it('keeps the You tab commerce toggle local-first when the ledger is offline', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain("if (type !== 'data_sharing') throw error;");
    expect(source).not.toContain("if (type === 'data_sharing' && granted)");
    expect(source).not.toContain('await setCommerceConsentLocal(false).catch(() => undefined)');
  });

  it('keeps You tab navigation rows touchable beyond the chevron glyph', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain('className="min-h-[56px] flex-row items-center justify-between py-2"');
    expect(source).toContain('className="h-[44px] w-[44px] items-center justify-center"');
    expect(source).toContain('accessibilityLabel={label}');
    expect(source).toContain("onPress={() => router.push('/settings/subscription')}");
    expect(source).toContain('onPress={() => openPolicyUrl(row.url)}');
    expect(source).not.toContain(
      'onPress={() => router.push(href)}\n                accessibilityRole="button"',
    );
    expect(source).not.toContain(
      'onPress={() => openPolicyUrl(row.url)}\n                accessibilityRole="button"',
    );
  });

  it('keeps secondary subscription exits buffered above 44px on phones', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain('mt-4 min-h-[48px] items-center justify-center py-2');
    expect(source).not.toContain('mt-4 min-h-[44px] items-center justify-center py-2');
  });
});
