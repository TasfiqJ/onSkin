import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PHASE7_EVIDENCE_KEYS,
  validatePhase7EvidenceInventory,
} from './core-loop-qa-packet-contract.mjs';

function validEvidence() {
  return Object.fromEntries(
    PHASE7_EVIDENCE_KEYS.map((key) => [key, key === 'signedOffBy' ? 'Release Owner' : true]),
  );
}

test('Phase 7 evidence inventory requires the exact canonical key set', () => {
  assert.equal(validatePhase7EvidenceInventory(validEvidence()).status, 'pass');
  const reduced = validEvidence();
  delete reduced.deviceQaPass;
  assert.equal(validatePhase7EvidenceInventory(reduced).status, 'blocked');
  assert.equal(
    validatePhase7EvidenceInventory({ ...validEvidence(), forgedEvidence: true }).status,
    'blocked',
  );
  assert.equal(
    validatePhase7EvidenceInventory({ ...validEvidence(), deviceQaPass: false }).status,
    'blocked',
  );
});
