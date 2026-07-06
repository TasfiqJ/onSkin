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
    expect(timing).toContain('accessibilityLabel={`Morning reminder time, ${amTimeLabel}`}');
    expect(timing).toContain('accessibilityLabel={`Evening reminder time, ${pmTimeLabel}`}');
    expect(timing).toContain(
      'accessibilityLabel={`Quiet hours start, ${quietStartTimeLabel}`}',
    );
    expect(timing).toContain('accessibilityLabel={`Quiet hours end, ${quietEndTimeLabel}`}');
    expect(timing).toContain('accessibilityHint="Opens time picker"');
    expect(timing).toContain("flexWrap: 'wrap'");
    expect(timing).toContain('style={{ flexShrink: 1, minWidth: 0 }}');
    expect(notifications).toContain('min-h-[56px] flex-row items-center justify-between py-3.5');
    expect(notifications).toContain('min-h-[48px] flex-1 justify-center pr-3');
    expect(notifications).not.toContain('min-h-[44px] flex-1 justify-center pr-3');
    expect(notifications).toContain('ToggleSwitch');
    expect(notifications).toContain('accessibilityLabel={title}');
  });

  it('keeps the reminder time picker dismissible without inert sheet buttons', () => {
    const source = readAppRoute('settings/timing.tsx');

    expect(source).toContain('accessibilityLabel="Dismiss time picker"');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('className="flex-1"\n          accessibilityLabel="Dismiss time picker"');
    expect(source).toContain('accessibilityViewIsModal');
    expect(source).toContain('accessibilityLabel={`${title}, ${formattedTime}`}');
    expect(source).toContain(
      'accessibilityHint={`Sets ${title.toLowerCase()} to ${formattedTime}`}',
    );
    expect(source).toContain('const formattedTime = fmtTime(t);');
    expect(source).not.toContain('onPress={() => {}}');
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

    expect(source).toContain("'min-h-[56px] flex-row items-center justify-between py-2'");
    expect(source).toContain("'min-h-[48px] flex-row items-center justify-between py-0.5'");
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

  it('keeps You tab first-viewport rows clear of the floating tab bar on short phones', () => {
    const source = readAppRoute('(tabs)/you.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const { height, width } = useWindowDimensions();');
    expect(source).toContain('const compactPhone = height < 640 || width < 430');
    expect(source).toContain("contentContainerClassName={compactPhone ? 'pb-32' : 'pb-8'}");
    expect(source).toContain("className={compactPhone ? 'mt-1' : 'mt-2'}");
    expect(source).toContain("className={compactPhone ? 'mt-3 p-3' : 'mt-6'}");
    expect(source).toContain("className={compactPhone ? 'mt-2 p-3' : 'mt-4'}");
    expect(source).not.toContain("className={compactPhone ? 'mt-4 p-4' : 'mt-6'}");
    expect(source).not.toContain("className={compactPhone ? 'mt-3 p-4' : 'mt-4'}");
    expect(source).toContain('const accountLabel = isAnonymous ?');
    expect(source).toContain('className="mt-1 min-h-[48px] flex-row items-center justify-between gap-3"');
    expect(source).toContain('className="min-h-[48px] items-center justify-center rounded-pill px-4 py-2"');
    expect(source).toContain("compact={compactPhone}");
  });

  it('keeps secondary subscription exits buffered above 44px on phones', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain('min-h-[48px] flex-row items-center justify-between py-3.5');
    expect(source).toContain('mt-4 min-h-[48px] items-center justify-center py-2');
    expect(source).not.toContain('mt-4 min-h-[44px] items-center justify-center py-2');
  });

  it('keeps free subscription settings compliant with restore and policy access', () => {
    const source = readAppRoute('settings/subscription.tsx');

    expect(source).toContain('<Row label={PAYWALL_COPY.manage.restoreRow} onPress={onRestore} />');
    expect(source).toContain('<Row label="Terms" onPress={() => openPolicy(TERMS_URL)} />');
    expect(source).toContain(
      '<Row label="Privacy" last onPress={() => openPolicy(PRIVACY_URL)} />',
    );
    expect(source).not.toContain(
      '<Row label={PAYWALL_COPY.manage.restoreRow} last onPress={onRestore} />',
    );
  });
});
