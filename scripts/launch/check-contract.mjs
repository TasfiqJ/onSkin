#!/usr/bin/env node
import {
  LAUNCH_CONTRACT_PATH,
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from './contract.mjs';

try {
  const contract = loadLaunchContract();
  const snapshot = launchContractSnapshot(contract);
  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          valid: true,
          path: LAUNCH_CONTRACT_PATH,
          contract: snapshot,
          platformRequirements: {
            ios: platformRequirementStatus('ios', contract),
            android: platformRequirementStatus('android', contract),
          },
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  console.log('iOS all-features launch contract');
  console.log(`Path: ${LAUNCH_CONTRACT_PATH}`);
  console.log(`Program: ${contract.programId}`);
  console.log(`Platforms: ${contract.release.platforms.join(', ')}`);
  console.log(`Mode: ${contract.release.mode}`);
  console.log(`Required features: ${contract.requiredFeatures.length}`);
  console.log(`Required Phase 7/8 surfaces: ${contract.requiredSurfaces.length}`);
  console.log(`iOS release evidence: ${platformRequirementStatus('ios', contract)}`);
  console.log(`Android release evidence: ${platformRequirementStatus('android', contract)}`);
  console.log('Launch contract is valid.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
