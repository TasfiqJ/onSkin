import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('tab bar treatment', () => {
  it('uses a legible floating app-style tab bar instead of the old dot marker', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain('FLOATING_TAB_BAR_HEIGHT = 90');
    expect(source).toContain('FLOATING_TAB_BAR_CLEARANCE');
    expect(source).toContain('function TabBarIcon');
    expect(source).toContain('function TodayIcon');
    expect(source).toContain('function ProgressIcon');
    expect(source).toContain('function ShelfIcon');
    expect(source).toContain('function YouIcon');
    expect(source).toContain('function FloatingTabBar');
    expect(source).toContain('tabBar={(props) => <FloatingTabBar {...props} />}');
    expect(source).toContain('tabBarHideOnKeyboard: true');
    expect(source).toContain('tabBarShowLabel: false');
    expect(source).toContain('useKeyboardVisible');
    expect(source).toContain('Keyboard.addListener');
    expect(source).toContain('tabBarActiveTintColor: colors.clayDeep');
    expect(source).toContain('tabBarInactiveTintColor: colors.ink');
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('tabSceneClearance');
    expect(source).toContain('sceneStyle: [styles.tabScene, { paddingBottom: tabSceneClearance }]');
    expect(source).toContain('backgroundColor: colors.paperRaised');
    expect(source).toContain('backgroundColor: colors.clayTint');
    expect(source).toContain('borderColor: colors.hairlineStrong');
    expect(source).toContain('borderRadius: 30');
    expect(source).toContain("position: 'absolute'");
    expect(source).toContain('left: 16');
    expect(source).toContain('right: 16');
    expect(source).toContain('height: FLOATING_TAB_BAR_HEIGHT');
    expect(source).toContain('accessibilityRole="tablist"');
    expect(source).toContain('accessibilityRole="tab"');
    expect(source).toContain('accessibilityState={{ selected: focused }}');
    expect(source).toContain('aria-selected={focused}');
    expect(source).toContain("type: 'tabPress'");
    expect(source).toContain("type: 'tabLongPress'");
    expect(source).toContain('fontSize: 13');
    expect(source).toContain('lineHeight: 18');
    expect(source).toContain('minHeight: 22');
    expect(source).toContain('minHeight: 72');
    expect(source).toContain('height: 72');
    expect(source).toContain('FLOATING_TAB_BAR_HEIGHT + tabBarBottom + FLOATING_TAB_BAR_GAP');
    expect(source).toContain('width: 42');
    expect(source).not.toContain('function Dot');
  });

  it('renders tab labels directly inside protected one-line phone geometry', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain('function FloatingTabBar');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('maxFontSizeMultiplier={1.08}');
    expect(source).toContain('minimumFontScale={0.88}');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('{displayLabel}');
    expect(source).toContain('TAB_ICON_BY_ROUTE');
    expect(source).toContain('flexShrink: 1');
    expect(source).toContain('includeFontPadding: false');
    expect(source).toContain('height: 72');
    expect(source).toContain('minWidth: 0');
    expect(source).toContain("width: '100%'");
    expect(source).toContain("textAlign: 'center'");
    expect(source).not.toContain('function renderTabBarLabel');
    expect(source).not.toContain('tabLabelFrame');
    expect(source).not.toContain('tabBarLabel: renderTabBarLabel');
    expect(source).not.toContain("tabBarLabelPosition: 'below-icon'");
    expect(source).not.toContain('lineHeight: 15');
    expect(source).not.toContain('fontSize: 11');
    expect(source).not.toContain('minWidth: 56');
  });
});
