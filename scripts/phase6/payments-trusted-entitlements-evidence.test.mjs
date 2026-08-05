import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  auditRevenueCatTrustedEntitlementsEvidence,
  sha256RevenueCatAppUserId,
  trustedEntitlementsModeFromRevenueCatSource,
  trustedEntitlementsSourceDriftAllowed,
} from './payments-trusted-entitlements-evidence.mjs';

const NOW_MS = Date.parse('2026-08-04T12:00:00.000Z');
const APP_ID = 'appProductionIos2026';
const BUNDLE_ID = 'com.routinekind.app';
const BUILD_NUMBER = '104';
const SOURCE_GIT_SHA = 'a'.repeat(40);
const PACKAGE_VERSION = '10.4.1';
const ENTITLEMENT_ID = 'pro';
const ANNUAL_PRODUCT_ID = 'routinekind.pro.annual';
const MONTHLY_PRODUCT_ID = 'routinekind.pro.monthly';
const SIGNED_OFF_BY = 'Tas Mohammed';
const TRUSTED_ENTITLEMENTS_SOURCE = `
const Purchases = await loadPurchases();
Purchases.configure({
  apiKey,
  entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
});
`;

function artifactBytes(environment, operation) {
  return Buffer.from(`redacted ${environment} ${operation} RevenueCat output\n`, 'utf8');
}

function observation(environment, operation, observedAt, appUserId, productId = ANNUAL_PRODUCT_ID) {
  const bytes = artifactBytes(environment, operation);
  return {
    environment,
    operation,
    appUserIdSha256: sha256RevenueCatAppUserId(appUserId),
    artifactPath: `docs/phase-6/revenuecat-trusted-entitlements-artifacts/test-release/${environment}-${operation}.txt`,
    artifactSha256: createHash('sha256').update(bytes).digest('hex'),
    productId,
    entitlementId: ENTITLEMENT_ID,
    verificationResult: operation === 'purchase' ? 'VERIFIED' : 'VERIFIED_ON_DEVICE',
    isActive: true,
    observedAt,
  };
}

function validDocument() {
  return {
    schemaVersion: 2,
    status: 'complete',
    provider: 'revenuecat',
    environment: 'production',
    redacted: true,
    app: {
      platform: 'ios',
      revenueCatAppId: APP_ID,
      bundleIdentifier: BUNDLE_ID,
      buildNumber: BUILD_NUMBER,
      sourceGitSha: SOURCE_GIT_SHA,
      reactNativePurchasesVersion: PACKAGE_VERSION,
      trustedEntitlementsMode: 'INFORMATIONAL',
    },
    entitlementId: ENTITLEMENT_ID,
    productIds: {
      annual: ANNUAL_PRODUCT_ID,
      monthly: MONTHLY_PRODUCT_ID,
    },
    observations: {
      sandbox: {
        purchase: observation('sandbox', 'purchase', '2026-08-03T10:00:00.000Z', 'sandbox-user'),
        restore: observation('sandbox', 'restore', '2026-08-03T10:05:00.000Z', 'sandbox-user'),
      },
      testFlight: {
        purchase: observation(
          'testflight',
          'purchase',
          '2026-08-04T09:00:00.000Z',
          'testflight-user',
        ),
        restore: observation(
          'testflight',
          'restore',
          '2026-08-04T09:05:00.000Z',
          'testflight-user',
        ),
      },
    },
    reviewedAt: '2026-08-04T11:00:00.000Z',
    reviewedBy: SIGNED_OFF_BY,
  };
}

function createRoot(prefix = 'routinekind-trusted-entitlements-') {
  const root = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(root, 'docs', 'phase-6'), { recursive: true });
  return root;
}

