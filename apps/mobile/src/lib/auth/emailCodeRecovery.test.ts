import { describe, expect, it } from 'vitest';

import {
  EMAIL_CODE_CLIENT_VALIDITY_MS,
  getEmailCodeChallengeState,
  startEmailCodeChallenge,
} from './emailCodeRecovery';

describe('email-code recovery state', () => {
  const challenge = startEmailCodeChallenge(10_000);

  it('allows a fresh code but paces resend for one minute', () => {
    expect(getEmailCodeChallengeState(challenge, 10_000)).toEqual({
      expired: false,
      resendSeconds: 60,
    });
    expect(getEmailCodeChallengeState(challenge, 69_999).resendSeconds).toBe(1);
    expect(getEmailCodeChallengeState(challenge, 70_000)).toEqual({
      expired: false,
      resendSeconds: 0,
    });
  });

  it('requires a new code at the local validity boundary', () => {
    expect(
      getEmailCodeChallengeState(challenge, 10_000 + EMAIL_CODE_CLIENT_VALIDITY_MS - 1).expired,
    ).toBe(false);
    expect(getEmailCodeChallengeState(challenge, 10_000 + EMAIL_CODE_CLIENT_VALIDITY_MS)).toEqual({
      expired: true,
      resendSeconds: 0,
    });
  });

  it('fails closed on clock rollback or invalid timestamps', () => {
    expect(getEmailCodeChallengeState(challenge, 9_999).expired).toBe(true);
    expect(getEmailCodeChallengeState(challenge, Number.NaN).expired).toBe(true);
  });
});
