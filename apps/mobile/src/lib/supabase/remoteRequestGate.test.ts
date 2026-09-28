import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasActiveSupabaseRemoteRequestBinding,
  requireSupabaseRemoteSessionBinding,
  rotateActiveSupabaseRemoteRequestBinding,
  runWithSupabaseAppleAuthBootstrapPermit,
  runWithSupabaseAppleCredentialInvalidationPermit,
  runWithSupabaseAccountDeletionRequestPermit,
  runWithSupabaseAuthLogoutPermit,
  runWithSupabaseAuthRefreshPermit,
  runWithSupabaseFreshAuthPermit,
  runWithSupabaseIdentityUpgradePermit,
  supabaseRemoteRequestAdmission,
  waitForSupabaseRemoteResidualSettlement,
} from './remoteRequestGate';

vi.mock('../env', () => ({
  env: {
    supabasePublishableKey: 'sb_publishable_test',
    supabaseUrl: 'https://project.supabase.co',
  },
}));

const SUBJECT = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function jwt(subject = SUBJECT, sessionId = SESSION_ID, suffix = 'signature'): string {
  const payload = Buffer.from(JSON.stringify({ session_id: sessionId, sub: subject })).toString(
    'base64url',
  );
  return `e30.${payload}.${suffix}`;
}

const BINDING = Object.freeze({
  accessToken: jwt(),
  sessionId: SESSION_ID,
  subject: SUBJECT,
});
const APPLE_BOOTSTRAP = Object.freeze({
  appleUser: 'apple-subject',
  authorizationCode: 'single-use-code',
  identityToken: 'identity-token',
  nonce: 'a'.repeat(43),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('process-wide Supabase remote request gate wrappers', () => {
  it('derives only an exact subject/session binding', () => {
    expect(requireSupabaseRemoteSessionBinding(BINDING.accessToken, SUBJECT)).toEqual(BINDING);
    expect(() =>
      requireSupabaseRemoteSessionBinding(
        BINDING.accessToken,
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toThrow('SUPABASE_REMOTE_REQUEST_BINDING_REJECTED');
  });

  it('forwards exact refresh credentials and bounded semantic timeouts', async () => {
    const runWithPermit = vi
      .spyOn(supabaseRemoteRequestAdmission, 'runWithPermit')
      .mockResolvedValue('completed');
    const operation = vi.fn(async () => 'completed');

    await expect(
      runWithSupabaseAuthRefreshPermit(BINDING, 'opaque-refresh-token', operation, 30_000),
    ).resolves.toBe('completed');

    expect(runWithPermit).toHaveBeenCalledWith(
      {
        purpose: 'auth_refresh',
        binding: BINDING,
        refreshToken: 'opaque-refresh-token',
        timeoutMs: 30_000,
      },
      operation,
    );
  });

  it('forwards fresh, identity-upgrade, and logout purposes without widening them', async () => {
    const runWithPermit = vi
      .spyOn(supabaseRemoteRequestAdmission, 'runWithPermit')
      .mockResolvedValue(undefined);
    const operation = vi.fn(async () => undefined);

    await runWithSupabaseFreshAuthPermit(operation, 30_000);
    await runWithSupabaseIdentityUpgradePermit(BINDING, operation, 30_000);
    await runWithSupabaseAuthLogoutPermit(BINDING, operation, 5_000);

    expect(runWithPermit.mock.calls.map(([permit]) => permit)).toEqual([
      { purpose: 'auth_fresh_sign_in', timeoutMs: 30_000 },
      { purpose: 'auth_identity_upgrade', binding: BINDING, timeoutMs: 30_000 },
      { purpose: 'auth_logout', binding: BINDING, timeoutMs: 5_000 },
    ]);
  });

  it('forwards a narrowly scoped Apple bootstrap with optional same-user binding', async () => {
    const runWithPermit = vi
      .spyOn(supabaseRemoteRequestAdmission, 'runWithPermit')
      .mockResolvedValue(undefined);
    const operation = vi.fn(async () => undefined);

    await runWithSupabaseAppleAuthBootstrapPermit(APPLE_BOOTSTRAP, undefined, operation, 45_000);
    await runWithSupabaseAppleAuthBootstrapPermit(APPLE_BOOTSTRAP, BINDING, operation, 45_000);

    expect(runWithPermit.mock.calls.map(([permit]) => permit)).toEqual([
      {
        purpose: 'apple_auth_bootstrap',
        credentials: APPLE_BOOTSTRAP,
        timeoutMs: 45_000,
      },
      {
        purpose: 'apple_auth_bootstrap',
        credentials: APPLE_BOOTSTRAP,
        binding: BINDING,
        timeoutMs: 45_000,
      },
    ]);
  });

  it('forwards an exact bound Apple credential invalidation', async () => {
    const runWithPermit = vi
      .spyOn(supabaseRemoteRequestAdmission, 'runWithPermit')
      .mockResolvedValue(undefined);
    const operation = vi.fn(async () => undefined);

    await runWithSupabaseAppleCredentialInvalidationPermit(
      BINDING,
      'apple-subject',
      'revoked',
      operation,
      15_000,
    );

    expect(runWithPermit).toHaveBeenCalledWith(
      {
        purpose: 'apple_credential_invalid',
        binding: BINDING,
        appleUser: 'apple-subject',
        reason: 'revoked',
        timeoutMs: 15_000,
      },
      operation,
    );
  });

  it('keeps deletion status bearerless and begin exactly bound', async () => {
    const runWithPermit = vi
      .spyOn(supabaseRemoteRequestAdmission, 'runWithPermit')
      .mockResolvedValue('sentinel');
    const transport = vi.fn();
    const operation = vi.fn();

    await runWithSupabaseAccountDeletionRequestPermit(
      { action: 'status', timeoutMs: 15_000 },
      transport,
      operation,
    );
    await runWithSupabaseAccountDeletionRequestPermit(
      { action: 'begin', binding: BINDING, timeoutMs: 15_000 },
      transport,
      operation,
    );

    expect(runWithPermit.mock.calls.map(([permit]) => permit)).toEqual([
      { purpose: 'account_deletion', action: 'status', timeoutMs: 15_000 },
      {
        purpose: 'account_deletion',
        action: 'begin',
        binding: BINDING,
        timeoutMs: 15_000,
      },
    ]);
  });

  it('requires the previous exact binding for rotation and exposes true residual settlement', async () => {
    const nextToken = jwt(SUBJECT, SESSION_ID, 'next-signature');
    const rotate = vi
      .spyOn(supabaseRemoteRequestAdmission, 'rotateActiveBinding')
      .mockResolvedValue({ ...BINDING, accessToken: nextToken });
    const wait = vi
      .spyOn(supabaseRemoteRequestAdmission, 'waitForResidualSettlement')
      .mockResolvedValue(undefined);

    await expect(
      rotateActiveSupabaseRemoteRequestBinding(BINDING, nextToken, SUBJECT),
    ).resolves.toMatchObject({ accessToken: nextToken });
    await waitForSupabaseRemoteResidualSettlement();

    expect(rotate).toHaveBeenCalledWith(BINDING, nextToken, SUBJECT);
    expect(wait).toHaveBeenCalledOnce();
  });

  it('exposes only the boolean exact-active binding check', () => {
    const hasActive = vi
      .spyOn(supabaseRemoteRequestAdmission, 'hasActiveBinding')
      .mockReturnValue(true);

    expect(hasActiveSupabaseRemoteRequestBinding(BINDING.accessToken, SUBJECT)).toBe(true);
    expect(hasActive).toHaveBeenCalledWith(BINDING.accessToken, SUBJECT);
  });
});
