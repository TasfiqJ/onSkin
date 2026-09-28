import { beforeEach, describe, expect, it } from 'vitest';

import {
  agePolicyRouteMayMountWithoutReceipt,
  clearAgePolicyReverificationHandoff,
  consumePostAgeConsentRoute,
  dismissAgePolicyReverificationHandoff,
  getAgePolicyReverificationHandoff,
  isAgePolicyReverificationRequiredInSession,
  markAgePolicyReverificationHandoffFailed,
  stageAgePolicyReverificationHandoff,
  stagePostAgeConsentRoute,
} from './agePolicyRoute';

describe('age-policy route gate', () => {
  beforeEach(() => {
    clearAgePolicyReverificationHandoff();
    consumePostAgeConsentRoute();
  });

  it('hands the one-time consent transition to the protected navigator', () => {
    expect(consumePostAgeConsentRoute()).toBe(false);
    stagePostAgeConsentRoute();
    expect(consumePostAgeConsentRoute()).toBe(true);
    expect(consumePostAgeConsentRoute()).toBe(false);
  });

  it.each([[[]], [['onboarding', 'age']]])(
    'permits only the receipt bootstrap route %j without a current receipt',
    (segments) => {
      expect(agePolicyRouteMayMountWithoutReceipt(segments)).toBe(true);
    },
  );

  it.each([
    [['today']],
    [['onboarding', 'consent']],
    [['onboarding', 'account']],
    [['paywall']],
    [['community']],
    [['settings', 'skin-profile']],
  ])('blocks protected deep link %j without a current receipt', (segments) => {
    expect(agePolicyRouteMayMountWithoutReceipt(segments)).toBe(false);
  });

  it('carries only transient re-verification UI state and ignores stale completions', () => {
    const generation = stageAgePolicyReverificationHandoff();
    expect(getAgePolicyReverificationHandoff()).toBe('reverification_required');
    expect(isAgePolicyReverificationRequiredInSession()).toBe(true);

    dismissAgePolicyReverificationHandoff();
    markAgePolicyReverificationHandoffFailed(generation);
    expect(getAgePolicyReverificationHandoff()).toBe('none');
    expect(isAgePolicyReverificationRequiredInSession()).toBe(true);

    const currentGeneration = stageAgePolicyReverificationHandoff();
    markAgePolicyReverificationHandoffFailed(currentGeneration);
    expect(getAgePolicyReverificationHandoff()).toBe('reverification_write_failed');
    expect(isAgePolicyReverificationRequiredInSession()).toBe(true);

    clearAgePolicyReverificationHandoff();
    expect(getAgePolicyReverificationHandoff()).toBe('none');
    expect(isAgePolicyReverificationRequiredInSession()).toBe(false);
  });
});