function withEvidenceBytes(bytes, callback) {
  const root = createRoot();
  const evidencePath = 'docs/phase-6/revenuecat-trusted-entitlements-evidence.test-release.json';
  const absolutePath = join(root, evidencePath);
  writeFileSync(absolutePath, bytes);
  try {
    return callback({ root, evidencePath, absolutePath });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function withEvidence(document, callback) {
  const root = createRoot();
  const evidencePath = 'docs/phase-6/revenuecat-trusted-entitlements-evidence.test-release.json';
  const absolutePath = join(root, evidencePath);
  for (const group of Object.values(document.observations ?? {})) {
    if (!group || typeof group !== 'object') continue;
    for (const item of Object.values(group)) {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.artifactPath !== 'string' ||
        !item.artifactPath.startsWith(
          'docs/phase-6/revenuecat-trusted-entitlements-artifacts/test-release/',
        )
      ) {
        continue;
      }
      const path = join(root, item.artifactPath);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, artifactBytes(item.environment, item.operation));
    }
  }
  writeFileSync(absolutePath, `${JSON.stringify(document, null, 2)}\n`);
  try {
    return callback({ root, evidencePath, absolutePath });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function audit(root, evidencePath, overrides = {}) {
  return auditRevenueCatTrustedEntitlementsEvidence({
    root,
    evidencePath,
    nowMs: NOW_MS,
    revenueCatAppId: APP_ID,
    bundleIdentifier: BUNDLE_ID,
    buildNumber: BUILD_NUMBER,
    sourceGitSha: SOURCE_GIT_SHA,
    sourceGitCommitVerified: true,
    reactNativePurchasesVersion: PACKAGE_VERSION,
    trustedEntitlementsSource: TRUSTED_ENTITLEMENTS_SOURCE,
    entitlementId: ENTITLEMENT_ID,
    annualProductId: ANNUAL_PRODUCT_ID,
    monthlyProductId: MONTHLY_PRODUCT_ID,
    signedOffBy: SIGNED_OFF_BY,
    ...overrides,
  });
}

test('accepts canonical complete evidence cross-bound to the exact release inputs', () => {
  withEvidence(validDocument(), ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.match(result.artifactSha256, /^[0-9a-f]{64}$/u);
    assert.equal(result.revenueCatAppId, APP_ID);
    assert.equal(result.bundleIdentifier, BUNDLE_ID);
    assert.equal(result.buildNumber, BUILD_NUMBER);
    assert.equal(result.sourceGitSha, SOURCE_GIT_SHA);
    assert.equal(result.trustedEntitlementsMode, 'INFORMATIONAL');
    assert.equal(result.observationArtifacts.length, 4);
    assert.equal(result.reviewedBy, SIGNED_OFF_BY);
  });
});

test('hashes bounded app-user IDs without retaining the identifier', () => {
  const identifier = '$RCAnonymousID:private-user';
  const digest = sha256RevenueCatAppUserId(identifier);
  assert.equal(digest, createHash('sha256').update(identifier).digest('hex'));
  assert.equal(digest.includes(identifier), false);
  assert.equal(sha256RevenueCatAppUserId(' bad '), '');
  assert.equal(sha256RevenueCatAppUserId('bad\u0000value'), '');
});

test('derives INFORMATIONAL only from one direct non-overridable Purchases.configure call', () => {
  assert.equal(
    trustedEntitlementsModeFromRevenueCatSource(TRUSTED_ENTITLEMENTS_SOURCE),
    'INFORMATIONAL',
  );
  for (const source of [
    '// entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL',
    'Purchases.configure({ entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.DISABLED });',
    'Purchases.configure({ entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL, ...override });',
    `${TRUSTED_ENTITLEMENTS_SOURCE}\n${TRUSTED_ENTITLEMENTS_SOURCE}`,
  ]) {
    assert.equal(trustedEntitlementsModeFromRevenueCatSource(source), '');
  }
});

test('allows only additive or modified governed evidence paths after the reviewed source commit', () => {
  const allowed =
    [
      'A',
      'docs/phase-6/revenuecat-trusted-entitlements-evidence.release-104.json',
      'A',
      'docs/phase-6/revenuecat-trusted-entitlements-artifacts/release-104/sandbox-purchase.txt',
      'M',
      'docs/phase-6/generated/payments-qa-packet.json',
    ].join('\0') + '\0';
  assert.equal(trustedEntitlementsSourceDriftAllowed(''), true);
  assert.equal(trustedEntitlementsSourceDriftAllowed(allowed), true);
  for (const drift of [
    'M\0apps/mobile/src/lib/iap/revenuecat.ts\0',
    'M\0docs/phase-6/payments-runbook.md\0',
    'D\0docs/phase-6/revenuecat-trusted-entitlements-evidence.release-104.json\0',
    'R100\0old.txt\0new.txt\0',
    'A\0docs/phase-6/revenuecat-trusted-entitlements-evidence.release-104.json',
  ]) {
    assert.equal(trustedEntitlementsSourceDriftAllowed(drift), false);
  }
});

test('rejects missing, absolute, traversing, backslash, and noncanonical evidence paths', () => {
  for (const evidencePath of [
    '',
    resolve('docs/phase-6/evidence.json'),
    '../evidence.json',
    'docs\\phase-6\\revenuecat-trusted-entitlements-evidence.release.json',
    'docs/phase-6/other.json',
  ]) {
    const result = audit('C:/repo', evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /evidence path|Missing/u);
  }
});

test('rejects empty and oversized evidence artifacts', () => {
  withEvidenceBytes(Buffer.alloc(0), ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /1\.\.65536 bytes/u);
  });
  withEvidenceBytes(Buffer.alloc(65_537, 0x20), ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /1\.\.65536 bytes/u);
  });
});

