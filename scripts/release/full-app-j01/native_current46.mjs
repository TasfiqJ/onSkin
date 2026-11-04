/** Current complete native source/config candidate. No device or owner admission. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { proveCurrentNativeSource46 } from '../../phase9/ios-privacy-contract.mjs';
import { verifyNativeCandidate46, assertCurrentNativeHead46 } from '../../phase9/ios-privacy-lock-succession46.mjs';
import { IOS_WIDGET_EXTENSION_CONTRACT, validateIosExtensionConfig,
  validateIosExtensionVariantIsolation } from '../../phase5/ios-extension-contract.mjs';

const hash = value => createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');

export function validateIosExtensionConfig46({ root, config, packageJson, packageLock, variant }) {
  try {
    const { report, witness } = proveCurrentNativeSource46(root);
    if (hash(packageJson) !== witness.mobilePackage.sha256 ||
        hash(packageLock) !== report.inputs.packageLock.sha256) throw new Error('CURRENT_CONFIG_INPUT_DRIFT');
    const old = JSON.parse(readFileSync(resolve(root, 'docs/phase-9/ios-sdk-lock-succession23.v1.json')));
    for (const [name, expected] of Object.entries(old.widgetCompatibility)) {
      const actual = packageLock.packages[`node_modules/${name}`];
      if (packageJson.dependencies[name] !== expected.specifier ||
          packageLock.packages['apps/mobile'].dependencies[name] !== expected.specifier ||
          ['version', 'resolved', 'integrity'].some(key => actual?.[key] !== expected[key])) throw new Error('CURRENT_WIDGET_SOURCE_DRIFT');
    }
    const historicalPackage = structuredClone(packageJson);
    const historicalLock = structuredClone(packageLock);
    for (const [name, expected] of Object.entries(IOS_WIDGET_EXTENSION_CONTRACT.reviewedDependencyLocks)) {
      historicalPackage.dependencies[name] = expected.specifier;
      historicalLock.packages['apps/mobile'].dependencies[name] = expected.specifier;
      for (const key of ['version', 'resolved', 'integrity']) historicalLock.packages[expected.path][key] = expected[key];
    }
    return { ...validateIosExtensionConfig({ config, packageJson: historicalPackage,
      packageLock: historicalLock, variant }), sourceCompatibility: {
      kind: 'CURRENT_NATIVE_SOURCE46', status: witness.status, sourceOnly: true,
      nativeAccepted: false, archiveInspected: false, acceptanceGranted: false,
      publicReleaseAuthorized: false, witnessSHA256: report.inputs.lockSuccession46.sha256,
    } };
  } catch {
    return { errors: [`${variant}: CURRENT_NATIVE_SOURCE46_IDENTITY_REQUIRED`], identity: null };
  }
}

export function runNativeCurrent46(root = process.cwd()) {
  const committed = assertCurrentNativeHead46(root);
  const candidate = verifyNativeCandidate46(root);
  const { report, witness } = proveCurrentNativeSource46(root);
  const packageJson = JSON.parse(readFileSync(resolve(root, 'apps/mobile/package.json')));
  const packageLock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
  const identities = [];
  for (const variant of ['development', 'staging']) {
    const probe = spawnSync(process.execPath, [resolve(root, 'scripts/phase5/resolve-ios-extension-config.mjs'), variant],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    if (probe.status !== 0) throw new Error(`CURRENT_NATIVE_SOURCE46_CONFIG_RESOLUTION:${variant}`);
    const checked = validateIosExtensionConfig46({ root, config: JSON.parse(probe.stdout), packageJson, packageLock, variant });
    if (checked.errors.length || !checked.identity) throw new Error(`CURRENT_NATIVE_SOURCE46_CONFIG:${JSON.stringify(checked.errors)}`);
    identities.push(checked.identity);
  }
  if (validateIosExtensionVariantIsolation(identities).length) throw new Error('CURRENT_NATIVE_SOURCE46_VARIANT_COLLISION');
  const nativeConfig = spawnSync(process.execPath, [resolve(root, 'scripts/phase5/check-native-config.mjs')],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  if (nativeConfig.status !== 0) throw new Error(`CURRENT_NATIVE_SOURCE46_FULL_NATIVE_CONFIG:${nativeConfig.stderr || nativeConfig.stdout}`);
  const after = verifyNativeCandidate46(root);
  if (JSON.stringify(candidate.source) !== JSON.stringify(after.source) ||
      JSON.stringify(candidate.stamps) !== JSON.stringify(after.stamps)) throw new Error('CURRENT_NATIVE_SOURCE46_SOURCE_RACE');
  assertCurrentNativeHead46(root, committed.sourceHead);
  return { status: witness.status, source: after.source, descriptorSHA256: candidate.file.sha256,
    committedSourceProof: committed,
    currentPackageSHA256: witness.rootPackage.sha256, currentLockSHA256: candidate.lockFile.sha256,
    changedLockNodes: witness.changedNodes, verifiedInputCount: candidate.inputs.length,
    installedNativeTrees: candidate.trees, completeInstalledAudit: report.summary,
    completeAuditLedgerHashes: report.ledgerHashes, identities,
    originalPurposeNativeConfig: { exit: nativeConfig.status,
      stdoutSHA256: createHash('sha256').update(nativeConfig.stdout).digest('hex'),
      stderrSHA256: createHash('sha256').update(nativeConfig.stderr).digest('hex') },
    claims: witness.claims, admissions: witness.admissions, sourceOnly: true,
    archiveInspected: false, acceptanceGranted: false, publicReleaseAuthorized: false,
    release: 'NO_GO', qualification: 'CURRENT_COMPLETE_INSTALLED_SOURCE_AND_CONFIG_ONLY_INDEPENDENT_REVIEW_REQUIRED' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(runNativeCurrent46(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'))));
}
