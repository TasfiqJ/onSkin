#!/usr/bin/env node
import { createRequire } from 'node:module';

import {
  abs,
  block,
  envSnapshot,
  evidenceFlagEnabled,
  exists,
  hash,
  printResult,
  read,
  strict,
  warn,
  write,
} from './lib.mjs';
import {
  isReleasePlatformRequired,
  launchContractSnapshot,
  loadLaunchContract,
  platformRequirementStatus,
} from '../launch/contract.mjs';
import {
  IosArchivePrivacyEvidenceError,
  loadAndValidateIosArchivePrivacyEvidence,
} from './ios-archive-privacy-evidence.mjs';
import { auditIosReleaseCandidateCrossBinding } from './ios-release-candidate-cross-binding.mjs';
import { auditReleaseCandidateGitContract } from './release-candidate-git-contract.mjs';
import { IosPrivacyContractError, auditIosPrivacySource } from './ios-privacy-contract.mjs';
import {
  auditStoreOnlyResolvedApp,
  auditStoreOnlyRelease,
  readStoreOnlyReleaseInputs,
} from '../optimization/store-only-release-audit.mjs';

const cliArguments = process.argv.slice(2);
const allowedCliArguments = new Set(['--check', '--strict']);
const cliErrors = [];
for (const argument of cliArguments) {
  if (!allowedCliArguments.has(argument)) cliErrors.push(`Unknown argument: ${argument}.`);
  if (cliArguments.indexOf(argument) !== cliArguments.lastIndexOf(argument)) {
    cliErrors.push(`Duplicate argument: ${argument}.`);
  }
}
const checkOnly = cliArguments.includes('--check');
const errors = [...new Set(cliErrors)];
const warnings = [];
const env = envSnapshot();
const launchContract = loadLaunchContract();
const androidReleaseRequired = isReleasePlatformRequired('android', launchContract);
const app = JSON.parse(read('apps/mobile/app.base.json')).expo;
const eas = JSON.parse(read('apps/mobile/eas.json'));
const appConfigSource = read('apps/mobile/app.config.js');
const artifacts = {};
const require = createRequire(import.meta.url);
const appConfigPath = require.resolve('../../apps/mobile/app.config.js');
const variants = ['development', 'staging', 'production'];
const reviewedIosBuildEnvironment = Object.freeze({
  easCliVersion: '21.0.1',
  image: 'macos-tahoe-26.4-xcode-26.4',
  imagePinScope: 'expo-specific-name-minor-updates-possible',
  macosVersion: '26.4.1',
  xcodeVersion: '26.4',
  xcodeBuild: '17E202',
  iosSdkVersion: '26.4',
  nodeVersion: '22.22.2',
  cocoapodsVersion: '1.16.2',
  fastlaneVersion: '2.233.1',
  reviewedAt: '2026-07-16',
  source: 'https://docs.expo.dev/build-reference/infrastructure/',
  cliSource: 'https://docs.expo.dev/eas/cli/',
});
const releaseCandidateEvidencePath =
  /^docs\/phase-9\/release-candidates\/(rc-[a-z0-9]+(?:-[a-z0-9]+)*)\/ios-archive-privacy-evidence\.json$/;
const canonicalEasBuildId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const productionIdentityConfigErrorPatterns = [
  /BRAND_LEGAL_CLEARANCE=cleared/,
  /explicit final native identity env values/,
];

try {
  auditStoreOnlyRelease(readStoreOnlyReleaseInputs());
} catch (error) {
  block(
    errors,
    false,
    `Store-only update-delivery policy: ${error instanceof Error ? error.message : String(error)}`,
  );
}

let iosPrivacySourceAudit = null;
try {
  iosPrivacySourceAudit = auditIosPrivacySource();
  block(
    errors,
    iosPrivacySourceAudit.status !== 'source_invalid',
    `Installed iOS privacy source audit is invalid (${iosPrivacySourceAudit.summary.errorCount} errors).`,
  );
} catch (error) {
  const diagnostic =
    error instanceof IosPrivacyContractError
      ? `${error.message} [${error.code} at ${error.path ?? '-'}]`
      : error instanceof Error
        ? error.message
        : String(error);
  block(errors, false, `Installed iOS privacy source audit could not run: ${diagnostic}`);
}

