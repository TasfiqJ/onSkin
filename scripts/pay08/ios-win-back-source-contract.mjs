#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const PAY08_SOURCE_PATHS = Object.freeze({
  launchContract: 'docs/hugeToDo/launch-contract.json',
  launchContractValidator: 'scripts/launch/contract.mjs',
  appConfig: 'apps/mobile/app.config.js',
  appConfigTest: 'apps/mobile/src/lib/appConfig.test.ts',
  eas: 'apps/mobile/eas.json',
  envExample: '.env.example',
  commercialState: 'apps/mobile/src/features/subscription/winBackCommercialState.ts',
  env: 'apps/mobile/src/lib/env.ts',
  authProvider: 'apps/mobile/src/lib/auth/AuthProvider.tsx',
  revenueCat: 'apps/mobile/src/lib/iap/revenuecat.ts',
  winBackRoute: 'apps/mobile/src/app/paywall/winback.tsx',
  paywallCopy: 'apps/mobile/src/features/subscription/copy.ts',
  plans: 'apps/mobile/src/features/subscription/plans.ts',
  packageJson: 'package.json',
  checkpoint: 'docs/hugeToDo/PAY-08-IOS-WIN-BACK-ADMISSION-SOURCE-CHECKPOINT-2026-08-04.md',
  paymentsRunbook: 'docs/phase-6/payments-runbook.md',
  paymentsChecklist: 'docs/phase-6/payments-qa-checklist.md',
  // The lean plan retains this legacy task's evidence without adding it back to V1.
  executionStatus: 'docs/hugeToDo/history/main-before-lean-integration-2026-09-27/execution-status.json',
});

