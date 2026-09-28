import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureAppleAuthLifecycle,
  invalidateAppleAuthLifecycle,
} from './appleAuthLifecycleClient';

const mocks = vi.hoisted(() => ({
  gatedFetch: vi.fn(),
  runInvalidation: vi.fn(
    async (
      _binding: unknown,
      _appleUser: string,
      _reason: string,
      operation: () => Promise<unknown>,
    ) => operation(),
  ),
}));

vi.mock('@/lib/env', () => ({
  env: {
    supabasePublishableKey: 'sb_publishable_test',
    supabaseUrl: 'https://project.supabase.co',
  },
}));

vi.mock('@/lib/supabase/remoteRequestGate', () => ({
  createSupabaseRemoteRequestGatedFetch: () => mocks.gatedFetch,
  runWithSupabaseAppleCredentialInvalidationPermit: mocks.runInvalidation,
}));

const capture = Object.freeze({
  appleUser: 'apple-subject',
  authorizationCode: 'single-use-code',
  identityToken: 'identity-token',
  nonce: 'a'.repeat(43),
});

afterEach(() => {
  vi.clearAllMocks();
  mocks.runInvalidation.mockImplementation(async (_binding, _appleUser, _reason, operation) =>
    operation(),
  );
});

describe('Apple auth lifecycle client', () => {
  it('posts the exact capture body with the newly authenticated bearer', async () => {
    mocks.gatedFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'active',
          generation: 4,
          nextValidationAt: '2026-07-16T12:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(captureAppleAuthLifecycle('new-access-token', capture)).resolves.toEqual({
      status: 'active',
      generation: 4,
      nextValidationAt: '2026-07-16T12:00:00.000Z',
    });

    expect(mocks.gatedFetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/apple-auth-lifecycle',
      {
        method: 'POST',
        headers: {
          apikey: 'sb_publishable_test',
          Authorization: 'Bearer new-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'capture', ...capture }),
      },
    );
  });

  it.each([
    [503, { error: 'APPLE_AUTH_LIFECYCLE_UNAVAILABLE' }],
    [200, { status: 'active', generation: 0, nextValidationAt: '2026-07-16T12:00:00.000Z' }],
    [
      200,
      {
        status: 'active',
        generation: '9223372036854775808',
        nextValidationAt: '2026-07-16T12:00:00.000Z',
      },
    ],
    [200, { status: 'active', generation: 1, nextValidationAt: 'not-a-date' }],
    [
      200,
      {
        status: 'active',
        generation: 1,
        nextValidationAt: '2026-07-16T12:00:00.000Z',
        extra: true,
      },
    ],
  ])('rejects a non-authoritative lifecycle response (%s)', async (status, payload) => {
    mocks.gatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(captureAppleAuthLifecycle('new-access-token', capture)).rejects.toThrow(
      'APPLE_AUTH_LIFECYCLE_CAPTURE_FAILED',
    );
  });

  it('invalidates through one exact bound permit and accepts only blocked', async () => {
    const binding = {
      accessToken: 'live-access-token',
      sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      subject: '11111111-1111-4111-8111-111111111111',
    };
    mocks.gatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'blocked' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      invalidateAppleAuthLifecycle(binding, 'apple-subject', 'revoked'),
    ).resolves.toEqual({ status: 'blocked' });

    expect(mocks.runInvalidation).toHaveBeenCalledWith(
      binding,
      'apple-subject',
      'revoked',
      expect.any(Function),
    );
    expect(mocks.gatedFetch).toHaveBeenCalledWith(
      'https://project.supabase.co/functions/v1/apple-auth-lifecycle',
      {
        method: 'POST',
        headers: {
          apikey: 'sb_publishable_test',
          Authorization: 'Bearer live-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'credential_invalid',
          appleUser: 'apple-subject',
          reason: 'revoked',
        }),
      },
    );
  });

  it.each([
    [503, { error: 'unavailable' }],
    [200, { status: 'active' }],
    [200, { status: 'blocked', extra: true }],
  ])('rejects a non-authoritative invalidation response (%s)', async (status, payload) => {
    mocks.gatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      invalidateAppleAuthLifecycle(
        {
          accessToken: 'live-access-token',
          sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          subject: '11111111-1111-4111-8111-111111111111',
        },
        'apple-subject',
        'not_found',
      ),
    ).rejects.toThrow('APPLE_AUTH_LIFECYCLE_INVALIDATION_FAILED');
  });
});