function appConfigForVariant(variant) {
  const previousVariant = process.env.APP_VARIANT;
  const previousEnv = process.env.EXPO_PUBLIC_APP_ENV;
  process.env.APP_VARIANT = variant;
  process.env.EXPO_PUBLIC_APP_ENV = variant;
  delete require.cache[appConfigPath];

  try {
    return { config: require(appConfigPath)().expo, error: null };
  } catch (error) {
    return {
      config: null,
      error: error instanceof Error ? error.message : `Unable to resolve ${variant} app config.`,
    };
  } finally {
    delete require.cache[appConfigPath];
    if (previousVariant === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previousVariant;
    if (previousEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = previousEnv;
  }
}

function expectedVariantValue(baseValue, variant) {
  return variant === 'production' ? baseValue : `${baseValue}.${variant}`;
}

function isProductionIdentityConfigBlock(variant, error) {
  return (
    variant === 'production' &&
    productionIdentityConfigErrorPatterns.some((pattern) => pattern.test(error ?? ''))
  );
}

block(errors, Boolean(app.version), 'App version is missing.');
block(
  errors,
  app.runtimeVersion?.policy === 'fingerprint',
  'runtimeVersion must retain the fingerprint policy for artifact compatibility.',
);
block(errors, Boolean(app.ios?.bundleIdentifier), 'iOS bundle identifier is missing.');
if (androidReleaseRequired) {
  block(errors, Boolean(app.android?.package), 'Android package is missing.');
  block(
    errors,
    app.android?.allowBackup === false,
    'Android Auto Backup must be disabled for local health-adjacent stores.',
  );
}
block(
  errors,
  eas?.cli?.appVersionSource === 'local',
  'EAS appVersionSource must stay local for reviewed release manifests.',
);
block(errors, eas?.cli?.version === '21.0.1', 'EAS CLI must be pinned to reviewed version 21.0.1.');
block(
  errors,
  eas?.cli?.requireCommit === true,
  'EAS builds must require a committed Git source before upload.',
);
block(
  errors,
  eas?.build?.production?.distribution === 'store',
  'Production EAS build must use store distribution.',
);
block(
  errors,
  eas?.build?.production?.autoIncrement === false,
  'Production EAS build must not auto-increment the reviewed native build number.',
);
block(
  errors,
  /CATALOG_RELEASE_IOS_BUILD_NUMBER/.test(appConfigSource) &&
    /expo\.ios\.buildNumber\s*=\s*buildNumber/.test(appConfigSource),
  'Production app config must embed the exact reviewed CATALOG_RELEASE_IOS_BUILD_NUMBER.',
);
block(
  errors,
  /NSCameraUsageDescription/.test(JSON.stringify(app.ios ?? {})),
  'iOS camera privacy string is missing.',
);
block(
  errors,
  /NSFaceIDUsageDescription/.test(JSON.stringify(app.ios ?? {})),
  'iOS Face ID privacy string is missing.',
);

for (const variant of variants) {
  const profile = eas.build?.[variant];
  block(errors, Boolean(profile), `EAS build profile is missing: ${variant}.`);
  if (!profile) continue;
  block(
    errors,
    profile.env?.APP_VARIANT === variant,
    `EAS ${variant} build must set APP_VARIANT=${variant}.`,
  );
  block(
    errors,
    profile.env?.EXPO_PUBLIC_APP_ENV === variant,
    `EAS ${variant} build must set EXPO_PUBLIC_APP_ENV=${variant}.`,
  );
  block(
    errors,
    profile.ios?.image === reviewedIosBuildEnvironment.image,
    `EAS ${variant} build must use the reviewed full Expo iOS image name.`,
  );
}

block(
  errors,
  eas.build?.development?.developmentClient === true,
  'Development profile must be a development client.',
);
block(
  errors,
  eas.build?.development?.distribution === 'internal',
  'Development profile must use internal distribution.',
);
block(
  errors,
  eas.build?.staging?.distribution === 'internal',
  'Staging profile must use internal distribution.',
);
block(
  errors,
  eas.build?.production?.developmentClient !== true,
  'Production profile must not enable developmentClient.',
);

const variantResults = Object.fromEntries(
  variants.map((variant) => [variant, appConfigForVariant(variant)]),
);
const variantConfigs = Object.fromEntries(
  variants.map((variant) => [variant, variantResults[variant].config]),
);
for (const variant of variants) {
  const config = variantConfigs[variant];
  if (!config) {
    const message = `Resolved ${variant} app config failed: ${variantResults[variant].error}`;
    if (!strict && isProductionIdentityConfigBlock(variant, variantResults[variant].error)) {
      warn(
        warnings,
        false,
        'Resolved production app config blocked until BRAND_LEGAL_CLEARANCE=cleared and explicit final native identity env values are supplied.',
      );
    } else {
      block(errors, false, message);
    }
    continue;
  }
  try {
    auditStoreOnlyResolvedApp(config, variant);
  } catch (error) {
    block(
      errors,
      false,
      `Store-only update-delivery policy: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  block(
    errors,
    config.extra?.appVariant === variant,
    `Resolved ${variant} config extra.appVariant mismatch.`,
  );
  block(
    errors,
    config.extra?.appEnvironment === variant,
    `Resolved ${variant} config extra.appEnvironment mismatch.`,
  );
  block(
    errors,
    config.scheme === (variant === 'production' ? app.scheme : `${app.scheme}-${variant}`),
    `Resolved ${variant} scheme is not isolated.`,
  );
  block(
    errors,
    config.ios?.bundleIdentifier === expectedVariantValue(app.ios?.bundleIdentifier, variant),
    `Resolved ${variant} iOS bundle identifier is not isolated.`,
  );
  if (androidReleaseRequired) {
    block(
      errors,
      config.android?.package === expectedVariantValue(app.android?.package, variant),
      `Resolved ${variant} Android package is not isolated.`,
    );
    block(
      errors,
      config.android?.allowBackup === false,
      `Resolved ${variant} Android config must keep allowBackup=false.`,
    );
  }
}

const androidPermissions = new Set(app.android?.permissions ?? []);
if (androidReleaseRequired) {
  for (const permission of androidPermissions) {
    block(
      errors,
      ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'].includes(permission),
      `Unexpected Android permission requires review: ${permission}.`,
    );
  }
}

let iosArchivePrivacyEvidence = null;
let iosArchivePrivacyEvidenceIndexValidated = false;
const iosArchivePrivacyEvidencePath = env.PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH;
if (iosArchivePrivacyEvidencePath) {
  const productionConfig = variantConfigs.production;
  const sourceGitSha = env.PHASE9_IOS_SOURCE_GIT_SHA ?? '';
  const expectedEasBuildId = env.PHASE9_IOS_EAS_BUILD_ID ?? '';
  const evidencePathMatch = releaseCandidateEvidencePath.exec(iosArchivePrivacyEvidencePath);
  const evidencePathMatchesRc = Boolean(evidencePathMatch);
  const releaseCandidateDirectory = evidencePathMatch
    ? `docs/phase-9/release-candidates/${evidencePathMatch[1]}`
    : null;
  block(
    errors,
    evidencePathMatchesRc,
    'PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH must name the completed JSON in one non-template RC folder.',
  );
  block(
    errors,
    /^[0-9a-f]{40}$/.test(sourceGitSha),
    'PHASE9_IOS_SOURCE_GIT_SHA must be the exact lowercase build-source commit.',
  );
  block(
    errors,
    canonicalEasBuildId.test(expectedEasBuildId),
    'PHASE9_IOS_EAS_BUILD_ID must be the canonical lowercase EAS build UUID.',
  );
  let releaseCandidateGitValid = false;
  if (/^[0-9a-f]{40}$/.test(sourceGitSha) && evidencePathMatchesRc) {
    try {
      const gitAudit = auditReleaseCandidateGitContract({
        root: abs('.'),
        sourceGitSha,
        releaseCandidateDir: releaseCandidateDirectory,
        requiredTrackedFiles: [
          iosArchivePrivacyEvidencePath,
          `${releaseCandidateDirectory}/manifest.md`,
          `${releaseCandidateDirectory}/signoff.md`,
          `${releaseCandidateDirectory}/store-review-packet.md`,
        ],
      });
      releaseCandidateGitValid = gitAudit.status === 'pass';
      for (const error of gitAudit.errors) {
        block(errors, false, `iOS release-candidate Git contract: ${error}`);
      }
    } catch {
      block(errors, false, 'The iOS release-candidate Git contract could not be evaluated.');
    }
  }

  if (!productionConfig) {
    block(
      errors,
      false,
      'iOS archive privacy evidence cannot be validated until production identity config resolves.',
    );
  } else if (releaseCandidateGitValid && canonicalEasBuildId.test(expectedEasBuildId)) {
    try {
      iosArchivePrivacyEvidence = loadAndValidateIosArchivePrivacyEvidence(
        iosArchivePrivacyEvidencePath,
        {
          root: abs('.'),
          expectedSourceGitSha: sourceGitSha,
          expectedBuild: {
            appVersion: productionConfig.version,
            buildNumber: env.PHASE9_IOS_BUILD_NUMBER ?? '',
            bundleIdentifier: productionConfig.ios?.bundleIdentifier,
            teamIdentifier: env.PHASE9_APPLE_TEAM_ID ?? '',
          },
        },
      );
      const validatedProvenance = iosArchivePrivacyEvidence.validation.provenance;

      const archive = iosArchivePrivacyEvidence.validation.archive;
      const candidateReferences = [
        archive.file,
        validatedProvenance.easBuildLog,
        ...Object.values(iosArchivePrivacyEvidence.validation.artifacts),
      ];
      const manifestPath = `${releaseCandidateDirectory}/manifest.md`;
      const storePacketPath = `${releaseCandidateDirectory}/store-review-packet.md`;
      const signoffPath = `${releaseCandidateDirectory}/signoff.md`;
      const crossBinding = auditIosReleaseCandidateCrossBinding({
        releaseCandidateDirectory,
        references: candidateReferences,
        manifestSource: read(manifestPath),
        storePacketSource: read(storePacketPath),
        signoffSource: read(signoffPath),
        sourceGitSha,
        expectedEasBuildId,
        reviewedBuildEnvironment: reviewedIosBuildEnvironment,
        signedOffBy: env.PHASE9_SIGNED_OFF_BY,
        validation: iosArchivePrivacyEvidence.validation,
      });
      for (const error of crossBinding.errors) {
        block(errors, false, `iOS release-candidate cross-binding: ${error}`);
      }

      iosArchivePrivacyEvidenceIndexValidated = releaseCandidateGitValid && crossBinding.validated;
      artifacts.PHASE9_IOS_ARTIFACT = {
        format: archive.format,
        path: archive.file.path,
        sha256: archive.file.sha256,
        sizeBytes: archive.file.sizeBytes,
      };
      artifacts.PHASE9_IOS_EAS_BUILD_LOG = {
        easBuildId: validatedProvenance.easBuildId,
        easGitCommitSha: validatedProvenance.easGitCommitSha,
        path: validatedProvenance.easBuildLog.path,
        sha256: validatedProvenance.easBuildLog.sha256,
        sizeBytes: validatedProvenance.easBuildLog.sizeBytes,
      };
    } catch (error) {
      const detail =
        error instanceof IosArchivePrivacyEvidenceError
          ? `${error.code} at ${error.path}`
          : 'unexpected validator failure';
      block(errors, false, `iOS archive privacy evidence is invalid (${detail}).`);
    }
  }
} else {
  warn(
    warnings,
    false,
    'Exact iOS archive evidence not supplied: set PHASE9_IOS_ARCHIVE_PRIVACY_EVIDENCE_PATH to the completed RC JSON.',
  );
}

for (const [key, label] of androidReleaseRequired
  ? [['PHASE9_ANDROID_ARTIFACT', 'Android artifact']]
  : []) {
  const path = env[key];
  if (path && exists(path)) artifacts[key] = { path, sha256: hash(path) };
  else warn(warnings, false, `${label} not supplied for hashing: set ${key}=path.`);
}

warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_IOS_TESTFLIGHT_PASS),
  'Missing TestFlight evidence: PHASE9_IOS_TESTFLIGHT_PASS=true.',
);
if (androidReleaseRequired) {
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE9_ANDROID_CLOSED_TEST_PASS),
    'Missing Play internal/closed testing evidence: PHASE9_ANDROID_CLOSED_TEST_PASS=true.',
  );
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE9_ANDROID_TARGET_API_PASS),
    'Missing Android target API proof from built artifact: PHASE9_ANDROID_TARGET_API_PASS=true.',
  );
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE9_ANDROID_16KB_PASS),
    'Missing Android 16 KB page-size proof: PHASE9_ANDROID_16KB_PASS=true.',
  );
}
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_IOS_PRIVACY_REPORT_PASS),
  'Missing iOS privacy-report reviewer metadata flag: PHASE9_IOS_PRIVACY_REPORT_PASS=true. This flag is not archive evidence.',
);
warn(
  warnings,
  iosArchivePrivacyEvidenceIndexValidated,
  'A hash-bound, named-reviewed production archive evidence index remains required: archive, aggregate privacy report PDF, manifest ledger, required-reason APIs, SDK signatures, entitlements, symbols, binary processing, observed traffic, and App Privacy answers. Index validation proves archive-container integrity, release-identity binding, file binding, and matching review metadata; it does not prove opaque report truth, Apple trust, legal compliance, or App Store acceptance.',
);
warn(
  warnings,
  evidenceFlagEnabled(env.PHASE9_APP_STORE_PACKET_PASS),
  'Missing App Store review packet evidence: PHASE9_APP_STORE_PACKET_PASS=true.',
);
if (androidReleaseRequired) {
  warn(
    warnings,
    evidenceFlagEnabled(env.PHASE9_PLAY_PACKET_PASS),
    'Missing Google Play review packet evidence: PHASE9_PLAY_PACKET_PASS=true.',
  );
}

const inspectionOutput = `${JSON.stringify(
  {
    generatedAt: new Date().toISOString(),
    launchContract: launchContractSnapshot(launchContract),
    platformStatus: {
      ios: platformRequirementStatus('ios', launchContract),
      android: platformRequirementStatus('android', launchContract),
    },
    app: {
      name: app.name,
      slug: app.slug,
      version: app.version,
      runtimeVersion: app.runtimeVersion,
      scheme: app.scheme,
      iosBundleIdentifier: app.ios?.bundleIdentifier,
      androidPackage: app.android?.package,
      androidAllowBackup: app.android?.allowBackup ?? true,
      androidPermissions: [...androidPermissions],
    },
    easBuildProfiles: Object.fromEntries(
      variants.map((variant) => [
        variant,
        {
          channel: eas.build?.[variant]?.channel ?? null,
          iosImage: eas.build?.[variant]?.ios?.image ?? null,
          distribution: eas.build?.[variant]?.distribution ?? null,
          developmentClient: eas.build?.[variant]?.developmentClient === true,
          appVariant: eas.build?.[variant]?.env?.APP_VARIANT ?? null,
          appEnvironment: eas.build?.[variant]?.env?.EXPO_PUBLIC_APP_ENV ?? null,
        },
      ]),
    ),
    reviewedIosBuildEnvironment,
    resolvedVariants: Object.fromEntries(
      variants.map((variant) => [
        variant,
        variantConfigs[variant]
          ? {
              name: variantConfigs[variant].name,
              scheme: variantConfigs[variant].scheme,
              iosBundleIdentifier: variantConfigs[variant].ios?.bundleIdentifier,
              androidPackage: variantConfigs[variant].android?.package,
              androidAllowBackup: variantConfigs[variant].android?.allowBackup ?? true,
              appVariant: variantConfigs[variant].extra?.appVariant,
              appEnvironment: variantConfigs[variant].extra?.appEnvironment,
            }
          : {
              error: variantResults[variant].error,
            },
      ]),
    ),
    artifacts,
    iosArchivePrivacyEvidence,
    iosPrivacySourceAudit: iosPrivacySourceAudit
      ? {
          status: iosPrivacySourceAudit.status,
          claims: iosPrivacySourceAudit.claims,
          scope: iosPrivacySourceAudit.scope,
          summary: iosPrivacySourceAudit.summary,
          inputs: iosPrivacySourceAudit.inputs,
          ledgerHashes: iosPrivacySourceAudit.ledgerHashes,
          archiveReviewerMetadataFlag: evidenceFlagEnabled(env.PHASE9_IOS_PRIVACY_REPORT_PASS),
          archiveEvidenceIndexValidated: iosArchivePrivacyEvidenceIndexValidated,
          archiveCodeSignatureCryptographicallyVerified: false,
          archiveContainerIntegrityMachineValidated:
            iosArchivePrivacyEvidence?.validation.archive.containerIntegrity ?? false,
          provisioningCmsSignatureTrusted: false,
        }
      : null,
    blockers: errors,
    warnings,
  },
  null,
  2,
)}\n`;

if (!checkOnly) {
  write('docs/phase-9/generated/store-build-inspection.json', inspectionOutput);
}

printResult('Phase 9 store build inspection', errors, warnings);
