#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const PAY07_SOURCE_PATHS = Object.freeze({
  appConfig: 'apps/mobile/app.config.js',
  eas: 'apps/mobile/eas.json',
  env: 'apps/mobile/src/lib/env.ts',
  fixtureBase: 'apps/mobile/src/features/subscription/entitlementE2EFixture.ts',
  fixtureNative: 'apps/mobile/src/features/subscription/entitlementE2EFixture.native.ts',
  fixtureWeb: 'apps/mobile/src/features/subscription/entitlementE2EFixture.web.ts',
  useEntitlement: 'apps/mobile/src/features/subscription/useEntitlement.ts',
  store: 'apps/mobile/src/features/subscription/store.ts',
  successRoute: 'apps/mobile/src/app/paywall/success.tsx',
  successAdmission: 'apps/mobile/src/features/subscription/successAdmission.ts',
  successPresentation: 'apps/mobile/src/features/subscription/successPresentation.ts',
  successCopy: 'apps/mobile/src/features/subscription/copy.ts',
  billingCadence: 'apps/mobile/src/features/subscription/billingCadence.ts',
  entitlementEvidence: 'apps/mobile/src/features/subscription/entitlementEvidence.ts',
  revenueCat: 'apps/mobile/src/lib/iap/revenuecat.ts',
  serverGrantAdmission: 'supabase/functions/subscription-grants/customProGrantAdmission.ts',
  serverGrantRoute: 'supabase/functions/subscription-grants/index.ts',
  serverGrantAdmissionTest:
    'supabase/functions/subscription-grants/customProGrantAdmission.test.ts',
  phase6Check: 'scripts/phase6/check-payments-env.mjs',
  phase6PacketBuilder: 'scripts/phase6/build-payments-qa-packet.mjs',
  trustedEvidence: 'scripts/phase6/payments-trusted-entitlements-evidence.mjs',
  trustedEvidenceTest: 'scripts/phase6/payments-trusted-entitlements-evidence.test.mjs',
  trustedEvidenceTemplate: 'docs/phase-6/revenuecat-trusted-entitlements-evidence.template.json',
  envExample: '.env.example',
  packageJson: 'package.json',
  sourceContract: 'scripts/pay07/entitlement-admission-source-contract.mjs',
  sourceContractTest: 'scripts/pay07/entitlement-admission-source-contract.test.mjs',
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTRACT_SCRIPT = 'pay07:entitlement-admission-source-contract:test';
const CONTRACT_COMMAND = 'node --test scripts/pay07/entitlement-admission-source-contract.test.mjs';
const TRUSTED_EVIDENCE_SCRIPT = 'phase6:trusted-entitlements-evidence:test';
const TRUSTED_EVIDENCE_COMMAND =
  'node --test scripts/phase6/payments-trusted-entitlements-evidence.test.mjs';
const SUBSCRIPTION_GRANTS_SMOKE_SCRIPT = 'phase6:subscription-grants-smoke';
const SUBSCRIPTION_GRANT_ADMISSION_TEST =
  'supabase/functions/subscription-grants/customProGrantAdmission.test.ts';
const APP_ENVIRONMENTS = new Set(['development', 'staging', 'production']);

function normalize(value) {
  return String(value).replaceAll('\r\n', '\n');
}

