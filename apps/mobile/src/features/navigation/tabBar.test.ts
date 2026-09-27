import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('tab bar treatment', () => {
  it('uses the platform-native tab bar so iOS owns Liquid Glass and safe-area behavior', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain("from 'expo-router/unstable-native-tabs'");
    expect(source).toContain('<NativeTabs');
    expect(source).toContain('disableTransparentOnScrollEdge');
    expect(source).toContain('minimizeBehavior="onScrollDown"');
    expect(source).toContain('tintColor={colors.clay}');
    expect(source).toContain('<NativeTabs.Trigger name="today">');
    expect(source).toContain('<NativeTabs.Trigger name="progress">');
    expect(source).toContain('<NativeTabs.Trigger name="shelf">');
    expect(source).toContain('<NativeTabs.Trigger name="you">');
    expect(source).toContain('<NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>');
    expect(source).toContain('<NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>');
    expect(source).toContain('<NativeTabs.Trigger.Label>Shelf</NativeTabs.Trigger.Label>');
    expect(source).toContain('<NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>');
    expect(source).toContain("sf={{ default: 'house', selected: 'house.fill' }}");
    expect(source).toContain(
      "sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }}",
    );
    expect(source).toContain(
      "sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}",
    );
  });

  it('does not recreate a custom glass tab bar in the content layer', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).not.toContain('FloatingTabBar');
    expect(source).not.toContain('GlassView');
    expect(source).not.toContain('TAB_ITEM_HEIGHT');
    expect(source).not.toContain('FLOATING_TAB_BAR_HEIGHT');
    expect(source).not.toContain('tabItemActive');
    expect(source).not.toContain("backgroundColor: 'rgba(32,27,21,0.94)'");
  });

  it('keeps Expo web navigable without replacing the native mobile host', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain("import { router, Tabs } from 'expo-router'");
    expect(source).toContain("if (Platform.OS === 'web')");
    expect(source).toContain('<Tabs');
    expect(source).toContain('tabBarItemStyle: { minHeight: 56 }');
    expect(source).toContain('height: 84');
    expect(source).toContain('tabBarIcon: () => null');
    expect(source).toContain('<Tabs.Screen name="today"');
    expect(source).toContain('<Tabs.Screen name="progress"');
    expect(source).toContain('<Tabs.Screen name="shelf"');
    expect(source).toContain('<Tabs.Screen name="you"');
    expect(source).not.toContain('GlassView');
    expect(source).not.toContain('FloatingTabBar');
  });

  it('keeps lifecycle and notification side effects mounted above the tab host', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain('<BehaviouralTriggers />');
    expect(source).toContain('useExpiryReoffer();');
    expect(source).toContain('pendingLifecycleRoute');
  });
});
