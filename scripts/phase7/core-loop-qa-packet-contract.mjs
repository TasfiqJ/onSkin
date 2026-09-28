export const PHASE7_EVIDENCE_KEYS = Object.freeze([
  'brandReady',
  'supabaseRlsPass',
  'clinicalReviewPass',
  'catalogBetaImportPass',
  'deviceQaPass',
  'revenueCatQaPass',
  'privacyExportDeletePass',
  'betaDashboardReady',
  'signedOffBy',
  'onboardingConsentQaPass',
  'shelfIntakeQaPass',
  'reviewedGuidanceQaPass',
  'routineBuilderQaPass',
  'todayCheckoffQaPass',
  'photosPrivacyQaPass',
  'remindersQaPass',
  'paymentsLifecycleQaPass',
  'privacyControlsQaPass',
  'shareCardQaPass',
  'deferredSurfacesQaPass',
  'analyticsQaPass',
]);

export function validatePhase7EvidenceInventory(evidence) {
  const errors = [];
  const keys =
    evidence !== null && typeof evidence === 'object' && !Array.isArray(evidence)
      ? Object.keys(evidence)
      : [];
  if (
    keys.length !== PHASE7_EVIDENCE_KEYS.length ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !PHASE7_EVIDENCE_KEYS.includes(key))
  ) {
    errors.push('Phase 7 evidence inventory is not exact');
  }
  for (const key of PHASE7_EVIDENCE_KEYS) {
    const value = evidence?.[key];
    if (key === 'signedOffBy') {
      if (typeof value !== 'string' || value.length === 0) {
        errors.push('Phase 7 evidence has no named signoff');
      }
    } else if (value !== true) {
      errors.push(`Phase 7 evidence ${key} is not pass`);
    }
  }
  return Object.freeze({
    status: errors.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(errors),
  });
}
