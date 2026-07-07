import type { DetectedConflict } from '@/features/intelligence/engine';
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
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  EnvKey,
  string | undefined
>;
const ORIGINAL_DEV = (globalThis as { __DEV__?: boolean }).__DEV__;

function setEnv(name: EnvKey, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function loadPhase7With(overrides: Partial<Record<EnvKey, string>>) {
  vi.resetModules();
  for (const key of ENV_KEYS) setEnv(key, undefined);
  for (const [key, value] of Object.entries(overrides) as [EnvKey, string | undefined][]) {
    setEnv(key, value);
  }
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
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
  };
}

function reviewedConflict(overrides: Partial<DetectedConflict> = {}): DetectedConflict {
  return {
    rule: {
      tagA: 'retinoid',
      tagB: 'aha',
      interactionType: 'routine',
      reviewedBy: 'clinical-reviewer',
    },
    productAId: 'product-a',
    productBId: 'product-b',
    productAName: 'Product A',
    productBName: 'Product B',
    ...overrides,
  } as DetectedConflict;
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

  it('allows staging to exercise deferred surfaces without a final domain', async () => {
    const { phase7Flags } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'staging',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: '',
      ...enableAllPhase7Flags(),
    });

    expect(phase7Flags.productionSurfaceReady).toBe(true);
    expect(phase7Flags.communityPosting).toBe(true);
    expect(phase7Flags.trend).toBe(true);
    expect(phase7Flags.cloudAsk).toBe(true);
    expect(phase7Flags.widgets).toBe(true);
    expect(phase7Flags.goalActiveRecommendations).toBe(true);
    expect(phase7Flags.commerce).toBe(false);
    expect(phase7Flags.shareCard).toBe(false);
  });

  it('enables production surfaces only when public identity is ready', async () => {
    const { phase7Flags } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
      ...enableAllPhase7Flags(),
    });

    expect(phase7Flags.finalDomainReady).toBe(true);
    expect(phase7Flags.productionSurfaceReady).toBe(true);
    expect(phase7Flags.commerce).toBe(true);
    expect(phase7Flags.communityPosting).toBe(true);
    expect(phase7Flags.trend).toBe(true);
    expect(phase7Flags.cloudAsk).toBe(true);
    expect(phase7Flags.widgets).toBe(true);
    expect(phase7Flags.shareCard).toBe(true);
    expect(phase7Flags.goalActiveRecommendations).toBe(true);
  });
});

describe('Phase 7 share-card eligibility', () => {
  it('requires reviewed, non-safety, non-pregnancy owned-product conflicts', async () => {
    const { canShareConflictCard } = await loadPhase7With({
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: 'https://routinekind.app',
      ...enableAllPhase7Flags(),
    });

    expect(canShareConflictCard(reviewedConflict())).toBe(true);
    expect(
      canShareConflictCard(
        reviewedConflict({ rule: { ...reviewedConflict().rule, reviewedBy: null } }),
      ),
    ).toBe(false);
    expect(
      canShareConflictCard(
        reviewedConflict({ rule: { ...reviewedConflict().rule, reviewedBy: '   ' } }),
      ),
    ).toBe(false);
    expect(
      canShareConflictCard(
        reviewedConflict({ rule: { ...reviewedConflict().rule, interactionType: 'safety' } }),
      ),
    ).toBe(false);
    expect(
      canShareConflictCard(
        reviewedConflict({ rule: { ...reviewedConflict().rule, tagA: 'pregnancy' } }),
      ),
    ).toBe(false);
    expect(canShareConflictCard(reviewedConflict({ productAId: null }))).toBe(false);
  });
});
