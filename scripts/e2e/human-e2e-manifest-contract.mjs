import { validateGovernedEvidenceChainBinding } from '../launch/governed-evidence-chain.mjs';

export const HUMAN_E2E_REQUIRED_GATE_IDS = Object.freeze([
  'iphone-375-667-200-text-pressure',
  'iphone-375-200-text-pressure',
  'modern-390-200-text-pressure',
  'boundary-414-896-200-text-pressure',
  'modern-430-200-text-pressure',
  'skipped-routes-375-667-200-text-pressure',
  'skipped-routes-390-844-200-text-pressure',
  'skipped-routes-430-932-200-text-pressure',
  'account-upgrade-supported-phone',
  'account-isolation-supported-phone',
  'account-deletion-durable-recovery-expo-web-stress',
  'health-consent-withdrawal-expo-web-compatibility',
  'cat04-catalog-recovery-supported-phone',
  'cat05-native-ocr-review-supported-phone',
  'progress-timelapse-supported-phone',
  'progress-capture-analysis-supported-phone',
  'progress-device-only-backup-supported-phone',
  'progress-direct-route-lock-supported-phone',
  'progress-storage-recovery-supported-phone',
  'private-envelope-corruption-supported-phone',
  'pregnancy-safety-status-supported-phone',
  'multi-active-plan-today-supported-phone',
  'routine-order-persistence-supported-phone',
  'conflict-choice-schedule-supported-phone',
  'cycle-disruption-reconciliation-supported-phone',
  'authored-cycle-customization-supported-phone',
  'cat07-shelf-freshness-supported-phone',
  'required-surface-honesty-supported-phone',
  'trend-route-group-gate-supported-phone',
  'data-export-local-photo-disclosure-supported-phone',
  'data-export-combined-device-supported-phone',
  'data-export-account-generation-supported-phone',
]);

function sameStringSet(left, right) {
  if (left.length !== right.length || new Set(left).size !== left.length) return false;
  const expected = new Set(right);
  return left.every((value) => expected.has(value));
}

export function validateHumanE2eManifestReleaseRole(packet, audit) {
  const errors = [];
  if (packet === null || typeof packet !== 'object' || Array.isArray(packet)) {
    return Object.freeze({
      status: 'blocked',
      errors: Object.freeze(['human-E2E manifest must be one JSON object']),
    });
  }
  if (packet.status !== 'pass') errors.push('human-E2E manifest status is not pass');
  if (!Array.isArray(packet.blockers) || packet.blockers.length !== 0) {
    errors.push('human-E2E manifest blockers must be one empty array');
  }
  if (!Array.isArray(packet.gateResults)) {
    errors.push('human-E2E manifest gateResults must be an array');
  } else {
    const requiredGates = packet.gateResults.filter((gate) => gate?.required === true);
    const requiredIds = requiredGates.map((gate) => gate?.id);
    if (!sameStringSet(requiredIds, HUMAN_E2E_REQUIRED_GATE_IDS)) {
      errors.push('human-E2E manifest required-gate inventory is not exact');
    }
    for (const gate of requiredGates) {
      if (gate?.status !== 'pass' || gate?.verdict !== 'pass') {
        errors.push(`human-E2E required gate ${String(gate?.id ?? '<missing>')} is not pass`);
      }
    }
  }
  const chainValidation = validateGovernedEvidenceChainBinding(packet.governedEvidenceChain, audit);
  errors.push(...chainValidation.errors.map((error) => `human-E2E manifest ${error}`));
  if (packet.gitSha !== packet.governedEvidenceChain?.currentGitSha) {
    errors.push('human-E2E manifest Git SHA does not match its governed current Git SHA');
  }
  return Object.freeze({
    status: errors.length === 0 ? 'pass' : 'blocked',
    errors: Object.freeze(errors),
  });
}
