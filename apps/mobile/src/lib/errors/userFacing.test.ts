import { describe, expect, it } from 'vitest';

import {
  AUTH_UNAVAILABLE_MESSAGE,
  appLockUserMessage,
  authUserMessage,
  dataRightsUserMessage,
  shareCardUserMessage,
} from './userFacing';

describe('user-facing error copy', () => {
  it('maps common auth failures to stable copy', () => {
    expect(authUserMessage(new Error('Token has expired or is invalid'))).toBe(
      'That code did not work. Request a new code and try again.',
    );
    expect(authUserMessage(new Error('Email rate limit exceeded for this address'))).toBe(
      'Too many attempts. Wait a moment, then try again.',
    );
    expect(authUserMessage(new Error(AUTH_UNAVAILABLE_MESSAGE))).toBe(AUTH_UNAVAILABLE_MESSAGE);
  });

  it('does not reflect raw backend/provider details', () => {
    const raw = 'relation "public.profiles" does not exist; token=secret; user_id=123';
    expect(authUserMessage(new Error(raw))).toBe('Something went wrong. Please try again.');
    expect(dataRightsUserMessage()).not.toMatch(/relation|token|user_id|supabase|provider/i);
    expect(appLockUserMessage()).not.toMatch(/exception|stack|biometric|native/i);
    expect(shareCardUserMessage()).not.toMatch(/file|uri|path|stack/i);
  });
});
