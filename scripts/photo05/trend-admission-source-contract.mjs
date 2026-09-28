#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const PHOTO05A_TREND_SOURCE_PATHS = Object.freeze({
  checkpoint: 'docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md',
  featurePhotoProgress: 'docs/06-photo-progress.md',
  featureTrendAnalysis: 'docs/12-ai-trend-analysis.md',
  masterPlan: 'docs/MASTER_PLAN.md',
  decisions: 'docs/DECISIONS.md',
  featureIndex: 'docs/FEATURE_INDEX.md',
  roadmap: 'docs/ROADMAP.md',
  userFlowTree: 'docs/USER_FLOW_TREE.md',
  hugeTodoIndex: 'docs/hugeToDo/README.md',
  phase7SurfaceInventory: 'docs/phase-7/surface-inventory.md',
  launchContract: 'docs/hugeToDo/launch-contract.json',
  launchContractModule: 'scripts/launch/contract.mjs',
  launchContractSmoke: 'scripts/launch/contract-smoke.mjs',
  launchContractCheck: 'scripts/launch/check-contract.mjs',
  packageJson: 'package.json',
  exampleEnv: '.env.example',
  mobileEnv: 'apps/mobile/src/lib/env.ts',
  mobileEnvTest: 'apps/mobile/src/lib/env.test.ts',
  phase7: 'apps/mobile/src/lib/launch/phase7.ts',
  phase7Test: 'apps/mobile/src/lib/launch/phase7.test.ts',
  deferredSurface: 'apps/mobile/src/components/launch/DeferredSurface.tsx',
  deferredSurfaceTest: 'apps/mobile/src/components/launch/DeferredSurface.test.ts',
  safeBack: 'apps/mobile/src/lib/navigation/safeBack.ts',
  safeBackTest: 'apps/mobile/src/lib/navigation/safeBack.test.ts',
  dependentConsentContract: 'apps/mobile/src/lib/consent/dependentConsentContract.ts',
  dependentConsentContractTest: 'apps/mobile/src/lib/consent/dependentConsentContract.test.ts',
  dependentConsentLifecycle: 'apps/mobile/src/lib/consent/dependentConsentLifecycle.ts',
  dependentConsentLifecycleTest: 'apps/mobile/src/lib/consent/dependentConsentLifecycle.test.ts',
  progress: 'apps/mobile/src/app/(tabs)/progress.tsx',
  progressAbout: 'apps/mobile/src/app/progress/about.tsx',
  you: 'apps/mobile/src/app/(tabs)/you.tsx',
  trendLayout: 'apps/mobile/src/app/trend/_layout.tsx',
  trendOptIn: 'apps/mobile/src/app/trend/optin.tsx',
  trendFairness: 'apps/mobile/src/app/trend/fairness.tsx',
  applyConsentChoice: 'apps/mobile/src/features/trend/applyConsentChoice.ts',
  applyConsentChoiceTest: 'apps/mobile/src/features/trend/applyConsentChoice.test.ts',
  claimSafetyTest: 'apps/mobile/src/features/trend/claimsafety.test.ts',
  consent: 'apps/mobile/src/features/trend/consent.ts',
  consentTest: 'apps/mobile/src/features/trend/consent.test.ts',
  copy: 'apps/mobile/src/features/trend/copy.ts',
  fairnessPrivacyGateTest: 'apps/mobile/src/features/trend/fairnessPrivacyGate.test.ts',
  store: 'apps/mobile/src/features/trend/store.ts',
  storeTest: 'apps/mobile/src/features/trend/store.test.ts',
  candidateClassifier: 'apps/mobile/src/features/trend/trend.ts',
  candidateClassifierTest: 'apps/mobile/src/features/trend/trend.test.ts',
  receipt: 'apps/mobile/src/features/trend/receipt.ts',
  receiptTest: 'apps/mobile/src/features/trend/receipt.test.ts',
  trendInsight: 'apps/mobile/src/features/trend/TrendInsight.tsx',
  trendRoutesTest: 'apps/mobile/src/features/trend/trendRoutes.test.ts',
  useTrend: 'apps/mobile/src/features/trend/useTrend.ts',
  useTrendTest: 'apps/mobile/src/features/trend/useTrend.test.ts',
  photoCopy: 'apps/mobile/src/features/photos/copy.ts',
  publicTypes: 'packages/types/src/index.ts',
  databaseTypes: 'packages/types/src/database.types.ts',
  photoTrendMigration: 'supabase/migrations/20260613000024_photo_trend.sql',
  sourceContract: 'scripts/photo05/trend-admission-source-contract.mjs',
  sourceContractTest: 'scripts/photo05/trend-admission-source-contract.test.mjs',
  phase7PacketBuilder: 'scripts/phase7/build-core-loop-qa-packet.mjs',
  phase7Checker: 'scripts/phase7/check-core-loop.mjs',
  phase7CheckerSmoke: 'scripts/phase7/check-core-loop-smoke.mjs',
  phase7PacketContractTest: 'scripts/phase7/core-loop-qa-packet-contract.test.mjs',
  phase7PacketContract: 'scripts/phase7/core-loop-qa-packet-contract.mjs',
  phase9PacketBuilder: 'scripts/phase9/build-release-qa-packet.mjs',
  phase9ReleaseSmoke: 'scripts/phase9/release-smoke.mjs',
  phase9Integrity: 'scripts/phase9/release-qa-integrity.mjs',
  phase9IntegrityTest: 'scripts/phase9/release-qa-integrity.test.mjs',
});

