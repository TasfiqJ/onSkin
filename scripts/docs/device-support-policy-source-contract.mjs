export function validateSupportedPhoneGates(gateResults, requiredGateIds, requirePassingEvidence) {
  const blockers = [];
  const launchGate = gateResults.find((gate) => gate.id === 'iphone-375-667-200-text-pressure');

  for (const gateId of requiredGateIds) {
    const matching = gateResults.filter((gate) => gate.id === gateId);
    if (matching.length !== 1) {
      blockers.push(`${gateId} must have exactly one supported-phone gate definition.`);
      continue;
    }
    const gate = matching[0];
    if (!gate.required) blockers.push(`${gateId} must be required supported-phone evidence.`);
    if (gate.supportClass !== 'supported-phone') {
      blockers.push(`${gateId} must be classified as supported-phone evidence.`);
    }
    if (!['pass', 'fail'].includes(gate.status)) {
      blockers.push(`${gateId} must retain an honest pass or fail evidence status.`);
    }
    if (requirePassingEvidence && gate.status !== 'pass') {
      blockers.push(`${gateId} must pass.`);
    }
  }

  return { blockers, launchGate };
}
