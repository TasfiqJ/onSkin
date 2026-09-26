import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { authUserMessage } from '@/lib/errors/userFacing';

const CONFIG = fileURLToPath(new URL('../../../../../supabase/config.toml', import.meta.url));
const TEMPLATE = fileURLToPath(
  new URL('../../../../../supabase/templates/email_change.html', import.meta.url),
);
const ACCOUNT_ROUTE = fileURLToPath(
  new URL('../../app/onboarding/account.tsx', import.meta.url),
);

describe('AUTH-02 email-change source contract', () => {
  it('pins a manual OTP template and the anonymous-compatible confirmation mode', () => {
    const config = readFileSync(CONFIG, 'utf8');
    const template = readFileSync(TEMPLATE, 'utf8');

    expect(config).toContain('double_confirm_changes = true');
    expect(config).toContain('otp_length = 6');
    expect(config).toContain('otp_expiry = 3600');
    expect(config).toContain('[auth.email.template.email_change]');
    expect(config).toContain('content_path = "./supabase/templates/email_change.html"');
    expect(template).toContain('{{ .Token }}');
    expect(template).toContain('expires in 60 minutes');
    expect(template).not.toContain('{{ .ConfirmationURL }}');
    expect(template).not.toMatch(/<a\b/iu);
    expect(template).not.toMatch(/<img\b/iu);
  });

  it('starts local expiry at dispatch and exposes failures as an alert', () => {
    const source = readFileSync(ACCOUNT_ROUTE, 'utf8');

    expect(source).toContain('const requestStartedAtMs = Date.now();');
    expect(source).toContain('startEmailCodeChallenge(requestStartedAtMs)');
    expect(source).toContain('accessibilityRole="alert"');
  });

  it.each([
    ['otp_expired', 'That code did not work. Request a new code and try again.'],
    ['over_email_send_rate_limit', 'Too many attempts. Wait a moment, then try again.'],
    ['over_request_rate_limit', 'Too many attempts. Wait a moment, then try again.'],
    [
      'email_exists',
      "We couldn't attach that email without changing your current plan. Use another method or continue without an account.",
    ],
    ['email_address_invalid', 'Enter a valid email address and try again.'],
  ])('maps provider code %s without exposing its raw message', (code, expected) => {
    expect(authUserMessage({ code, message: 'sensitive provider detail' })).toBe(expected);
  });

  it('maps the native fetch error wording to offline recovery copy', () => {
    expect(authUserMessage(new Error('TypeError: Failed to fetch'))).toBe(
      'Connection problem. Check your network and try again.',
    );
  });

  it('fails safely on an unclassified provider 429', () => {
    expect(authUserMessage({ status: 429, message: 'provider quota detail' })).toBe(
      'Too many attempts. Wait a moment, then try again.',
    );
  });
});
