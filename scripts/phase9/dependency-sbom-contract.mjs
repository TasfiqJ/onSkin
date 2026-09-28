export const DEPENDENCY_AUDIT_MODES = Object.freeze(['not_run', 'offline_cache', 'registry']);

export const DEPENDENCY_AUDIT_NOT_RUN_WARNING =
  'npm audit was not run; set PHASE9_RUN_NPM_AUDIT=true in release CI.';
export const DEPENDENCY_AUDIT_OFFLINE_WARNING =
  'npm audit used only the local offline advisory cache; rerun against the registry in release CI.';
export const DEPENDENCY_AUDIT_SIGNOFF_WARNING =
  'Missing registry-backed dependency/SBOM signoff: PHASE9_DEPENDENCY_AUDIT_PASS=true after reviewing the exact RC scanner artifacts.';

export function resolveDependencyAuditProvenance({ requested, offline, completed }) {
  for (const [name, value] of Object.entries({ requested, offline, completed })) {
    if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  }
  if (!requested && (offline || completed)) {
    throw new Error('an unrequested dependency audit cannot be offline or complete');
  }
  return Object.freeze({
    requested,
    mode: requested ? (offline ? 'offline_cache' : 'registry') : 'not_run',
    completed,
  });
}

export function dependencyAuditEvidenceWarnings({ provenance, signedOff }) {
  if (
    provenance === null ||
    typeof provenance !== 'object' ||
    !DEPENDENCY_AUDIT_MODES.includes(provenance.mode) ||
    typeof provenance.requested !== 'boolean' ||
    typeof provenance.completed !== 'boolean' ||
    typeof signedOff !== 'boolean'
  ) {
    throw new TypeError('dependency audit warning inputs are invalid');
  }
  const warnings = [];
  if (!provenance.requested) warnings.push(DEPENDENCY_AUDIT_NOT_RUN_WARNING);
  if (provenance.mode === 'offline_cache') warnings.push(DEPENDENCY_AUDIT_OFFLINE_WARNING);
  if (!(signedOff && provenance.mode === 'registry' && provenance.completed)) {
    warnings.push(DEPENDENCY_AUDIT_SIGNOFF_WARNING);
  }
  return Object.freeze(warnings);
}