test('rejects symlinks instead of following governed evidence aliases', () => {
  const root = createRoot();
  const target = join(root, 'docs', 'phase-6', 'target.json');
  const junctionTarget = join(root, 'junction-target');
  const evidencePath = 'docs/phase-6/revenuecat-trusted-entitlements-evidence.symlink-test.json';
  const link = join(root, evidencePath);
  writeFileSync(target, `${JSON.stringify(validDocument(), null, 2)}\n`);
  try {
    try {
      symlinkSync(target, link, 'file');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EPERM') {
        mkdirSync(junctionTarget);
        symlinkSync(junctionTarget, link, 'junction');
      } else {
        throw error;
      }
    }
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /direct regular non-symlink file/u);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('rejects invalid UTF-8, noncanonical JSON, and duplicate keys', () => {
  withEvidenceBytes(Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x7d]), ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /valid UTF-8 JSON/u);
  });

  const compact = Buffer.from(JSON.stringify(validDocument()), 'utf8');
  withEvidenceBytes(compact, ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /canonical duplicate-free JSON/u);
  });

  const canonical = `${JSON.stringify(validDocument(), null, 2)}\n`;
  const duplicate = canonical.replace(
    `  "reviewedBy": "${SIGNED_OFF_BY}"`,
    `  "reviewedBy": "Overwritten Reviewer",\n  "reviewedBy": "${SIGNED_OFF_BY}"`,
  );
  withEvidenceBytes(Buffer.from(duplicate, 'utf8'), ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /canonical duplicate-free JSON/u);
  });
});

test('rejects unknown keys at every governed schema level', () => {
  for (const mutate of [
    (document) => {
      document.extra = true;
    },
    (document) => {
      document.app.extra = true;
    },
    (document) => {
      document.productIds.extra = 'value';
    },
    (document) => {
      document.observations.extra = {};
    },
    (document) => {
      document.observations.sandbox.extra = {};
    },
    (document) => {
      document.observations.sandbox.purchase.extra = true;
    },
  ]) {
    const document = validDocument();
    mutate(document);
    withEvidence(document, ({ root, evidencePath }) => {
      const result = audit(root, evidencePath);
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /schema|purchase and restore/u);
    });
  }
});

test('returns schema errors instead of throwing on malformed nested values', () => {
  for (const mutate of [
    (document) => {
      document.app = null;
    },
    (document) => {
      document.productIds = null;
    },
    (document) => {
      document.observations = null;
    },
    (document) => {
      document.observations.sandbox = null;
    },
    (document) => {
      document.observations.sandbox.purchase = null;
    },
  ]) {
    const document = validDocument();
    mutate(document);
    withEvidence(document, ({ root, evidencePath }) => {
      const result = audit(root, evidencePath);
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), /schema|purchase and restore/u);
    });
  }
});

test('rejects incomplete status, unredacted records, non-production identity, and non-informational mode', () => {
  const document = validDocument();
  document.status = 'template';
  document.redacted = false;
  document.environment = 'sandbox';
  document.app.platform = 'android';
  document.app.trustedEntitlementsMode = 'DISABLED';
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath, {
      trustedEntitlementsSource:
        'Purchases.configure({ entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.DISABLED });',
    });
    assert.equal(result.valid, false);
    const errors = result.errors.join('\n');
    assert.match(errors, /schemaVersion 2, complete, redacted/u);
    assert.match(errors, /INFORMATIONAL/u);
    assert.match(errors, /platform must be ios/u);
  });
});