export const REQUIRED_PAY08_ADMISSION = Object.freeze({
  schemaVersion: 1,
  winBackOfferAdmitted: false,
  automaticInAppMessagesAllowed: false,
  winBackInAppMessageAllowed: false,
  disabledWinBackProviderCallsAllowed: false,
  eligibilityDerivedOfferRequired: true,
  localizedStorePricingRequired: true,
  hardcodedDiscountAllowed: false,
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTRACT_SCRIPT = 'pay08:ios-win-back-source-contract:test';
const CONTRACT_COMMAND = 'node --test scripts/pay08/ios-win-back-source-contract.test.mjs';

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

function namedFunctionText(path, text, name) {
  const source = sourceFile(path, text);
  let found = null;
  const visit = (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found ? found.getText(source) : '';
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

function auditAdmission(snapshot, errors) {
  const contractPath = PAY08_SOURCE_PATHS.launchContract;
  const contract = parseJson(contractPath, snapshot[contractPath], errors);
  if (contract) {
    const actual = contract.iosWinBackOfferAdmission;
    if (JSON.stringify(actual) !== JSON.stringify(REQUIRED_PAY08_ADMISSION)) {
      errors.push(
        `${contractPath}: iosWinBackOfferAdmission must exactly match the versioned PAY-08 no-offer admission.`,
      );
    }
  }

  const validatorPath = PAY08_SOURCE_PATHS.launchContractValidator;
  const validator = snapshot[validatorPath];
  for (const [pattern, message] of [
    [
      /REQUIRED_IOS_WIN_BACK_OFFER_ADMISSION\s*=\s*Object\.freeze/u,
      'launch-contract validator must export the PAY-08 admission schema.',
    ],
    [
      /contract\.iosWinBackOfferAdmission\?\.\[key\]\s*!==\s*expected/u,
      'launch-contract validator must check every PAY-08 admission value.',
    ],
    [
      /only the exact PAY-08 admission keys/u,
      'launch-contract validator must reject missing and extra PAY-08 keys.',
    ],
  ]) {
    requirePattern(errors, validatorPath, validator, pattern, message);
  }
}

function auditBuildBoundary(snapshot, errors) {
  const configPath = PAY08_SOURCE_PATHS.appConfig;
  const config = snapshot[configPath];
  requirePattern(
    errors,
    configPath,
    config,
    /readOptionalBooleanEnv\(\s*['"]EXPO_PUBLIC_IOS_WIN_BACK_ENABLED['"]\s*,\s*process\.env\.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED\s*,?\s*\)/u,
    'app config must parse the public win-back flag as an exact boolean.',
  );
  requirePattern(
    errors,
    configPath,
    config,
    /iosWinBackEnabled\s*&&\s*launchContract\.iosWinBackOfferAdmission\?\.winBackOfferAdmitted\s*!==\s*true/u,
    'app config must reject enabled builds whenever the launch contract is not positively admitted.',
  );

  const easPath = PAY08_SOURCE_PATHS.eas;
  const eas = parseJson(easPath, snapshot[easPath], errors);
  if (eas) {
    const profiles = Object.entries(eas.build ?? {});
    if (profiles.length === 0)
      errors.push(`${easPath}: at least one EAS build profile is required.`);
    for (const [profile, config] of profiles) {
      if (config?.env?.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED !== 'false') {
        errors.push(
          `${easPath}: build.${profile}.env.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED must be explicit string false.`,
        );
      }
    }
  }

  const envExamplePath = PAY08_SOURCE_PATHS.envExample;
  const assignments = snapshot[envExamplePath]
    .split('\n')
    .filter((line) => /^EXPO_PUBLIC_IOS_WIN_BACK_ENABLED=/u.test(line));
  if (assignments.length !== 1 || assignments[0] !== 'EXPO_PUBLIC_IOS_WIN_BACK_ENABLED=false') {
    errors.push(
      `${envExamplePath}: public iOS win-back flag must have one exact documented false assignment.`,
    );
  }
}

function auditRuntimeGate(snapshot, errors) {
  const statePath = PAY08_SOURCE_PATHS.commercialState;
  const state = snapshot[statePath];
  requirePattern(
    errors,
    statePath,
    state,
    /IOS_WIN_BACK_COMMERCIAL_STATE[^=]*=\s*['"]no_offer['"]\s*;/u,
    'reviewed commercial state must remain no_offer.',
  );
  requirePattern(
    errors,
    statePath,
    state,
    /return\s+publicFlag\s*===\s*true\s*&&\s*commercialState\s*===\s*['"]native_offer_enabled['"]\s*;/u,
    'runtime enablement must require both the public flag and reviewed native-offer state.',
  );
  rejectPattern(
    errors,
    statePath,
    state,
    /fetch\s*\(|supabase\.|AsyncStorage/u,
    'commercial authority must not be remotely or locally overridden at runtime.',
  );

  const envPath = PAY08_SOURCE_PATHS.env;
  const env = snapshot[envPath];
  requirePattern(
    errors,
    envPath,
    env,
    /iosWinBackEnabled:\s*resolveIosWinBackEnabled\(\s*readBooleanEnv\(process\.env\.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED\)\s*,?\s*\)/u,
    'runtime env must pass the public flag through reviewed commercial-state resolution.',
  );

  const revenueCatPath = PAY08_SOURCE_PATHS.revenueCat;
  const revenueCat = snapshot[revenueCatPath];
  const configure = namedFunctionText(revenueCatPath, revenueCat, 'configureRevenueCat');
  requirePattern(
    errors,
    revenueCatPath,
    configure,
    /shouldShowInAppMessagesAutomatically:\s*false/u,
    'RevenueCat automatic StoreKit messages must be disabled explicitly.',
  );
  if (
    (configure.match(/shouldShowInAppMessagesAutomatically\s*:/gu) ?? []).length !== 1 ||
    (configure.match(/shouldShowInAppMessagesAutomatically:\s*false/gu) ?? []).length !== 1
  ) {
    errors.push(
      `${revenueCatPath}: RevenueCat configuration must contain exactly one automatic-message policy and it must be false.`,
    );
  }
  const messageDelivery = namedFunctionText(
    revenueCatPath,
    revenueCat,
    'showConfiguredRevenueCatInAppMessages',
  );
  for (const type of ['BILLING_ISSUE', 'PRICE_INCREASE_CONSENT', 'GENERIC']) {
    requirePattern(
      errors,
      revenueCatPath,
      messageDelivery,
      new RegExp(`IN_APP_MESSAGE_TYPE\\.${type}`, 'u'),
      `manual in-app message allowlist must retain ${type}.`,
    );
  }
  requirePattern(
    errors,
    revenueCatPath,
    messageDelivery,
    /if\s*\(Platform\.OS\s*===\s*['"]ios['"]\s*&&\s*env\.iosWinBackEnabled\)\s*\{\s*inAppMessageTypes\.push\(Purchases\.IN_APP_MESSAGE_TYPE\.WIN_BACK_OFFER\)\s*;?\s*\}/u,
    'WIN_BACK_OFFER messages may enter the manual allowlist only behind iOS and reviewed runtime admission.',
  );
  requirePattern(
    errors,
    revenueCatPath,
    messageDelivery,
    /Purchases\.showInAppMessages\(inAppMessageTypes\)/u,
    'RevenueCat messages must use the explicit governed allowlist.',
  );
  if ((messageDelivery.match(/Purchases\.showInAppMessages\s*\(/gu) ?? []).length !== 1) {
    errors.push(
      `${revenueCatPath}: governed message delivery must issue exactly one presentation call using the allowlist.`,
    );
  }
  if ((messageDelivery.match(/IN_APP_MESSAGE_TYPE\.WIN_BACK_OFFER/gu) ?? []).length !== 1) {
    errors.push(
      `${revenueCatPath}: WIN_BACK_OFFER must occur exactly once inside its reviewed enablement guard.`,
    );
  }

  const messageRetry = namedFunctionText(revenueCatPath, revenueCat, 'showRevenueCatInAppMessages');
  for (const [pattern, message] of [
    [
      /bindingMatches\(configuredBinding, binding\)/u,
      'manual-message retry must require the exact already-configured binding.',
    ],
    [
      /requireConfigured\(ticket,\s*['"]in-app messages['"]\)/u,
      'manual-message retry must remain inside provider publication authority.',
    ],
    [
      /showConfiguredRevenueCatInAppMessages\(Purchases, ticket\)/u,
      'manual-message retry must reuse the governed allowlist.',
    ],
  ]) {
    requirePattern(errors, revenueCatPath, messageRetry, pattern, message);
  }
  rejectPattern(
    errors,
    revenueCatPath,
    messageRetry,
    /(?:configuredBinding\s*=|cachedOfferings\s*=|Purchases\.configure\(|Purchases\.logIn\()/u,
    'manual-message retry must not mutate identity or offering cache.',
  );

  const authProviderPath = PAY08_SOURCE_PATHS.authProvider;
  const authProvider = snapshot[authProviderPath];
  requirePattern(
    errors,
    authProviderPath,
    authProvider,
    /priorState\s*===\s*['"]inactive['"][\s\S]{0,900}showRevenueCatInAppMessages\(published\.user\.id\)/u,
    'retained non-Apple publication must retry manual messages on inactive-to-active foreground.',
  );
  requirePattern(
    errors,
    authProviderPath,
    authProvider,
    /priorState\s*===\s*['"]inactive['"]\s*&&\s*retainedPublication[\s\S]{0,700}showRevenueCatInAppMessages\(current\.user\.id\)/u,
    'retained Apple publication must retry manual messages after foreground credential validation.',
  );

  const discovery = namedFunctionText(revenueCatPath, revenueCat, 'winBackViewForPackage');
  requirePattern(
    errors,
    revenueCatPath,
    discovery,
    /if\s*\(\s*!env\.iosWinBackEnabled\s*\|\|\s*Platform\.OS\s*!==\s*['"]ios['"]\s*\)\s*return\s+null/u,
    'disabled discovery must gate both commercial admission and iOS before provider calls.',
  );
  const discoveryGuard = discovery.search(/if\s*\(\s*!env\.iosWinBackEnabled/u);
  const discoveryProvider = discovery.search(
    /requireConfigured\(|getEligibleWinBackOffersForPackage\(/u,
  );
  if (discoveryGuard < 0 || discoveryProvider < 0 || discoveryGuard >= discoveryProvider) {
    errors.push(
      `${revenueCatPath}: disabled discovery must return before configuration or eligible-offer provider calls.`,
    );
  }

  const purchase = namedFunctionText(revenueCatPath, revenueCat, 'purchaseWinBackPackage');
  requirePattern(
    errors,
    revenueCatPath,
    purchase,
    /if\s*\(\s*!env\.iosWinBackEnabled\s*\|\|\s*Platform\.OS\s*!==\s*['"]ios['"]\s*\)/u,
    'disabled purchase must gate both commercial admission and iOS before provider calls.',
  );
  const purchaseGuard = purchase.search(/if\s*\(\s*!env\.iosWinBackEnabled/u);
  const purchaseProvider = purchase.search(
    /requireConfigured\(|getEligibleWinBackOffersForPackage\(|purchasePackageWithWinBackOffer\(/u,
  );
  if (purchaseGuard < 0 || purchaseProvider < 0 || purchaseGuard >= purchaseProvider) {
    errors.push(
      `${revenueCatPath}: disabled purchase must return unavailable before every provider/store call.`,
    );
  }
  for (const pattern of [
    /priceLabel:\s*offer\.priceString/u,
    /originalPriceLabel:\s*pack\.product\.priceString/u,
    /purchasePackageWithWinBackOffer\(annualPackage,\s*winBackOffer\)/u,
  ]) {
    requirePattern(
      errors,
      revenueCatPath,
      revenueCat,
      pattern,
      'future positive path must remain bound to the exact eligible SDK offer and localized store pricing.',
    );
  }
}

function auditTruthfulPresentation(snapshot, errors) {
  const routePath = PAY08_SOURCE_PATHS.winBackRoute;
  const route = snapshot[routePath];
  requirePattern(
    errors,
    routePath,
    route,
    /env\.iosWinBackEnabled[\s\S]{0,180}offering\.data\.winBack\?\.canPurchase\s*===\s*true/u,
    'offer presentation must require both reviewed enablement and exact SDK eligibility.',
  );
  requirePattern(
    errors,
    routePath,
    route,
    /eligibleOffer\?\.priceLabel\s*\?\?\s*annualDisplay\.priceLabel/u,
    'offer price must come from the eligible SDK offer; fallback must use the ordinary current plan.',
  );
  requirePattern(
    errors,
    routePath,
    route,
    /if\s*\(\s*!canWinBack\s*\)\s*\{\s*router\.replace\(['"]\/paywall\/upsell\?feature=full_routine['"]\)\s*;/u,
    'unavailable state must route to the standard Pro offer before invoking win-back purchase.',
  );

  const copyPath = PAY08_SOURCE_PATHS.paywallCopy;
  const copy = snapshot[copyPath];
  const winBackCopyStart = copy.indexOf('winback: {');
  const winBackCopyEnd = copy.indexOf('trialReminder:', winBackCopyStart);
  const winBackCopy =
    winBackCopyStart >= 0 && winBackCopyEnd > winBackCopyStart
      ? copy.slice(winBackCopyStart, winBackCopyEnd)
      : '';
  if (!winBackCopy) {
    errors.push(`${copyPath}: PAYWALL_COPY.winback must be a distinct reviewed copy block.`);
  } else if (/(?:[$€£]\s*\d|\b\d+(?:\.\d+)?\s*%)/u.test(winBackCopy)) {
    errors.push(
      `${copyPath}: win-back copy must contain no hardcoded currency amount or percentage.`,
    );
  }

  for (const path of [
    PAY08_SOURCE_PATHS.plans,
    PAY08_SOURCE_PATHS.paywallCopy,
    PAY08_SOURCE_PATHS.winBackRoute,
  ]) {
    rejectPattern(
      errors,
      path,
      snapshot[path],
      /\$34\.99|respectful\s+30%|(?:WINBACK|winBack|winback)\s*=\s*\{[\s\S]{0,240}(?:priceLabel|percentOff)|30%-off/u,
      'no hardcoded or invented win-back discount may remain in launch presentation source.',
    );
  }
}

function auditVerificationWiring(snapshot, errors) {
  const packagePath = PAY08_SOURCE_PATHS.packageJson;
  const packageJson = parseJson(packagePath, snapshot[packagePath], errors);
  if (!packageJson) return;
  const scripts = packageJson.scripts ?? {};
  if (scripts[CONTRACT_SCRIPT] !== CONTRACT_COMMAND) {
    errors.push(`${packagePath}: ${CONTRACT_SCRIPT} must run the exact PAY-08 test command.`);
  }
  if (!String(scripts['launch:contract:verify'] ?? '').includes(`npm run ${CONTRACT_SCRIPT}`)) {
    errors.push(`${packagePath}: launch:contract:verify must include the PAY-08 source contract.`);
  }
  for (const script of ['phase6:verify', 'phase9:verify', 'launch:verify']) {
    if (!String(scripts[script] ?? '').includes('npm run launch:contract:verify')) {
      errors.push(`${packagePath}: ${script} must inherit PAY-08 through launch:contract:verify.`);
    }
  }
}

function auditCheckpointBoundary(snapshot, errors) {
  const checkpointPath = PAY08_SOURCE_PATHS.checkpoint;
  const checkpoint = snapshot[checkpointPath];
  for (const [pattern, message] of [
    [/Status:\s*`in_progress`/u, 'checkpoint must not claim PAY-08 complete.'],
    [/live-blocked/u, 'checkpoint must preserve the external operational boundary.'],
    [
      /developer\.apple\.com\/documentation\/storekit\/merchandising-win-back-offers-in-your-app/u,
      'checkpoint must cite Apple automatic win-back merchandising behavior.',
    ],
    [
      /revenuecat\.com\/docs\/subscription-guidance\/subscription-offers\/ios-subscription-offers/u,
      'checkpoint must cite RevenueCat iOS offer guidance.',
    ],
    [
      /exact subscription products and storefronts[\s\S]{0,300}no configured or active win-back offer/u,
      'checkpoint must require exact-product/storefront App Store Connect no-offer evidence.',
    ],
  ]) {
    requirePattern(errors, checkpointPath, checkpoint, pattern, message);
  }

  const statusPath = PAY08_SOURCE_PATHS.executionStatus;
  const status = parseJson(statusPath, snapshot[statusPath], errors);
  const pay08 = status?.items?.find?.((task) => task?.id === 'PAY-08');
  if (!pay08 || pay08.status !== 'in_progress') {
    errors.push(
      `${statusPath}: PAY-08 must remain in_progress until live/store evidence closes it.`,
    );
  }
}

export function readPay08SourceSnapshot(rootDir = root) {
  const snapshot = {};
  for (const path of Object.values(PAY08_SOURCE_PATHS)) {
    const absolute = resolve(rootDir, path);
    snapshot[path] = existsSync(absolute) ? normalize(readFileSync(absolute, 'utf8')) : null;
  }
  return snapshot;
}

export function auditPay08SourceSnapshot(snapshot) {
  const errors = [];
  for (const path of Object.values(PAY08_SOURCE_PATHS)) {
    if (typeof snapshot[path] !== 'string')
      errors.push(`${path}: required PAY-08 source is missing.`);
  }
  if (errors.length > 0) return errors;

  auditAdmission(snapshot, errors);
  auditBuildBoundary(snapshot, errors);
  auditRuntimeGate(snapshot, errors);
  auditTruthfulPresentation(snapshot, errors);
  auditVerificationWiring(snapshot, errors);
  auditCheckpointBoundary(snapshot, errors);
  return errors;
}

export function assertPay08SourceContract(rootDir = root) {
  const errors = auditPay08SourceSnapshot(readPay08SourceSnapshot(rootDir));
  if (errors.length > 0)
    throw new Error(`PAY-08 source contract failed:\n- ${errors.join('\n- ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertPay08SourceContract();
  console.log('PAY-08 iOS win-back source contract passed.');
}
