export const BETA_COVERAGE_EVIDENCE_KEYS = Object.freeze([
  'realBetaDataClaimed',
  'dashboardEvidencePresent',
  'supportDashboardEvidencePresent',
  'analyticsDashboardEvidencePresent',
  'sourceExportDigestPresent',
  'namedSignoffPresent',
]);

export function validateBetaCoverageEvidenceInventory(evidence) {
  const keys =
    evidence !== null && typeof evidence === 'object' && !Array.isArray(evidence)
      ? Object.keys(evidence)
      : [];
  const errors = [];
  if (
    keys.length !== BETA_COVERAGE_EVIDENCE_KEYS.length ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !BETA_COVERAGE_EVIDENCE_KEYS.includes(key))
  ) {
    errors.push('beta coverage evidence inventory is not exact');
  }
  for (const key of BETA_COVERAGE_EVIDENCE_KEYS) {
    if (evidence?.[key] !== true) errors.push(`beta coverage evidence ${key} is not pass`);
  }
  return Object.freeze({
    status: errors.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(errors),
  });
}
