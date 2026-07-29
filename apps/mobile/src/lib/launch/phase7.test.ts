import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_FINAL_BRAND_DOMAIN',
  'EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED',
  'EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED',
  'EXPO_PUBLIC_PHASE7_TREND_ENABLED',
  'EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED',
  'EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED',
  'EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED',
  'EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED',
  'EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED',
  'EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED',
  'EXPO_PUBLIC_E2E_REVIEWED_CONFLICT_SHARING',
  'EXPO_PUBLIC_E2E_TREND_ENABLED',
  'EXPO_PUBLIC_E2E_TREND_CONSENTED',
  'EXPO_PUBLIC_E2E_TREND_INSIGHT',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  EnvKey,
  string | undefined
>;
const ORIGINAL_DEV = (globalThis as { __DEV__?: boolean }).__DEV__;
const PHASE7_SOURCE_PATH = fileURLToPath(new URL('./phase7.ts', import.meta.url));

function setEnv(name: EnvKey, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function loadPhase7With(
  overrides: Partial<Record<EnvKey, string>>,
  { dev = false }: { dev?: boolean } = {},
) {
  vi.resetModules();
  for (const key of ENV_KEYS) setEnv(key, undefined);
  for (const [key, value] of Object.entries(overrides) as [EnvKey, string | undefined][]) {
    setEnv(key, value);
  }
  (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  return import('./phase7');
}

function enableAllPhase7Flags(): Partial<Record<EnvKey, string>> {
  return {
    EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_TREND_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED: 'true',
    EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED: 'true',
    EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED: 'true',
    EXPO_PUBLIC_E2E_TREND_ENABLED: 'true',
    EXPO_PUBLIC_E2E_TREND_CONSENTED: 'true',
    EXPO_PUBLIC_E2E_TREND_INSIGHT: 'change_observed',
  };
}

afterEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) setEnv(key, ORIGINAL_ENV[key]);
  if (ORIGINAL_DEV === undefined) delete (globalThis as { __DEV__?: boolean }).__DEV__;
  else (globalThis as { __DEV__?: boolean }).__DEV__ = ORIGINAL_DEV;
});

