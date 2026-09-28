import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));
const REPO_DIR = fileURLToPath(new URL('../../../../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('paywall mobile contracts', () => {
  it('keeps the subscription hook graph unmounted while a contextual gate is unfocused', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const shellStart = proGate.indexOf('export function ProGate(');
    const focusedStart = proGate.indexOf('function FocusedProGate(');
    const hocStart = proGate.indexOf('/** HOC to gate a whole screen behind Pro');
    const focusShell = proGate.slice(shellStart, focusedStart);
    const focusedGate = proGate.slice(focusedStart, hocStart);

    expect(shellStart).toBeGreaterThanOrEqual(0);
    expect(focusedStart).toBeGreaterThan(shellStart);
    expect(hocStart).toBeGreaterThan(focusedStart);
    expect(focusShell).toContain('const isFocused = useIsFocused();');
    expect(focusShell).toContain('if (!isFocused) return null;');
    expect(focusShell).toContain('return <FocusedProGate {...props} />;');

    for (const focusedOnlyHook of [
      'useWindowDimensions(',
      'usePathname(',
      'useOwnerQueryScope(',
      'useEntitlement(',
      'useEntitlementActions(',
      'useSubscriptionOffering(',
      'usePaidActionHold(',
      'useState<',
      'useEffect(',
    ]) {
      expect(focusShell).not.toContain(focusedOnlyHook);
      expect(focusedGate).toContain(focusedOnlyHook);
    }

    expect(focusedGate).not.toContain('useIsFocused(');
    expect(focusedGate).toContain('const entitlementChecking = isLoading || (!data && !isError);');
    expect(focusedGate).toContain('if (!locked) return <>{children}</>;');
    expect(focusedGate).toContain("if (locked) track('contextual_paywall_shown', { feature });");
  });

  it('acknowledges durable lifecycle prompts only from their mounted target surfaces', () => {
    const tabs = readAppRoute('(tabs)/_layout.tsx');
    const reoffer = readAppRoute('paywall/reoffer.tsx');
    const downgrade = readAppRoute('paywall/downgrade.tsx');

    expect(tabs).toContain('pathname: prompt.route');
    expect(tabs).toContain('params: { lifecyclePromptId: prompt.promptId }');
    expect(tabs).toContain('const storeUserId = user?.id ?? null;');
    expect(tabs).toContain('if (!storeUserId) return;');
    expect(tabs).toContain('expectedStoreUserId: storeUserId');
    expect(tabs).toContain('!isOwnerQueryScopeCurrent(ownerScope)');
    expect(tabs).toContain('mounted = false');

    for (const route of [reoffer, downgrade]) {
      expect(route).toContain('useLocalSearchParams<{ lifecyclePromptId?: string | string[] }>()');
      expect(route).toContain('acknowledgeLifecyclePromptPresented');
      expect(route).toContain('promptId: lifecyclePromptId');
      expect(route).toContain('supersedeLifecyclePrompt');
    }
    expect(reoffer).toContain("directPaywallDecision('reoffer'");
    expect(reoffer).toContain("decision.lifecycleDisposition === 'present'");
    expect(reoffer).toContain("route: '/paywall/reoffer'");
    expect(downgrade).toContain("directPaywallDecision('downgrade'");
    expect(downgrade).toContain("decision.lifecycleDisposition !== 'present'");
    expect(downgrade).toContain("route: '/paywall/downgrade'");
  });

  it('keeps lifecycle paywall bodies scrollable above fixed actions on short phones', () => {
    for (const route of ['paywall/reoffer.tsx', 'paywall/downgrade.tsx', 'paywall/winback.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should support short phone viewports`).toContain('<ScrollView');
      expect(source, `${route} should keep bottom actions outside the scroll body`).toMatch(
        /<View className=(?:"gap-|\{compactPaywall \? 'gap-)/,
      );
    }

    for (const route of ['paywall/reoffer.tsx', 'paywall/downgrade.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should read phone height for compact footer spacing`).toContain(
        'useWindowDimensions',
      );
      expect(source, `${route} should define the compact paywall breakpoint`).toContain(
        'const compactPaywall = height < 640',
      );
      expect(source, `${route} should reserve scroll space above fixed footer actions`).toContain(
        "contentContainerClassName={compactPaywall ? 'pb-",
      );
      expect(source, `${route} should give compact decline actions a 32px bottom buffer`).toContain(
        "className={compactPaywall ? 'gap-2.5 pb-8'",
      );
      expect(
        source,
        `${route} should not keep compact footer actions at an 8px bottom edge`,
      ).not.toContain('className="gap-2.5 pb-2"');
    }

    const downgrade = readAppRoute('paywall/downgrade.tsx');
    expect(downgrade).toContain('const supportFloorTextPressurePaywall =');
    expect(downgrade).toContain(
      "width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(downgrade).toContain(
      'const compactPaywall = height < 640 || supportFloorTextPressurePaywall;',
    );
  });

  it('keeps paywall decline and dismiss controls buffered above 44px on phones', () => {
    for (const route of [
      'paywall/reoffer.tsx',
      'paywall/downgrade.tsx',
      'paywall/winback.tsx',
      'paywall/upsell.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should not keep a 40px route or decline target`).not.toContain(
        'h-[40px]',
      );
      expect(source, `${route} should not keep a 42px route or decline target`).not.toContain(
        'h-[42px]',
      );
      expect(
        source,
        `${route} should not rely on exact 44px sizing that renders at 43.99px`,
      ).not.toContain('h-[44px]');
    }

    for (const route of [
      'paywall/reoffer.tsx',
      'paywall/downgrade.tsx',
      'paywall/winback.tsx',
      'paywall/upsell.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should render paywall decline exits with 48px buffer`).toContain(
        'className="h-[48px] items-center justify-center"',
      );
    }
  });

  it('keeps contextual paywall sheets viewport-capped and scrollable', () => {
    const sheet = readSource('components/ui/Sheet.tsx');
    const upsell = readAppRoute('paywall/upsell.tsx');
    const proGate = readSource('features/subscription/ProGate.tsx');

    expect(sheet).toContain('useWindowDimensions');
    expect(sheet).toContain('backdropReserve = backdropAccessible ? 48 : 12');
    expect(sheet).toContain('sheetMaxHeight');
    expect(sheet).toContain('maxHeight: sheetMaxHeight');
    expect(sheet).toContain('overflow-hidden rounded-t-sheet');
    expect(sheet).toContain('style: { flexShrink: 1 }');
    expect(sheet).toContain('backdropAccessible?: boolean');
    expect(upsell).toContain("import { RouteIconButton, Sheet, Text } from '@/components/ui';");
    expect(upsell).toContain(
      "import { Platform, Pressable, View, useWindowDimensions } from 'react-native';",
    );
    expect(upsell).toContain('useWindowDimensions');
    expect(upsell).toContain('const { fontScale, height, width } = useWindowDimensions();');
    expect(upsell).toContain('const midTextPressurePaywall =');
    expect(upsell).toContain(
      "width <= 390 && height >= 700 && height < 780 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(upsell).toContain('const compactPaywall = height < 640 || midTextPressurePaywall;');
    expect(upsell).toContain('const shortPaywall = height < 600 || midTextPressurePaywall;');
    expect(upsell).toContain('const splitShortPaywall = height < 410;');
    expect(upsell).toContain('const microShortPaywall = height < 380;');
    expect(upsell).toContain('const narrowShortPaywall = shortPaywall && width < 360;');
    expect(upsell).toContain('const paywallTitle = microShortPaywall');
    expect(upsell).toContain("? 'Unlock photos.'");
    expect(upsell).toContain(": 'Unlock Pro.'");
    expect(upsell).toContain(': copy.title;');
    expect(upsell).toContain(
      "const longCompactTitle = compactPaywall && width < 420 && key === 'reminders_widgets';",
    );
    expect(upsell).toContain("? 'px-6 pb-3 pt-2'");
    expect(upsell).toContain(": shortPaywall\n            ? 'px-7 pb-5 pt-3'");
    expect(upsell).toContain('{shortPaywall ? null : (');
    expect(upsell).toContain('<View className="mb-0 flex-row items-center justify-between">');
    expect(upsell).toContain('<RouteIconButton');
    expect(upsell).toContain('accessibilityLabel="Maybe later"');
    expect(upsell).toContain('glyph="x"');
    expect(upsell).toContain('tone="muted"');
    expect(upsell).toContain('accessibilityLabel={copy.title}');
    expect(upsell).toContain('{paywallTitle}');
    expect(upsell).toContain('adjustsFontSizeToFit={microShortPaywall}');
    expect(upsell).toContain('numberOfLines={microShortPaywall ? 1 : undefined}');
    expect(upsell).toMatch(/fontSize:\s*microShortPaywall\s*\?\s*18/);
    expect(upsell).toMatch(/lineHeight:\s*microShortPaywall\s*\?\s*21/);
    expect(upsell).toContain('{!narrowShortPaywall ? (');
    expect(upsell).toContain(
      "className={shortPaywall ? 'mt-1.5' : compactPaywall ? 'mt-2' : 'mt-3'}",
    );
    expect(upsell).toContain('fontSize: shortPaywall ? 14 : undefined');
    expect(upsell).toContain(
      "narrowShortPaywall\n            ? 'mt-1 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-1.5'",
    );
    expect(upsell).toContain('{narrowShortPaywall ? null : (');
    expect(upsell).toContain('adjustsFontSizeToFit={microShortPaywall || narrowShortPaywall}');
    expect(upsell).toContain('minimumFontScale={0.82}');
    expect(upsell).toContain(
      'numberOfLines={microShortPaywall || narrowShortPaywall ? 1 : undefined}',
    );
    expect(upsell).toMatch(/fontSize:\s*microShortPaywall\s*\?\s*18/);
    expect(upsell).toMatch(/lineHeight:\s*microShortPaywall\s*\?\s*21/);
    expect(upsell).toContain('{annualDisplay.pricePerMonthLabel && !narrowShortPaywall ? (');
    expect(upsell).toMatch(
      /compactPaywall\s*\?\s*'mt-2 h-\[54px\] items-center justify-center rounded-pill'/,
    );
    expect(upsell).toContain(
      "microShortPaywall\n            ? 'mt-0 h-[48px] items-center justify-center rounded-pill'",
    );
    expect(upsell).toContain(
      '!decision.allowPurchase || !offeringResolved || paidAction.isHeld || purchase.isPending',
    );
    expect(upsell).not.toContain('disabled={!canPurchase || purchase.isPending}');
    expect(upsell).toContain('fontSize: microShortPaywall ? 15.5 : 17');
    expect(upsell).toContain(
      '{shortPaywall && !splitShortPaywall ? <ComplianceRow density="compactHeader" /> : null}',
    );
    expect(upsell).toContain('{shortPaywall ? null : <ComplianceRow />}');
    expect(upsell).toContain('backdropAccessible={false}');
    expect(proGate).toContain('<ScrollView');
    expect(proGate).toContain(
      "import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';",
    );
    expect(proGate).toContain("import { RouteIconButton, Screen, Text } from '@/components/ui';");
    expect(proGate).toMatch(
      /headerCompliancePaywall && ultraShortPaywall\s*\?\s*'h-\[48px\] self-end justify-center px-2'\s*:\s*'h-\[48px\] justify-center px-2'/,
    );
    expect(proGate).toContain('paywallDismissFallbackForFeature(feature)');
    expect(proGate).toContain('dismissPaywall(router, paywallDismissFallback)');
    expect(proGate).toContain('useWindowDimensions');
    expect(proGate).toContain('const compactPaywall = height < 640');
    expect(proGate).toContain('const shortPaywall = height < 600');
    expect(proGate).toContain('const ultraShortPaywall = height < 460');
    expect(proGate).toContain('const microShortPaywall = height < 380;');
    expect(proGate).toContain('const narrowShortPaywall = shortPaywall && width < 360;');
    expect(proGate).toContain('const supportedTextPressurePaywall = width <= 430 && height < 900;');
    expect(proGate).toContain('const boundaryTextPressurePaywall =');
    expect(proGate).toContain('width > 390 &&');
    expect(proGate).toContain('height >= 840 &&');
    expect(proGate).toContain('const tallPhoneTextPressurePaywall =');
    expect(proGate).toContain(
      "width <= 430 && height >= 900 && height < 960 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(proGate).toContain(
      'const denseTallTextPressurePaywall = tallPhoneTextPressurePaywall && width <= 430;',
    );
    expect(proGate).toContain('const supportFloorTextPressurePaywall =');
    expect(proGate).toContain(
      "width <= 390 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(proGate).toContain(
      'denseTallTextPressurePaywall || boundaryTextPressurePaywall || supportFloorTextPressurePaywall;',
    );
    expect(proGate).toContain(
      'const progressTextPressurePaywall = insideProgressPhotoPaywall && supportedTextPressurePaywall;',
    );
    expect(proGate).toContain('const supportFloorProgressExploreFirstDeferred =');
    expect(proGate).toContain('supportFloorTextPressurePaywall && insideProgressPhotoPaywall;');
    expect(proGate).toContain('compactProgressPhotoPaywall ||\n    progressTextPressurePaywall ||');
    expect(proGate).toContain('progressTextPressurePaywall ||\n    boundaryTextPressurePaywall ||');
    expect(proGate).toContain('const microShortDeferredCtaStyle = microShortPaywall');
    expect(proGate).toContain('marginTop: splitShortProgressTabPaywall ? 0 : 88,');
    expect(proGate).toContain("position: 'relative' as const,");
    expect(proGate).toContain('zIndex: 2,');
    expect(proGate).toContain('const paywallTitle = microShortPaywall');
    expect(proGate).toContain("? 'Unlock photos.'");
    expect(proGate).toContain(": 'Unlock Pro.'");
    expect(proGate).toContain(': copy.title;');
    expect(proGate).toContain('const splitShortProgressTabPaywall =');
    expect(proGate).toContain(
      "height < 410 && feature === 'photo_timeline' && pathname === '/progress'",
    );
    expect(proGate).toContain('const storeUnavailableReason =');
    expect(proGate).toContain("? 'Store unavailable in this preview.'");
    expect(proGate).toContain(
      "justifyContent: compactPaywall || denseTextPressurePaywall ? 'flex-start' : 'center'",
    );
    expect(proGate).toContain("? 'min-h-[48px] flex-row items-start justify-between gap-2 pt-0'");
    expect(proGate).toContain("? 'min-h-[96px] items-stretch pt-0'");
    expect(proGate).toContain("? 'h-[48px] self-end justify-center px-2'");
    expect(proGate).toContain('supportFloorTextPressurePaywall ? (');
    expect(proGate).toContain('accessibilityLabel="Maybe later"');
    expect(proGate).toContain('glyph="x"');
    expect(proGate).toContain('tone="muted"');
    expect(proGate).toContain(
      'narrowShortPaywall ||\n        progressTextPressurePaywall ||\n        boundaryTextPressurePaywall ||',
    );
    expect(proGate).toMatch(
      /paddingBottom:\s*compactProgressPhotoPaywall\s*\?\s*96\s*:\s*shortPaywall\s*\?\s*16\s*:\s*compactPaywall\s*\?\s*112\s*:\s*24/,
    );
    expect(proGate).toContain(
      '{headerCompliancePaywall ? <ComplianceRow density="compactHeader" /> : null}',
    );
    expect(proGate).toContain('{headerCompliancePaywall ? null : <ComplianceRow />}');
    expect(proGate).toContain('accessibilityLabel={copy.title}');
    expect(proGate).toContain('{paywallTitle}');
    expect(proGate).toContain('adjustsFontSizeToFit={microShortPaywall}');
    expect(proGate).toContain('numberOfLines={microShortPaywall ? 1 : undefined}');
    expect(proGate).toMatch(/fontSize:\s*microShortPaywall\s*\?\s*18/);
    expect(proGate).toMatch(/lineHeight:\s*microShortPaywall\s*\?\s*21/);
    expect(proGate).toContain(
      '{splitShortProgressTabPaywall ||\n        microShortPaywall ||\n        narrowShortPaywall ||\n        denseTextPressurePaywall ? null : (',
    );
    expect(proGate).toContain('numberOfLines={ultraShortPaywall ? 2 : undefined}');
    expect(proGate).toMatch(
      /microShortPaywall\s*\?\s*'mt-1 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-1'/,
    );
    expect(proGate).toContain(
      "narrowShortPaywall\n              ? 'mt-1 flex-row items-center justify-between rounded-card bg-paper-raised px-3 py-1.5'",
    );
    expect(proGate).toContain('{narrowShortPaywall ? null : (');
    expect(proGate).toContain('adjustsFontSizeToFit={microShortPaywall || narrowShortPaywall}');
    expect(proGate).toContain(
      'numberOfLines={microShortPaywall || narrowShortPaywall ? 1 : undefined}',
    );
    expect(proGate).toContain('fontSize: microShortPaywall');
    expect(proGate).toContain('lineHeight: microShortPaywall');
    expect(proGate).toContain('shortPaywall || denseTextPressurePaywall');
    expect(proGate).toMatch(
      /microShortPaywall\s*\?\s*'mt-0 h-\[48px\] items-center justify-center rounded-pill'/,
    );
    expect(proGate).toContain('style={[');
    expect(proGate).toContain('microShortDeferredCtaStyle,');
    expect(proGate).toContain(
      'canPurchase && !paidAction.isHeld ? colors.clay : colors.mutedLight',
    );
    expect(proGate).toContain('accessibilityLabel={primaryCtaLabel}');
    expect(proGate).toContain('numberOfLines={1}');
    expect(proGate).toContain(
      'fontSize: microShortPaywall ? 15.5 : denseTextPressurePaywall ? 16 : 17',
    );
    expect(proGate).toContain(
      'lineHeight: microShortPaywall ? 18 : denseTextPressurePaywall ? 19 : undefined',
    );
    expect(proGate).toContain(
      'disabled={!offeringResolved || paidAction.isHeld || purchase.isPending}',
    );
    expect(proGate).not.toContain('disabled={!canPurchase || purchase.isPending}');
    expect(proGate).toContain('!supportedTextPressurePaywall');
    expect(proGate).toContain('!tallPhoneTextPressurePaywall');
    expect(proGate).toContain('style={{ flexShrink: 1, minWidth: 0 }}');
    expect(proGate).toContain(
      "style={{ flexShrink: 0, letterSpacing: 0, minWidth: 92, textAlign: 'right' }}",
    );
    expect(proGate).toContain(
      "ultraShortPaywall\n                ? 'mt-1 min-h-[48px] flex-row items-center gap-2 rounded-card px-3 py-1.5'",
    );
    expect(proGate).toContain('{storeUnavailableReason}');
    expect(proGate).toContain('{showExploreFirst && !ultraShortPaywall && !narrowShortPaywall ? (');
    expect(proGate).toContain(
      'const compactExploreCopyPaywall = supportedTextPressurePaywall || tallPhoneTextPressurePaywall;',
    );
    expect(proGate).toContain("compactExploreCopyPaywall\n    ? 'Explore first'");
    expect(proGate).toContain("compactExploreCopyPaywall\n    ? 'No card needed.'");
    expect(proGate).toContain(
      'accessibilityLabel={`${PAYWALL_COPY.offer.exploreTitle}. ${PAYWALL_COPY.offer.exploreBody}`}',
    );
    expect(proGate).toContain('marginTop: supportFloorProgressExploreFirstDeferred');
    expect(proGate).toContain('? 176');
    expect(proGate).toContain('numberOfLines={ultraShortPaywall ? 1 : undefined}');
    expect(proGate).toContain("? 'mt-2 h-[50px] items-center justify-center rounded-pill'");
    expect(proGate).not.toContain('className="pb-4"');
  });

  it('keeps shortest contextual paywall compliance clear of fixed chrome', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const flowTree = readFileSync(`${REPO_DIR}/docs/USER_FLOW_TREE.md`, 'utf8');
    const headerCompliance = proGate.indexOf(
      '{headerCompliancePaywall ? <ComplianceRow density="compactHeader" /> : null}',
    );
    const scrollBody = proGate.indexOf('<ScrollView');
    const bottomCompliance = proGate.indexOf(
      '{headerCompliancePaywall ? null : <ComplianceRow />}',
    );
    const feedback = proGate.indexOf('<PaywallFeedback');

    expect(proGate).toContain("import { router, useIsFocused, usePathname } from 'expo-router';");
    expect(proGate).toContain('const isFocused = useIsFocused();');
    expect(proGate).toContain("if (locked) track('contextual_paywall_shown', { feature });");
    expect(proGate.indexOf('if (!isFocused) return null;')).toBeLessThan(
      proGate.indexOf('if (entitlementChecking)'),
    );
    expect(proGate).toContain('if (!isFocused) return null;');
    expect(proGate).toContain('const pathname = usePathname();');
    expect(proGate).toContain('const insideProgressPhotoPaywall =');
    expect(proGate).toContain("feature === 'photo_timeline' && pathname.startsWith('/progress');");
    expect(proGate).toContain(
      'const progressTextPressurePaywall = insideProgressPhotoPaywall && supportedTextPressurePaywall;',
    );
    expect(proGate).toContain(
      'const compactProgressPhotoPaywall = compactPaywall && insideProgressPhotoPaywall;',
    );
    expect(proGate).toContain('compactProgressPhotoPaywall ||\n    progressTextPressurePaywall ||');
    expect(proGate).toContain('progressTextPressurePaywall ||\n    boundaryTextPressurePaywall ||');
    expect(proGate).toContain(
      'boundaryTextPressurePaywall ||\n    tallPhoneTextPressurePaywall ||',
    );
    expect(proGate).toContain('const shortPaywall = height < 600;');
    expect(proGate).toContain('const ultraShortPaywall = height < 460;');
    expect(proGate).toContain('const narrowShortPaywall = shortPaywall && width < 360;');
    expect(proGate).toContain(
      "height < 410 && feature === 'photo_timeline' && pathname === '/progress'",
    );
    expect(proGate).toContain(
      'narrowShortPaywall ||\n        progressTextPressurePaywall ||\n        boundaryTextPressurePaywall ||',
    );
    expect(proGate).toContain('{showExploreFirst && !ultraShortPaywall && !narrowShortPaywall ? (');
    expect(proGate).toContain('{storeUnavailableReason}');
    expect(proGate).not.toContain('compactComplianceSpacer');
    expect(proGate).not.toContain('height: compactComplianceSpacer');
    expect(proGate).toContain('paddingTop: shortPaywall ? 0 : compactPaywall ? 4 : 0,');
    expect(proGate).toMatch(
      /paddingBottom:\s*compactProgressPhotoPaywall\s*\?\s*96\s*:\s*shortPaywall\s*\?\s*16\s*:\s*compactPaywall\s*\?\s*112\s*:\s*24/,
    );
    expect(headerCompliance).toBeGreaterThan(-1);
    expect(scrollBody).toBeGreaterThan(-1);
    expect(bottomCompliance).toBeGreaterThan(-1);
    expect(feedback).toBeGreaterThan(-1);
    expect(headerCompliance).toBeLessThan(scrollBody);
    expect(bottomCompliance).toBeGreaterThan(feedback);
    expect(proGate).toContain(
      '{shortPaywall || boundaryTextPressurePaywall || supportFloorTextPressurePaywall ? null : (',
    );
    expect(proGate).toContain(
      "'mt-1.5 min-h-[48px] flex-row items-center gap-2 rounded-card px-3 py-1.5'",
    );
    expect(proGate).toContain('{headerCompliancePaywall ? null : <ComplianceRow />}');
    expect(flowTree).toContain('320 x 480 contextual ProGate follow-up');
    expect(flowTree).toContain('320 x 568 text-pressure follow-up');
  });

  it('keeps compact monthly equivalent labels on one readable line', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const upsell = readAppRoute('paywall/upsell.tsx');
    const onboardingPaywall = readAppRoute('onboarding/paywall.tsx');

    for (const [name, source] of [
      ['ProGate', proGate],
      ['paywall/upsell', upsell],
      ['onboarding/paywall', onboardingPaywall],
    ] as const) {
      expect(source, `${name} should not force /mo onto its own cramped line`).not.toContain(
        '\\n/mo',
      );
      expect(source, `${name} should keep monthly equivalent text to one line`).toContain(
        'numberOfLines={1}',
      );
      expect(source, `${name} should allow compact text to shrink before wrapping`).toContain(
        'minimumFontScale={0.86}',
      );
    }

    expect(proGate).toContain('>{`${annualDisplay.pricePerMonthLabel}/mo`}</Text>');
    expect(upsell).toContain('>{`${annualDisplay.pricePerMonthLabel}/mo`}</Text>');
    expect(onboardingPaywall).toContain('>{`${monthlyEquivalent}/mo`}</Text>');
    expect(proGate).toContain(
      "style={{ flexShrink: 0, letterSpacing: 0, minWidth: 92, textAlign: 'right' }}",
    );
    expect(upsell).toContain("style={{ letterSpacing: 0, textAlign: 'right' }}");
    expect(onboardingPaywall).toContain('<View style={{ flexShrink: 1, minWidth: 0 }}>');
    expect(onboardingPaywall).toContain('minWidth: compactPaywall ? 104 : 92');
  });

  it('keeps contextual routine paywalls value-first for first-time free users', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const entitlement = readSource('features/subscription/entitlement.ts');

    expect(proGate).toContain('canStartContextualReverseTrial(data)');
    expect(proGate).toContain('startReverseTrial.mutate');
    expect(proGate).toContain('PAYWALL_COPY.offer.exploreTitle');
    expect(proGate).toContain('PAYWALL_COPY.offer.exploreBody');
    expect(entitlement).toMatch(/canStartContextualReverseTrial[\s\S]*?return false;/);
    expect(proGate).toContain('enabled: locked && shouldLoadContextualOffering(data)');
  });

  it('keeps lapsed contextual paywalls on paid recovery copy', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const useEntitlement = readSource('features/subscription/useEntitlement.ts');

    expect(proGate).toContain('const lapsedEntitlement = data?.expired === true;');
    expect(proGate).toContain(
      "const lapsedReverseTrial = lapsedEntitlement && data?.priorPeriodType === 'reverse_trial';",
    );
    expect(proGate).toContain(
      "const priceIntroLabel = lapsedEntitlement ? 'Restore Pro for' : annualDisplay.introLabel;",
    );
    expect(proGate).toContain('const primaryCtaLabel = lapsedEntitlement');
    expect(proGate).toContain('PAYWALL_COPY.reoffer.keepCta');
    expect(proGate).toContain('PAYWALL_COPY.downgrade.renewCta');
    expect(proGate).toContain('paywallPurchasePresentation(annual)');
    expect(proGate).toContain('purchasePresentation.cta');
    expect(proGate).toContain('{priceIntroLabel}');
    expect(proGate).toContain('{primaryCtaLabel}');
    expect(proGate).toContain('if (!canPurchase) {');
    expect(proGate).toContain('PAYWALL_FEEDBACK.storePricingUnavailable');
    expect(proGate).toContain(
      'disabled={!offeringResolved || paidAction.isHeld || purchase.isPending}',
    );
    expect(proGate).not.toContain('disabled={!canPurchase || purchase.isPending}');
    expect(useEntitlement).toContain("fixture !== 'expired_store'");
    expect(useEntitlement).toContain("fixture !== 'expired_reverse_trial'");
    expect(useEntitlement).toContain("if (fixture === 'expired_store')");
    expect(useEntitlement).toContain("if (fixture === 'expired_reverse_trial')");
    expect(useEntitlement).toContain("if (env.appEnvironment !== 'development') return null;");
    expect(useEntitlement).toContain(
      'const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();',
    );
  });

  it('defers fail-soft trial reminder reconciliation from the ordered published winner', () => {
    const source = readSource('features/subscription/useEntitlement.ts');
    const reminder = readSource('features/subscription/entitlementReminder.ts');
    const delivery = readSource('features/notifications/deliver.ts');
    const helperStart = source.indexOf('async function persistRevenueCatResult');
    const helperEnd = source.indexOf('\nexport function useEntitlement', helperStart);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helperEnd).toBeGreaterThan(helperStart);

    const helper = source.slice(helperStart, helperEnd);
    const emptyStart = helper.indexOf('if (!entitlement) {');
    const emptyEnd = helper.indexOf('const attributed =', emptyStart);
    const emptyBranch = helper.slice(emptyStart, emptyEnd);

    expect(emptyStart).toBeGreaterThanOrEqual(0);
    expect(emptyEnd).toBeGreaterThan(emptyStart);
    expect(emptyBranch).toContain('if (!classified.emptyEvidence) return null;');
    expect(emptyBranch).toContain('await acceptRevenueCatVerifiedEmpty(classified.emptyEvidence)');
    expect(emptyBranch).toContain('const published = publishAcceptance(acceptance);');
    expect(emptyBranch).toContain('deferEntitlementTrialReminder(ownerScope, published);');
    expect(emptyBranch).toContain('acceptedEntitlement: acceptance.entitlement');
    expect(emptyBranch).toContain('publishedState: published');
    expect(helper.match(/deferEntitlementTrialReminder\(ownerScope, published\);/g)).toHaveLength(
      2,
    );
    expect(helper).not.toContain('scheduleTrialReminder');
    expect(helper).not.toContain('cancelTrialReminder');
    expect(reminder).toContain("import('@/features/notifications/deliver')");
    expect(reminder).toContain('advanceEntitlementStateAtBoundary(');
    expect(reminder).toContain('publishedState,');
    expect(reminder).toContain(
      'void reconcileEntitlementTrialReminder(ownerScope, publishedState)',
    );
    expect(reminder).toContain('.catch(() => undefined)');
    expect(source).toContain('advanceEntitlementStateAtBoundary(current, Date.now(), event)');
    expect(delivery).toContain('export async function scheduleTrialReminder(');
    expect(delivery).toContain('input: TrialReminderInput,');
    expect(delivery).toContain('lifecycle?: NotificationScheduleLifecycle,');
    expect(delivery).toContain('scheduleNativeNotificationExact(guardedLease.signal');
    expect(delivery).not.toContain('loadEntitlement');
  });

  it('keeps gated content hidden while entitlement is still resolving', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const useEntitlement = readSource('features/subscription/useEntitlement.ts');
    const offering = readSource('features/subscription/useSubscriptionOffering.ts');

    expect(proGate).toContain('const entitlementChecking = isLoading || (!data && !isError);');
    expect(proGate.indexOf('if (entitlementChecking)')).toBeLessThan(
      proGate.indexOf('if (!locked) return <>{children}</>;'),
    );
    expect(proGate).toContain('Checking your access');
    expect(proGate).toContain(
      'We will keep Pro-only screens hidden until your subscription status is confirmed.',
    );
    expect(proGate).toContain('if (!locked) return <>{children}</>;');
    expect(useEntitlement).toContain('EXPO_PUBLIC_E2E_ENTITLEMENT_DELAY_MS');
    expect(useEntitlement).toContain('const MAX_E2E_ENTITLEMENT_DELAY_MS = 3_000;');
    expect(useEntitlement).toContain("if (env.appEnvironment !== 'development') return 0;");
    expect(useEntitlement).toContain(
      'await awaitAccountGenerationLease(lease, () => wait(e2eDelay));',
    );
    expect(proGate).toContain('enabled: locked && shouldLoadContextualOffering(data)');
    expect(offering).toContain('enabled?: boolean;');
    expect(offering).toContain('enabled,');
  });

  it('recovers uncertain entitlement evidence without showing or loading a paywall', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const entitlement = readSource('features/subscription/entitlement.ts');
    const uncertainBranch = proGate.indexOf('if (entitlementUncertain)');
    const unlockedBranch = proGate.indexOf('if (!locked) return <>{children}</>;');

    expect(proGate).toContain('isEntitlementEvidenceUncertain,');
    expect(proGate).toContain(
      'const entitlementUncertain = !data ? isError : isEntitlementEvidenceUncertain(data);',
    );
    expect(proGate).toContain(
      'const locked = data ? !data.isPro && !entitlementUncertain : false;',
    );
    expect(uncertainBranch).toBeGreaterThan(proGate.indexOf('if (entitlementChecking)'));
    expect(uncertainBranch).toBeLessThan(unlockedBranch);
    expect(proGate).toContain('Access temporarily unavailable');
    expect(proGate).toContain('accessibilityLabel="Retry plan verification"');
    expect(proGate).toContain('onPress={() => void retryVerification()}');
    expect(proGate).toContain('enabled: locked && shouldLoadContextualOffering(data)');
    expect(entitlement).toContain("s?.evidenceStatus === 'stale'");
    expect(entitlement).toContain("s?.evidenceStatus === 'unsupported_version'");
  });

  it('keeps the reverse-trial reoffer inert until entitlement evidence resolves', () => {
    const reoffer = readAppRoute('paywall/reoffer.tsx');
    const policy = readSource('features/subscription/directPaywallPolicy.ts');
    const resolution = readSource('features/subscription/DirectPaywallResolution.tsx');
    const trackEffect = reoffer.slice(
      reoffer.indexOf("track('paywall_shown'") - 120,
      reoffer.indexOf("track('paywall_shown'") + 180,
    );
    const acknowledgementEffect = reoffer.slice(
      reoffer.indexOf('void acknowledgeLifecyclePromptPresented') - 180,
      reoffer.indexOf('void acknowledgeLifecyclePromptPresented') + 220,
    );

    expect(policy).toContain('if (!state) return input.isError ? INERT_RECOVERY : INERT_LOADING;');
    expect(policy).toContain('isEntitlementEvidenceUncertain(state)');
    expect(reoffer).toContain("const decision = directPaywallDecision('reoffer'");
    expect(reoffer).toContain('useSubscriptionOffering({ enabled: decision.loadOffering })');
    expect(trackEffect).toContain('if (!decision.trackPresentation) return;');
    expect(acknowledgementEffect).toContain("if (decision.lifecycleDisposition === 'present')");
    expect(reoffer).toContain('if (!decision.allowPurchase || paidAction.isHeld) return;');
    expect(reoffer).toContain('if (!decision.allowPurchase) return;');
    expect(reoffer.indexOf("if (decision.phase === 'recovery')")).toBeLessThan(
      reoffer.indexOf('function renderPriceSummary'),
    );
    expect(resolution).toContain('Plan status unavailable');
    expect(resolution).toContain('accessibilityLabel="Retry plan verification"');
    expect(reoffer).toContain('onRetry={() => void entitlement.retryVerification()}');
    expect(policy).toContain("return offer('active_reverse_trial'");
    expect(policy).toContain("return offer('expired_reverse_trial'");
    expect(policy).toContain("if (isLapsedPaid(state)) return redirect('downgrade'");
  });

  it('keeps forced provider refresh explicit and covers the full Retry flight', () => {
    const source = readSource('features/subscription/useEntitlement.ts');
    const passiveStart = source.indexOf('reconcile: () =>');
    const passiveEnd = source.indexOf('selectCurrentState:', passiveStart);
    const passiveReconciliation = source.slice(passiveStart, passiveEnd);
    const retryStart = source.indexOf('const verificationRetry = useMutation');
    const retryEnd = source.indexOf('\n  useEffect(', retryStart);
    const explicitRetry = source.slice(retryStart, retryEnd);

    expect(passiveStart).toBeGreaterThanOrEqual(0);
    expect(passiveEnd).toBeGreaterThan(passiveStart);
    expect(passiveReconciliation).toContain('entitlementServerCoordinator.reconcile');
    expect(passiveReconciliation).not.toContain('refreshCustomerInfo');
    expect(passiveReconciliation).not.toContain('entitlementRevenueCatRefreshCoordinator');

    expect(retryStart).toBeGreaterThanOrEqual(0);
    expect(retryEnd).toBeGreaterThan(retryStart);
    expect(explicitRetry).toContain('entitlementVerificationRetryCoordinator.retry');
    expect(explicitRetry).toContain('await query.refetch();');
    expect(explicitRetry).toContain('entitlementRevenueCatRefreshCoordinator.refresh');
    expect(explicitRetry).toContain('const customerInfo = await refreshCustomerInfo({');
    expect(explicitRetry).toContain('entitlementServerCoordinator.reconcile');
    expect(explicitRetry).toContain('force: true');
    expect(explicitRetry).not.toContain('useSubscriptionOffering');
    expect(source).toContain('isVerificationRetrying: verificationRetry.isPending');
    expect(source).toContain('retryVerification: () => verificationRetry.mutateAsync()');

    const recoverySurfaces = [
      readSource('features/subscription/ProGate.tsx'),
      readAppRoute('settings/subscription.tsx'),
      readAppRoute('onboarding/paywall.tsx'),
      readAppRoute('paywall/downgrade.tsx'),
      readAppRoute('paywall/reoffer.tsx'),
      readAppRoute('paywall/upsell.tsx'),
      readAppRoute('paywall/winback.tsx'),
    ];
    for (const recoverySurface of recoverySurfaces) {
      expect(recoverySurface).toContain('isVerificationRetrying');
      expect(recoverySurface).toContain('retryVerification');
    }
  });

  it('binds every direct paywall side effect to the shared entitlement decision', () => {
    for (const [route, policyRoute] of [
      ['paywall/upsell.tsx', 'upsell'],
      ['paywall/winback.tsx', 'winback'],
      ['paywall/downgrade.tsx', 'downgrade'],
      ['paywall/reoffer.tsx', 'reoffer'],
      ['onboarding/paywall.tsx', 'onboarding'],
    ] as const) {
      const source = readAppRoute(route);
      expect(source).toContain(`directPaywallDecision('${policyRoute}'`);
      expect(source).toContain('useSubscriptionOffering({ enabled: decision.loadOffering })');
      expect(source).toContain('if (!decision.allowPurchase');
      expect(source).toContain("if (decision.phase === 'loading')");
      expect(source).toContain("if (decision.phase === 'recovery')");
      expect(source).toContain("if (decision.phase === 'redirect')");
      expect(source).toContain('isOwnerQueryScopeCurrent(ownerScope)');
    }

    const upsell = readAppRoute('paywall/upsell.tsx');
    const winback = readAppRoute('paywall/winback.tsx');
    const reoffer = readAppRoute('paywall/reoffer.tsx');
    const onboarding = readAppRoute('onboarding/paywall.tsx');
    expect(upsell).toContain('if (!decision.trackPresentation) return;');
    expect(winback).toContain('if (!decision.trackPresentation) return;');
    expect(reoffer).toContain('if (!decision.trackPresentation) return;');
    expect(onboarding).toContain('if (!decision.trackPresentation) return;');
    expect(onboarding).toContain('label="Continue free"');
    expect(onboarding).not.toContain('startReverseTrial');

    for (const route of [
      readAppRoute('paywall/reoffer.tsx'),
      readAppRoute('paywall/downgrade.tsx'),
    ]) {
      expect(route).toContain('void supersedeLifecyclePrompt({');
      expect(route).not.toContain('await supersedeLifecyclePrompt({');
      expect(route).not.toContain('params: { lifecyclePromptId');
    }
  });

  it('binds paid mutations to rendered evidence and receipt-only success navigation', () => {
    const hold = readSource('features/subscription/usePaidActionHold.ts');
    const feedback = readSource('features/subscription/PaywallFeedback.tsx');
    for (const [route, kind] of [
      ['paywall/upsell.tsx', 'upsell_purchase'],
      ['paywall/winback.tsx', 'winback_purchase'],
      ['paywall/downgrade.tsx', 'downgrade_purchase'],
      ['paywall/reoffer.tsx', 'reoffer_purchase'],
      ['onboarding/paywall.tsx', 'onboarding_purchase'],
    ] as const) {
      const source = readAppRoute(route);
      expect(source).toContain(`kind: '${kind}'`);
      expect(source).toContain('expectedEvidenceIdentity:');
      expect(source).toContain('paidAction.resolve(result)');
      expect(source).toContain("outcome.kind === 'success'");
      expect(source).toContain('params: { receipt: outcome.receiptId }');
      expect(source).not.toContain("if (result.active) router.replace('/paywall/success')");
      expect(source).toContain('paidAction.feedback ?? actionFeedback');
      expect(source).toContain('paidAction.isHeld');
    }

    const reoffer = readAppRoute('paywall/reoffer.tsx');
    expect(reoffer).toContain("kind: 'decline_expired_reverse_trial'");

    const proGate = readSource('features/subscription/ProGate.tsx');
    for (const kind of ['upsell_purchase', 'downgrade_purchase', 'reoffer_purchase']) {
      expect(proGate).toContain(`'${kind}'`);
    }
    expect(proGate).toContain("kind: 'reverse_trial'");
    expect(proGate).toContain('expectedEvidenceIdentity: data?.evidenceIdentity ?? null');
    expect(proGate).toContain('isOwnerQueryScopeCurrent(ownerScope)');
    expect(hold).toContain('const paidActionHoldStore = createPaidActionHoldStore()');
    expect(hold).toContain('useSyncExternalStore');
    expect(hold).not.toContain('useState');
    expect(hold).not.toContain('currentEvidenceIdentity');
    expect(feedback).toContain('The store result could not be verified yet.');
    expect(feedback).not.toContain('Purchase received');
  });

  it('does not abandon win-back while native offering metadata is unresolved', () => {
    const winback = readAppRoute('paywall/winback.tsx');
    const policy = readSource('features/subscription/winBackOfferingPolicy.ts');

    expect(policy).toContain("if (!offering) return 'loading';");
    expect(policy).toContain("offering.status === 'available'");
    expect(winback).toContain('const offeringDecision = winBackOfferingDecision(offering.data);');
    expect(winback).toContain("if (offeringDecision === 'loading') return;");
    expect(winback).toContain("offeringDecision === 'loading' ||");
    expect(winback).toContain("offeringDecision === 'fallback' ? (");
    expect(winback.indexOf("if (offeringDecision === 'loading') return;")).toBeLessThan(
      winback.indexOf("router.replace('/paywall/upsell?feature=full_routine')"),
    );
  });

  it('renders purchase success only from a current-owner one-use receipt', () => {
    const success = readAppRoute('paywall/success.tsx');
    const receipts = readSource('features/subscription/purchaseSuccessReceipt.ts');

    expect(success).toContain('useLocalSearchParams<{ receipt?: string | string[] }>()');
    expect(success).toContain('consumePurchaseSuccessReceipt(ownerScope, receiptId)');
    expect(success).toContain('const redemptionKey = `${ownerScope.generation}:${receiptId');
    expect(success).toContain('attemptedRedemptionKey.current === redemptionKey');
    expect(success).toContain('redemption.key === redemptionKey');
    expect(success).toContain('!isOwnerQueryScopeCurrent(ownerScope)');
    expect(success).toContain('No recent purchase to confirm');
    expect(success).not.toContain('useEntitlement()');
    expect(success).not.toContain('useSubscriptionOffering()');
    expect(success).not.toContain('PLANS.annual.trialDays');
    expect(success).not.toContain('?? true');
    expect(success).not.toContain("'the store price'");
    expect(receipts).toContain(
      'acceptedState.evidenceIdentity === publishedState.evidenceIdentity',
    );
    expect(receipts).toContain("action: 'purchase' | 'winback';");
    expect(receipts).toContain('completed: boolean;');
    expect(receipts).toContain('purchasePriceLabel?: string;');
    expect(receipts).toContain('offerDurationLabel?: string;');
    expect(receipts).toContain('storedPriceLabel !== publishedPriceLabel');
    expect(receipts).toContain('this.receipts.delete(normalized);');
  });

  it('keeps paywall compliance links comfortably large enough for phone taps', () => {
    const source = readSource('features/subscription/ComplianceRow.tsx');

    expect(source).toContain("density?: 'default' | 'compactHeader';");
    expect(source).toContain("const compactHeader = density === 'compactHeader';");
    expect(source).toContain("'min-h-[48px] flex-row items-center justify-start gap-1'");
    expect(source).toContain("'min-h-[48px] flex-row items-center justify-center gap-2.5'");
    expect(
      source.match(/'min-h-\[48px\] min-w-\[48px\] items-center justify-center px-0'/g),
    ).toHaveLength(3);
    expect(
      source.match(/'min-h-\[48px\] min-w-\[48px\] items-center justify-center px-1'/g),
    ).toHaveLength(3);
    expect(source.match(/style=\{\{ minHeight: 48, minWidth: 48 \}\}/g)).toHaveLength(3);
    expect(source).not.toContain('hitSlop={8}');
  });

  it('keeps paywall compliance handoff and restore feedback visible', () => {
    const source = readSource('features/subscription/ComplianceRow.tsx');
    const restoreFeedback = readSource('features/subscription/restoreFeedback.ts');
    const entitlement = readSource('features/subscription/useEntitlement.ts');
    const settings = readAppRoute('settings/subscription.tsx');

    expect(source).toContain('const [feedback, setFeedback] = useState<string | null>(null);');
    expect(source).toContain('export function openPolicy(url: string): Promise<boolean>');
    expect(source).toContain('alertOnFailure: false');
    expect(source).toContain('const opened = await openPolicy(url);');
    expect(source).toContain('if (!opened) setFeedback(POLICY_LINK_UNAVAILABLE_MESSAGE);');
    expect(source).toContain('onPress={() => void onPolicy(TERMS_URL)}');
    expect(source).toContain('onPress={() => void onPolicy(PRIVACY_URL)}');
    expect(source).toContain("import { restoreFeedbackMessage } from './restoreFeedback';");
    expect(restoreFeedback).toContain('if (result.storePurchaseFound && result.active)');
    expect(restoreFeedback).toContain(
      'result.verificationPending || result.purchaseMayHaveCompleted',
    );
    expect(restoreFeedback).toContain('Do not purchase again');
    expect(restoreFeedback).toContain(
      'No store purchase was found. Your existing Pro access remains active.',
    );
    expect(source).toContain('setFeedback(message);');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain("'pb-1 pr-2 text-left'");
    expect(source).toContain("'px-4 pb-2 text-center'");
    expect(source).not.toContain('Alert.alert');
    expect(source).not.toContain('import { Alert');
    expect(entitlement).toContain("fixture !== 'expired_store'");
    expect(entitlement).toContain("fixture !== 'expired_reverse_trial'");
    expect(entitlement).toContain("periodType: 'normal'");
    expect(entitlement).toContain("managementUrl: 'https://apps.apple.com/account/subscriptions'");
    expect(entitlement).toContain('storePurchaseFound: result.restored');
    expect(settings).toContain('setSubscriptionFeedback(restoreFeedbackMessage(result));');
    expect(settings).toContain(
      'const exactEntitlementPriceLabel = currentPlan ? data?.priceLabel : null;',
    );
    expect(settings).not.toContain('offering.data.annual.priceLabel');
  });

  it('keeps purchase and restore recovery route-owned instead of native alerts', () => {
    const feedback = readSource('features/subscription/PaywallFeedback.tsx');
    const stateNotice = readSource('components/ui/StateNotice.tsx');
    const externalOpen = readSource('lib/navigation/externalOpen.ts');

    expect(feedback).toContain('export function PaywallFeedback');
    expect(feedback).toContain('<StateNotice');
    expect(feedback).toContain('kind={feedback.kind}');
    expect(feedback).toContain('PAYWALL_FEEDBACK');
    expect(stateNotice).toContain("alert ? 'alert' : undefined");
    expect(externalOpen).toContain('alertOnFailure?: boolean');
    expect(externalOpen).not.toContain('Alert.alert');
    expect(externalOpen).not.toContain('import { Alert');

    for (const route of [
      'onboarding/paywall.tsx',
      'paywall/reoffer.tsx',
      'paywall/downgrade.tsx',
      'paywall/upsell.tsx',
      'paywall/winback.tsx',
    ]) {
      const source = readAppRoute(route);

      expect(source, `${route} should render shared inline paywall feedback`).toContain(
        'PaywallFeedback',
      );
      expect(source, `${route} should clear stale feedback before purchase action`).toContain(
        'setActionFeedback(null);',
      );
      expect(source, `${route} should use shared store-pricing feedback`).toContain(
        'PAYWALL_FEEDBACK',
      );
      expect(source, `${route} should not use native alerts for purchase recovery`).not.toContain(
        'Alert.alert',
      );
      expect(source, `${route} should not import native Alert`).not.toContain('import { Alert');
    }

    const proGate = readSource('features/subscription/ProGate.tsx');
    expect(proGate).toContain('PaywallFeedback');
    expect(proGate).toContain('setActionFeedback(null);');
    expect(proGate).toContain('PAYWALL_FEEDBACK');
    expect(proGate).not.toContain('Alert.alert');
    expect(proGate).not.toContain('import { Alert');

    const subscriptionSettings = readAppRoute('settings/subscription.tsx');
    expect(subscriptionSettings).toContain('alertOnFailure: false');
    expect(subscriptionSettings).toContain(
      'setSubscriptionFeedback(restoreFeedbackMessage(result));',
    );
    expect(subscriptionSettings).toContain('setSubscriptionFeedback(RESTORE_UNAVAILABLE_MESSAGE);');
    expect(subscriptionSettings).not.toContain('Alert.alert');
    expect(subscriptionSettings).not.toContain('import { Alert');
  });

  it('keeps purchase-capable lifecycle paywalls compliant with Terms, Privacy, and Restore', () => {
    for (const route of ['paywall/reoffer.tsx', 'paywall/downgrade.tsx']) {
      const source = readAppRoute(route);

      expect(source, `${route} should import shared paywall compliance controls`).toContain(
        "import { ComplianceRow } from '@/features/subscription/ComplianceRow';",
      );
      expect(
        source,
        `${route} should render Terms, Privacy, and Restore on the paywall surface`,
      ).toContain('<ComplianceRow />');
    }

    const winback = readAppRoute('paywall/winback.tsx');

    expect(winback).toContain(
      "import { ComplianceRow } from '@/features/subscription/ComplianceRow';",
    );
    expect(winback, 'dark win-back paywall should render readable compliance controls').toContain(
      '<ComplianceRow tone="dark" />',
    );
  });

  it('keeps compact lifecycle paywall compliance in the visible action footer', () => {
    const reoffer = readAppRoute('paywall/reoffer.tsx');
    const downgrade = readAppRoute('paywall/downgrade.tsx');
    const winback = readAppRoute('paywall/winback.tsx');

    expect(reoffer).toContain('{compactPaywall ? null : <ComplianceRow />}');
    expect(reoffer).toContain('{compactPaywall ? <ComplianceRow /> : null}');
    expect(downgrade).toContain('{compactPaywall ? null : <ComplianceRow />}');
    expect(downgrade).toContain('{compactPaywall ? <ComplianceRow /> : null}');
    expect(winback).toContain('{compactPaywall ? null : <ComplianceRow tone="dark" />}');
    expect(winback).toContain('{compactPaywall ? <ComplianceRow tone="dark" /> : null}');
  });

  it('keeps lifecycle paywalls explicit when store pricing disables purchase', () => {
    for (const route of ['paywall/reoffer.tsx', 'paywall/downgrade.tsx']) {
      const source = readAppRoute(route);

      expect(
        source,
        `${route} should only show the store-unavailable reason in unavailable states`,
      ).toContain("offering.data?.status && offering.data.status !== 'available'");
      if (route === 'paywall/reoffer.tsx') {
        expect(source, `${route} should centralize the unavailable reason`).toContain(
          'const unavailableReason =',
        );
        expect(source, `${route} should explain why the purchase action is disabled`).toContain(
          '{unavailableReason}',
        );
      } else {
        expect(source, `${route} should explain why the purchase action is disabled`).toContain(
          '{offering.data.reason}',
        );
      }
    }
  });

  it('keeps compact reverse-trial keep options billing context above the CTA', () => {
    const reoffer = readAppRoute('paywall/reoffer.tsx');
    const compactPrice = reoffer.indexOf('{compactPaywall ? renderPriceSummary(true) : null}');
    const compactReason = reoffer.indexOf('{compactPaywall && unavailableReason ? (');
    const purchaseCta = reoffer.indexOf('onPress={onStartTrial}');

    expect(reoffer).toContain("contentContainerClassName={compactPaywall ? 'pb-56' : 'pb-4'}");
    expect(reoffer).toContain('adjustsFontSizeToFit');
    expect(reoffer).toContain('numberOfLines={1}');
    expect(reoffer).toContain('numberOfLines={compact ? 2 : undefined}');
    expect(reoffer).toContain('minimumFontScale={0.78}');
    expect(reoffer).toContain('fontSize: compact ? 20 : 24');
    expect(reoffer).toContain('fontSize: compact ? 11.5 : undefined');
    expect(compactPrice).toBeGreaterThan(-1);
    expect(compactReason).toBeGreaterThan(-1);
    expect(purchaseCta).toBeGreaterThan(-1);
    expect(compactPrice).toBeLessThan(purchaseCta);
    expect(compactReason).toBeLessThan(purchaseCta);
  });

  it('keeps unavailable win-back offer copy next to the fallback action', () => {
    const winback = readAppRoute('paywall/winback.tsx');

    expect(winback).toContain('useWindowDimensions');
    expect(winback).toContain(
      "import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';",
    );
    expect(winback).toContain('const { fontScale = 1, height, width } = useWindowDimensions();');
    expect(winback).toContain('const tallTextPressurePaywall =');
    expect(winback).toContain(
      "width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(winback).toContain('const compactPaywall = height < 640 || tallTextPressurePaywall;');
    expect(winback).toContain("style={{ overflow: 'hidden' }}");
    expect(winback).toContain("justifyContent: compactPaywall ? 'flex-start' : 'center'");
    expect(winback).toContain('const unavailableOfferCopy =');
    expect(winback).toContain('className="gap-2.5"');
    expect(winback).toContain(
      'style={{ backgroundColor: BG, paddingTop: compactPaywall ? 8 : 0 }}',
    );
    expect(winback).toContain('className="px-2 text-center"');
    expect(winback).toContain('{unavailableOfferCopy}');
    expect(winback).toContain("? 'Checking offer…'");
    expect(winback).toContain('? PAYWALL_COPY.winback.cta');
    expect(winback).toContain(": 'See current Pro plan'");
  });

  it('keeps active reverse-trial keep options distinct from the expired re-offer', () => {
    const reoffer = readAppRoute('paywall/reoffer.tsx');
    const copy = readSource('features/subscription/copy.ts');

    expect(reoffer).toContain('const activeReverseTrial = data?.inReverseTrial === true;');
    expect(reoffer).toContain(
      "context: activeReverseTrial ? 'reverse_trial_keep_options' : 'reverse_trial_reoffer'",
    );
    expect(reoffer).toContain('PAYWALL_COPY.reverseTrial.keepTitle');
    expect(reoffer).toContain('PAYWALL_COPY.reoffer.title');
    expect(reoffer).toContain('dismissPaywall(router, APP_YOU_ROUTE)');
    expect(copy).toContain("keepPill: 'No card on file'");
    expect(copy).toContain("keepDeclineCta: 'Keep exploring for now'");
  });

  it('keeps the onboarding paywall actions visible sooner on short phones', () => {
    const source = readAppRoute('onboarding/paywall.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPaywall = height < 640');
    expect(source).toContain('const supportFloorTextPressurePaywall =');
    expect(source).toContain(
      "width <= 430 && height >= 640 && height < 700 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(source).toContain('const tallTextPressurePaywall =');
    expect(source).toContain(
      "width <= 430 && height >= 900 && height < 980 && (fontScale >= 1.3 || Platform.OS === 'web')",
    );
    expect(source).toContain(
      'const compactPaywall = height < 640 || supportFloorTextPressurePaywall || tallTextPressurePaywall;',
    );
    expect(source).toContain('const headerCompliancePaywall = compactPaywall;');
    expect(source).toContain(
      '{headerCompliancePaywall ? <ComplianceRow density="compactHeader" /> : null}',
    );
    expect(source).toContain('{headerCompliancePaywall ? null : <ComplianceRow />}');
    expect(source).toContain("contentContainerClassName={compactPaywall ? 'pb-6' : 'pb-8'}");
    expect(source).toContain("className={compactPaywall ? 'mt-2.5 gap-1' : 'mt-5 gap-2.5'}");
    expect(source).toContain("'mt-2 h-[48px] items-center justify-center rounded-pill'");
    expect(source).toContain("'mt-5 h-[54px] items-center justify-center rounded-pill'");
    expect(source).toContain('compact={compactPaywall}');
    expect(source).not.toContain('contentContainerClassName="pb-8"');
  });

  it('keeps purchase success metadata readable on compact phones', () => {
    const source = readAppRoute('paywall/success.tsx');
    const copy = readSource('features/subscription/copy.ts');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPhone = height < 640');
    expect(copy).toContain('metaRowsForTrial:');
    expect(copy).toContain('metaRowsForPaid:');
    expect(source).toContain('const metaRows = inTrial');
    expect(source).toContain('PAYWALL_COPY.success.metaRowsForTrial(');
    expect(source).toContain('PAYWALL_COPY.success.metaRowsForPaid(');
    expect(source).toContain('currentReceipt.offerDurationLabel');
    expect(source).toContain('metaRows.map((row)');
    expect(source).toContain('max-w-[272px]');
    expect(source).toContain('lineHeight: 18');
    expect(source).toContain('includeFontPadding: false');
    expect(source).toContain('\\u2713');
    expect(source).toContain("className={compactPhone ? 'pb-4' : 'pb-2'}");
    expect(source).not.toContain('{meta}');
    expect(source).not.toContain(`>${String.fromCharCode(0x2713)}</Text>`);
    expect(source).not.toContain(`>${String.fromCharCode(0x00e2, 0x0153, 0x201c)}</Text>`);
  });

  it('binds every RevenueCat store action to one exact owner lease without mutation retries', () => {
    const actions = readSource('features/subscription/useEntitlement.ts');
    const offering = readSource('features/subscription/useSubscriptionOffering.ts');
    const revenuecat = readSource('lib/iap/revenuecat.ts');
    const settings = readAppRoute('settings/subscription.tsx');

    expect(actions).toContain('const revenueCatOwner = (lease: AccountGenerationLease) =>');
    expect(actions).toContain("if (!user?.id) throw new Error('REVENUECAT_OWNER_REQUIRED');");
    expect(actions).toContain('const result = await purchasePackage(');
    expect(actions).toMatch(
      /\(\)\s*=>\s*assertActionAtCommit\(lease, input, \['onboarding_purchase'\]\),/,
    );
    expect(actions).toMatch(/\(\)\s*=>\s*assertActionAtCommit\(lease, input, allowedKinds\),/);
    expect(actions).toContain('restorePurchases(revenueCatOwner(lease))');
    expect(actions).toContain('const result = await purchaseWinBackPackage(');
    expect(actions).toMatch(
      /\(\)\s*=>\s*assertActionAtCommit\(lease, input, \['winback_purchase'\]\),/,
    );
    expect(actions).toContain('showNativeManageSubscriptions(revenueCatOwner(lease))');
    expect(actions.match(/retry: 0,/g)?.length).toBeGreaterThanOrEqual(5);

    expect(offering).toContain('const owner = { appUserId: user.id, lease } as const;');
    expect(offering).toContain('await configureRevenueCat(owner);');
    expect(offering).toContain('return getSubscriptionOffering(owner);');

    expect(revenuecat).toContain('context: RevenueCatOperationContext');
    expect(revenuecat).toContain('type OwnerTaggedOfferings');
    expect(revenuecat).toContain('ownerCoordinator.runHazard(');
    expect(settings).toContain('const { manage, restore } = useEntitlementActions();');
    expect(settings).toContain('openedNative = await manage.mutateAsync();');
    expect(settings).not.toContain('showNativeManageSubscriptions()');
  });

  it('keeps the ownerless reverse-trial fixture development-only and Supabase-unconfigured', () => {
    const actions = readSource('features/subscription/useEntitlement.ts');

    expect(actions).toContain("import { env, isSupabaseConfigured } from '@/lib/env';");
    expect(actions).toContain('const reverseTrialStoreUserId = () => {');
    expect(actions).toContain('if (user?.id) return user.id;');
    expect(actions).toContain(
      "if (env.appEnvironment === 'development' && !isSupabaseConfigured) return undefined;",
    );
    expect(actions).toMatch(
      /const reverseTrialStoreUserId = \(\) => \{[\s\S]*?throw new Error\('REVENUECAT_OWNER_REQUIRED'\);[\s\S]*?\};/,
    );
    const reverseTrialBlock = actions.match(
      /const startReverseTrial = useMutation\(\{[\s\S]*?const startTrial = useMutation/,
    )?.[0];
    expect(reverseTrialBlock).toBeDefined();
    expect(reverseTrialBlock).toContain('const storeUserId = reverseTrialStoreUserId();');
    expect(reverseTrialBlock).toMatch(
      /startReverseTrialOnServer\(\s*lease\.assertCurrent,\s*storeUserId,\s*\(\) =>/,
    );
    expect(
      reverseTrialBlock?.match(/assertActionAtCommit\(lease, input, \['reverse_trial'\]\)/g),
    ).toHaveLength(2);
    expect(actions).not.toMatch(
      /assertActionAtCommit\(lease, input, \['reverse_trial'\]\);\s+const owner = revenueCatOwner\(lease\);/,
    );
  });
});
