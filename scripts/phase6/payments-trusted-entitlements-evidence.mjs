import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import ts from 'typescript';

const MAX_EVIDENCE_BYTES = 65_536;
const MAX_OBSERVATION_ARTIFACT_BYTES = 16 * 1024 * 1024;
const MAX_EVIDENCE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const EVIDENCE_PATH_PATTERN =
  /^docs\/phase-6\/revenuecat-trusted-entitlements-evidence\.[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.json$/u;
const OBSERVATION_ARTIFACT_PATH_PATTERN =
  /^docs\/phase-6\/revenuecat-trusted-entitlements-artifacts\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(?:json|log|txt|png|jpe?g|webp)$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const BUILD_NUMBER_PATTERN = /^[1-9]\d{0,17}$/u;
const PACKAGE_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/u;
const REVENUECAT_APP_ID_PATTERN = /^app[A-Za-z0-9_-]{5,252}$/u;
const BUNDLE_IDENTIFIER_PATTERN =
  /^(?=.{3,255}$)[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/u;
const PROVIDER_ID_PATTERN = /^(?=.{1,255}$)[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const NON_PRODUCTION_ID_PATTERN =
  /(?:^|[._-])(?:dev|development|staging|sandbox|test)(?:$|[._-])/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const ARTIFACT_CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const TEXT_OBSERVATION_ARTIFACT_PATTERN = /\.(?:json|log|txt)$/u;
const PLACEHOLDER_PATTERN =
  /(?:replace[_ -]?with|placeholder|change[_ -]?me|\btbd\b|\btodo\b|\bpending\b|\bunknown\b|your[_ -]|example\.com|<{1,2}[^>]+>{1,2}|_{2,}blocked|x{5,})/iu;
const SECRET_LIKE_PATTERN =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bbearer\s+[A-Za-z0-9._~+/=-]{8,}|(?:^|[^A-Za-z0-9])(?:sk|pk|whsec|rcb)_[A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/iu;

const INPUT_KEYS = Object.freeze([
  'annualProductId',
  'buildNumber',
  'bundleIdentifier',
  'entitlementId',
  'evidencePath',
  'sourceGitCommitVerified',
  'sourceGitSha',
  'monthlyProductId',
  'nowMs',
  'reactNativePurchasesVersion',
  'revenueCatAppId',
  'root',
  'signedOffBy',
  'trustedEntitlementsSource',
]);
const TOP_LEVEL_KEYS = Object.freeze([
  'app',
  'entitlementId',
  'environment',
  'observations',
  'productIds',
  'provider',
  'redacted',
  'reviewedAt',
  'reviewedBy',
  'schemaVersion',
  'status',
]);
const APP_KEYS = Object.freeze([
  'buildNumber',
  'bundleIdentifier',
  'sourceGitSha',
  'platform',
  'reactNativePurchasesVersion',
  'revenueCatAppId',
  'trustedEntitlementsMode',
]);
const PRODUCT_KEYS = Object.freeze(['annual', 'monthly']);
const OBSERVATION_GROUP_KEYS = Object.freeze(['sandbox', 'testFlight']);
const LIFECYCLE_KEYS = Object.freeze(['purchase', 'restore']);
const OBSERVATION_KEYS = Object.freeze([
  'appUserIdSha256',
  'artifactPath',
  'artifactSha256',
  'entitlementId',
  'environment',
  'isActive',
  'observedAt',
  'operation',
  'productId',
  'verificationResult',
]);

function exactKeys(value, expectedKeys) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\n') === [...expectedKeys].sort().join('\n')
  );
}

function canonicalIsoTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function samePath(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function safeProviderId(value) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    PROVIDER_ID_PATTERN.test(value) &&
    !NON_PRODUCTION_ID_PATTERN.test(value) &&
    !PLACEHOLDER_PATTERN.test(value) &&
    !SECRET_LIKE_PATTERN.test(value)
  );
}

function safeReviewer(value) {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 2 &&
    value.length <= 120 &&
    /\p{L}/u.test(value) &&
    /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'’-]*$/u.test(value) &&
    !CONTROL_CHARACTER_PATTERN.test(value) &&
    !PLACEHOLDER_PATTERN.test(value) &&
    !SECRET_LIKE_PATTERN.test(value)
  );
}

function collectStrings(value, output) {
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, output);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      output.push(key);
      collectStrings(entry, output);
    }
  }
}

