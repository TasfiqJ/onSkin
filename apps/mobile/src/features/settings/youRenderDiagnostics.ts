export const YOU_RENDER_DIAGNOSTICS_GLOBAL = '__LAYERWELL_YOU_RENDER_DIAGNOSTICS__' as const;

export type YouRenderDiagnosticsSnapshot = Readonly<{
  screenRenders: number;
  accountRenders: number;
  subscriptionRenders: number;
  staticOverviewRenders: number;
  mutationShellRenders: number;
  consentCoordinatorRenders: number;
  dataRightsCoordinatorRenders: number;
  commerceRenders: number;
  securityRenders: number;
  privacyRenders: number;
  policiesRenders: number;
  dataRenders: number;
  consentStarts: number;
  appLockStarts: number;
  policyStarts: number;
  exportStarts: number;
  destructiveStarts: number;
}>;

type MutableYouRenderDiagnostics = {
  -readonly [Key in keyof YouRenderDiagnosticsSnapshot]: number;
};

type YouDiagnosticsGlobal = typeof globalThis & {
  __LAYERWELL_YOU_RENDER_DIAGNOSTICS__?: MutableYouRenderDiagnostics;
};

const EMPTY_DIAGNOSTICS: YouRenderDiagnosticsSnapshot = Object.freeze({
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
});

function diagnosticsEnabled(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function mutableDiagnostics(): MutableYouRenderDiagnostics | null {
  if (!diagnosticsEnabled()) return null;
  const root = globalThis as YouDiagnosticsGlobal;
  root.__LAYERWELL_YOU_RENDER_DIAGNOSTICS__ ??= { ...EMPTY_DIAGNOSTICS };
  return root.__LAYERWELL_YOU_RENDER_DIAGNOSTICS__;
}

function recordRender(key: keyof MutableYouRenderDiagnostics): void {
  const diagnostics = mutableDiagnostics();
  if (diagnostics) diagnostics[key] += 1;
}

export function recordYouScreenRender(): void {
  recordRender('screenRenders');
}

export function recordYouAccountRender(): void {
  recordRender('accountRenders');
}

export function recordYouSubscriptionRender(): void {
  recordRender('subscriptionRenders');
}

export function recordYouStaticOverviewRender(): void {
  recordRender('staticOverviewRenders');
}

export function recordYouMutationShellRender(): void {
  recordRender('mutationShellRenders');
}

export function recordYouConsentCoordinatorRender(): void {
  recordRender('consentCoordinatorRenders');
}

export function recordYouDataRightsCoordinatorRender(): void {
  recordRender('dataRightsCoordinatorRenders');
}

export function recordYouCommerceRender(): void {
  recordRender('commerceRenders');
}

export function recordYouSecurityRender(): void {
  recordRender('securityRenders');
}

export function recordYouPrivacyRender(): void {
  recordRender('privacyRenders');
}

export function recordYouPoliciesRender(): void {
  recordRender('policiesRenders');
}

export function recordYouDataRender(): void {
  recordRender('dataRenders');
}

export function recordYouConsentStart(): void {
  recordRender('consentStarts');
}

export function recordYouAppLockStart(): void {
  recordRender('appLockStarts');
}

export function recordYouPolicyStart(): void {
  recordRender('policyStarts');
}

export function recordYouExportStart(): void {
  recordRender('exportStarts');
}

export function recordYouDestructiveStart(): void {
  recordRender('destructiveStarts');
}

export function readYouRenderDiagnostics(): YouRenderDiagnosticsSnapshot {
  const diagnostics = mutableDiagnostics();
  return diagnostics ? Object.freeze({ ...diagnostics }) : EMPTY_DIAGNOSTICS;
}

export function resetYouRenderDiagnostics(): void {
  const diagnostics = mutableDiagnostics();
  if (!diagnostics) return;
  Object.assign(diagnostics, EMPTY_DIAGNOSTICS);
}
