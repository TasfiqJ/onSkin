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
    pattern: /(network|offline|timeout|timed out|fetch failed)/i,
    message: 'Connection problem. Check your network and try again.',
  },
  {
    pattern: /(cancel|canceled|cancelled)/i,
    message: 'Sign-in was canceled.',
  },
];

function rawMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : '';
}

export function authUserMessage(error: unknown): string {
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
