#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import {
  auditPay07EntitlementAdmissionSnapshot,
  loadPay07EntitlementAdmissionSnapshot,
  PAY07_SOURCE_PATHS,
} from './entitlement-admission-source-contract.mjs';

const root = resolve(import.meta.dirname, '../..');

function mutate(snapshot, path, change) {
  return Object.freeze({ ...snapshot, [path]: change(snapshot[path]) });
}

function replaceRequired(source, before, after) {
  assert.ok(source.includes(before), `fixture source is missing ${JSON.stringify(before)}`);
  return source.replace(before, after);
}

function assertRejected(snapshot, pattern) {
  assert.match(auditPay07EntitlementAdmissionSnapshot(snapshot).join('\n'), pattern);
}

test('current PAY-07 entitlement-admission source snapshot passes', () => {
  assert.deepEqual(
    auditPay07EntitlementAdmissionSnapshot(loadPay07EntitlementAdmissionSnapshot(root)),
    [],
  );
});

test('missing authority files fail closed', () => {
  const snapshot = { ...loadPay07EntitlementAdmissionSnapshot(root) };
  delete snapshot[PAY07_SOURCE_PATHS.fixtureNative];
  delete snapshot[PAY07_SOURCE_PATHS.successRoute];
  const errors = auditPay07EntitlementAdmissionSnapshot(Object.freeze(snapshot));
  assert.ok(errors.some((error) => /entitlementE2EFixture\.native\.ts: required/u.test(error)));
  assert.ok(errors.some((error) => /paywall\/success\.tsx: required/u.test(error)));
});

test('positive entitlement fixtures are rejected from base and native modules', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  for (const path of [PAY07_SOURCE_PATHS.fixtureBase, PAY07_SOURCE_PATHS.fixtureNative]) {
    assertRejected(
      mutate(snapshot, path, (source) =>
        replaceRequired(
          source,
          'return null;',
          'return process.env.EXPO_PUBLIC_E2E_ENTITLEMENT ? ({ isPro: true } as never) : null;',
        ),
      ),
      /base\/unsupported-platform entitlement fixture must return only|native entitlement fixture must return only|must expose no environment/u,
    );
  }
});

test('web fixture cannot grant outside development or leak into native resolution', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.fixtureWeb, (source) =>
      replaceRequired(
        source,
        "if (env.appEnvironment !== 'development') return null;",
        "if (env.appEnvironment === 'production') return null;",
      ),
    ),
    /positive web entitlement fixture must fail closed outside development/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.useEntitlement, (source) =>
      replaceRequired(
        source,
        "from './entitlementE2EFixture';",
        "from './entitlementE2EFixture.web';",
      ),
    ),
    /extensionless platform resolution|must not force a web or native fixture/u,
  );
});

test('runtime hook cannot regain a direct environment entitlement bypass', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      PAY07_SOURCE_PATHS.useEntitlement,
      (source) =>
        `${source}\nconst localPro = process.env.EXPO_PUBLIC_E2E_ENTITLEMENT === 'pro';\n`,
    ),
    /runtime hook must not implement entitlement fixtures directly|may exist only in the `.web\.ts` module/u,
  );
});

test('unconfigured Supabase cannot mint or persist a local reverse trial', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.store, (source) =>
      replaceRequired(
        source,
        "throw new Error('Reverse trial is unavailable until Supabase is configured.');",
        "return commitAppGrant(context, { tier: 'pro', source: 'app_granted' } as never);",
      ),
    ),
    /must unconditionally throw|must not mint or persist local Pro/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.store, (source) =>
      replaceRequired(
        source,
        'if (!isSupabaseConfigured) {',
        "if (!isSupabaseConfigured && env.appEnvironment !== 'development') {",
      ),
    ),
    /must unconditionally throw when Supabase is unconfigured/u,
  );
});

test('server custom grant authority rejects hosted and bypassed admission', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.serverGrantAdmission, (source) =>
      replaceRequired(
        source,
        "if (appEnvironment !== 'development' || !supabaseUrl) return false;",
        'if (!supabaseUrl) return false;',
      ),
    ),
    /must reject every non-development environment/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.serverGrantAdmission, (source) =>
      replaceRequired(source, "url.protocol === 'http:' &&", "url.protocol === 'https:' &&"),
    ),
    /must require HTTP/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.serverGrantRoute, (source) =>
      replaceRequired(
        source,
        'if (!customProGrantAllowed(appEnvironment, supabaseUrl)) {',
        'if (false) {',
      ),
    ),
    /must return 403|must execute before authentication/u,
  );
});

