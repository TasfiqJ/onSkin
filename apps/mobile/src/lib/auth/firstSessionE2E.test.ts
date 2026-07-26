import { afterEach, describe, expect, it } from 'vitest';

import {
  clearPublishedFirstSessionE2ESession,
  getFirstSessionE2EFixture,
  getPublishedFirstSessionE2ESession,
  publishFirstSessionE2ESession,
} from './firstSessionE2E';

afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E_FIRST_SESSION_AUTH;
  clearPublishedFirstSessionE2ESession();
});

describe('first-session E2E auth fixture', () => {
  it('provides a stable anonymous session only for the exact unconfigured development mode', () => {
    const fixture = getFirstSessionE2EFixture({
      appEnvironment: 'development',
      isDev: true,
      mode: 'anonymous_owner',
      supabaseConfigured: false,
    });

    expect(fixture).toMatchObject({
      mode: 'anonymous_owner',
      session: {
        user: {
          id: 'local-device-unclaimed',
          is_anonymous: true,
        },
      },
    });
  });

  it.each([
    {
      appEnvironment: 'development' as const,
      isDev: false,
      mode: 'anonymous_owner',
      supabaseConfigured: false,
    },
    {
      appEnvironment: 'staging' as const,
      isDev: true,
      mode: 'anonymous_owner',
      supabaseConfigured: false,
    },
    {
      appEnvironment: 'production' as const,
      isDev: true,
      mode: 'anonymous_owner',
      supabaseConfigured: false,
    },
    {
      appEnvironment: 'development' as const,
      isDev: true,
      mode: 'anonymous_owner',
      supabaseConfigured: true,
    },
    {
      appEnvironment: 'development' as const,
      isDev: true,
      mode: 'unknown',
      supabaseConfigured: false,
    },
  ])('stays disabled outside its complete safety boundary: %o', (options) => {
    expect(getFirstSessionE2EFixture(options)).toBeNull();
  });

  it('does not activate when its explicit environment switch is absent', () => {
    expect(
      getFirstSessionE2EFixture({
        appEnvironment: 'development',
        isDev: true,
        supabaseConfigured: false,
      }),
    ).toBeNull();
  });

  it('retains only an explicitly published exact fixture in process memory', () => {
    const fixture = getFirstSessionE2EFixture({
      appEnvironment: 'development',
      isDev: true,
      mode: 'anonymous_owner',
      supabaseConfigured: false,
    });
    expect(fixture).not.toBeNull();
    expect(getPublishedFirstSessionE2ESession(fixture)).toBeNull();

    publishFirstSessionE2ESession(fixture!);
    expect(getPublishedFirstSessionE2ESession(fixture)).toBe(fixture!.session);

    clearPublishedFirstSessionE2ESession();
    expect(getPublishedFirstSessionE2ESession(fixture)).toBeNull();
  });
});
