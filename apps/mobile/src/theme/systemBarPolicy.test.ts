import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { statusBarStyleForSurface } from './systemBarPolicy';

const mobileRoot = path.resolve(__dirname, '../..');

function readMobile(relativePath: string): string {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

describe('system bar launch policy', () => {
  it('uses deterministic contrast for paper and night surfaces', () => {
    expect(statusBarStyleForSurface('paper')).toBe('dark');
    expect(statusBarStyleForSurface('night')).toBe('light');
  });

  it('forces the launch app to light mode and keeps Android predictive back disabled', () => {
    const appBase = JSON.parse(readMobile('app.base.json')) as {
      expo: {
        userInterfaceStyle?: string;
        android?: { predictiveBackGestureEnabled?: boolean };
        plugins?: unknown[];
      };
    };

    expect(appBase.expo.userInterfaceStyle).toBe('light');
    expect(appBase.expo.android?.predictiveBackGestureEnabled).toBe(false);

    const splashPlugin = appBase.expo.plugins?.find(
      (plugin): plugin is [string, Record<string, unknown>] =>
        Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );
    expect(splashPlugin?.[1]).not.toHaveProperty('dark');
  });

  it('keeps a paper root default and gives every full night route an explicit override', () => {
    expect(readMobile('src/app/_layout.tsx')).toContain("statusBarStyleForSurface('paper')");

    const screen = readMobile('src/components/ui/Screen.tsx');
    expect(screen).toContain('statusBarStyleForSurface(tone)');

    for (const route of [
      'src/app/(tabs)/today.tsx',
      'src/app/commerce/transparency.tsx',
      'src/app/onboarding/reveal.tsx',
    ]) {
      expect(readMobile(route), route).toContain('tone="night"');
    }

    for (const route of [
      'src/app/cycle/week.tsx',
      'src/app/shelf/scan.tsx',
      'src/app/progress/capture.tsx',
      'src/app/progress/review.tsx',
      'src/app/progress/[id].tsx',
      'src/app/paywall/winback.tsx',
    ]) {
      expect(readMobile(route), route).toContain("statusBarStyleForSurface('night')");
    }

    const conflict = readMobile('src/app/conflict/[ruleId].tsx');
    expect(conflict).toContain("surfaceTone={isSafety ? 'night' : 'paper'}");
    expect(conflict).toContain('statusBarStyleForSurface(surfaceTone)');
  });
});
