import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditPay08SourceSnapshot,
  PAY08_SOURCE_PATHS,
  readPay08SourceSnapshot,
} from './ios-win-back-source-contract.mjs';

function freshSnapshot() {
  return structuredClone(readPay08SourceSnapshot());
}

function errorsFor(snapshot) {
  return auditPay08SourceSnapshot(snapshot).join('\n');
}

test('current PAY-08 no-offer source contract passes', () => {
  assert.deepEqual(auditPay08SourceSnapshot(freshSnapshot()), []);
});

test('missing governed source fails closed', () => {
  const snapshot = freshSnapshot();
  snapshot[PAY08_SOURCE_PATHS.commercialState] = null;
  assert.match(
    errorsFor(snapshot),
    /winBackCommercialState\.ts: required PAY-08 source is missing/,
  );
});

test('forged positive launch admission is rejected', () => {
  const snapshot = freshSnapshot();
  const path = PAY08_SOURCE_PATHS.launchContract;
  const contract = JSON.parse(snapshot[path]);
  contract.iosWinBackOfferAdmission.winBackOfferAdmitted = true;
  snapshot[path] = JSON.stringify(contract);
  assert.match(errorsFor(snapshot), /must exactly match the versioned PAY-08 no-offer admission/);
});

test('EAS profile or app-config override cannot enable the closed admission', () => {
  const easSnapshot = freshSnapshot();
  const easPath = PAY08_SOURCE_PATHS.eas;
  const eas = JSON.parse(easSnapshot[easPath]);
  eas.build.production.env.EXPO_PUBLIC_IOS_WIN_BACK_ENABLED = 'true';
  easSnapshot[easPath] = JSON.stringify(eas);
  assert.match(errorsFor(easSnapshot), /build\.production.*must be explicit string false/);

  const configSnapshot = freshSnapshot();
  const configPath = PAY08_SOURCE_PATHS.appConfig;
  configSnapshot[configPath] = configSnapshot[configPath].replace(
    'launchContract.iosWinBackOfferAdmission?.winBackOfferAdmitted !== true',
    'false',
  );
  assert.match(errorsFor(configSnapshot), /must reject enabled builds/);
});

test('automatic or unconditional StoreKit win-back messages are rejected', () => {
  const automatic = freshSnapshot();
  const path = PAY08_SOURCE_PATHS.revenueCat;
  automatic[path] = automatic[path].replace(
    'shouldShowInAppMessagesAutomatically: false',
    'shouldShowInAppMessagesAutomatically: true',
  );
  assert.match(errorsFor(automatic), /automatic StoreKit messages must be disabled/);

  const unconditional = freshSnapshot();
  unconditional[path] = unconditional[path].replace(
    "if (Platform.OS === 'ios' && env.iosWinBackEnabled) {",
    'if (env.iosWinBackEnabled) {',
  );
  assert.match(errorsFor(unconditional), /behind iOS and reviewed runtime admission/);

  const secondPresentation = freshSnapshot();
  secondPresentation[path] = secondPresentation[path].replace(
    'await Purchases.showInAppMessages(inAppMessageTypes);',
    'await Purchases.showInAppMessages(inAppMessageTypes);\n          await Purchases.showInAppMessages();',
  );
  assert.match(errorsFor(secondPresentation), /exactly one presentation call/);

  const secondWinBackInsertion = freshSnapshot();
  secondWinBackInsertion[path] = secondWinBackInsertion[path].replace(
    'await Purchases.showInAppMessages(inAppMessageTypes);',
    'inAppMessageTypes.push(Purchases.IN_APP_MESSAGE_TYPE.WIN_BACK_OFFER);\n          await Purchases.showInAppMessages(inAppMessageTypes);',
  );
  assert.match(errorsFor(secondWinBackInsertion), /WIN_BACK_OFFER must occur exactly once/);
});

test('disabled discovery and purchase must return before provider calls', () => {
  const discovery = freshSnapshot();
  const path = PAY08_SOURCE_PATHS.revenueCat;
  discovery[path] = discovery[path].replace(
    "if (!env.iosWinBackEnabled || Platform.OS !== 'ios') return null;",
    "if (Platform.OS !== 'ios') return null;",
  );
  assert.match(errorsFor(discovery), /disabled discovery must return before/);

  const purchase = freshSnapshot();
  purchase[path] = purchase[path].replace(
    "if (!env.iosWinBackEnabled || Platform.OS !== 'ios') {",
    'if (!env.iosWinBackEnabled) {',
  );
  assert.match(
    errorsFor(purchase),
    /disabled purchase must gate both commercial admission and iOS/,
  );
});

test('manual recovery-message retry cannot lose binding, cache, or foreground reachability', () => {
  const binding = freshSnapshot();
  const revenueCatPath = PAY08_SOURCE_PATHS.revenueCat;
  binding[revenueCatPath] = binding[revenueCatPath].replace(
    'if (!bindingMatches(configuredBinding, binding)) return;',
    'if (false) return;',
  );
  assert.match(errorsFor(binding), /must require the exact already-configured binding/);

  const mutation = freshSnapshot();
  mutation[revenueCatPath] = mutation[revenueCatPath].replace(
    'export async function showRevenueCatInAppMessages(appUserId: string): Promise<void> {',
    'export async function showRevenueCatInAppMessages(appUserId: string): Promise<void> {\n  cachedOfferings = null;',
  );
  assert.match(errorsFor(mutation), /must not mutate identity or offering cache/);

  const foreground = freshSnapshot();
  const authPath = PAY08_SOURCE_PATHS.authProvider;
  foreground[authPath] = foreground[authPath].replace(
    'void showRevenueCatInAppMessages(published.user.id).catch(() => {});',
    '',
  );
  assert.match(errorsFor(foreground), /retained non-Apple publication must retry/);
});

test('hardcoded discount claims and ungoverned wiring are rejected', () => {
  const discount = freshSnapshot();
  const plansPath = PAY08_SOURCE_PATHS.plans;
  discount[plansPath] += "\nexport const WINBACK = { priceLabel: '$34.99', percentOff: 30 };\n";
  assert.match(errorsFor(discount), /no hardcoded or invented win-back discount/);

  const copyDiscount = freshSnapshot();
  const copyPath = PAY08_SOURCE_PATHS.paywallCopy;
  copyDiscount[copyPath] = copyDiscount[copyPath].replace(
    "body: 'Review the annual Pro option.",
    "body: 'Save $29.99. Review the annual Pro option.",
  );
  assert.match(errorsFor(copyDiscount), /no hardcoded currency amount or percentage/);

  const wiring = freshSnapshot();
  const packagePath = PAY08_SOURCE_PATHS.packageJson;
  const packageJson = JSON.parse(wiring[packagePath]);
  packageJson.scripts['launch:contract:verify'] = packageJson.scripts[
    'launch:contract:verify'
  ].replace(' && npm run pay08:ios-win-back-source-contract:test', '');
  wiring[packagePath] = JSON.stringify(packageJson);
  assert.match(errorsFor(wiring), /launch:contract:verify must include/);
});

test('source checkpoint cannot erase the external App Store Connect boundary', () => {
  const snapshot = freshSnapshot();
  const path = PAY08_SOURCE_PATHS.checkpoint;
  snapshot[path] = snapshot[path].replace('`in_progress`', '`complete`');
  assert.match(errorsFor(snapshot), /must not claim PAY-08 complete/);
});
