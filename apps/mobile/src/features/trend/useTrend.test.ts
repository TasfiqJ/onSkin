import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AccountGenerationLease } from '@/lib/auth/accountGeneration';

import { TrendInsight, TrendInsightFromSource } from './TrendInsight';
import {
  readMonkBandWithLease,
  useMonkBand,
  useTrendConsent,
  useTrendInsight,
  useTrendInsightFromPhotos,
} from './useTrend';

const FEATURE_DIR = fileURLToPath(new URL('./', import.meta.url));
const TREND_BYPASS_ENV_KEYS = [
  'EXPO_PUBLIC_PHASE7_TREND_ENABLED',
  'EXPO_PUBLIC_E2E_TREND_ENABLED',
  'EXPO_PUBLIC_E2E_TREND_CONSENTED',
  'EXPO_PUBLIC_E2E_TREND_INSIGHT',
] as const;
const ORIGINAL_ENV = Object.fromEntries(
  TREND_BYPASS_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof TREND_BYPASS_ENV_KEYS)[number], string | undefined>;
const ORIGINAL_DEV = (globalThis as { __DEV__?: boolean }).__DEV__;

afterEach(() => {
  for (const key of TREND_BYPASS_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  if (ORIGINAL_DEV === undefined) delete (globalThis as { __DEV__?: boolean }).__DEV__;
  else (globalThis as { __DEV__?: boolean }).__DEV__ = ORIGINAL_DEV;
});

describe('PHOTO-05A zero-admission trend hooks', () => {
  it('returns one frozen unavailable result despite env, dev, E2E, and caller enable inputs', () => {
    for (const key of TREND_BYPASS_ENV_KEYS) process.env[key] = 'true';
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    const consent = useTrendConsent({ enabled: true });
    const monk = useMonkBand({ enabled: true });
    const insight = useTrendInsight();

    expect(consent).toEqual({
      data: false,
      isError: false,
      isLoading: false,
      isSuccess: true,
      status: 'success',
    });
    expect(monk).toEqual({
      data: null,
      isError: false,
      isLoading: false,
      isSuccess: true,
      status: 'success',
    });
    expect(insight).toEqual({ consented: false, insight: null, isLoading: false });
    expect(Object.isFrozen(consent)).toBe(true);
    expect(Object.isFrozen(monk)).toBe(true);
    expect(Object.isFrozen(insight)).toBe(true);
  });

  it('does not inspect legacy photo history or forged consent/insight caller sources', () => {
    const onPrivateRead = vi.fn();
    const privatePhotoSource = Object.defineProperties(
      {},
      {
        data: { get: onPrivateRead },
        isLoading: { get: onPrivateRead },
        isSuccess: { get: onPrivateRead },
      },
    );
    const forgedPresentationSource = Object.defineProperties(
      {},
      {
        consented: { get: onPrivateRead },
        insight: { get: onPrivateRead },
      },
    );

    expect(useTrendInsightFromPhotos(privatePhotoSource, { enabled: true })).toEqual({
      consented: false,
      insight: null,
      isLoading: false,
    });
    expect(TrendInsightFromSource({ source: forgedPresentationSource })).toBeNull();
    expect(TrendInsight()).toBeNull();
    expect(onPrivateRead).not.toHaveBeenCalled();
  });

  it('keeps the reserved Monk read local and null without profile transport', async () => {
    const assertCurrent = vi.fn();
    const lease = { assertCurrent } as unknown as AccountGenerationLease;

    await expect(readMonkBandWithLease(lease)).resolves.toBeNull();
    expect(assertCurrent).toHaveBeenCalledOnce();
  });

  it('contains no query, photo, consent, classifier, narrative, env, or analytics producer', () => {
    const hookSource = readFileSync(`${FEATURE_DIR}/useTrend.ts`, 'utf8');
    const componentSource = readFileSync(`${FEATURE_DIR}/TrendInsight.tsx`, 'utf8');

    for (const forbidden of [
      'useQuery',
      'usePhotos',
      'useOwnerQueryScope',
      'supabase',
      'isTrendInsightsConsented',
      'classifyChange',
      'trendNarrative',
      'process.env',
      '__DEV__',
      "track('",
    ]) {
      expect(hookSource).not.toContain(forbidden);
    }
    expect(componentSource).not.toContain("track('");
    expect(componentSource).not.toContain('source.consented');
    expect(componentSource).not.toContain('source.insight');
  });
});