describe('Phase 7 launch flags', () => {
  it('keeps production Phase 7 surfaces disabled without a final brand domain', async () => {
    const { phase7Flags } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: '',
      ...enableAllPhase7Flags(),
    });

    expect(phase7Flags.finalDomainReady).toBe(false);
    expect(phase7Flags.productionSurfaceReady).toBe(false);
    expect(phase7Flags.commerce).toBe(false);
    expect(phase7Flags.communityPosting).toBe(false);
    expect(phase7Flags.communityAggregates).toBe(false);
    expect(phase7Flags.trend).toBe(false);
    expect(phase7Flags.cloudAsk).toBe(false);
    expect(phase7Flags.widgets).toBe(false);
    expect(phase7Flags.shareCard).toBe(false);
    expect(phase7Flags.goalActiveRecommendations).toBe(false);
  });

  it('treats example domains as not ready in production', async () => {
    const { phase7Flags } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://example.com',
      ...enableAllPhase7Flags(),
    });

    expect(phase7Flags.finalDomainReady).toBe(false);
    expect(phase7Flags.productionSurfaceReady).toBe(false);
    expect(phase7Flags.cloudAsk).toBe(false);
  });

  it('rejects reserved or malformed final domains in production', async () => {
    const invalidDomains = [
      'https://routinekind.localhost',
      'https://user:pass@routinekind.app',
      'routinekind.app?redirect=https://evil.example',
      'routinekind',
      'http://127.0.0.1',
    ];

    for (const domain of invalidDomains) {
      const { phase7Flags } = await loadPhase7With({
        EXPO_PUBLIC_APP_ENV: 'production',
        EXPO_PUBLIC_FINAL_BRAND_DOMAIN: domain,
        ...enableAllPhase7Flags(),
      });

      expect(phase7Flags.finalDomainReady).toBe(false);
      expect(phase7Flags.productionSurfaceReady).toBe(false);
      expect(phase7Flags.shareCard).toBe(false);
    }
  });

  it('keeps unimplemented capabilities closed even when staging flags are enabled', async () => {
    const { phase7Capabilities, phase7Flags } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: '',
      ...enableAllPhase7Flags(),
    });

    expect(phase7Flags.productionSurfaceReady).toBe(true);
    expect(Object.isFrozen(phase7Capabilities)).toBe(true);
    expect(phase7Capabilities).toEqual({
      commerce: false,
      communityQuestionSubmission: false,
      communityAggregates: false,
      trendEngine: false,
      nativeWidgets: false,
      conflictSharePublication: false,
    });
    expect(phase7Flags.communityPosting).toBe(false);
    expect(phase7Flags.communityAggregates).toBe(false);
    expect(phase7Flags.trend).toBe(false);
    expect(phase7Flags.cloudAsk).toBe(true);
    expect(phase7Flags.widgets).toBe(false);
    expect(phase7Flags.goalActiveRecommendations).toBe(true);
    expect(phase7Flags.commerce).toBe(false);
    expect(phase7Flags.shareCard).toBe(false);
  });

  it('enables implemented production surfaces only when public identity is ready', async () => {
    const { phase7Flags } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
      ...enableAllPhase7Flags(),
    });

    expect(phase7Flags.finalDomainReady).toBe(true);
    expect(phase7Flags.productionSurfaceReady).toBe(true);
    expect(phase7Flags.commerce).toBe(false);
    expect(phase7Flags.communityPosting).toBe(false);
    expect(phase7Flags.communityAggregates).toBe(false);
    expect(phase7Flags.trend).toBe(false);
    expect(phase7Flags.cloudAsk).toBe(true);
    expect(phase7Flags.widgets).toBe(false);
    expect(phase7Flags.shareCard).toBe(false);
    expect(phase7Flags.goalActiveRecommendations).toBe(true);
  });

  it('keeps Trend issuerless under env, dev, E2E, public-domain, and mutation attempts', async () => {
    const { phase7Capabilities, phase7Flags, isPhase7SurfaceEnabled } = await loadPhase7With(
      {
        EXPO_PUBLIC_APP_ENV: 'development',
        EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
        ...enableAllPhase7Flags(),
      },
      { dev: true },
    );

    expect(phase7Capabilities.trendEngine).toBe(false);
    expect(phase7Flags.trend).toBe(false);
    expect(isPhase7SurfaceEnabled('trend')).toBe(false);
    expect(Object.isFrozen(phase7Capabilities)).toBe(true);
    expect(Object.isFrozen(phase7Flags)).toBe(true);
    expect(Reflect.set(phase7Flags as object, 'trend', true)).toBe(false);
    expect(phase7Flags.trend).toBe(false);

    const source = readFileSync(PHASE7_SOURCE_PATH, 'utf8');
    expect(source).toMatch(/trendEngine:\s*false/);
    expect(source).toMatch(/\btrend:\s*false/);
    expect(source).not.toContain('trend: phase7Capabilities.trendEngine && env.phase7TrendEnabled');
  });

  it('keeps commerce issuerless under env, dev, public-domain, and mutation attempts', async () => {
    const { phase7Capabilities, phase7Flags, isPhase7SurfaceEnabled } = await loadPhase7With(
      {
        EXPO_PUBLIC_APP_ENV: 'development',
        EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
        ...enableAllPhase7Flags(),
      },
      { dev: true },
    );

    expect(phase7Capabilities.commerce).toBe(false);
    expect(phase7Flags.commerce).toBe(false);
    expect(isPhase7SurfaceEnabled('commerce')).toBe(false);
    expect(Object.isFrozen(phase7Capabilities)).toBe(true);
    expect(Object.isFrozen(phase7Flags)).toBe(true);
    expect(Reflect.set(phase7Flags as object, 'commerce', true)).toBe(false);
    expect(phase7Flags.commerce).toBe(false);

    const source = readFileSync(PHASE7_SOURCE_PATH, 'utf8');
    expect(source).toMatch(/\bcommerce:\s*false/);
    expect(source).not.toContain('commerce: env.phase7CommerceEnabled');
  });
});

describe('Phase 7 share-card eligibility', () => {
  it('rejects every conflict even when all flags and public identity look ready', async () => {
    const { canShareConflictCard } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
      ...enableAllPhase7Flags(),
    });

    expect(
      canShareConflictCard({
        rule: {
          id: 'forged-rule',
          interactionType: 'routine',
          reviewedBy: 'clinical-reviewer',
        },
        productAId: 'product-a',
        productBId: 'product-b',
        productAName: 'Product A',
        productBName: 'Product B',
        sharePublicationReceipt: { decision: 'admitted' },
      }),
    ).toBe(false);
  });

  it('does not let a development fixture grant share authority', async () => {
    const flags = {
      EXPO_PUBLIC_APP_ENV: 'development',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
      ...enableAllPhase7Flags(),
      EXPO_PUBLIC_E2E_REVIEWED_CONFLICT_SHARING: 'true',
    };
    const validLookingConflict = {
      rule: { reviewedBy: 'reviewer', interactionType: 'routine' },
      productAId: 'product-a',
      productBId: 'product-b',
    };

    const devModule = await loadPhase7With(flags, { dev: true });
    expect(devModule.phase7Flags.shareCard).toBe(false);
    expect(devModule.canShareConflictCard(validLookingConflict)).toBe(false);

    const productionModule = await loadPhase7With(flags, { dev: false });
    expect(productionModule.phase7Flags.shareCard).toBe(false);
    expect(productionModule.canShareConflictCard(validLookingConflict)).toBe(false);
  });
});