test('success route cannot default or synthesize a purchase confirmation', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(
        source,
        'const endDate = fmt(state.expiresAt!);',
        'const fallbackDays = 7;\n  const endDate = fmt(state.expiresAt!);',
      ),
    ),
    /must not default trial state or synthesize confirmation dates/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(source, 'const d = new Date(iso);', 'const d = new Date(iso || Date.now());'),
    ),
    /format an exact supplied expiry|must not default trial state or synthesize confirmation dates/u,
  );
});

test('success route requires both current Pro and exact expiry evidence', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successAdmission, (source) =>
      replaceRequired(
        source,
        'if (!state?.isPro || !state.expiresAt || !state.verifiedAt) return null;',
        'if (!state?.isPro && !state.expiresAt && !state.verifiedAt) return null;',
      ),
    ),
    /active, expiry, and verification evidence are required/u,
  );
});

test('success admission rejects pre-mount cache and stale verification', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successAdmission, (source) =>
      replaceRequired(
        source,
        'return Math.max(previousNowMs, observedNowMs);',
        'return observedNowMs;',
      ),
    ),
    /success clock must never move backward/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successAdmission, (source) =>
      replaceRequired(source, '!query.isFetchedAfterMount', 'false'),
    ),
    /cached pre-mount data must block confirmation/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successAdmission, (source) =>
      replaceRequired(
        source,
        'verifiedAtMs < nowMs - SUCCESS_EVIDENCE_MAX_AGE_MS',
        'verifiedAtMs < 0',
      ),
    ),
    /stale verification evidence must block confirmation/u,
  );
});

test('success route forces a fresh exact-owner query after mount', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(source, "useEntitlement({ refetchOnMount: 'always' })", 'useEntitlement()'),
    ),
    /force an exact post-mount entitlement query/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(
        source,
        'const liveNowMs = monotonicSuccessClockMs(nowMs, dataUpdatedAt);',
        'const liveNowMs = nowMs;',
      ),
    ),
    /live wall clock rather than frozen query metadata/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(
        source,
        'const advanced = monotonicSuccessClockMs(current, Date.now());',
        'const advanced = Date.now();',
      ),
    ),
    /earliest evidence\/expiry boundary|app becomes active/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(source, 'Math.max(Date.now(), boundaryMs + 1)', 'Date.now()'),
    ),
    /earliest evidence\/expiry boundary/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successRoute, (source) =>
      replaceRequired(
        source,
        '}, [evidenceBoundaryMs, refetch]);',
        '}, [evidenceBoundaryMs, dataUpdatedAt, refetch]);',
      ),
    ),
    /unchanged authority data must not restart/u,
  );
});

test('success claims separate non-billing grants from exact renewing store evidence', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successPresentation, (source) =>
      replaceRequired(source, "if (state.store === 'promotional') {", 'if (false) {'),
    ),
    /promotions must use non-billing copy/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.successPresentation, (source) =>
      replaceRequired(
        source,
        'state.willRenew === true && BILLING_STORES.has(state.store) && price',
        'price',
      ),
    ),
    /renewal claims require billing-store authority/u,
  );
});

test('app config and EAS profiles reject environment drift', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.appConfig, (source) =>
      replaceRequired(
        source,
        'if (appEnvironment !== variant) {',
        "if (appEnvironment !== variant && variant === 'production') {",
      ),
    ),
    /mismatch must throw/u,
  );

  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.eas, (source) => {
      const eas = JSON.parse(source);
      eas.build.production.env.EXPO_PUBLIC_APP_ENV = 'development';
      return JSON.stringify(eas);
    }),
    /production APP_VARIANT and EXPO_PUBLIC_APP_ENV must be identical/u,
  );
});

test('release JavaScript cannot accept a development public environment label', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.env, (source) =>
      replaceRequired(
        source,
        "if (candidate === 'development' && !isDevRuntime()) return 'production';",
        "if (candidate === 'development' && !isDevRuntime()) return 'development';",
      ),
    ),
    /must not accept a development public environment label/u,
  );
});

