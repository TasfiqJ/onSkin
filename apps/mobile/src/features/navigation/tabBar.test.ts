import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

function readNumericConstant(source: string, name: string): number {
  const match = source.match(new RegExp(`const ${name} = (\\d+);`));

  if (!match) {
    throw new Error(`Missing numeric tab bar constant: ${name}`);
  }

  return Number(match[1]);
}

describe('tab bar treatment', () => {
  it('uses a legible Wealthsimple-style floating app tab bar instead of the old dot marker', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain('FLOATING_TAB_BAR_HEIGHT = 66');
    expect(source).toContain('FLOATING_TAB_BAR_CLEARANCE');
    expect(source).toContain('FLOATING_TAB_BAR_SIDE_MARGIN');
    expect(source).toContain('FLOATING_TAB_BAR_MAX_WIDTH');
    expect(source).toContain('FLOATING_TAB_BAR_HORIZONTAL_PADDING');
    expect(source).toContain('MIN_TAB_TOUCH_TARGET');
    expect(source).toContain('TAB_ITEM_HEIGHT');
    expect(source).toContain('WEB_TAB_ITEM_FOCUS_RESET');
    expect(source).toContain('WEB_TAB_ITEM_FOCUS_RING');
    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('tabBarHorizontalInset');
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
    expect(source).toContain('tabBarActiveTintColor: colors.ink');
    expect(source).toContain('tabBarInactiveTintColor: colors.mutedStrong');
    expect(source).toContain('useSafeAreaInsets');
    expect(source).toContain('tabSceneClearance');
    expect(source).toContain('sceneStyle: [styles.tabScene, { paddingBottom: tabSceneClearance }]');
    expect(source).toContain('backgroundColor: colors.paperRaised');
    expect(source).toContain('focused ? colors.ink : colors.mutedStrong');
    expect(source).toContain('backgroundColor: colors.paperRaised');
    expect(source).toContain('borderColor: colors.hairlineStrong');
    expect(source).toContain('borderColor: colors.hairlineStrong');
    expect(source).toContain('borderRadius: 33');
    expect(source).toContain("position: 'absolute'");
    expect(source).toContain('left: tabBarHorizontalInset');
    expect(source).toContain('right: tabBarHorizontalInset');
    expect(source).toContain('zIndex: 50');
    expect(source).toContain('height: FLOATING_TAB_BAR_HEIGHT');
    expect(source).toContain('tabItemActive: {');
    expect(source).toContain('backgroundColor: colors.greige');
    expect(source).toContain('borderColor: colors.hairline');
    expect(source).toContain('accessibilityRole="tablist"');
    expect(source).toContain('accessibilityRole="tab"');
    expect(source).toContain('accessibilityState={{ selected: focused }}');
    expect(source).toContain('aria-selected={focused}');
    expect(source).toContain("type: 'tabPress'");
    expect(source).toContain("type: 'tabLongPress'");
    expect(source).toContain('fontSize: 12.5');
    expect(source).toContain('lineHeight: 16');
    expect(source).toContain('minHeight: 17');
    expect(source).toContain('minHeight: MIN_TAB_TOUCH_TARGET');
    expect(source).toContain('height: TAB_ITEM_HEIGHT');
    expect(source).toContain('FLOATING_TAB_BAR_HEIGHT + tabBarBottom + FLOATING_TAB_BAR_GAP');
    expect(source).toContain('width: 42');
    expect(source).toContain("outlineStyle: 'none'");
    expect(source).toContain('boxShadow: ');
    expect(source).toContain('onFocus={() => setFocusRingRouteKey(route.key)}');
    expect(source).toContain('onBlur={() =>');
    expect(source).toContain('setFocusRingRouteKey((currentKey)');
    expect(source).not.toContain('function Dot');
    expect(source).toContain('testID={`bottom-tab-${route.name}`}');
    expect(source).not.toContain('tabActiveRail');
    expect(source).not.toContain('tabActiveRailVisible');
    expect(source).not.toContain('ACTIVE_TAB_SHADOW');
    expect(source).not.toContain('iconShellActive');
    expect(source).not.toContain('iconShellActive: {\n    backgroundColor: colors.ink');
    expect(source).not.toContain("backgroundColor: 'rgba(255,255,255,0.74)'");
    expect(source).not.toContain('backgroundColor: colors.clayTint');
    expect(source).not.toContain("borderColor: 'rgba(165,105,75,0.20)'");
    expect(source).not.toContain('focused ? colors.paperRaised : colors.mutedStrong');
    expect(source).not.toContain('tabItemActive: {\n    backgroundColor: colors.ink');
    expect(source).not.toContain('backgroundColor: colors.greigeChip');
  });

  it('renders tab labels directly inside protected one-line phone geometry', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');

    expect(source).toContain('function FloatingTabBar');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('ellipsizeMode="tail"');
    expect(source).toContain('maxFontSizeMultiplier={1.08}');
    expect(source).toContain('minimumFontScale={0.86}');
    expect(source).toContain('numberOfLines={1}');
    expect(source).toContain('{displayLabel}');
    expect(source).toContain('TAB_ICON_BY_ROUTE');
    expect(source).toContain('flexShrink: 1');
    expect(source).toContain('fontSize: 12.5');
    expect(source).toContain('includeFontPadding: false');
    expect(source).toContain('lineHeight: 16');
    expect(source).toContain('height: TAB_ITEM_HEIGHT');
    expect(source).toContain('minWidth: 0');
    expect(source).toContain("width: '100%'");
    expect(source).toContain("textAlign: 'center'");
    expect(source).toContain("textAlignVertical: 'center'");
    expect(source).toContain('hitSlop={{ bottom: 6, left: 2, right: 2, top: 6 }}');
    expect(source).toContain("borderColor: 'transparent'");
    expect(source).not.toContain('function renderTabBarLabel');
    expect(source).not.toContain('tabLabelFrame');
    expect(source).not.toContain('tabBarLabel: renderTabBarLabel');
    expect(source).not.toContain("tabBarLabelPosition: 'below-icon'");
    expect(source).not.toContain('lineHeight: 15');
    expect(source).not.toContain('fontSize: 11');
    expect(source).not.toContain('fontSize: 12,\n    includeFontPadding: false');
    expect(source).not.toContain('minWidth: 56');
  });

  it('protects the floating bar geometry on 320 px phones', () => {
    const source = readAppRoute('(tabs)/_layout.tsx');
    const tabBarHeight = readNumericConstant(source, 'FLOATING_TAB_BAR_HEIGHT');
    const sideMargin = readNumericConstant(source, 'FLOATING_TAB_BAR_SIDE_MARGIN');
    const horizontalPadding = readNumericConstant(source, 'FLOATING_TAB_BAR_HORIZONTAL_PADDING');
    const minTouchTarget = readNumericConstant(source, 'MIN_TAB_TOUCH_TARGET');
    const tabItemHeight = readNumericConstant(source, 'TAB_ITEM_HEIGHT');
    const usableWidth = 320 - sideMargin * 2 - horizontalPadding * 2;

    expect(tabBarHeight).toBeGreaterThanOrEqual(tabItemHeight + 12);
    expect(tabItemHeight).toBeGreaterThanOrEqual(minTouchTarget);
    expect(minTouchTarget).toBeGreaterThanOrEqual(52);
    expect(usableWidth / 4).toBeGreaterThanOrEqual(74);
    expect(source).toContain('minimumFontScale={0.86}');
    expect(source).toContain('maxFontSizeMultiplier={1.08}');
  });
});
