import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

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
      expect(source, `${route} should not rely on exact 44px sizing that renders at 43.99px`).not.toContain(
        'h-[44px]',
      );
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
    expect(proGate).toContain('useWindowDimensions');
    expect(proGate).toContain('const compactPaywall = height < 640');
    expect(proGate).toContain("justifyContent: compactPaywall ? 'flex-start' : 'center'");
    expect(proGate).toContain('paddingBottom: compactPaywall ? 112 : 24');
    expect(proGate).toContain(
      "? 'mt-2 h-[50px] items-center justify-center rounded-pill'",
    );
    expect(proGate).not.toContain('className="pb-4"');
  });

  it('keeps paywall compliance links comfortably large enough for phone taps', () => {
    const source = readSource('features/subscription/ComplianceRow.tsx');

    expect(source).toContain('className="min-h-[48px] flex-row');
    expect(
      source.match(
        /className="min-h-\[48px\] min-w-\[48px\] items-center justify-center px-1"/g,
      ),
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
      expect(source, `${route} should render Terms, Privacy, and Restore on the paywall surface`).toContain(
        '<ComplianceRow />',
      );
    }

    const winback = readAppRoute('paywall/winback.tsx');

    expect(winback).toContain(
      "import { ComplianceRow } from '@/features/subscription/ComplianceRow';",
    );
    expect(winback, 'dark win-back paywall should render readable compliance controls').toContain(
      '<ComplianceRow tone="dark" />',
    );
  });

  it('keeps the onboarding paywall actions visible sooner on short phones', () => {
    const source = readAppRoute('onboarding/paywall.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPaywall = height < 640');
    expect(source).toContain("contentContainerClassName={compactPaywall ? 'pb-6' : 'pb-8'}");
    expect(source).toContain("className={compactPaywall ? 'mt-2.5 gap-1' : 'mt-5 gap-2.5'}");
    expect(source).toContain(
      "className={compactPaywall ? 'mt-2 h-[48px] items-center justify-center rounded-pill' : 'mt-5 h-[54px] items-center justify-center rounded-pill'}",
    );
    expect(source).toContain("compact={compactPaywall}");
    expect(source).not.toContain('contentContainerClassName="pb-8"');
  });
});