export const PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS = Object.freeze(
  Object.values(PHOTO05A_TREND_SOURCE_PATHS),
);

export const REQUIRED_TREND_INSIGHT_ADMISSION = Object.freeze({
  trendInsightAdmitted: false,
  validatedOnDeviceEngineAvailable: false,
  resultIssuerAvailable: false,
  calibrationAuthorityAvailable: false,
  fairnessAuthorityAvailable: false,
  simulatedMetricsAllowed: false,
  contentAnalyticsAllowed: false,
  disabledPathSideEffectsAllowed: false,
  cloudPhotoProcessingAllowed: false,
  scoreAgeGradePercentageAllowed: false,
});

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MOBILE_SOURCE_ROOT = 'apps/mobile/src';
const DISABLED_ENTRY_PATHS = Object.freeze([
  PHOTO05A_TREND_SOURCE_PATHS.phase7,
  PHOTO05A_TREND_SOURCE_PATHS.trendLayout,
  PHOTO05A_TREND_SOURCE_PATHS.trendOptIn,
  PHOTO05A_TREND_SOURCE_PATHS.trendFairness,
  PHOTO05A_TREND_SOURCE_PATHS.applyConsentChoice,
  PHOTO05A_TREND_SOURCE_PATHS.trendInsight,
  PHOTO05A_TREND_SOURCE_PATHS.useTrend,
]);
const BANNED_DISABLED_IDENTIFIERS = new Set([
  'Crypto',
  'FileSystem',
  'Sharing',
  'XMLHttpRequest',
  'axios',
  'captureRef',
  'classifyChange',
  'deltaMetric',
  'digestStringAsync',
  'fetch',
  'grantHealthDependentConsent',
  'require',
  'isTrendInsightsConsented',
  'lightingConsistent',
  'mdcThreshold',
  'sendBeacon',
  'shareAsync',
  'supabase',
  'toneAdjustedMdc',
  'track',
  'trendNarrative',
  'usePhotos',
  'useQuery',
]);
const BANNED_DISABLED_MODULE =
  /(?:^|\/)(?:analytics|features\/onboarding|features\/photos\/usePhotos|lib\/supabase)(?:\/|$)|^(?:expo-crypto|expo-file-system(?:\/legacy)?|expo-sharing|react-native-view-shot)$/u;
const BANNED_TREND_BYPASS =
  /(?:__DEV__|EXPO_PUBLIC_(?:E2E|PHASE7_TREND)|process\.env[\s\S]{0,100}trend|trend[\s\S]{0,100}(?:fixture|legacy|e2e|callerOverride))/iu;
const BANNED_SIMULATED_OUTPUT =
  /\b(?:deltaMetric|lightingConsistent|mdcThreshold|toneAdjustedMdc|simulatedDelta|syntheticDelta|skinScore|skinAge|rednessMetric|erythemaMetric|percentageImprovement)\b/u;

function normalize(text) {
  return String(text).replaceAll('\r\n', '\n');
}