test('cross-binds app, bundle, build, source Git SHA, package version, IDs, and reviewer', () => {
  const document = validDocument();
  document.app.revenueCatAppId = 'appDifferentProduction';
  document.app.bundleIdentifier = 'com.different.production';
  document.app.buildNumber = '105';
  document.app.sourceGitSha = 'b'.repeat(40);
  document.app.reactNativePurchasesVersion = '10.4.2';
  document.entitlementId = 'pro_other';
  document.productIds.annual = 'routinekind.pro.otherannual';
  document.productIds.monthly = 'routinekind.pro.othermonthly';
  document.reviewedBy = 'Different Reviewer';
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    const errors = result.errors.join('\n');
    for (const pattern of [
      /production app ID/u,
      /production bundle ID/u,
      /production build/u,
      /sourceGitSha/u,
      /exact package version/u,
      /production entitlement ID/u,
      /annual product ID/u,
      /monthly product ID/u,
      /configured named reviewer/u,
    ]) {
      assert.match(errors, pattern);
    }
  });
});

test('requires separate sandbox and TestFlight purchase/restore verified active observations', () => {
  const document = validDocument();
  document.observations.sandbox.purchase.verificationResult = 'NOT_REQUESTED';
  document.observations.sandbox.restore.appUserIdSha256 = '0'.repeat(64);
  document.observations.testFlight.purchase.isActive = false;
  document.observations.testFlight.restore.environment = 'sandbox';
  document.observations.testFlight.restore.operation = 'purchase';
  document.observations.testFlight.restore.entitlementId = 'other';
  document.observations.testFlight.restore.productId = 'other.product';
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    const errors = result.errors.join('\n');
    assert.match(errors, /VERIFIED or VERIFIED_ON_DEVICE/u);
    assert.match(errors, /non-placeholder lowercase SHA-256/u);
    assert.match(errors, /active entitlement/u);
    assert.match(errors, /required environment and operation/u);
    assert.match(errors, /configured entitlement ID/u);
    assert.match(errors, /configured production product ID/u);
  });
});

test('requires each purchase/restore pair to bind the same app-user ID hash', () => {
  const document = validDocument();
  document.observations.sandbox.restore.appUserIdSha256 =
    sha256RevenueCatAppUserId('different-sandbox-user');
  withEvidence(document, ({ root, evidencePath }) => {
    const result = audit(root, evidencePath);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /same app-user ID hash/u);
  });
});

test('requires four unique direct retained observation artifacts with matching SHA-256 bytes', () => {
  const missing = validDocument();
  missing.observations.sandbox.purchase.artifactPath =
    'docs/phase-6/revenuecat-trusted-entitlements-artifacts/test-release/missing.txt';
  withEvidence(missing, ({ root, evidencePath }) => {
    rmSync(resolve(root, missing.observations.sandbox.purchase.artifactPath), { force: true });
    assert.match(audit(root, evidencePath).errors.join('\n'), /observation artifact is missing/u);
  });

  const mismatched = validDocument();
  mismatched.observations.testFlight.purchase.artifactSha256 = 'b'.repeat(64);
  withEvidence(mismatched, ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /SHA-256 does not match/u);
  });

  const duplicate = validDocument();
  duplicate.observations.testFlight.restore.artifactPath =
    duplicate.observations.testFlight.purchase.artifactPath;
  duplicate.observations.testFlight.restore.artifactSha256 =
    duplicate.observations.testFlight.purchase.artifactSha256;
  withEvidence(duplicate, ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /separate artifact path/u);
  });

  const traversal = validDocument();
  traversal.observations.sandbox.restore.artifactPath = '../outside.txt';
  withEvidence(traversal, ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /artifactPath must be/u);
  });
});

test('rejects secret-like, control, placeholder, and invalid UTF-8 text artifact bytes', () => {
  for (const [bytes, pattern] of [
    [Buffer.from('Authorization: Bearer abcdefghijklmnop\n'), /secret-like material/u],
    [Buffer.from('redacted\u0000capture'), /control characters/u],
    [Buffer.from('REPLACE_WITH_CAPTURE\n'), /placeholder material/u],
    [Buffer.from([0xc3, 0x28]), /valid UTF-8/u],
  ]) {
    const document = validDocument();
    const item = document.observations.sandbox.purchase;
    item.artifactSha256 = createHash('sha256').update(bytes).digest('hex');
    withEvidence(document, ({ root, evidencePath }) => {
      writeFileSync(resolve(root, item.artifactPath), bytes);
      const result = audit(root, evidencePath);
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), pattern);
      assert.equal(JSON.stringify(result).includes(bytes.toString('utf8')), false);
    });
  }
});

