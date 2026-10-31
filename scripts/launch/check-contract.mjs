#!/usr/bin/env node
import {
  LAUNCH_CONTRACT_PATH,
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from './contract.mjs';

try {
  // Explicit product-scope adoption. Default callers retain the historical
  // technical contract and output; this selector cannot activate a feature.
  if (process.argv.includes('--scope')) {
    const args = process.argv.slice(2);
    const index = args.indexOf('--scope');
    if (args[index + 1] !== 'full-app-j01-v2' || args.lastIndexOf('--scope') !== index) {
      throw new Error('Unknown versioned product scope.');
    }
    args.splice(index, 2);
    const { runContract33 } = await import('./full-app-contract33.mjs');
    process.exit(runContract33(args));
  }
  if (process.argv.some((arg) => arg.startsWith('--scope') || arg === '--external-readiness')) {
    throw new Error('Use --scope full-app-j01-v2 for versioned product readiness.');
  }
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
  console.log('iOS lean V1 launch contract');
  console.log(`Path: ${LAUNCH_CONTRACT_PATH}`);
  console.log(`Program: ${contract.programId}`);
  console.log(`Platforms: ${contract.release.platforms.join(', ')}`);
  console.log(`Mode: ${contract.release.mode}`);
  console.log(`Required features: ${contract.requiredFeatures.length}`);
  console.log(`Deferred features: ${contract.deferredFeatures.length}`);
  console.log(`Required optional Phase 7/8 surfaces: ${contract.requiredSurfaces.length}`);
  console.log(`iOS release evidence: ${platformRequirementStatus('ios', contract)}`);
  console.log(`Android release evidence: ${platformRequirementStatus('android', contract)}`);
  console.log('Launch contract is valid.');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