function addTimestampErrors(errors, label, value, nowMs) {
  if (!canonicalIsoTimestamp(value)) {
    errors.push(`${label} must be a canonical UTC timestamp.`);
    return null;
  }
  const timestampMs = Date.parse(value);
  if (timestampMs > nowMs) errors.push(`${label} must not be in the future.`);
  if (timestampMs < nowMs - MAX_EVIDENCE_AGE_MS) {
    errors.push(`${label} is older than the 30-day evidence window.`);
  }
  return timestampMs;
}

function freezeResult(result) {
  Object.freeze(result.errors);
  Object.freeze(result.observationArtifacts);
  return Object.freeze(result);
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return '';
}

function informationalModeExpression(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'INFORMATIONAL' &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'ENTITLEMENT_VERIFICATION_MODE' &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'Purchases'
  );
}

/**
 * Derive the configured Trusted Entitlements mode from the exact reviewed
 * RevenueCat source. The source must contain one direct Purchases.configure
 * object with one non-overridable informational-mode property.
 */
export function trustedEntitlementsModeFromRevenueCatSource(source) {
  if (typeof source !== 'string' || source.length < 1 || source.length > 2_000_000) return '';
  const file = ts.createSourceFile(
    'revenuecat.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (file.parseDiagnostics.length > 0) return '';

  let configureCalls = 0;
  let informationalCalls = 0;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Purchases' &&
      node.expression.name.text === 'configure'
    ) {
      configureCalls += 1;
      const options = node.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        const modeProperties = options.properties.filter(
          (property) =>
            ts.isPropertyAssignment(property) &&
            propertyName(property.name) === 'entitlementVerificationMode',
        );
        const canBeOverridden = options.properties.some(
          (property) => ts.isSpreadAssignment(property) || ts.isComputedPropertyName(property.name),
        );
        if (
          !canBeOverridden &&
          modeProperties.length === 1 &&
          informationalModeExpression(modeProperties[0].initializer)
        ) {
          informationalCalls += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return configureCalls === 1 && informationalCalls === 1 ? 'INFORMATIONAL' : '';
}

export function trustedEntitlementsSourceDriftAllowed(nameStatusOutput) {
  if (typeof nameStatusOutput !== 'string') return false;
  if (nameStatusOutput === '') return true;
  if (!nameStatusOutput.endsWith('\0')) return false;
  const fields = nameStatusOutput.slice(0, -1).split('\0');
  if (fields.length % 2 !== 0) return false;
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if (status !== 'A' && status !== 'M') return false;
    if (
      !EVIDENCE_PATH_PATTERN.test(path) &&
      !OBSERVATION_ARTIFACT_PATH_PATTERN.test(path) &&
      path !== 'docs/phase-6/generated/payments-qa-packet.json' &&
      path !== 'docs/phase-6/generated/payments-qa-packet.md'
    ) {
      return false;
    }
  }
  return true;
}

function observationArtifact(input, label, observation, errors) {
  const artifactPath = observation.artifactPath;
  const expectedSha256 = observation.artifactSha256;
  let artifactSha256 = '';
  if (
    typeof artifactPath !== 'string' ||
    artifactPath !== artifactPath.trim() ||
    artifactPath.includes('\\') ||
    !OBSERVATION_ARTIFACT_PATH_PATTERN.test(artifactPath)
  ) {
    errors.push(
      `${label} artifactPath must be one normalized repo-relative governed observation artifact path.`,
    );
    return { label, path: '', sha256: '' };
  }
  if (!SHA256_PATTERN.test(expectedSha256) || /^([0-9a-f])\1{63}$/u.test(expectedSha256)) {
    errors.push(`${label} artifactSha256 must be a non-placeholder lowercase SHA-256 digest.`);
  }

  const absolutePath = resolve(input.root, artifactPath);
  const governedRoot = `${resolve(
    input.root,
    'docs/phase-6/revenuecat-trusted-entitlements-artifacts',
  )}${sep}`;
  const withinGovernedRoot =
    process.platform === 'win32'
      ? absolutePath.toLowerCase().startsWith(governedRoot.toLowerCase())
      : absolutePath.startsWith(governedRoot);
  if (!withinGovernedRoot) {
    errors.push(`${label} observation artifact escapes the governed artifact directory.`);
  } else if (!existsSync(absolutePath)) {
    errors.push(`${label} observation artifact is missing.`);
  } else {
    try {
      const stat = lstatSync(absolutePath);
      const realPath = realpathSync(absolutePath);
      if (stat.isSymbolicLink() || !stat.isFile() || !samePath(realPath, absolutePath)) {
        errors.push(`${label} observation artifact must be one direct regular non-symlink file.`);
      } else if (stat.size < 1 || stat.size > MAX_OBSERVATION_ARTIFACT_BYTES) {
        errors.push(`${label} observation artifact must be 1..16777216 bytes.`);
      } else {
        const bytes = readFileSync(absolutePath);
        if (bytes.length < 1 || bytes.length > MAX_OBSERVATION_ARTIFACT_BYTES) {
          errors.push(`${label} observation artifact must be 1..16777216 bytes.`);
        } else {
          artifactSha256 = createHash('sha256').update(bytes).digest('hex');
          if (artifactSha256 !== expectedSha256) {
            errors.push(`${label} observation artifact SHA-256 does not match its retained bytes.`);
          }
          if (TEXT_OBSERVATION_ARTIFACT_PATTERN.test(artifactPath)) {
            try {
              const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
              if (ARTIFACT_CONTROL_CHARACTER_PATTERN.test(text)) {
                errors.push(`${label} observation artifact contains control characters.`);
              }
              if (SECRET_LIKE_PATTERN.test(text)) {
                errors.push(`${label} observation artifact contains secret-like material.`);
              }
              if (PLACEHOLDER_PATTERN.test(text)) {
                errors.push(`${label} observation artifact contains placeholder material.`);
              }
            } catch {
              errors.push(`${label} text observation artifact must contain valid UTF-8.`);
            }
          }
        }
      }
    } catch {
      errors.push(`${label} observation artifact could not be read safely.`);
    }
  }
  return { label, path: artifactPath, sha256: artifactSha256 };
}

function validateObservation({
  document,
  errors,
  expectedEnvironment,
  expectedOperation,
  input,
  label,
  observation,
}) {
  if (!exactKeys(observation, OBSERVATION_KEYS)) {
    errors.push(`${label} has an invalid or unknown-key observation schema.`);
    return null;
  }

  if (
    observation.environment !== expectedEnvironment ||
    observation.operation !== expectedOperation
  ) {
    errors.push(`${label} does not match its required environment and operation.`);
  }
  if (observation.entitlementId !== input.entitlementId) {
    errors.push(`${label} entitlementId does not match the configured entitlement ID.`);
  }
  const configuredProducts = new Set([input.annualProductId, input.monthlyProductId]);
  if (!configuredProducts.has(observation.productId)) {
    errors.push(`${label} productId does not match a configured production product ID.`);
  }
  if (
    observation.productId !== document.productIds?.annual &&
    observation.productId !== document.productIds?.monthly
  ) {
    errors.push(`${label} productId does not match the evidence product bindings.`);
  }
  if (
    !SHA256_PATTERN.test(observation.appUserIdSha256) ||
    /^([0-9a-f])\1{63}$/u.test(observation.appUserIdSha256)
  ) {
    errors.push(`${label} appUserIdSha256 must be a non-placeholder lowercase SHA-256 digest.`);
  }
  if (
    observation.verificationResult !== 'VERIFIED' &&
    observation.verificationResult !== 'VERIFIED_ON_DEVICE'
  ) {
    errors.push(`${label} must record VERIFIED or VERIFIED_ON_DEVICE.`);
  }
  if (observation.isActive !== true) {
    errors.push(`${label} must record an active entitlement result.`);
  }
  const artifact = observationArtifact(input, label, observation, errors);
  return {
    artifact,
    observedAtMs: addTimestampErrors(
      errors,
      `${label} observedAt`,
      observation.observedAt,
      input.nowMs,
    ),
  };
}

export function sha256RevenueCatAppUserId(value) {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > 1024 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    return '';
  }
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function auditRevenueCatTrustedEntitlementsEvidence(input) {
  if (
    !exactKeys(input, INPUT_KEYS) ||
    typeof input.root !== 'string' ||
    typeof input.evidencePath !== 'string' ||
    !Number.isSafeInteger(input.nowMs) ||
    input.nowMs < 0 ||
    typeof input.revenueCatAppId !== 'string' ||
    typeof input.bundleIdentifier !== 'string' ||
    typeof input.buildNumber !== 'string' ||
    typeof input.sourceGitSha !== 'string' ||
    typeof input.sourceGitCommitVerified !== 'boolean' ||
    typeof input.reactNativePurchasesVersion !== 'string' ||
    typeof input.trustedEntitlementsSource !== 'string' ||
    typeof input.entitlementId !== 'string' ||
    typeof input.annualProductId !== 'string' ||
    typeof input.monthlyProductId !== 'string' ||
    typeof input.signedOffBy !== 'string'
  ) {
    throw new TypeError('RevenueCat Trusted Entitlements evidence audit input is malformed.');
  }

  const errors = [];
  let artifactSha256 = '';
  let decodedText = '';
  let document;
  let normalizedPath = '';
  const observationArtifacts = [];
  const trustedEntitlementsMode = trustedEntitlementsModeFromRevenueCatSource(
    input.trustedEntitlementsSource,
  );

  if (!input.evidencePath) {
    errors.push('Missing RevenueCat Trusted Entitlements evidence path.');
  } else if (
    input.evidencePath !== input.evidencePath.trim() ||
    input.evidencePath.includes('\\') ||
    !EVIDENCE_PATH_PATTERN.test(input.evidencePath)
  ) {
    errors.push(
      'RevenueCat Trusted Entitlements evidence path must be one normalized repo-relative docs/phase-6/revenuecat-trusted-entitlements-evidence.<release>.json path.',
    );
  } else {
    normalizedPath = input.evidencePath;
    const absolutePath = resolve(input.root, normalizedPath);
    const governedRoot = `${resolve(input.root, 'docs/phase-6')}${sep}`;
    const withinGovernedRoot =
      process.platform === 'win32'
        ? absolutePath.toLowerCase().startsWith(governedRoot.toLowerCase())
        : absolutePath.startsWith(governedRoot);
    if (!withinGovernedRoot) {
      errors.push('RevenueCat Trusted Entitlements evidence path escapes docs/phase-6.');
    } else if (!existsSync(absolutePath)) {
      errors.push('RevenueCat Trusted Entitlements evidence artifact is missing.');
    } else {
      try {
        const stat = lstatSync(absolutePath);
        const realPath = realpathSync(absolutePath);
        if (stat.isSymbolicLink() || !stat.isFile() || !samePath(realPath, absolutePath)) {
          errors.push(
            'RevenueCat Trusted Entitlements evidence artifact must be one direct regular non-symlink file.',
          );
        } else if (stat.size < 1 || stat.size > MAX_EVIDENCE_BYTES) {
          errors.push('RevenueCat Trusted Entitlements evidence artifact must be 1..65536 bytes.');
        } else {
          const bytes = readFileSync(absolutePath);
          if (bytes.length < 1 || bytes.length > MAX_EVIDENCE_BYTES) {
            errors.push(
              'RevenueCat Trusted Entitlements evidence artifact must be 1..65536 bytes.',
            );
          } else {
            artifactSha256 = createHash('sha256').update(bytes).digest('hex');
            try {
              decodedText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
              document = JSON.parse(decodedText);
            } catch {
              errors.push(
                'RevenueCat Trusted Entitlements evidence artifact must contain valid UTF-8 JSON.',
              );
            }
          }
        }
      } catch {
        errors.push('RevenueCat Trusted Entitlements evidence artifact could not be read safely.');
      }
    }
  }

  if (document !== undefined) {
    if (decodedText !== `${JSON.stringify(document, null, 2)}\n`) {
      errors.push(
        'RevenueCat Trusted Entitlements evidence must use canonical duplicate-free JSON encoding.',
      );
    }

    const strings = [];
    collectStrings(document, strings);
    if (strings.some((value) => CONTROL_CHARACTER_PATTERN.test(value))) {
      errors.push('RevenueCat Trusted Entitlements evidence contains control characters.');
    }
    if (
      SECRET_LIKE_PATTERN.test(decodedText) ||
      strings.some((value) => SECRET_LIKE_PATTERN.test(value))
    ) {
      errors.push('RevenueCat Trusted Entitlements evidence contains secret-like material.');
    }
    if (strings.some((value) => PLACEHOLDER_PATTERN.test(value))) {
      errors.push('RevenueCat Trusted Entitlements evidence contains placeholder values.');
    }

    if (!exactKeys(document, TOP_LEVEL_KEYS)) {
      errors.push('RevenueCat Trusted Entitlements evidence has an invalid top-level schema.');
    } else {
      if (
        document.schemaVersion !== 2 ||
        document.status !== 'complete' ||
        document.provider !== 'revenuecat' ||
        document.environment !== 'production' ||
        document.redacted !== true
      ) {
        errors.push(
          'RevenueCat Trusted Entitlements evidence must be schemaVersion 2, complete, redacted, and bound to the production RevenueCat environment.',
        );
      }

      if (!exactKeys(document.app, APP_KEYS)) {
        errors.push('RevenueCat Trusted Entitlements evidence has an invalid app schema.');
      } else {
        if (
          !REVENUECAT_APP_ID_PATTERN.test(input.revenueCatAppId) ||
          PLACEHOLDER_PATTERN.test(input.revenueCatAppId) ||
          document.app.revenueCatAppId !== input.revenueCatAppId
        ) {
          errors.push('Evidence revenueCatAppId does not match the configured production app ID.');
        }
        if (
          !BUNDLE_IDENTIFIER_PATTERN.test(input.bundleIdentifier) ||
          NON_PRODUCTION_ID_PATTERN.test(input.bundleIdentifier) ||
          PLACEHOLDER_PATTERN.test(input.bundleIdentifier) ||
          document.app.bundleIdentifier !== input.bundleIdentifier
        ) {
          errors.push('Evidence bundleIdentifier does not match the production bundle ID.');
        }
        if (
          !BUILD_NUMBER_PATTERN.test(input.buildNumber) ||
          document.app.buildNumber !== input.buildNumber
        ) {
          errors.push('Evidence buildNumber does not match the reviewed production build.');
        }
        if (
          !input.sourceGitCommitVerified ||
          !GIT_SHA_PATTERN.test(input.sourceGitSha) ||
          document.app.sourceGitSha !== input.sourceGitSha
        ) {
          errors.push(
            'Evidence sourceGitSha does not match a verified immutable reviewed source commit.',
          );
        }
        if (
          !PACKAGE_VERSION_PATTERN.test(input.reactNativePurchasesVersion) ||
          document.app.reactNativePurchasesVersion !== input.reactNativePurchasesVersion
        ) {
          errors.push(
            'Evidence reactNativePurchasesVersion does not match the configured exact package version.',
          );
        }
        if (
          trustedEntitlementsMode !== 'INFORMATIONAL' ||
          document.app.trustedEntitlementsMode !== trustedEntitlementsMode
        ) {
          errors.push(
            'Trusted Entitlements mode must be derived from the reviewed source as INFORMATIONAL.',
          );
        }
        if (document.app.platform !== 'ios') {
          errors.push('RevenueCat Trusted Entitlements evidence app platform must be ios.');
        }
      }

      if (!safeProviderId(input.entitlementId) || document.entitlementId !== input.entitlementId) {
        errors.push(
          'Evidence entitlementId does not match the configured production entitlement ID.',
        );
      }
      if (!exactKeys(document.productIds, PRODUCT_KEYS)) {
        errors.push('RevenueCat Trusted Entitlements evidence has an invalid productIds schema.');
      } else {
        if (
          !safeProviderId(input.annualProductId) ||
          document.productIds.annual !== input.annualProductId
        ) {
          errors.push('Evidence annual product ID does not match configured production.');
        }
        if (
          !safeProviderId(input.monthlyProductId) ||
          document.productIds.monthly !== input.monthlyProductId
        ) {
          errors.push('Evidence monthly product ID does not match configured production.');
        }
        if (input.annualProductId === input.monthlyProductId) {
          errors.push('Configured annual and monthly product IDs must be distinct.');
        }
      }

      const reviewedAtMs = addTimestampErrors(
        errors,
        'RevenueCat Trusted Entitlements evidence reviewedAt',
        document.reviewedAt,
        input.nowMs,
      );
      if (!safeReviewer(document.reviewedBy) || document.reviewedBy !== input.signedOffBy) {
        errors.push(
          'RevenueCat Trusted Entitlements evidence reviewedBy does not match the configured named reviewer.',
        );
      }

      if (!exactKeys(document.observations, OBSERVATION_GROUP_KEYS)) {
        errors.push('RevenueCat Trusted Entitlements evidence has an invalid observations schema.');
      } else {
        const observedTimes = {};
        for (const [groupKey, expectedEnvironment] of [
          ['sandbox', 'sandbox'],
          ['testFlight', 'testflight'],
        ]) {
          const lifecycle = document.observations[groupKey];
          if (!exactKeys(lifecycle, LIFECYCLE_KEYS)) {
            errors.push(
              `${groupKey} evidence must contain exact purchase and restore observations.`,
            );
            continue;
          }
          for (const operation of LIFECYCLE_KEYS) {
            const label = `${groupKey} ${operation}`;
            const validation = validateObservation({
              document,
              errors,
              expectedEnvironment,
              expectedOperation: operation,
              input,
              label,
              observation: lifecycle[operation],
            });
            observedTimes[label] = validation?.observedAtMs ?? null;
            if (validation?.artifact) observationArtifacts.push(validation.artifact);
          }
          if (
            lifecycle.purchase?.productId !== undefined &&
            lifecycle.restore?.productId !== undefined &&
            lifecycle.purchase.productId !== lifecycle.restore.productId
          ) {
            errors.push(`${groupKey} purchase and restore must bind the same product ID.`);
          }
          if (
            lifecycle.purchase?.appUserIdSha256 !== undefined &&
            lifecycle.restore?.appUserIdSha256 !== undefined &&
            lifecycle.purchase.appUserIdSha256 !== lifecycle.restore.appUserIdSha256
          ) {
            errors.push(`${groupKey} purchase and restore must bind the same app-user ID hash.`);
          }
          const purchaseAt = observedTimes[`${groupKey} purchase`];
          const restoreAt = observedTimes[`${groupKey} restore`];
          if (purchaseAt !== null && restoreAt !== null && restoreAt <= purchaseAt) {
            errors.push(
              `${groupKey} restore observation must be later than its purchase observation.`,
            );
          }
        }
        if (reviewedAtMs !== null) {
          for (const [label, observedAtMs] of Object.entries(observedTimes)) {
            if (observedAtMs !== null && observedAtMs > reviewedAtMs) {
              errors.push(`${label} observation must not be later than reviewedAt.`);
            }
          }
        }
      }
    }
  }

  const artifactPaths = observationArtifacts.map((artifact) => artifact.path).filter(Boolean);
  if (artifactPaths.length > 0 && new Set(artifactPaths).size !== artifactPaths.length) {
    errors.push('Each Trusted Entitlements observation must use a separate artifact path.');
  }

  const reviewedBy =
    safeReviewer(document?.reviewedBy) && document.reviewedBy === input.signedOffBy
      ? document.reviewedBy
      : '';
  return freezeResult({
    valid: errors.length === 0,
    path: normalizedPath,
    artifactSha256,
    observationArtifacts,
    revenueCatAppId:
      REVENUECAT_APP_ID_PATTERN.test(input.revenueCatAppId) &&
      !PLACEHOLDER_PATTERN.test(input.revenueCatAppId) &&
      document?.app?.revenueCatAppId === input.revenueCatAppId
        ? input.revenueCatAppId
        : '',
    bundleIdentifier:
      BUNDLE_IDENTIFIER_PATTERN.test(input.bundleIdentifier) &&
      !NON_PRODUCTION_ID_PATTERN.test(input.bundleIdentifier) &&
      !PLACEHOLDER_PATTERN.test(input.bundleIdentifier) &&
      document?.app?.bundleIdentifier === input.bundleIdentifier
        ? input.bundleIdentifier
        : '',
    buildNumber:
      BUILD_NUMBER_PATTERN.test(input.buildNumber) &&
      document?.app?.buildNumber === input.buildNumber
        ? input.buildNumber
        : '',
    sourceGitSha:
      input.sourceGitCommitVerified &&
      GIT_SHA_PATTERN.test(input.sourceGitSha) &&
      document?.app?.sourceGitSha === input.sourceGitSha
        ? input.sourceGitSha
        : '',
    trustedEntitlementsMode:
      trustedEntitlementsMode === 'INFORMATIONAL' &&
      document?.app?.trustedEntitlementsMode === trustedEntitlementsMode
        ? trustedEntitlementsMode
        : '',
    reviewedAt: canonicalIsoTimestamp(document?.reviewedAt) ? document.reviewedAt : '',
    reviewedBy,
    errors,
  });
}
