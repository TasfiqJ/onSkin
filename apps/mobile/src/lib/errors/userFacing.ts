const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
export const AUTH_UNAVAILABLE_MESSAGE =
  'Account sign-in is not available right now. You can continue without an account.';

type KnownErrorPattern = {
  pattern: RegExp;
  message: string;
};

const AUTH_PATTERNS: readonly KnownErrorPattern[] = [
  {
    pattern: /account sign-in is not available/i,
    message: AUTH_UNAVAILABLE_MESSAGE,
  },
  {
    pattern: /(otp|code|token).*(invalid|expired)|invalid.*(otp|code|token)/i,
    message: 'That code did not work. Request a new code and try again.',
  },
  {
    pattern: /(rate limit|too many|over.*limit|send rate)/i,
    message: 'Too many attempts. Wait a moment, then try again.',
  },
  {
    pattern: /(network|offline|timeout|timed out|fetch failed|failed to fetch)/i,
    message: 'Connection problem. Check your network and try again.',
  },
  {
    pattern: /(cancel|canceled|cancelled)/i,
    message: 'Sign-in was canceled.',
  },
  {
    pattern: /identity.*already.*(linked|exists)|already.*(linked|registered).*identity/i,
    message:
      'That sign-in is already connected to another account. Use another method or continue without an account.',
  },
  {
    pattern: /email.*already.*(registered|exists)|already been registered/i,
    message:
      "We couldn't attach that email without changing your current plan. Use another method or continue without an account.",
  },
  {
    pattern: /request a new email code|email code.*no longer valid/i,
    message: 'Request a new code and try again.',
  },
];

function rawMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : '';
}

function authErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return typeof error.code === 'string' ? error.code : '';
}

function authErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

export function authUserMessage(error: unknown): string {
  // Supabase documents `code` as the stable AuthApiError discriminator. Keep
  // message matching only as a compatibility fallback for network/client errors.
  switch (authErrorCode(error)) {
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'That code did not work. Request a new code and try again.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts. Wait a moment, then try again.';
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return "We couldn't attach that email without changing your current plan. Use another method or continue without an account.";
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Enter a valid email address and try again.';
  }
  if (authErrorStatus(error) === 429) {
    return 'Too many attempts. Wait a moment, then try again.';
  }
  const message = rawMessage(error);
  const known = AUTH_PATTERNS.find((entry) => entry.pattern.test(message));
  return known?.message ?? GENERIC_MESSAGE;
}

export function dataRightsUserMessage(): string {
  return 'We could not complete that privacy request. Please try again.';
}

export function appLockUserMessage(): string {
  return 'App lock is not available on this device right now.';
}

export function privacyChoiceUserMessage(): string {
  return "We couldn't save that choice. Please try again.";
}

export function shareCardUserMessage(): string {
  return "We couldn't create the card. Please try again.";
}
