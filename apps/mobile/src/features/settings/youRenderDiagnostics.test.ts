import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readYouRenderDiagnostics,
  recordYouAccountRender,
  recordYouCommerceRender,
  recordYouConsentCoordinatorRender,
  recordYouConsentStart,
  recordYouDataRender,
  recordYouDataRightsCoordinatorRender,
  recordYouDestructiveStart,
  recordYouExportStart,
  recordYouAppLockStart,
  recordYouMutationShellRender,
  recordYouPolicyStart,
  recordYouPoliciesRender,
  recordYouPrivacyRender,
  recordYouScreenRender,
  recordYouSecurityRender,
  recordYouStaticOverviewRender,
  recordYouSubscriptionRender,
  resetYouRenderDiagnostics,
} from './youRenderDiagnostics';

const runtime = globalThis as typeof globalThis & {
  __DEV__?: boolean;
  __ONSKIN_YOU_RENDER_DIAGNOSTICS__?: unknown;
};
const originalDev = runtime.__DEV__;

const EMPTY_SNAPSHOT = {
  screenRenders: 0,
  accountRenders: 0,
  subscriptionRenders: 0,
  staticOverviewRenders: 0,
  mutationShellRenders: 0,
  consentCoordinatorRenders: 0,
  dataRightsCoordinatorRenders: 0,
  commerceRenders: 0,
  securityRenders: 0,
  privacyRenders: 0,
  policiesRenders: 0,
  dataRenders: 0,
  consentStarts: 0,
  appLockStarts: 0,
  policyStarts: 0,
  exportStarts: 0,
  destructiveStarts: 0,
} as const;

describe('You content-free render diagnostics', () => {
  beforeEach(() => {
    runtime.__DEV__ = true;
    delete runtime.__ONSKIN_YOU_RENDER_DIAGNOSTICS__;
  });

  afterEach(() => {
    delete runtime.__ONSKIN_YOU_RENDER_DIAGNOSTICS__;
    if (originalDev === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = originalDev;
  });

  it('counts each fixed route, coordinator, and section render', () => {
    recordYouScreenRender();
    recordYouAccountRender();
    recordYouSubscriptionRender();
    recordYouStaticOverviewRender();
    recordYouMutationShellRender();
    recordYouConsentCoordinatorRender();
    recordYouDataRightsCoordinatorRender();
    recordYouCommerceRender();
    recordYouSecurityRender();
    recordYouPrivacyRender();
    recordYouPoliciesRender();
    recordYouDataRender();
    recordYouDataRender();
    recordYouConsentStart();
    recordYouAppLockStart();
    recordYouPolicyStart();
    recordYouExportStart();
    recordYouDestructiveStart();

    expect(readYouRenderDiagnostics()).toEqual({
      ...EMPTY_SNAPSHOT,
      screenRenders: 1,
      accountRenders: 1,
      subscriptionRenders: 1,
      staticOverviewRenders: 1,
      mutationShellRenders: 1,
      consentCoordinatorRenders: 1,
      dataRightsCoordinatorRenders: 1,
      commerceRenders: 1,
      securityRenders: 1,
      privacyRenders: 1,
      policiesRenders: 1,
      dataRenders: 2,
      consentStarts: 1,
      appLockStarts: 1,
      policyStarts: 1,
      exportStarts: 1,
      destructiveStarts: 1,
    });
  });

  it('returns frozen copies that cannot mutate live counters', () => {
    recordYouPrivacyRender();
    const first = readYouRenderDiagnostics();
    const second = readYouRenderDiagnostics();

    expect(Object.isFrozen(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(second.privacyRenders).toBe(1);
  });

  it('resets to an exact numeric-only schema with no content fields', () => {
    recordYouScreenRender();
    recordYouConsentCoordinatorRender();
    recordYouDataRender();
    resetYouRenderDiagnostics();

    const snapshot = readYouRenderDiagnostics();
    expect(snapshot).toEqual(EMPTY_SNAPSHOT);
    expect(Object.keys(snapshot).sort()).toEqual([
      'accountRenders',
      'appLockStarts',
      'commerceRenders',
      'consentCoordinatorRenders',
      'consentStarts',
      'dataRenders',
      'dataRightsCoordinatorRenders',
      'destructiveStarts',
      'exportStarts',
      'mutationShellRenders',
      'policiesRenders',
      'policyStarts',
      'privacyRenders',
      'screenRenders',
      'securityRenders',
      'staticOverviewRenders',
      'subscriptionRenders',
    ]);
    expect(Object.values(snapshot).every((value) => Number.isFinite(value))).toBe(true);
  });

  it('does nothing and creates no global outside development builds', () => {
    runtime.__DEV__ = false;

    recordYouScreenRender();
    recordYouAccountRender();
    recordYouSubscriptionRender();
    recordYouStaticOverviewRender();
    recordYouMutationShellRender();
    recordYouConsentCoordinatorRender();
    recordYouDataRightsCoordinatorRender();
    recordYouCommerceRender();
    recordYouSecurityRender();
    recordYouPrivacyRender();
    recordYouPoliciesRender();
    recordYouDataRender();
    recordYouConsentStart();
    recordYouAppLockStart();
    recordYouPolicyStart();
    recordYouExportStart();
    recordYouDestructiveStart();
    resetYouRenderDiagnostics();

    const snapshot = readYouRenderDiagnostics();
    expect(snapshot).toEqual(EMPTY_SNAPSHOT);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(runtime.__ONSKIN_YOU_RENDER_DIAGNOSTICS__).toBeUndefined();
  });
});