function sourceFile(path, text) {
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function namedFunction(source, name) {
  let found = null;
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function isNegatedIdentifier(node, name) {
  const current = unwrap(node);
  return (
    current &&
    ts.isPrefixUnaryExpression(current) &&
    current.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(unwrap(current.operand)) &&
    unwrap(current.operand).text === name
  );
}

function findIfStatement(node, predicate) {
  let found = null;
  const visit = (current) => {
    if (found) return;
    if (ts.isIfStatement(current) && predicate(current)) {
      found = current;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function exactFailClosedFixture(path, text) {
  const source = sourceFile(path, text);
  const delay = namedFunction(source, 'e2eEntitlementDelayMs');
  const state = namedFunction(source, 'e2eEntitlementState');
  const delayStatement = delay?.body?.statements?.[0];
  const stateStatement = state?.body?.statements?.[0];
  return (
    delay?.body?.statements.length === 1 &&
    ts.isReturnStatement(delayStatement) &&
    delayStatement.expression?.kind === ts.SyntaxKind.NumericLiteral &&
    delayStatement.expression.text === '0' &&
    state?.body?.statements.length === 1 &&
    ts.isReturnStatement(stateStatement) &&
    stateStatement.expression?.kind === ts.SyntaxKind.NullKeyword
  );
}

function exactUnconfiguredRefusal(path, text) {
  const source = sourceFile(path, text);
  const fn = namedFunction(source, 'startReverseTrialOnServer');
  if (!fn?.body) return false;
  const branch = findIfStatement(fn, (statement) =>
    isNegatedIdentifier(statement.expression, 'isSupabaseConfigured'),
  );
  if (!branch || branch.elseStatement) return false;
  const consequent = branch.thenStatement;
  if (!ts.isBlock(consequent) || consequent.statements.length !== 1) return false;
  return ts.isThrowStatement(consequent.statements[0]);
}

function parseJson(path, text, errors) {
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(
      `${path}: invalid JSON (${error instanceof Error ? error.message : String(error)}).`,
    );
    return null;
  }
}

function requirePattern(errors, path, text, pattern, message) {
  if (!pattern.test(text)) errors.push(`${path}: ${message}`);
}

function rejectPattern(errors, path, text, pattern, message) {
  if (pattern.test(text)) errors.push(`${path}: ${message}`);
}

function auditFixtures(snapshot, errors) {
  const base = snapshot[PAY07_SOURCE_PATHS.fixtureBase];
  const native = snapshot[PAY07_SOURCE_PATHS.fixtureNative];
  const web = snapshot[PAY07_SOURCE_PATHS.fixtureWeb];
  const useEntitlement = snapshot[PAY07_SOURCE_PATHS.useEntitlement];

  if (base && !exactFailClosedFixture(PAY07_SOURCE_PATHS.fixtureBase, base)) {
    errors.push(
      `${PAY07_SOURCE_PATHS.fixtureBase}: base/unsupported-platform entitlement fixture must return only delay 0 and state null.`,
    );
  }
  if (native && !exactFailClosedFixture(PAY07_SOURCE_PATHS.fixtureNative, native)) {
    errors.push(
      `${PAY07_SOURCE_PATHS.fixtureNative}: native entitlement fixture must return only delay 0 and state null.`,
    );
  }
  for (const [path, source] of [
    [PAY07_SOURCE_PATHS.fixtureBase, base],
    [PAY07_SOURCE_PATHS.fixtureNative, native],
  ]) {
    if (!source) continue;
    rejectPattern(
      errors,
      path,
      source,
      /(?:process\.env|__DEV__|deriveState|EXPO_PUBLIC_E2E_ENTITLEMENT|isActive\s*:\s*true|tier\s*:\s*['"]pro['"])/u,
      'base/native fixture must expose no environment, derivation, or positive entitlement authority.',
    );
  }

  if (web) {
    requirePattern(
      errors,
      PAY07_SOURCE_PATHS.fixtureWeb,
      web,
      /if\s*\(env\.appEnvironment\s*!==\s*['"]development['"]\)\s*return\s+null\s*;/u,
      'positive web entitlement fixture must fail closed outside development.',
    );
    requirePattern(
      errors,
      PAY07_SOURCE_PATHS.fixtureWeb,
      web,
      /process\.env\.EXPO_PUBLIC_E2E_ENTITLEMENT\b/u,
      'browser-only positive entitlement fixture input is missing.',
    );
    rejectPattern(
      errors,
      PAY07_SOURCE_PATHS.fixtureWeb,
      web,
      /(?:Platform\.OS|react-native|NativeModules|expo-modules-core)/u,
      'web fixture must not contain a native/platform fallback path.',
    );
  }

  if (useEntitlement) {
    requirePattern(
      errors,
      PAY07_SOURCE_PATHS.useEntitlement,
      useEntitlement,
      /from\s+['"]\.\/entitlementE2EFixture['"]\s*;/u,
      'runtime hook must use extensionless platform resolution for the entitlement fixture.',
    );
    rejectPattern(
      errors,
      PAY07_SOURCE_PATHS.useEntitlement,
      useEntitlement,
      /entitlementE2EFixture\.(?:web|native)/u,
      'runtime hook must not force a web or native fixture implementation.',
    );
    rejectPattern(
      errors,
      PAY07_SOURCE_PATHS.useEntitlement,
      useEntitlement,
      /(?:process\.env\.EXPO_PUBLIC_E2E_ENTITLEMENT\b|function\s+e2eEntitlementState\s*\(|function\s+e2eEntitlementDelayMs\s*\()/u,
      'runtime hook must not implement entitlement fixtures directly.',
    );
  }

  for (const [key, path] of Object.entries(PAY07_SOURCE_PATHS)) {
    if (
      [
        'fixtureWeb',
        'sourceContract',
        'sourceContractTest',
        'phase6Check',
        'phase6PacketBuilder',
        'envExample',
      ].includes(key)
    )
      continue;
    const source = snapshot[path];
    if (!source) continue;
    rejectPattern(
      errors,
      path,
      source,
      /EXPO_PUBLIC_E2E_ENTITLEMENT\b/u,
      'positive entitlement fixture input may exist only in the `.web.ts` module.',
    );
  }
}

function auditServerOnlyGrant(snapshot, errors) {
  const path = PAY07_SOURCE_PATHS.store;
  const store = snapshot[path];
  if (!store) return;

  if (!exactUnconfiguredRefusal(path, store)) {
    errors.push(
      `${path}: startReverseTrialOnServer() must unconditionally throw when Supabase is unconfigured.`,
    );
  }
  requirePattern(
    errors,
    path,
    store,
    /if\s*\(\s*!env\.customProGrantEnabled\s*\)\s*\{\s*throw\s+new\s+Error\(\s*['"]CUSTOM_PRO_GRANT_DISABLED['"]\s*\)\s*;/u,
    'custom full-Pro grant must be disabled before any server invocation unless the development exception is explicit.',
  );
  rejectPattern(
    errors,
    path,
    store,
    /(?:LOCAL_REVERSE_TRIAL_DAYS|daysFromNowISO|isSupabaseConfigured[\s\S]{0,500}(?:commitAppGrant|tier\s*:\s*['"]pro['"]|source\s*:\s*['"]app_granted['"]))/u,
    'unconfigured runtime must not mint or persist local Pro/app-grant evidence.',
  );
  requirePattern(
    errors,
    path,
    store,
    /supabase\.functions\.invoke\(\s*['"]subscription-grants['"]/u,
    'reverse-trial grant must invoke the server subscription-grants authority.',
  );
  requirePattern(
    errors,
    path,
    store,
    /body\s*:\s*\{\s*action\s*:\s*['"]start_reverse_trial['"]\s*\}/u,
    'reverse-trial request must use the exact server action.',
  );
}

function auditCustomProGrantServerBoundary(snapshot, errors) {
  const admissionPath = PAY07_SOURCE_PATHS.serverGrantAdmission;
  const routePath = PAY07_SOURCE_PATHS.serverGrantRoute;
  const admission = snapshot[admissionPath];
  const route = snapshot[routePath];

  if (admission) {
    for (const [pattern, message] of [
      [
        /if\s*\(appEnvironment\s*!==\s*['"]development['"]\s*\|\|\s*!supabaseUrl\)\s*return\s+false\s*;/u,
        'server grant admission must reject every non-development environment and missing URL.',
      ],
      [
        /const\s+LOCAL_SUPABASE_HOSTS\s*=\s*new\s+Set\(\s*\[\s*['"]127\.0\.0\.1['"]\s*,\s*['"]localhost['"]\s*,\s*['"]\[::1\]['"]\s*\]\s*\)/u,
        'server grant admission must use only exact loopback hostnames.',
      ],
      [/url\.protocol\s*===\s*['"]http:['"]/u, 'local grant authority must require HTTP.'],
      [
        /LOCAL_SUPABASE_HOSTS\.has\(url\.hostname\.toLowerCase\(\)\)/u,
        'server grant admission must compare the parsed hostname to the loopback allowlist.',
      ],
      [/url\.port\.length\s*>\s*0/u, 'local grant authority must require an explicit port.'],
      [/url\.username\.length\s*===\s*0/u, 'local grant authority must reject URL credentials.'],
      [/url\.password\.length\s*===\s*0/u, 'local grant authority must reject URL credentials.'],
      [/url\.pathname\s*===\s*['"]\/['"]/u, 'local grant authority must reject non-root paths.'],
      [/url\.search\.length\s*===\s*0/u, 'local grant authority must reject URL queries.'],
      [/url\.hash\.length\s*===\s*0/u, 'local grant authority must reject URL fragments.'],
      [/catch\s*\{\s*return\s+false\s*;/u, 'malformed server URLs must fail closed.'],
    ]) {
      requirePattern(errors, admissionPath, admission, pattern, message);
    }
  }

  if (!route) return;
  requirePattern(
    errors,
    routePath,
    route,
    /from\s+['"]\.\/customProGrantAdmission\.ts['"]\s*;/u,
    'subscription-grants must import the server-side custom grant boundary.',
  );
  requirePattern(
    errors,
    routePath,
    route,
    /if\s*\(\s*!customProGrantAllowed\(appEnvironment,\s*supabaseUrl\)\s*\)\s*\{\s*return\s+json\(\{\s*error:\s*['"]custom_pro_grant_disabled['"]\s*\},\s*403\)\s*;\s*\}/u,
    'subscription-grants must return 403 when server admission is closed.',
  );
  const boundary = route.indexOf('if (!customProGrantAllowed(appEnvironment, supabaseUrl))');
  const authentication = route.indexOf('const token = bearerToken(req)');
  const grant = route.indexOf("supabase.rpc('grant_app_granted_reverse_trial'");
  if (
    boundary < 0 ||
    authentication < 0 ||
    grant < 0 ||
    boundary >= authentication ||
    authentication >= grant
  ) {
    errors.push(
      `${routePath}: server grant admission must execute before authentication and grant authority.`,
    );
  }
}

function auditSuccessRoute(snapshot, errors) {
  const path = PAY07_SOURCE_PATHS.successRoute;
  const success = snapshot[path];
  if (!success) return;

  requirePattern(
    errors,
    path,
    success,
    /useEntitlement\(\{\s*refetchOnMount:\s*['"]always['"]\s*\}\)/u,
    'success route must force an exact post-mount entitlement query.',
  );
  requirePattern(
    errors,
    path,
    success,
    /const\s+liveNowMs\s*=\s*monotonicSuccessClockMs\(nowMs,\s*dataUpdatedAt\)\s*;[\s\S]{0,160}const\s+confirmedState\s*=\s*admittedSuccessState\(entitlement,\s*liveNowMs\)\s*;/u,
    'success confirmation must use a live wall clock rather than frozen query metadata.',
  );
  requirePattern(
    errors,
    path,
    success,
    /const\s+evidenceBoundaryMs\s*=\s*successEvidenceBoundaryMs\(data\)\s*;[\s\S]{0,300}const\s+boundaryMs\s*=\s*evidenceBoundaryMs[\s\S]{0,220}remainingMs\s*=\s*boundaryMs\s*-\s*schedulingNowMs[\s\S]{0,650}Math\.max\(Date\.now\(\),\s*boundaryMs\s*\+\s*1\)[\s\S]{0,220}clockRef\.current\s*=\s*advanced[\s\S]{0,220}refetch\(\)/u,
    'success route must close and refresh at the earliest evidence/expiry boundary.',
  );
  requirePattern(
    errors,
    path,
    success,
    /AppState\.addEventListener\(\s*['"]change['"][\s\S]{0,380}monotonicSuccessClockMs\(current,\s*Date\.now\(\)\)[\s\S]{0,160}clockRef\.current\s*=\s*advanced[\s\S]{0,160}refetch\(\)/u,
    'success route must revalidate the live clock and authority when the app becomes active.',
  );
  rejectPattern(
    errors,
    path,
    success,
    /\[\s*evidenceBoundaryMs\s*,\s*dataUpdatedAt/u,
    'unchanged authority data must not restart the evidence-boundary timer.',
  );
  requirePattern(
    errors,
    path,
    success,
    /if\s*\(\s*!confirmedState\s*\)/u,
    'success confirmation must refuse every non-admitted state.',
  );
  requirePattern(
    errors,
    path,
    success,
    /return\s+<ConfirmedSuccessScreen\s+state=\{confirmedState\}\s*\/>\s*;/u,
    'confirmed success UI must receive only the gated current entitlement state.',
  );
  requirePattern(
    errors,
    path,
    success,
    /function\s+fmt\(iso:\s*string\)\s*:\s*string\s*\{\s*const\s+d\s*=\s*new\s+Date\(iso\)\s*;/u,
    'success metadata must format an exact supplied expiry without synthesis.',
  );
  rejectPattern(
    errors,
    path,
    success,
    /(?:inTrial\s*=.*\?\?\s*true|expiresAt.*\?\?|fallbackDays|PLANS\.|addDays|86_400_000|useSubscriptionOffering|offering\.data)/u,
    'success route must not default trial state or synthesize confirmation dates.',
  );

  const gateIndex = success.search(/if\s*\(\s*!confirmedState\s*\)/u);
  const confirmationIndex = success.search(
    /return\s+<ConfirmedSuccessScreen\s+state=\{confirmedState\}/u,
  );
  if (gateIndex < 0 || confirmationIndex < 0 || gateIndex >= confirmationIndex) {
    errors.push(`${path}: refusal gate must execute before the confirmed-success render.`);
  }
}

function auditSuccessAdmission(snapshot, errors) {
  const path = PAY07_SOURCE_PATHS.successAdmission;
  const admission = snapshot[path];
  if (!admission) return;

  for (const [pattern, message] of [
    [
      /return\s+Math\.max\(previousNowMs,\s*observedNowMs\)\s*;/u,
      'success clock must never move backward.',
    ],
    [/query\.isError/u, 'failed refresh must block confirmation.'],
    [/query\.isLoading/u, 'loading state must block confirmation.'],
    [/query\.isFetching/u, 'pending refresh must block confirmation.'],
    [/!query\.isFetchedAfterMount/u, 'cached pre-mount data must block confirmation.'],
    [
      /!state\?\.isPro\s*\|\|\s*!state\.expiresAt\s*\|\|\s*!state\.verifiedAt/u,
      'active, expiry, and verification evidence are required.',
    ],
    [/expiresAtMs\s*<=\s*nowMs/u, 'wall-clock-expired evidence must block confirmation.'],
    [
      /verifiedAtMs\s*<\s*nowMs\s*-\s*SUCCESS_EVIDENCE_MAX_AGE_MS/u,
      'stale verification evidence must block confirmation.',
    ],
    [
      /!state\.periodType\s*\|\|\s*!state\.store\s*\|\|\s*!state\.source/u,
      'exact authority metadata is required.',
    ],
  ]) {
    requirePattern(errors, path, admission, pattern, message);
  }
}

function auditFreshQueryHook(snapshot, errors) {
  const path = PAY07_SOURCE_PATHS.useEntitlement;
  const hook = snapshot[path];
  if (!hook) return;
  requirePattern(
    errors,
    path,
    hook,
    /export\s+function\s+useEntitlement\(options\?:\s*\{\s*refetchOnMount\?:\s*['"]always['"]\s*\}\)/u,
    'entitlement hook must expose only the explicit always-refetch mount option.',
  );
  requirePattern(
    errors,
    path,
    hook,
    /refetchOnMount:\s*options\?\.refetchOnMount/u,
    'entitlement hook must pass the explicit mount-refetch option to React Query.',
  );
}

function auditSuccessPresentation(snapshot, errors) {
  const path = PAY07_SOURCE_PATHS.successPresentation;
  const presentation = snapshot[path];
  if (!presentation) return;

  for (const [pattern, message] of [
    [
      /state\.periodType\s*===\s*['"]reverse_trial['"]\s*\|\|\s*state\.store\s*===\s*['"]app_granted['"]/u,
      'app grants must use no-card copy.',
    ],
    [
      /state\.store\s*===\s*['"]promotional['"]/u,
      'RevenueCat-granted promotions must use non-billing copy.',
    ],
    [
      /state\.willRenew\s*===\s*true[\s\S]{0,200}BILLING_STORES\.has\(state\.store\)[\s\S]{0,160}price[\s\S]{0,80}cadence/u,
      'renewal claims require billing-store authority, will-renew truth, an exact price, and exact product cadence.',
    ],
    [
      /state\.willRenew\s*===\s*false/u,
      'non-renewing access must have a dedicated no-renewal lane.',
    ],
  ]) {
    requirePattern(errors, path, presentation, pattern, message);
  }
  rejectPattern(
    errors,
    path,
    presentation,
    /useSubscriptionOffering|offering\.data|the store price/u,
    'confirmed copy must not borrow catalog fallback pricing.',
  );

  const cadencePath = PAY07_SOURCE_PATHS.billingCadence;
  const cadence = snapshot[cadencePath];
  if (!cadence) return;
  requirePattern(
    errors,
    cadencePath,
    cadence,
    /productId\s*===\s*env\.revenueCatAnnualProductId[\s\S]{0,100}productId\s*===\s*env\.revenueCatMonthlyProductId/u,
    'billing cadence must come from exact build-configured annual/monthly product IDs.',
  );
  requirePattern(
    errors,
    cadencePath,
    cadence,
    /trimmed\.replace\([\s\S]{0,100}\(\?:year\|yr\|month\|mo\)[\s\S]{0,50}\)/u,
    'price labels must normalize one existing annual or monthly cadence before rendering.',
  );
}

function auditEnvironmentParity(snapshot, errors) {
  const configPath = PAY07_SOURCE_PATHS.appConfig;
  const config = snapshot[configPath];
  if (config) {
    requirePattern(
      errors,
      configPath,
      config,
      /if\s*\(appEnvironment\s*!==\s*variant\)\s*\{\s*throw\s+new\s+Error\s*\(/u,
      'APP_VARIANT and EXPO_PUBLIC_APP_ENV mismatch must throw.',
    );
    requirePattern(
      errors,
      configPath,
      config,
      /readVariantEnv\(\s*['"]EXPO_PUBLIC_APP_ENV['"]\s*,\s*process\.env\.EXPO_PUBLIC_APP_ENV\s*\)/u,
      'EXPO_PUBLIC_APP_ENV must use the same strict variant parser as APP_VARIANT.',
    );
    requirePattern(
      errors,
      configPath,
      config,
      /customProGrantEnabled\s*&&\s*variant\s*!==\s*['"]development['"][\s\S]{0,220}throw\s+new\s+Error/u,
      'staging and production app config must reject the custom full-Pro grant.',
    );
  }

  const envPath = PAY07_SOURCE_PATHS.env;
  const env = snapshot[envPath];
  if (env) {
    requirePattern(
      errors,
      envPath,
      env,
      /if\s*\(candidate\s*===\s*['"]development['"]\s*&&\s*!isDevRuntime\(\)\)\s*return\s+['"]production['"]\s*;/u,
      'non-development JavaScript runtimes must not accept a development public environment label.',
    );
    requirePattern(
      errors,
      envPath,
      env,
      /APP_ENVIRONMENT\s*===\s*['"]development['"]\s*&&\s*isDevRuntime\(\)\s*&&\s*readBooleanEnv\(value\)/u,
      'custom full-Pro grant must be explicit and development-runtime-only.',
    );
  }

  const easPath = PAY07_SOURCE_PATHS.eas;
  const easText = snapshot[easPath];
  if (!easText) return;
  const eas = parseJson(easPath, easText, errors);
  if (!eas) return;
  const profiles = eas.build;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    errors.push(`${easPath}: build profiles are missing.`);
    return;
  }
  for (const required of APP_ENVIRONMENTS) {
    if (!profiles[required]) errors.push(`${easPath}: missing ${required} build profile.`);
  }
  for (const [profile, definition] of Object.entries(profiles)) {
    const values = definition?.env;
    const variant = values?.APP_VARIANT;
    const publicEnvironment = values?.EXPO_PUBLIC_APP_ENV;
    if (!APP_ENVIRONMENTS.has(variant) || variant !== publicEnvironment) {
      errors.push(
        `${easPath}: ${profile} APP_VARIANT and EXPO_PUBLIC_APP_ENV must be identical known environments.`,
      );
    }
    if (APP_ENVIRONMENTS.has(profile) && variant !== profile) {
      errors.push(`${easPath}: ${profile} profile must use the ${profile} environment exactly.`);
    }
    if (
      Object.keys(values ?? {}).some((key) =>
        /^EXPO_PUBLIC_E2E_ENTITLEMENT(?:_DELAY_MS)?$/u.test(key),
      )
    ) {
      errors.push(`${easPath}: ${profile} profile must not bundle entitlement E2E inputs.`);
    }
  }
}

function auditRevenueCatVerification(snapshot, errors) {
  const revenuePath = PAY07_SOURCE_PATHS.revenueCat;
  const revenueCat = snapshot[revenuePath];
  if (revenueCat) {
    requirePattern(
      errors,
      revenuePath,
      revenueCat,
      /checkTrialOrIntroductoryPriceEligibility\(productIds\)[\s\S]{0,500}INTRO_ELIGIBILITY_STATUS_ELIGIBLE/u,
      'introductory-offer claims must require exact per-product App Store eligibility.',
    );
    requirePattern(
      errors,
      revenuePath,
      revenueCat,
      /const\s+trialDays\s*=\s*trialEligible\s*\?\s*trialDaysForPackage\(pack\)\s*:\s*null/u,
      'unknown, ineligible, and failed eligibility checks must suppress trial claims.',
    );
    requirePattern(
      errors,
      revenuePath,
      revenueCat,
      /function\s+developmentFallbackPackage[\s\S]{0,700}trialDays:\s*null,[\s\S]{0,100}introLabel:\s*null,/u,
      'development fallback pricing must not synthesize introductory-offer eligibility.',
    );
    requirePattern(
      errors,
      revenuePath,
      revenueCat,
      /if\s*\(verification\s*===\s*['"]NOT_REQUESTED['"]\)\s*\{\s*throw\s+new\s+Error\(\s*['"]REVENUECAT_ENTITLEMENT_VERIFICATION_NOT_REQUESTED['"]\s*\)\s*;\s*\}/u,
      'CustomerInfo mapper must reject aggregate NOT_REQUESTED verification.',
    );
    requirePattern(
      errors,
      revenuePath,
      revenueCat,
      /if\s*\(info\.verification\s*!==\s*verification\)\s*\{\s*throw\s+new\s+Error\(\s*['"]REVENUECAT_ENTITLEMENT_VERIFICATION_MISMATCH['"]/u,
      'selected entitlement verification must exactly match aggregate verification.',
    );
    const rejection = revenueCat.search(
      /if\s*\(verification\s*===\s*['"]NOT_REQUESTED['"]\)\s*\{/u,
    );
    const read = revenueCat.indexOf('const info = entitlementInfo(customerInfo)', rejection);
    if (rejection < 0 || read < 0 || rejection >= read) {
      errors.push(
        `${revenuePath}: NOT_REQUESTED must be rejected before active entitlement reads.`,
      );
    }
  }

  const storePath = PAY07_SOURCE_PATHS.store;
  const store = snapshot[storePath];
  if (store) {
    requirePattern(
      errors,
      storePath,
      store,
      /if\s*\(verification\s*===\s*['"]NOT_REQUESTED['"]\)\s*\{\s*return\s*\{\s*status\s*:\s*['"]rejected['"]\s*,\s*reason\s*:\s*['"]verification_not_requested['"]\s*\}\s*;\s*\}/u,
      'evidence conversion must reject NOT_REQUESTED verification.',
    );
    requirePattern(
      errors,
      storePath,
      store,
      /selectedActive\s*!==\s*\(normalized\?\.isActive\s*===\s*true\)[\s\S]{0,120}selected\?\.verification\s*!==\s*verification/u,
      'evidence conversion must reject selected-child/aggregate verification mismatches.',
    );
  }

  const evidencePath = PAY07_SOURCE_PATHS.entitlementEvidence;
  const evidence = snapshot[evidencePath];
  if (evidence) {
    rejectPattern(
      errors,
      evidencePath,
      evidence,
      /revenuecat_not_requested/u,
      'owner-bound cache schema must not retain legacy NOT_REQUESTED positive provenance.',
    );
  }
}

function auditWiring(snapshot, errors) {
  const path = PAY07_SOURCE_PATHS.packageJson;
  const packageText = snapshot[path];
  if (!packageText) return;
  const pkg = parseJson(path, packageText, errors);
  if (!pkg) return;
  const scripts = pkg.scripts ?? {};
  if (scripts[CONTRACT_SCRIPT] !== CONTRACT_COMMAND) {
    errors.push(`${path}: ${CONTRACT_SCRIPT} must run the dedicated adversarial tests.`);
  }
  if (scripts[TRUSTED_EVIDENCE_SCRIPT] !== TRUSTED_EVIDENCE_COMMAND) {
    errors.push(`${path}: ${TRUSTED_EVIDENCE_SCRIPT} must run the adversarial artifact tests.`);
  }
  if (
    !String(scripts[SUBSCRIPTION_GRANTS_SMOKE_SCRIPT] ?? '').includes(
      SUBSCRIPTION_GRANT_ADMISSION_TEST,
    )
  ) {
    errors.push(
      `${path}: ${SUBSCRIPTION_GRANTS_SMOKE_SCRIPT} must run ${SUBSCRIPTION_GRANT_ADMISSION_TEST}.`,
    );
  }
  for (const parentScript of ['phase6:verify', 'launch:verify']) {
    if (!String(scripts[parentScript] ?? '').includes(`npm run ${CONTRACT_SCRIPT}`)) {
      errors.push(`${path}: ${parentScript} must run ${CONTRACT_SCRIPT}.`);
    }
    if (!String(scripts[parentScript] ?? '').includes(`npm run ${TRUSTED_EVIDENCE_SCRIPT}`)) {
      errors.push(`${path}: ${parentScript} must run ${TRUSTED_EVIDENCE_SCRIPT}.`);
    }
  }
  for (const parentScript of ['phase6:verify', 'phase9:verify', 'launch:verify']) {
    if (
      !String(scripts[parentScript] ?? '').includes(`npm run ${SUBSCRIPTION_GRANTS_SMOKE_SCRIPT}`)
    ) {
      errors.push(`${path}: ${parentScript} must run ${SUBSCRIPTION_GRANTS_SMOKE_SCRIPT}.`);
    }
  }
}

function auditTrustedEntitlementsGate(snapshot, errors) {
  const key = 'PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_PASS';
  const pathKey = 'PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_EVIDENCE_PATH';
  const checkPath = PAY07_SOURCE_PATHS.phase6Check;
  const builderPath = PAY07_SOURCE_PATHS.phase6PacketBuilder;
  const examplePath = PAY07_SOURCE_PATHS.envExample;
  const check = snapshot[checkPath];
  const builder = snapshot[builderPath];
  const example = snapshot[examplePath];

  if (check) {
    requirePattern(
      errors,
      checkPath,
      check,
      new RegExp(`['"]${key}['"]`, 'u'),
      'Phase 6 environment verification must require reviewed Trusted Entitlements evidence.',
    );
    requirePattern(
      errors,
      checkPath,
      check,
      /const\s+revenueCatTrustedEntitlementsEvidence\s*=\s*auditRevenueCatTrustedEntitlementsEvidence\(\{[\s\S]*PHASE6_REVENUECAT_TRUSTED_ENTITLEMENTS_EVIDENCE_PATH/u,
      'Phase 6 environment verification must validate the governed Trusted Entitlements artifact.',
    );
  }
  if (builder) {
    requirePattern(
      errors,
      builderPath,
      builder,
      new RegExp(`Missing ${key}=true\\.`, 'u'),
      'strict Phase 6 packets must block without reviewed Trusted Entitlements evidence.',
    );
    requirePattern(
      errors,
      builderPath,
      builder,
      /const\s+revenueCatTrustedEntitlementsEvidence\s*=\s*auditRevenueCatTrustedEntitlementsEvidence\(\{[\s\S]*revenueCatTrustedEntitlementsEvidence\.artifactSha256[\s\S]*revenueCatTrustedEntitlementsEvidence\.errors/u,
      'strict Phase 6 packets must hash and reject invalid Trusted Entitlements artifacts.',
    );
  }
  if (example) {
    requirePattern(
      errors,
      examplePath,
      example,
      new RegExp(`^${key}=$`, 'mu'),
      '.env.example must document the Trusted Entitlements review gate.',
    );
    requirePattern(
      errors,
      examplePath,
      example,
      new RegExp(`^${pathKey}=$`, 'mu'),
      '.env.example must document the governed Trusted Entitlements evidence path.',
    );
  }
}

export function auditPay07EntitlementAdmissionSnapshot(snapshot) {
  const errors = [];
  for (const path of Object.values(PAY07_SOURCE_PATHS)) {
    if (typeof snapshot[path] !== 'string') {
      errors.push(`${path}: required PAY-07 authority source is missing.`);
    }
  }
  auditFixtures(snapshot, errors);
  auditServerOnlyGrant(snapshot, errors);
  auditCustomProGrantServerBoundary(snapshot, errors);
  auditSuccessRoute(snapshot, errors);
  auditFreshQueryHook(snapshot, errors);
  auditSuccessAdmission(snapshot, errors);
  auditSuccessPresentation(snapshot, errors);
  auditEnvironmentParity(snapshot, errors);
  auditRevenueCatVerification(snapshot, errors);
  auditWiring(snapshot, errors);
  auditTrustedEntitlementsGate(snapshot, errors);
  return [...new Set(errors)].sort();
}

export function loadPay07EntitlementAdmissionSnapshot(rootPath = root) {
  return Object.freeze(
    Object.fromEntries(
      Object.values(PAY07_SOURCE_PATHS).map((path) => {
        const absolute = resolve(rootPath, path);
        return [path, existsSync(absolute) ? normalize(readFileSync(absolute, 'utf8')) : null];
      }),
    ),
  );
}

function main() {
  const errors = auditPay07EntitlementAdmissionSnapshot(
    loadPay07EntitlementAdmissionSnapshot(root),
  );
  if (errors.length > 0) {
    console.error('PAY07_ENTITLEMENT_ADMISSION_SOURCE_CONTRACT_FAILED');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('PAY07_ENTITLEMENT_ADMISSION_SOURCE_CONTRACT_PASS');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