test('RevenueCat NOT_REQUESTED cannot become active or legacy-positive evidence', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.revenueCat, (source) =>
      replaceRequired(
        source,
        "throw new Error('REVENUECAT_ENTITLEMENT_VERIFICATION_NOT_REQUESTED');",
        'return null;',
      ),
    ),
    /must reject aggregate NOT_REQUESTED verification/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.store, (source) =>
      replaceRequired(
        source,
        "return { status: 'rejected', reason: 'verification_not_requested' };",
        "return { status: 'evidence', evidence: { kind: 'legacy_positive', provenance: 'revenuecat_not_requested', entitlement: attributed } } as never;",
      ),
    ),
    /must reject NOT_REQUESTED verification|positive legacy provenance/u,
  );
});

test('introductory-offer copy cannot bypass exact per-product eligibility', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.revenueCat, (source) =>
      replaceRequired(
        source,
        'const trialDays = trialEligible ? trialDaysForPackage(pack) : null;',
        'const trialDays = trialDaysForPackage(pack);',
      ),
    ),
    /unknown, ineligible, and failed eligibility checks must suppress trial claims/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.revenueCat, (source) =>
      replaceRequired(
        source,
        'Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE',
        'Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_UNKNOWN',
      ),
    ),
    /exact per-product App Store eligibility/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.revenueCat, (source) =>
      replaceRequired(
        source,
        'trialDays: null,\n    introLabel: null,',
        "trialDays: p.trialDays || null,\n    introLabel: '14 days free',",
      ),
    ),
    /development fallback pricing must not synthesize introductory-offer eligibility/u,
  );
});

test('Phase 6, Phase 9, and launch verification cannot drop PAY-07 contracts', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  for (const parentScript of ['phase6:verify', 'launch:verify']) {
    assertRejected(
      mutate(snapshot, PAY07_SOURCE_PATHS.packageJson, (source) => {
        const pkg = JSON.parse(source);
        pkg.scripts[parentScript] = pkg.scripts[parentScript].replace(
          'npm run pay07:entitlement-admission-source-contract:test && ',
          '',
        );
        return JSON.stringify(pkg);
      }),
      new RegExp(`${parentScript} must run`, 'u'),
    );
  }
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.packageJson, (source) => {
      const pkg = JSON.parse(source);
      pkg.scripts['phase6:subscription-grants-smoke'] = pkg.scripts[
        'phase6:subscription-grants-smoke'
      ].replace('supabase/functions/subscription-grants/customProGrantAdmission.test.ts ', '');
      return JSON.stringify(pkg);
    }),
    /subscription-grants-smoke must run .*customProGrantAdmission\.test\.ts/u,
  );
  for (const parentScript of ['phase6:verify', 'phase9:verify', 'launch:verify']) {
    assertRejected(
      mutate(snapshot, PAY07_SOURCE_PATHS.packageJson, (source) => {
        const pkg = JSON.parse(source);
        pkg.scripts[parentScript] = pkg.scripts[parentScript].replace(
          'npm run phase6:subscription-grants-smoke && ',
          '',
        );
        return JSON.stringify(pkg);
      }),
      new RegExp(`${parentScript} must run phase6:subscription-grants-smoke`, 'u'),
    );
  }
});

test('Phase 6 cannot drop the production Trusted Entitlements evidence gate', () => {
  const snapshot = loadPay07EntitlementAdmissionSnapshot(root);
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.phase6PacketBuilder, (source) =>
      replaceRequired(
        source,
        "blockers.push('Missing PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_PASS=true.');",
        "blockers.push('Trusted Entitlements evidence omitted.');",
      ),
    ),
    /strict Phase 6 packets must block without reviewed Trusted Entitlements evidence/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.phase6Check, (source) =>
      replaceRequired(
        source,
        'const revenueCatTrustedEntitlementsEvidence = auditRevenueCatTrustedEntitlementsEvidence({',
        'const revenueCatTrustedEntitlementsEvidence = auditRemovedTrustedEntitlementsEvidence({',
      ),
    ),
    /must validate the governed Trusted Entitlements artifact/u,
  );
  assertRejected(
    mutate(snapshot, PAY07_SOURCE_PATHS.phase6PacketBuilder, (source) =>
      replaceRequired(
        source,
        'revenueCatTrustedEntitlementsEvidence.artifactSha256',
        'revenueCatTrustedEntitlementsEvidence.omittedSha256',
      ),
    ),
    /must hash and reject invalid Trusted Entitlements artifacts/u,
  );
});