function walkSourceFiles(root, relative = MOBILE_SOURCE_ROOT) {
  const absolute = resolve(root, relative);
  if (!existsSync(absolute)) return [];
  const out = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = `${relative}/${entry.name}`.replaceAll('\\', '/');
    if (entry.isDirectory()) out.push(...walkSourceFiles(root, path));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) out.push(path);
  }
  return out.sort();
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

function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function variableInitializer(source, name) {
  let initializer = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      initializer = node.initializer ?? null;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return initializer;
}

function frozenObject(source, name) {
  const initializer = unwrap(variableInitializer(source, name));
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    !ts.isPropertyAccessExpression(initializer.expression) ||
    initializer.expression.expression.getText(source) !== 'Object' ||
    initializer.expression.name.text !== 'freeze' ||
    initializer.arguments.length !== 1
  ) {
    return null;
  }
  const object = unwrap(initializer.arguments[0]);
  return object && ts.isObjectLiteralExpression(object) ? object : null;
}

function objectProperty(source, object, name) {
  if (!object) return null;
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (property.name.getText(source).replace(/^['"]|['"]$/gu, '') === name) {
      return unwrap(property.initializer);
    }
  }
  return null;
}

function namedFunction(source, name) {
  let match = null;
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      match = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return match;
}

function returnExpressions(node) {
  const returns = [];
  if (!node?.body) return returns;
  const visit = (child) => {
    if (ts.isFunctionLike(child) && child !== node) return;
    if (ts.isReturnStatement(child)) returns.push(unwrap(child.expression));
    ts.forEachChild(child, visit);
  };
  visit(node.body);
  return returns;
}

function callNames(node) {
  const names = [];
  const visit = (child) => {
    if (ts.isCallExpression(child) || ts.isNewExpression(child)) {
      const expression = child.expression;
      if (ts.isIdentifier(expression)) names.push(expression.text);
      if (ts.isPropertyAccessExpression(expression)) names.push(expression.name.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

function identifiers(node) {
  const names = new Set();
  const visit = (child) => {
    if (ts.isIdentifier(child)) names.add(child.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

function importedModules(source) {
  return source.statements.filter(ts.isImportDeclaration).map((node) => node.moduleSpecifier.text);
}

function exportedRuntimeNames(source) {
  const names = [];
  for (const statement of source.statements) {
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) names.push(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
  }
  return names.sort();
}

function stringArgumentsForCalls(source, name) {
  const values = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === name
    ) {
      values.push(ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : null);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

function runtimeImportedModules(source) {
  const modules = [];
  for (const node of source.statements) {
    if (
      ts.isImportDeclaration(node) &&
      !node.importClause?.isTypeOnly &&
      !(
        node.importClause?.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings) &&
        node.importClause.namedBindings.elements.every((element) => element.isTypeOnly)
      )
    ) {
      modules.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier) &&
      !node.isTypeOnly &&
      !(
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.every((element) => element.isTypeOnly)
      )
    ) {
      modules.push(node.moduleSpecifier.text);
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      modules.push(node.moduleReference.expression.text);
    }
  }
  return modules;
}

function dynamicRuntimeImportedModules(source) {
  const modules = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        modules.push(ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : null);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return modules;
}

function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\r\n]*/gu, '');
}

function functionReferencesParameter(source, fn) {
  if (!fn?.body) return false;
  const parameters = new Set(
    fn.parameters.filter((node) => ts.isIdentifier(node.name)).map((node) => node.name.text),
  );
  if (parameters.size === 0) return false;
  let referenced = false;
  const visit = (node) => {
    if (ts.isIdentifier(node) && parameters.has(node.text)) referenced = true;
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return referenced;
}

function auditNullRenderer(add, path, source, name) {
  const fn = namedFunction(source, name);
  const returns = returnExpressions(fn);
  add(Boolean(fn), path, `${name}() is missing`);
  add(
    returns.length > 0 && returns.every((value) => value?.kind === ts.SyntaxKind.NullKeyword),
    path,
    `${name}() must return only null`,
  );
  add(
    fn ? callNames(fn.body).length === 0 : false,
    path,
    `${name}() must not call hooks, analytics, classifiers, or side effects`,
  );
  add(
    !functionReferencesParameter(source, fn),
    path,
    `${name}() must not inspect caller-supplied source or props`,
  );
}

export function loadPhoto05aTrendSourceSnapshot(root = scriptRoot) {
  const snapshot = {};
  const paths = new Set([...PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS, ...walkSourceFiles(root)]);
  for (const path of [...paths].sort()) {
    const absolute = resolve(root, path);
    if (existsSync(absolute)) snapshot[path] = normalize(readFileSync(absolute, 'utf8'));
  }
  return Object.freeze(snapshot);
}

export function auditPhoto05aTrendSourceSnapshot(snapshot) {
  const errors = [];
  const add = (condition, path, message) => {
    if (!condition) errors.push(`${path}: ${message}.`);
  };

  for (const path of PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS) {
    add(typeof snapshot[path] === 'string', path, 'required PHOTO-05A authority source is missing');
  }
  if (errors.length > 0) return Object.freeze(errors.sort());
  for (const prefix of ['apps/mobile/src/features/trend/', 'apps/mobile/src/app/trend/']) {
    const actual = Object.keys(snapshot)
      .filter((path) => path.startsWith(prefix) && /\.(?:ts|tsx)$/u.test(path))
      .sort();
    const inventoried = PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS.filter((path) =>
      path.startsWith(prefix),
    ).sort();
    add(
      JSON.stringify(actual) === JSON.stringify(inventoried),
      PHOTO05A_TREND_SOURCE_PATHS.sourceContract,
      `complete Trend authority inventory must include every source under ${prefix}`,
    );
  }

  const prerequisitePaths = [
    PHOTO05A_TREND_SOURCE_PATHS.candidateClassifier,
    PHOTO05A_TREND_SOURCE_PATHS.receipt,
  ];
  for (const path of prerequisitePaths) {
    const text = withoutComments(snapshot[path]);
    add(
      !/(?:\bfetch\b|XMLHttpRequest|sendBeacon|supabase|posthog|sentry|\btrack\s*\(|photo_trend)/iu.test(
        text,
      ),
      path,
      'isolated Trend prerequisite must not contain network, content telemetry, observability, or server-row writes',
    );
    add(
      !/(?:BASE_MDC|DEFAULT_[A-Z_]*(?:THRESHOLD|MDC)|toneAdjustmentFactor|toneAdjustedMdc)/u.test(
        text,
      ),
      path,
      'isolated Trend prerequisite must not define a fabricated threshold or tone adjustment',
    );
  }
  const candidate = sourceFile(
    PHOTO05A_TREND_SOURCE_PATHS.candidateClassifier,
    snapshot[PHOTO05A_TREND_SOURCE_PATHS.candidateClassifier],
  );
  add(
    JSON.stringify(exportedRuntimeNames(candidate)) ===
      JSON.stringify(['TREND_CANDIDATE_CLASSIFIER_QUARANTINED']),
    PHOTO05A_TREND_SOURCE_PATHS.candidateClassifier,
    'legacy Trend classifier must remain quarantined behind one inert marker',
  );
  const receipt = sourceFile(
    PHOTO05A_TREND_SOURCE_PATHS.receipt,
    snapshot[PHOTO05A_TREND_SOURCE_PATHS.receipt],
  );
  add(
    JSON.stringify(exportedRuntimeNames(receipt)) ===
      JSON.stringify(
        [
          'TREND_ABSTENTION_REASONS',
          'TREND_ENGINE_INPUT_SCHEMA_VERSION',
          'TREND_LOCAL_AUTHENTICATION_ALGORITHM',
          'TREND_RESULT_RECEIPT_SCHEMA_VERSION',
          'canonicalTrendReceiptPayloadV1',
          'parseTrendEngineInputV1',
          'parseTrendResultReceiptV1',
          'sealTrendResultReceiptV1',
          'verifyTrendResultReceiptV1',
        ].sort(),
      ),
    PHOTO05A_TREND_SOURCE_PATHS.receipt,
    'isolated Trend receipt must expose only the reviewed prerequisite runtime surface',
  );

  const parsed = (path) => sourceFile(path, snapshot[path]);
  const phase7 = parsed(PHOTO05A_TREND_SOURCE_PATHS.phase7);
  const capabilities = frozenObject(phase7, 'phase7Capabilities');
  const flags = frozenObject(phase7, 'phase7Flags');
  add(
    Boolean(capabilities),
    PHOTO05A_TREND_SOURCE_PATHS.phase7,
    'phase7Capabilities must be frozen',
  );
  add(
    objectProperty(phase7, capabilities, 'trendEngine')?.kind === ts.SyntaxKind.FalseKeyword,
    PHOTO05A_TREND_SOURCE_PATHS.phase7,
    'phase7Capabilities.trendEngine must remain the literal false',
  );
  add(Boolean(flags), PHOTO05A_TREND_SOURCE_PATHS.phase7, 'phase7Flags must be frozen');
  add(
    objectProperty(phase7, flags, 'trend')?.kind === ts.SyntaxKind.FalseKeyword,
    PHOTO05A_TREND_SOURCE_PATHS.phase7,
    'phase7Flags.trend must remain the literal false',
  );
  add(
    !/(?:phase7TrendEnabled|EXPO_PUBLIC_PHASE7_TREND_ENABLED)/u.test(
      snapshot[PHOTO05A_TREND_SOURCE_PATHS.phase7],
    ),
    PHOTO05A_TREND_SOURCE_PATHS.phase7,
    'Trend admission must not depend on an environment flag',
  );

  let launchAdmission = null;
  try {
    launchAdmission = JSON.parse(
      snapshot[PHOTO05A_TREND_SOURCE_PATHS.launchContract],
    ).trendInsightAdmission;
  } catch {
    add(false, PHOTO05A_TREND_SOURCE_PATHS.launchContract, 'launch contract must be valid JSON');
  }
  add(
    JSON.stringify(launchAdmission) === JSON.stringify(REQUIRED_TREND_INSIGHT_ADMISSION),
    PHOTO05A_TREND_SOURCE_PATHS.launchContract,
    'trendInsightAdmission must remain the exact literal-zero PHOTO-05A machine contract',
  );

  const useTrend = parsed(PHOTO05A_TREND_SOURCE_PATHS.useTrend);
  add(
    runtimeImportedModules(useTrend).length === 0,
    PHOTO05A_TREND_SOURCE_PATHS.useTrend,
    'disabled Trend hooks must not import photos, consent, profile, network, classifier, narrative, or hook dependencies',
  );
  add(
    !BANNED_SIMULATED_OUTPUT.test(snapshot[PHOTO05A_TREND_SOURCE_PATHS.useTrend]),
    PHOTO05A_TREND_SOURCE_PATHS.useTrend,
    'disabled Trend hooks must not evaluate simulated metrics, MDC, fairness, scores, percentages, or redness',
  );
  add(
    JSON.stringify(exportedRuntimeNames(useTrend)) ===
      JSON.stringify([
        'readMonkBand',
        'useMonkBand',
        'useTrendConsent',
        'useTrendInsight',
        'useTrendInsightFromPhotos',
      ]),
    PHOTO05A_TREND_SOURCE_PATHS.useTrend,
    'disabled Trend compatibility module must expose only the exact inert runtime API',
  );
  for (const name of [
    'useTrendConsent',
    'useMonkBand',
    'useTrendInsightFromPhotos',
    'useTrendInsight',
  ]) {
    const fn = namedFunction(useTrend, name);
    add(Boolean(fn), PHOTO05A_TREND_SOURCE_PATHS.useTrend, `${name}() is missing`);
    add(
      fn ? !functionReferencesParameter(useTrend, fn) : false,
      PHOTO05A_TREND_SOURCE_PATHS.useTrend,
      `${name}() must not inspect caller-supplied photos, options, consent, tone, fixture, or legacy state`,
    );
    add(
      fn ? callNames(fn.body).length === 0 : false,
      PHOTO05A_TREND_SOURCE_PATHS.useTrend,
      `${name}() must return a pre-frozen unavailable result without runtime calls`,
    );
  }
  const readMonkBand = namedFunction(useTrend, 'readMonkBand');
  add(Boolean(readMonkBand), PHOTO05A_TREND_SOURCE_PATHS.useTrend, 'readMonkBand() is missing');
  add(
    readMonkBand &&
      readMonkBand.parameters.length === 0 &&
      returnExpressions(readMonkBand).length > 0 &&
      returnExpressions(readMonkBand).every((value) => value?.kind === ts.SyntaxKind.NullKeyword),
    PHOTO05A_TREND_SOURCE_PATHS.useTrend,
    'readMonkBand() must accept no caller input and return only null',
  );
  add(
    readMonkBand && callNames(readMonkBand.body).length === 0,
    PHOTO05A_TREND_SOURCE_PATHS.useTrend,
    'readMonkBand() must not call a caller object, profile, storage, hook, or network dependency',
  );

  const insight = parsed(PHOTO05A_TREND_SOURCE_PATHS.trendInsight);
  add(
    importedModules(insight).length === 0,
    PHOTO05A_TREND_SOURCE_PATHS.trendInsight,
    'the disabled Trend renderer must not import UI, hooks, analytics, copy, or classifiers',
  );
  add(
    JSON.stringify(exportedRuntimeNames(insight)) ===
      JSON.stringify(['TrendInsight', 'TrendInsightFromSource']),
    PHOTO05A_TREND_SOURCE_PATHS.trendInsight,
    'disabled Trend renderer must expose only the exact null-rendering API',
  );
  auditNullRenderer(
    add,
    PHOTO05A_TREND_SOURCE_PATHS.trendInsight,
    insight,
    'TrendInsightFromSource',
  );
  auditNullRenderer(add, PHOTO05A_TREND_SOURCE_PATHS.trendInsight, insight, 'TrendInsight');

  const consent = parsed(PHOTO05A_TREND_SOURCE_PATHS.consent);
  const consentText = snapshot[PHOTO05A_TREND_SOURCE_PATHS.consent];
  add(
    JSON.stringify(importedModules(consent).sort()) ===
      JSON.stringify([
        './store',
        '@/lib/analytics/track',
        '@/lib/consent/dependentConsentLifecycle',
      ]),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'Trend consent module may import only the bounded withdrawal cleanup dependencies',
  );
  add(
    JSON.stringify(exportedRuntimeNames(consent)) ===
      JSON.stringify([
        'TREND_ENGINE_UNAVAILABLE',
        'grantTrendInsightsConsent',
        'isTrendInsightsConsented',
        'revokeTrendInsightsConsent',
      ]),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'Trend consent module must expose only the exact read-false, grant-reject, and cleanup API',
  );
  add(
    JSON.stringify(stringArgumentsForCalls(consent, 'track')) ===
      JSON.stringify(['trend_consent_revoked']),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'Trend consent module may emit only the non-content withdrawal lifecycle event',
  );
  add(
    /TREND_ENGINE_UNAVAILABLE\s*=\s*['"]TREND_ENGINE_UNAVAILABLE['"]/u.test(consentText),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'the bounded TREND_ENGINE_UNAVAILABLE result is missing',
  );
  add(
    !/(?:grantHealthDependentConsent|trend_insights_opted_in|trend_shown|trend_(?:consistent|change|inconclusive|result|score))/u.test(
      consentText,
    ),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'positive consent admission and Trend content analytics must not exist',
  );
  const consentPredicate = namedFunction(consent, 'isTrendInsightsConsented');
  add(
    Boolean(consentPredicate),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'isTrendInsightsConsented() is missing',
  );
  add(
    consentPredicate &&
      returnExpressions(consentPredicate).length > 0 &&
      returnExpressions(consentPredicate).every(
        (value) =>
          value?.kind === ts.SyntaxKind.FalseKeyword ||
          (ts.isCallExpression(value) &&
            value.expression.getText(consent) === 'Promise.resolve' &&
            value.arguments[0]?.kind === ts.SyntaxKind.FalseKeyword),
      ),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'isTrendInsightsConsented() must return only false without reading storage or network state',
  );
  const grant = namedFunction(consent, 'grantTrendInsightsConsent');
  add(
    Boolean(grant),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'grantTrendInsightsConsent() is missing',
  );
  add(
    grant &&
      callNames(grant.body).every((name) => name === 'Error') &&
      /throw new Error\(TREND_ENGINE_UNAVAILABLE\)/u.test(grant.body.getText(consent)),
    PHOTO05A_TREND_SOURCE_PATHS.consent,
    'grantTrendInsightsConsent() must throw TREND_ENGINE_UNAVAILABLE before any work',
  );

  const applyChoiceText = snapshot[PHOTO05A_TREND_SOURCE_PATHS.applyConsentChoice];
  add(
    /if \(enabled\) return false;/u.test(applyChoiceText) &&
      !/(?:deps\.)?grant\s*\(/u.test(applyChoiceText),
    PHOTO05A_TREND_SOURCE_PATHS.applyConsentChoice,
    'positive consent choice must fail closed before dependency or invalidation work',
  );

  for (const path of [
    PHOTO05A_TREND_SOURCE_PATHS.trendOptIn,
    PHOTO05A_TREND_SOURCE_PATHS.trendFairness,
  ]) {
    const text = snapshot[path];
    add(/<DeferredSurface\b/u.test(text), path, 'direct Trend route must render DeferredSurface');
    add(/surface="trend"/u.test(text), path, 'direct Trend route must bind the trend surface');
    add(/trackView=\{false\}/u.test(text), path, 'direct Trend route must suppress view analytics');
    add(
      !/(?:EnabledFairness|TREND_COPY|useMonkBand|grantTrend|ToggleSwitch)/u.test(text),
      path,
      'direct Trend route must not retain an enabled, fairness, metric, or consent branch',
    );
  }
  const trendLayoutText = snapshot[PHOTO05A_TREND_SOURCE_PATHS.trendLayout];
  const trendLayoutSource = parsed(PHOTO05A_TREND_SOURCE_PATHS.trendLayout);
  const trendScreenGate = namedFunction(trendLayoutSource, 'TrendScreenGate');
  add(
    /screenLayout=\{\(\{ children \}\) => <TrendScreenGate>\{children\}<\/TrendScreenGate>\}/u.test(
      trendLayoutText,
    ) &&
      Boolean(trendScreenGate) &&
      !functionReferencesParameter(trendLayoutSource, trendScreenGate) &&
      /<DeferredSurface\b/u.test(trendLayoutText) &&
      /trackView=\{false\}/u.test(trendLayoutText),
    PHOTO05A_TREND_SOURCE_PATHS.trendLayout,
    'Trend route group must unconditionally withhold matched children behind an analytics-free unavailable surface',
  );
  add(
    !/(?:phase7Flags|isPhase7SurfaceEnabled)/u.test(trendLayoutText),
    PHOTO05A_TREND_SOURCE_PATHS.trendLayout,
    'Trend route group must not retain a flag, caller, or matched-child admission branch',
  );

  const deferredText = snapshot[PHOTO05A_TREND_SOURCE_PATHS.deferredSurface];
  add(
    /trackView\s*=\s*true/u.test(deferredText) &&
      /if\s*\(!trackView\)\s*return/u.test(deferredText),
    PHOTO05A_TREND_SOURCE_PATHS.deferredSurface,
    'DeferredSurface must return before analytics when trackView is false',
  );

  for (const path of [
    PHOTO05A_TREND_SOURCE_PATHS.progress,
    PHOTO05A_TREND_SOURCE_PATHS.progressAbout,
  ]) {
    const text = snapshot[path];
    add(
      !/(?:features\/trend|TrendInsight|useTrendConsent|phase7Flags\.trend)/u.test(text),
      path,
      'Progress must not mount a Trend result, consent read, or hidden Trend branch',
    );
  }
  add(
    !/(?:features\/trend|useTrend|TrendInsight)/u.test(snapshot[PHOTO05A_TREND_SOURCE_PATHS.you]),
    PHOTO05A_TREND_SOURCE_PATHS.you,
    'the You surface must not import or evaluate Trend runtime code',
  );

  for (const path of DISABLED_ENTRY_PATHS) {
    const text = snapshot[path];
    const source = parsed(path);
    const bannedIdentifier = [...identifiers(source)].find((name) =>
      BANNED_DISABLED_IDENTIFIERS.has(name),
    );
    const bannedModule = runtimeImportedModules(source).find((module) =>
      BANNED_DISABLED_MODULE.test(module),
    );
    const dynamicModule = dynamicRuntimeImportedModules(source)[0];
    add(
      !bannedIdentifier,
      path,
      `disabled Trend path contains banned runtime identifier ${bannedIdentifier ?? ''}`.trim(),
    );
    add(
      !bannedModule,
      path,
      `disabled Trend path imports banned runtime module ${bannedModule ?? ''}`.trim(),
    );
    add(
      dynamicModule === undefined,
      path,
      `disabled Trend path must not dynamically load runtime modules ${dynamicModule ?? ''}`.trim(),
    );
    add(
      !BANNED_TREND_BYPASS.test(withoutComments(text)),
      path,
      'Trend must not have environment, development, E2E, fixture, legacy, or caller bypasses',
    );
  }

  for (const [path, text] of Object.entries(snapshot)) {
    if (
      !path.startsWith(`${MOBILE_SOURCE_ROOT}/`) ||
      /\.test\.(?:ts|tsx)$/u.test(path) ||
      path.startsWith('apps/mobile/src/features/trend/')
    ) {
      continue;
    }
    const source = sourceFile(path, text);
    const runtimeIdentifiers = identifiers(source);
    const unsafeLoader = ['require', 'eval', 'Function'].find((name) =>
      runtimeIdentifiers.has(name),
    );
    add(
      !unsafeLoader,
      path,
      `production source must not expose an ungoverned runtime loader ${unsafeLoader ?? ''}`.trim(),
    );
    const dynamicModules = dynamicRuntimeImportedModules(source);
    add(
      !dynamicModules.includes(null),
      path,
      'production source must not use an unresolved dynamic module specifier',
    );
    const trendImport = [
      ...runtimeImportedModules(source),
      ...dynamicModules.filter((module) => module !== null),
    ].find((module) => /(?:^|\/)features\/trend(?:\/|$)/u.test(module));
    add(
      !trendImport,
      path,
      `production surface must not import disabled Trend runtime module ${trendImport ?? ''}`.trim(),
    );
  }

  let packageScripts = {};
  try {
    packageScripts = JSON.parse(snapshot[PHOTO05A_TREND_SOURCE_PATHS.packageJson]).scripts ?? {};
  } catch {
    add(false, PHOTO05A_TREND_SOURCE_PATHS.packageJson, 'package manifest must be valid JSON');
  }
  add(
    packageScripts['photo05:trend-admission-source-contract:test'] ===
      'node --test scripts/photo05/trend-admission-source-contract.test.mjs',
    PHOTO05A_TREND_SOURCE_PATHS.packageJson,
    'PHOTO-05A adversarial contract command must be exact',
  );
  add(
    /photo05:trend-admission-source-contract:test/u.test(
      packageScripts['launch:contract:verify'] ?? '',
    ),
    PHOTO05A_TREND_SOURCE_PATHS.packageJson,
    'launch contract verification must block on PHOTO-05A',
  );
  for (const parent of ['phase7:verify', 'phase9:verify', 'launch:verify']) {
    add(
      /launch:contract:verify/u.test(packageScripts[parent] ?? ''),
      PHOTO05A_TREND_SOURCE_PATHS.packageJson,
      `${parent} must transitively block on PHOTO-05A`,
    );
  }
  for (const path of [
    PHOTO05A_TREND_SOURCE_PATHS.phase7PacketBuilder,
    PHOTO05A_TREND_SOURCE_PATHS.phase9PacketBuilder,
  ]) {
    const text = snapshot[path];
    add(
      /PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS/u.test(text),
      path,
      'governed packet source inventory must bind every PHOTO-05A authority path',
    );
    add(
      /trendInsightAdmission\.trendInsightAdmitted/u.test(text),
      path,
      'governed packet must expose literal-zero Trend admission as a release blocker',
    );
  }
  for (const path of [
    PHOTO05A_TREND_SOURCE_PATHS.phase7Checker,
    PHOTO05A_TREND_SOURCE_PATHS.phase9ReleaseSmoke,
  ]) {
    add(
      /auditPhoto05aTrendAdmission/u.test(snapshot[path]),
      path,
      'Phase checker must execute the PHOTO-05A source audit',
    );
    add(
      /PHOTO05A_TREND_AUTHORITY_SOURCE_PATHS/u.test(snapshot[path]),
      path,
      'Phase checker must require the complete PHOTO-05A source inventory',
    );
  }

  return Object.freeze(errors.sort());
}

export function auditPhoto05aTrendAdmission(root = scriptRoot) {
  return auditPhoto05aTrendSourceSnapshot(loadPhoto05aTrendSourceSnapshot(root));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = auditPhoto05aTrendAdmission(process.cwd());
  if (errors.length > 0) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exit(1);
  }
  console.log('PHOTO-05A Trend admission source contract passed.');
}
