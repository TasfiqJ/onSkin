import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BETA_COVERAGE_EVIDENCE_KEYS,
  validateBetaCoverageEvidenceInventory,
} from './beta-coverage-packet-contract.mjs';

const passing = () => Object.fromEntries(BETA_COVERAGE_EVIDENCE_KEYS.map((key) => [key, true]));

test('beta coverage evidence requires the exact six-key all-true inventory', () => {
  assert.equal(validateBetaCoverageEvidenceInventory(passing()).status, 'pass');
  const missing = passing();
  delete missing.realBetaDataClaimed;
  assert.equal(validateBetaCoverageEvidenceInventory(missing).status, 'blocked');
  assert.equal(
    validateBetaCoverageEvidenceInventory({ ...passing(), forged: true }).status,
    'blocked',
  );
  assert.equal(
    validateBetaCoverageEvidenceInventory({ ...passing(), namedSignoffPresent: false }).status,
    'blocked',
  );
});
