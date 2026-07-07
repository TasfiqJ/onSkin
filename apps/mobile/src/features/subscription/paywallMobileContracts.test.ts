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
      expect(source, `${route} should keep bottom actions outside the scroll body`).toContain(
        'className="gap-',
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
    expect(upsell).toContain('<Sheet scroll backdropAccessible={false}');
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

    expect(proGate).toContain("import { router, usePathname } from 'expo-router';");
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

  it('keeps contextual routine paywalls value-first for first-time free users', () => {
    const proGate = readSource('features/subscription/ProGate.tsx');
    const entitlement = readSource('features/subscription/entitlement.ts');

    expect(proGate).toContain('canStartContextualReverseTrial(data)');
    expect(proGate).toContain('startReverseTrial.mutate');
    expect(proGate).toContain('PAYWALL_COPY.offer.exploreTitle');
    expect(proGate).toContain('PAYWALL_COPY.offer.exploreBody');
    expect(entitlement).toContain('s.priorPeriodType === null');
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
      expect(
        source,
        `${route} should explain why the purchase action is disabled`,
      ).toContain('{offering.data.reason}');
    }
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
    expect(source).not.toContain('{meta}');
    expect(source).not.toContain(`>${String.fromCharCode(0x2713)}</Text>`);
    expect(source).not.toContain(`>${String.fromCharCode(0x00e2, 0x0153, 0x201c)}</Text>`);
  });
});
