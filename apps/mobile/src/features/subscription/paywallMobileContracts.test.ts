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
      expect(source, `${route} should not keep compact footer actions at an 8px bottom edge`).not.toContain(
        'className="gap-2.5 pb-2"',
      );
    }
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
    expect(upsell).toContain('useWindowDimensions');
    expect(upsell).toContain('const compactPaywall = height < 640;');
    expect(upsell).toContain(
      "const longCompactTitle = compactPaywall && width < 420 && key === 'reminders_widgets';",
    );
    expect(upsell).toContain('className={compactPaywall ? \'px-7 pb-8 pt-4\' : undefined}');
    expect(upsell).toContain("fontSize: longCompactTitle ? 24 : 30");
    expect(upsell).toContain(
      "compactPaywall\n            ? 'mt-2 h-[54px] items-center justify-center rounded-pill'",
    );
    expect(upsell).toContain('backdropAccessible={false}');
    expect(proGate).toContain('<ScrollView');
    expect(proGate).toContain('className="h-[48px] justify-center px-2"');
    expect(proGate).toContain('paywallDismissFallbackForFeature(feature)');
    expect(proGate).toContain('dismissPaywall(router, paywallDismissFallback)');
    expect(proGate).toContain('useWindowDimensions');
    expect(proGate).toContain('const compactPaywall = height < 640');
    expect(proGate).toContain("justifyContent: compactPaywall ? 'flex-start' : 'center'");
    expect(proGate).toContain(
      'paddingBottom: compactTabbedPhotoPaywall ? 144 : compactPaywall ? 112 : 24',
    );
    expect(proGate).toContain("? 'mt-2 h-[50px] items-center justify-center rounded-pill'");
    expect(proGate).not.toContain('className="pb-4"');
  });

  it('keeps compact Progress-tab paywall compliance clear of the floating tab bar', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const flowTree = readFileSync(`${REPO_DIR}/docs/USER_FLOW_TREE.md`, 'utf8');

    expect(proGate).toContain("import { router, useIsFocused, usePathname } from 'expo-router';");
    expect(proGate).toContain('const isFocused = useIsFocused();');
    expect(proGate).toContain("if (isFocused && locked) track('contextual_paywall_shown', { feature });");
    expect(proGate.indexOf('if (!isFocused) return null;')).toBeLessThan(
      proGate.indexOf('if (isLoading || !data)'),
    );
    expect(proGate).toContain('if (!isFocused) return null;');
    expect(proGate).toContain('const pathname = usePathname();');
    expect(proGate).toContain(
      "const insideTabbedPhotoPaywall = pathname === '/progress' && feature === 'photo_timeline';",
    );
    expect(proGate).toContain(
      'const compactTabbedPhotoPaywall = compactPaywall && insideTabbedPhotoPaywall;',
    );
    expect(proGate).not.toContain('compactComplianceSpacer');
    expect(proGate).not.toContain('height: compactComplianceSpacer');
    expect(proGate).toContain(
      'paddingTop: compactTabbedPhotoPaywall ? 0 : compactPaywall ? 4 : 0,',
    );
    expect(proGate).toContain(
      'paddingBottom: compactTabbedPhotoPaywall ? 144 : compactPaywall ? 112 : 24,',
    );
    expect(proGate).toContain('{compactTabbedPhotoPaywall ? null : (');
    expect(proGate).toContain(
      "'mt-1.5 min-h-[48px] flex-row items-center gap-2 rounded-card px-3 py-1.5'",
    );
    expect(proGate).toContain('<ComplianceRow />');
    expect(flowTree).toContain(
      'including when store pricing is unavailable and the disabled-pricing reason is visible.',
    );
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
    expect(proGate).toContain("style={{ letterSpacing: 0, textAlign: 'right' }}");
    expect(upsell).toContain("style={{ letterSpacing: 0, textAlign: 'right' }}");
  });

  it('keeps contextual routine paywalls value-first for first-time free users', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const entitlement = readSource('features/subscription/entitlement.ts');

    expect(proGate).toContain('canStartContextualReverseTrial(data)');
    expect(proGate).toContain('startReverseTrial.mutate');
    expect(proGate).toContain('PAYWALL_COPY.offer.exploreTitle');
    expect(proGate).toContain('PAYWALL_COPY.offer.exploreBody');
    expect(entitlement).toContain('s.priorPeriodType === null');
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
    expect(proGate).toContain('PAYWALL_COPY.offer.cta');
    expect(proGate).toContain('{priceIntroLabel}');
    expect(proGate).toContain('{primaryCtaLabel}');
    expect(useEntitlement).toContain("fixture !== 'expired_store'");
    expect(useEntitlement).toContain("fixture !== 'expired_reverse_trial'");
    expect(useEntitlement).toContain("if (fixture === 'expired_store')");
    expect(useEntitlement).toContain("if (fixture === 'expired_reverse_trial')");
    expect(useEntitlement).toContain("const expiredAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();");
  });

  it('keeps paywall compliance links comfortably large enough for phone taps', () => {
    const source = readSource('features/subscription/ComplianceRow.tsx');

    expect(source).toContain('className="min-h-[48px] flex-row');
    expect(
      source.match(/className="min-h-\[48px\] min-w-\[48px\] items-center justify-center px-1"/g),
    ).toHaveLength(3);
    expect(source.match(/style=\{\{ minHeight: 48, minWidth: 48 \}\}/g)).toHaveLength(3);
    expect(source).not.toContain('hitSlop={8}');
  });

  it('keeps paywall compliance handoff and restore feedback visible', () => {
    const source = readSource('features/subscription/ComplianceRow.tsx');
    const entitlement = readSource('features/subscription/useEntitlement.ts');

    expect(source).toContain('const [feedback, setFeedback] = useState<string | null>(null);');
    expect(source).toContain('export function openPolicy(url: string): Promise<boolean>');
    expect(source).toContain('const opened = await openPolicy(url);');
    expect(source).toContain('if (!opened) setFeedback(POLICY_LINK_UNAVAILABLE_MESSAGE);');
    expect(source).toContain('onPress={() => void onPolicy(TERMS_URL)}');
    expect(source).toContain('onPress={() => void onPolicy(PRIVACY_URL)}');
    expect(source).toContain('function restoreFeedbackMessage(active: boolean): string');
    expect(source).toContain('setFeedback(message);');
    expect(source).toContain('accessibilityRole="alert"');
    expect(source).toContain('className="px-4 pb-2 text-center"');
    expect(entitlement).toContain("fixture !== 'expired_store'");
    expect(entitlement).toContain("fixture !== 'expired_reverse_trial'");
    expect(entitlement).toContain("periodType: 'normal'");
    expect(entitlement).toContain("managementUrl: 'https://apps.apple.com/account/subscriptions'");
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
    expect(compactPrice).toBeGreaterThan(-1);
    expect(compactReason).toBeGreaterThan(-1);
    expect(purchaseCta).toBeGreaterThan(-1);
    expect(compactPrice).toBeLessThan(purchaseCta);
    expect(compactReason).toBeLessThan(purchaseCta);
  });

  it('keeps unavailable win-back offer copy next to the fallback action', () => {
    const winback = readAppRoute('paywall/winback.tsx');

    expect(winback).toContain('useWindowDimensions');
    expect(winback).toContain('const compactPaywall = height < 640');
    expect(winback).toContain("style={{ overflow: 'hidden' }}");
    expect(winback).toContain("justifyContent: compactPaywall ? 'flex-start' : 'center'");
    expect(winback).toContain('const unavailableOfferCopy =');
    expect(winback).toContain('className="gap-2.5"');
    expect(winback).toContain('style={{ backgroundColor: BG, paddingTop: compactPaywall ? 8 : 0 }}');
    expect(winback).toContain('className="px-2 text-center"');
    expect(winback).toContain('{unavailableOfferCopy}');
    expect(winback).toContain("{canWinBack ? PAYWALL_COPY.winback.cta : 'See current Pro plan'}");
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
    expect(copy).toContain('metaRowsFor:');
    expect(copy).toContain('metaRowsForPaid:');
    expect(source).toContain('const metaRows = inTrial');
    expect(source).toContain('PAYWALL_COPY.success.metaRowsFor(endDate, price)');
    expect(source).toContain('PAYWALL_COPY.success.metaRowsForPaid(endDate, price)');
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
});
