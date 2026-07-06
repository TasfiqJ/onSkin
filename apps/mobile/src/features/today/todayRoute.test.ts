import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../app/', import.meta.url));

function readAppRoute(path: string): string {
  return readFileSync(`${APP_DIR}/${path}`, 'utf8');
}

describe('Today route mobile contracts', () => {
  it('keeps the streak and adherence pill comfortably tappable on phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain('accessibilityLabel="View your streak and adherence"');
    expect(source).toContain("router.push('/routine/streak')");
    expect(source).toContain('function streakLabel(days: number): string');
    expect(source).toContain("days === 1 ? 'day' : 'days'");
    expect(source).toContain('{streakLabel(progress.streak)}');
    expect(source).not.toContain('{progress.streak} days');
    expect(source).toContain('min-h-[48px]');
    expect(source).not.toContain('min-h-[44px]');
    expect(source).toContain('px-4 py-2.5');
    expect(source).not.toContain('px-3.5 py-1.5');
  });

  it('keeps Today prompt actions clear of the floating tab bar on short phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain('useWindowDimensions');
    expect(source).toContain('const compactPhone = height < 700');
    expect(source).toContain('const compactRecommendationPrompt = height < 860');
    expect(source).toContain("contentContainerClassName={compactPhone ? 'pb-28' : 'pb-6'}");
    expect(source).toContain('<ReverseTrialBanner compact={compactPhone} />');
    expect(source).toContain('<ReverseTrialBanner compact={compactPhone} tone="night" />');
    expect(source).toContain("className={compactPhone ? 'mt-3' : 'mt-4'}");
    expect(source).toContain("compactPhone\n                ? 'mt-4 rounded-card bg-paper-raised'");
    expect(source).toContain(": 'mt-6 rounded-card bg-paper-raised'");
    expect(source).toContain('paddingTop: compactPhone ? 18 : 22');
    expect(source).toContain('paddingBottom: compactPhone ? 8 : 12');
    expect(source).toContain('function compactRoutineInstruction(instruction: string): string');
    expect(source).toContain("case 'Vitamin C in the morning, under your SPF.':");
    expect(source).toContain("return 'Under your SPF.';");
    expect(source).toContain(
      'const displaySub = sub && compact ? compactRoutineInstruction(sub) : sub;',
    );
    expect(source).toContain('{displaySub}');
    expect(source).toContain('compact?: boolean;');
    expect(source).toContain(
      "className={cn('flex-row items-center', compact ? 'gap-3 py-2.5' : 'gap-3.5 py-3')}",
    );
    expect(source).toContain('numberOfLines={compact ? 1 : undefined}');
    expect(source).toContain('lineHeight: compact ? 16 : undefined');
    expect(source.match(/<CheckRow[\s\S]*?compact=\{compactPhone\}/g)).toHaveLength(2);
    expect(source).toContain(
      '<RecommendationsTeaser compact={compactRecommendationPrompt} showGapPrompt />',
    );
    expect(source).not.toContain('<RecommendationsTeaser compact={compactPhone} showGapPrompt />');
    expect(source).toContain('phase7Flags.cloudAsk && !compactPhone');
    expect(source).toContain('{compactPhone ? null : (');
  });

  it('keeps PM cycle strip labels legible on compact phones', () => {
    const source = readAppRoute('(tabs)/today.tsx');

    expect(source).toContain('FALLBACK_SLOTS');
    expect(source).toContain('slotLabel(n.slot)');
    expect(source).toContain('adjustsFontSizeToFit');
    expect(source).toContain('maxFontSizeMultiplier={1.12}');
    expect(source).toContain('minimumFontScale={0.85}');
    expect(source).toContain('<View className="flex-row gap-1">');
    expect(source).toContain('fontSize: 12');
    expect(source).toContain('lineHeight: 15');
    expect(source).toContain('marginTop: 8');
    expect(source).toContain("textAlign: 'center'");
    expect(source).not.toContain('className="mt-2 text-center text-[10.5px]"');
  });
});