test('rejects unverified source commits and source without informational configuration', () => {
  withEvidence(validDocument(), ({ root, evidencePath }) => {
    const unverified = audit(root, evidencePath, { sourceGitCommitVerified: false });
    assert.match(unverified.errors.join('\n'), /verified immutable reviewed source commit/u);
    const disabled = audit(root, evidencePath, {
      trustedEntitlementsSource:
        'Purchases.configure({ entitlementVerificationMode: Purchases.ENTITLEMENT_VERIFICATION_MODE.DISABLED });',
    });
    assert.match(disabled.errors.join('\n'), /derived from the reviewed source as INFORMATIONAL/u);
  });
});

test('rejects stale, future, post-review, and out-of-order timestamps', () => {
  const stale = validDocument();
  stale.observations.testFlight.purchase.observedAt = new Date(
    NOW_MS - 30 * 24 * 60 * 60 * 1000 - 1,
  ).toISOString();
  stale.observations.testFlight.restore.observedAt = new Date(NOW_MS + 1).toISOString();
  stale.observations.sandbox.restore.observedAt = '2026-08-03T09:59:00.000Z';
  stale.reviewedAt = '2026-08-04T08:00:00.000Z';
  withEvidence(stale, ({ root, evidencePath }) => {
    const errors = audit(root, evidencePath).errors.join('\n');
    assert.match(errors, /older than the 30-day evidence window/u);
    assert.match(errors, /must not be in the future/u);
    assert.match(errors, /restore observation must be later/u);
    assert.match(errors, /must not be later than reviewedAt/u);
  });

  const staleReview = validDocument();
  staleReview.reviewedAt = new Date(NOW_MS - 30 * 24 * 60 * 60 * 1000 - 1).toISOString();
  withEvidence(staleReview, ({ root, evidencePath }) => {
    assert.match(audit(root, evidencePath).errors.join('\n'), /older than the 30-day/u);
  });
});

test('rejects secret-like, control-character, and placeholder values without echoing secrets', () => {
  for (const [field, value, pattern] of [
    ['reviewedBy', 'sk_liveRevenueCatSecret123456', /secret-like material/u],
    ['reviewedBy', 'Reviewer\u0000Name', /control characters/u],
    ['reviewedBy', 'REPLACE_WITH_REVIEWER', /placeholder values/u],
  ]) {
    const document = validDocument();
    document[field] = value;
    withEvidence(document, ({ root, evidencePath }) => {
      const result = audit(root, evidencePath, { signedOffBy: value });
      assert.equal(result.valid, false);
      assert.match(result.errors.join('\n'), pattern);
      assert.equal(JSON.stringify(result).includes(value), false);
    });
  }
});

test('keeps the committed template incomplete, invalid as evidence, and free of secret material', () => {
  const root = resolve(import.meta.dirname, '../..');
  const evidencePath = 'docs/phase-6/revenuecat-trusted-entitlements-evidence.template.json';
  const raw = readFileSync(join(root, evidencePath), 'utf8');
  const template = JSON.parse(raw);
  assert.equal(template.status, 'template');
  assert.equal(template.redacted, true);
  assert.doesNotMatch(
    raw,
    /(?:-----BEGIN|\bbearer\s+|(?:sk|pk|whsec|rcb)_[A-Za-z0-9_-]{8,}|\beyJ[A-Za-z0-9_-]{8,}\.)/iu,
  );
  const result = audit(root, evidencePath);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /complete|placeholder/u);
});

test('rejects malformed audit input', () => {
  assert.throws(
    () =>
      auditRevenueCatTrustedEntitlementsEvidence({
        root: 'C:/repo',
        evidencePath: '',
        nowMs: NOW_MS,
        revenueCatAppId: APP_ID,
        bundleIdentifier: BUNDLE_ID,
        buildNumber: BUILD_NUMBER,
        sourceGitSha: SOURCE_GIT_SHA,
        sourceGitCommitVerified: true,
        reactNativePurchasesVersion: PACKAGE_VERSION,
        trustedEntitlementsSource: TRUSTED_ENTITLEMENTS_SOURCE,
        entitlementId: ENTITLEMENT_ID,
        annualProductId: ANNUAL_PRODUCT_ID,
        monthlyProductId: MONTHLY_PRODUCT_ID,
        signedOffBy: SIGNED_OFF_BY,
        extra: true,
      }),
    TypeError,
  );
});
