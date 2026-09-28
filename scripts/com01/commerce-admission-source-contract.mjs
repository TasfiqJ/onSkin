#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const REQUIRED_COMMERCE_ADMISSION = Object.freeze({
  commerceAdmitted: false,
  affiliateRailAvailable: false,
  publicationAuthorityAvailable: false,
  reviewedCatalogAvailable: false,
  reviewedStacksAvailable: false,
  partnerPollingAllowed: false,
  consentGrantAllowed: false,
  catalogReadsAllowed: false,
  clickRecordingAllowed: false,
  externalNavigationAllowed: false,
  analyticsAllowed: false,
  disabledPathSideEffectsAllowed: false,
});

export const COM01A_SOURCE_PATHS = Object.freeze({
  checkpoint:
    'docs/hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md',
  featureCommerce: 'docs/10-creator-stacks-build-spec.md',
  masterPlan: 'docs/MASTER_PLAN.md',
  decisions: 'docs/DECISIONS.md',
  featureIndex: 'docs/FEATURE_INDEX.md',
  roadmap: 'docs/ROADMAP.md',
  userFlowTree: 'docs/USER_FLOW_TREE.md',
  blockers: 'BLOCKERS.md',
  progress: 'PROGRESS.md',
  hugeTodoIndex: 'docs/hugeToDo/README.md',
  phase7SurfaceInventory: 'docs/phase-7/surface-inventory.md',
  envExample: '.env.example',
  launchContract: 'docs/hugeToDo/launch-contract.json',
  launchContractModule: 'scripts/launch/contract.mjs',
  launchContractSmoke: 'scripts/launch/contract-smoke.mjs',
  packageJson: 'package.json',
  env: 'apps/mobile/src/lib/env.ts',
  phase7: 'apps/mobile/src/lib/launch/phase7.ts',
  phase7Test: 'apps/mobile/src/lib/launch/phase7.test.ts',
  deferredSurface: 'apps/mobile/src/components/launch/DeferredSurface.tsx',
  commerceDeferredSurface:
    'apps/mobile/src/features/commerce/CommerceDeferredSurface.tsx',
  commerceLayout: 'apps/mobile/src/app/commerce/_layout.tsx',
  commerceConsentRoute: 'apps/mobile/src/app/commerce/consent.tsx',
  commerceStacksRoute: 'apps/mobile/src/app/commerce/stacks.tsx',
  commerceStackRoute: 'apps/mobile/src/app/commerce/stack/[slug].tsx',
  commerceTransparencyRoute:
    'apps/mobile/src/app/commerce/transparency.tsx',
  replenishRoute: 'apps/mobile/src/app/shelf/replenish.tsx',
  youRoute: 'apps/mobile/src/app/(tabs)/you.tsx',
  whereToBuy: 'apps/mobile/src/features/commerce/WhereToBuy.tsx',
  commerceLinkNotice:
    'apps/mobile/src/features/commerce/CommerceLinkNotice.tsx',
  commerceCopy: 'apps/mobile/src/features/commerce/copy.ts',
  lockGlyph: 'apps/mobile/src/features/commerce/LockGlyph.tsx',
  consent: 'apps/mobile/src/features/commerce/consent.ts',
  consentLogic: 'apps/mobile/src/features/commerce/consentLogic.ts',
  disclosureOperation:
    'apps/mobile/src/features/commerce/disclosureOperation.ts',
  attribution: 'apps/mobile/src/features/commerce/attribution.ts',
  store: 'apps/mobile/src/features/commerce/store.ts',
  useCommerce: 'apps/mobile/src/features/commerce/useCommerce.ts',
  links: 'apps/mobile/src/features/commerce/links.ts',
  stacks: 'apps/mobile/src/features/commerce/stacks.ts',
  orderReportPoll: 'supabase/functions/order-report-poll/index.ts',
  orderAttributionCore:
    'supabase/functions/order-report-poll/orderAttributionCore.ts',
  migration:
    'supabase/migrations/20260729000072_commerce_zero_admission.sql',
  databaseContract:
    'supabase/tests/database/commerce_zero_admission.test.sql',
  upgradeContract:
    'supabase/tests/upgrade/commerce_zero_admission_0072_upgrade.test.sql',
  sourceContract: 'scripts/com01/commerce-admission-source-contract.mjs',
  sourceContractTest:
    'scripts/com01/commerce-admission-source-contract.test.mjs',
  phase7Checker: 'scripts/phase7/check-core-loop.mjs',
  phase7CheckerSmoke: 'scripts/phase7/check-core-loop-smoke.mjs',
  phase7PacketBuilder: 'scripts/phase7/build-core-loop-qa-packet.mjs',
  phase7PacketContractTest:
    'scripts/phase7/core-loop-qa-packet-contract.test.mjs',
  phase9PacketBuilder: 'scripts/phase9/build-release-qa-packet.mjs',
  phase9ReleaseSmoke: 'scripts/phase9/release-smoke.mjs',
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MOBILE_COMMERCE_DIRECTORIES = Object.freeze([
  'apps/mobile/src/app/commerce',
  'apps/mobile/src/features/commerce',
]);
const COMMERCE_ROUTE_PATHS = Object.freeze([
  COM01A_SOURCE_PATHS.commerceConsentRoute,
  COM01A_SOURCE_PATHS.commerceStacksRoute,
  COM01A_SOURCE_PATHS.commerceStackRoute,
  COM01A_SOURCE_PATHS.commerceTransparencyRoute,
]);
const ALLOWED_PRODUCTION_COMMERCE_REFERENCES = Object.freeze([
  'apps/mobile/src/app/commerce/consent.tsx:@/features/commerce/CommerceDeferredSurface',
  'apps/mobile/src/app/commerce/stack/[slug].tsx:@/features/commerce/CommerceDeferredSurface',
  'apps/mobile/src/app/commerce/stacks.tsx:@/features/commerce/CommerceDeferredSurface',
  'apps/mobile/src/app/commerce/transparency.tsx:@/features/commerce/CommerceDeferredSurface',
  'apps/mobile/src/app/recommendations/[id].tsx:@/features/commerce/WhereToBuy',
].sort());
const ALLOWED_SERVER_COMMERCE_AUTHORITY_PATHS = Object.freeze([
  'supabase/functions/account-deletion/serviceRoleCleanup.ts',
  'supabase/functions/consent-withdrawal/dependentCleanupRuntime.ts',
  'supabase/functions/consent-withdrawal/granularWithdrawalCore.ts',
  'supabase/functions/data-export/exportRegistry.ts',
  'supabase/functions/data-export/index.ts',
  COM01A_SOURCE_PATHS.orderAttributionCore,
].sort());
const SERVER_COMMERCE_AUTHORITY_PATTERN =
  /(?:SHOPMY|ORDER_REPORT_|affiliate_links|creator_stacks|creator_stack_items|commerce_click_events|order_attributions|persistOrderAttribution|pollOrderReportPages)/iu;
const BANNED_DISABLED_MODULE =
  /^(?:expo-crypto|expo-linking|expo-web-browser)|(?:^|\/)(?:analytics|lib\/supabase|navigation\/externalUrl)(?:\/|$)/u;
const BANNED_BYPASS =
  /(?:__DEV__|process\.env|EXPO_PUBLIC_(?:E2E|PHASE7_COMMERCE)|example\.com|fixture.*commerce|commerce.*fixture)/iu;
const BANNED_RUNTIME_IDENTIFIERS = new Set([
  'Crypto',
  'Linking',
  'XMLHttpRequest',
  'axios',
  'buildClickToken',
  'createClient',
  'fetch',
  'openExternalHttpsUrl',
  'openURL',
  'randomUUID',
  'recordClick',
  'sendBeacon',
  'supabase',
  'track',
]);

function normalize(value) {
  return String(value).replaceAll('\r\n', '\n');
}

function walk(rootPath, relative) {
  const absolute = resolve(rootPath, relative);
  if (!existsSync(absolute)) return [];
  const out = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = `${relative}/${entry.name}`.replaceAll('\\', '/');
    if (entry.isDirectory()) out.push(...walk(rootPath, path));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) out.push(path);
  }
  return out.sort();
}

const INVENTORIED_COMMERCE_SOURCES = Object.freeze(
  MOBILE_COMMERCE_DIRECTORIES.flatMap((directory) => walk(root, directory)).sort(),
);
const MOBILE_PRODUCTION_SOURCE_PATHS = Object.freeze(
  walk(root, 'apps/mobile/src').filter((path) => !/\.test\.tsx?$/u.test(path)),
);
const SERVER_PRODUCTION_SOURCE_PATHS = Object.freeze(
  walk(root, 'supabase/functions').filter((path) => !/\.test\.ts$/u.test(path)),
);

export const COM01A_COMMERCE_AUTHORITY_SOURCE_PATHS = Object.freeze(
  [...new Set([
    ...Object.values(COM01A_SOURCE_PATHS),
    ...INVENTORIED_COMMERCE_SOURCES,
  ])].sort(),
);

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
  let found = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node.initializer ?? null;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
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
  const value = unwrap(initializer.arguments[0]);
  return value && ts.isObjectLiteralExpression(value) ? value : null;
}

function objectProperty(source, object, name) {
  if (!object) return null;
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const propertyName = property.name.getText(source).replace(/^['"]|['"]$/gu, '');
    if (propertyName === name) return unwrap(property.initializer);
  }
  return null;
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

function defaultExportedFunction(source) {
  return (
    source.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) &&
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword),
    ) ?? null
  );
}

function returnsOnlySelfClosingElement(source, fn, tagName) {
  if (!fn?.body || fn.body.statements.length !== 1) return false;
  const statement = fn.body.statements[0];
  if (!ts.isReturnStatement(statement) || !statement.expression) return false;
  const expression = unwrap(statement.expression);
  return (
    ts.isJsxSelfClosingElement(expression) &&
    expression.tagName.getText(source) === tagName &&
    expression.attributes.properties.length === 0
  );
}

function callNames(node) {
  const names = [];
  if (!node) return names;
  const visit = (child) => {
    if (ts.isCallExpression(child) || ts.isNewExpression(child)) {
      if (ts.isIdentifier(child.expression)) names.push(child.expression.text);
      if (ts.isPropertyAccessExpression(child.expression)) names.push(child.expression.name.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

function identifiers(node) {
  const names = new Set();
  if (!node) return names;
  const visit = (child) => {
    if (ts.isIdentifier(child)) names.add(child.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

function importedModules(source) {
  return source.statements
    .filter(ts.isImportDeclaration)
    .map((node) => node.moduleSpecifier.text);
}

function runtimeImportedModules(source) {
  return source.statements
    .filter(ts.isImportDeclaration)
    .filter((node) => !node.importClause?.isTypeOnly)
    .map((node) => node.moduleSpecifier.text);
}

function staticStringValue(node, source, bindings) {
  const value = unwrap(node);
  if (ts.isStringLiteralLike(value)) return value.text;
  if (ts.isIdentifier(value)) return bindings.get(value.text) ?? null;
  if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValue(value.left, source, bindings);
    const right = staticStringValue(value.right, source, bindings);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(value)) {
    let out = value.head.text;
    for (const span of value.templateSpans) {
      const expression = staticStringValue(span.expression, source, bindings);
      if (expression === null) return null;
      out += expression + span.literal.text;
    }
    return out;
  }
  return null;
}

function staticallyResolvedModuleReferences(path, text) {
  const source = sourceFile(path, text);
  const declarations = [];
  const collectDeclarations = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      declarations.push(node);
    }
    ts.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(source);

  const bindings = new Map();
  for (let pass = 0; pass < declarations.length + 1; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      if (bindings.has(declaration.name.text)) continue;
      const value = staticStringValue(declaration.initializer, source, bindings);
      if (value !== null) {
        bindings.set(declaration.name.text, value);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const references = new Set(importedModules(source));
  const visit = (node) => {
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const value = staticStringValue(node.moduleSpecifier, source, bindings);
      if (value !== null) references.add(value);
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const value = staticStringValue(node.arguments[0], source, bindings);
      if (value !== null) references.add(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...references];
}

function commerceModuleReferences(path, text) {
  return staticallyResolvedModuleReferences(path, text).filter(
    (module) =>
      module.startsWith('@/features/commerce/') ||
      /^(?:\.\.?\/)+(?:[^/]+\/)*commerce\//u.test(module),
  );
}

function referencesParameter(fn) {
  if (!fn?.body) return false;
  const parameters = new Set(
    fn.parameters.filter((parameter) => ts.isIdentifier(parameter.name)).map((parameter) => parameter.name.text),
  );
  let found = false;
  const visit = (node) => {
    if (ts.isIdentifier(node) && parameters.has(node.text)) found = true;
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return found;
}

function firstStatementKind(fn) {
  return fn?.body?.statements?.[0]?.kind ?? null;
}

function functionBodyText(source, name) {
  return namedFunction(source, name)?.body?.getText(source) ?? '';
}

function functionCallsOutsideAllowlist(source, name, allowlist = []) {
  const fn = namedFunction(source, name);
  const allowed = new Set(allowlist);
  return callNames(fn?.body).filter((call) => !allowed.has(call));
}

export function loadCom01aCommerceSourceSnapshot(rootPath = root) {
  const snapshot = {};
  const paths = new Set([
    ...COM01A_COMMERCE_AUTHORITY_SOURCE_PATHS,
    ...MOBILE_PRODUCTION_SOURCE_PATHS,
    ...SERVER_PRODUCTION_SOURCE_PATHS,
    ...MOBILE_COMMERCE_DIRECTORIES.flatMap((directory) => walk(rootPath, directory)),
  ]);

  for (const path of [...paths].sort()) {
    const absolute = resolve(rootPath, path);
    if (existsSync(absolute)) snapshot[path] = normalize(readFileSync(absolute, 'utf8'));
  }
  return Object.freeze(snapshot);
}

export function auditCom01aCommerceSourceSnapshot(snapshot) {
  const errors = [];
  const add = (condition, path, message) => {
    if (!condition) errors.push(`${path}: ${message}.`);
  };

  for (const path of COM01A_COMMERCE_AUTHORITY_SOURCE_PATHS) {
    add(typeof snapshot[path] === 'string', path, 'required COM-01A authority source is missing');
  }
  if (errors.length > 0) return Object.freeze(errors.sort());

  const actualCommerceFiles = MOBILE_COMMERCE_DIRECTORIES.flatMap((directory) =>
    Object.keys(snapshot).filter(
      (path) => path.startsWith(`${directory}/`) && /\.(?:ts|tsx)$/u.test(path),
    ),
  ).sort();
  add(
    JSON.stringify(actualCommerceFiles) === JSON.stringify(INVENTORIED_COMMERCE_SOURCES),
    COM01A_SOURCE_PATHS.sourceContract,
    'complete commerce source inventory must include every app and feature source',
  );
  const mobileProductionPaths = Object.keys(snapshot).filter(
    (path) =>
      path.startsWith('apps/mobile/src/') &&
      /\.(?:ts|tsx)$/u.test(path) &&
      !/\.test\.tsx?$/u.test(path),
  );
  const productionCommerceReferences = mobileProductionPaths.flatMap((path) =>
    commerceModuleReferences(path, snapshot[path] ?? '').map((module) => `${path}:${module}`),
  ).sort();
  add(
    JSON.stringify(productionCommerceReferences) ===
      JSON.stringify(ALLOWED_PRODUCTION_COMMERCE_REFERENCES),
    COM01A_SOURCE_PATHS.sourceContract,
    'production commerce consumers must remain the exact disabled-renderer allowlist',
  );
  add(
    mobileProductionPaths.every(
      (path) =>
        !/(?:phase7CommerceEnabled|EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED)/u.test(
          snapshot[path] ?? '',
        ),
    ),
    COM01A_SOURCE_PATHS.env,
    'mobile production source must expose no commerce environment flag or consumer',
  );
  for (const path of [
    COM01A_SOURCE_PATHS.envExample,
    COM01A_SOURCE_PATHS.phase7Checker,
    COM01A_SOURCE_PATHS.phase9ReleaseSmoke,
  ]) {
    add(
      !/EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED|phase7CommerceEnabled/u.test(snapshot[path]),
      path,
      'retired commerce environment input must not remain in configuration or launch tooling',
    );
  }

  const serverProductionPaths = Object.keys(snapshot).filter(
    (path) =>
      path.startsWith('supabase/functions/') &&
      /\.ts$/u.test(path) &&
      !/\.test\.ts$/u.test(path),
  );
  const serverCommerceAuthorityPaths = serverProductionPaths
    .filter((path) => SERVER_COMMERCE_AUTHORITY_PATTERN.test(snapshot[path] ?? ''))
    .sort();
  add(
    JSON.stringify(serverCommerceAuthorityPaths) ===
      JSON.stringify(ALLOWED_SERVER_COMMERCE_AUTHORITY_PATHS),
    COM01A_SOURCE_PATHS.sourceContract,
    'server commerce authority references must remain the exact reviewed export, cleanup, and dormant-core allowlist',
  );
  const orderCoreConsumers = serverProductionPaths.flatMap((path) =>
    staticallyResolvedModuleReferences(path, snapshot[path] ?? '')
      .filter((module) => /orderAttributionCore(?:\.ts)?$/u.test(module))
      .map((module) => `${path}:${module}`),
  );
  add(
    orderCoreConsumers.length === 0,
    COM01A_SOURCE_PATHS.orderAttributionCore,
    'dormant order-attribution core must have no production server consumer',
  );
  const orderCoreText = snapshot[COM01A_SOURCE_PATHS.orderAttributionCore];
  add(
    !/(?:Deno\.env|fetch\s*\(|createClient|supabase|SHOPMY_[A-Z0-9_]*(?:KEY|SECRET|TOKEN))/iu.test(
      orderCoreText,
    ),
    COM01A_SOURCE_PATHS.orderAttributionCore,
    'dormant order-attribution core must contain no provider credential, network, or database authority',
  );

  const parsed = (path) => sourceFile(path, snapshot[path]);
  const commerceLayout = parsed(COM01A_SOURCE_PATHS.commerceLayout);
  add(
    JSON.stringify(importedModules(commerceLayout)) === JSON.stringify(['expo-router']) &&
      /\bSlot\b/u.test(snapshot[COM01A_SOURCE_PATHS.commerceLayout]) &&
      /return\s+<Slot\s*\/>/u.test(snapshot[COM01A_SOURCE_PATHS.commerceLayout]),
    COM01A_SOURCE_PATHS.commerceLayout,
    'commerce layout must be a transparent Slot so each direct URL remains exact',
  );
  add(
    !/(?:CommerceDeferredSurface|useEffect|useQuery|track|router\.(?:push|replace))/u.test(
      snapshot[COM01A_SOURCE_PATHS.commerceLayout],
    ),
    COM01A_SOURCE_PATHS.commerceLayout,
    'commerce layout must not add refusal duplication, state, analytics, or navigation',
  );
  const phase7 = parsed(COM01A_SOURCE_PATHS.phase7);
  const capabilities = frozenObject(phase7, 'phase7Capabilities');
  const flags = frozenObject(phase7, 'phase7Flags');
  add(Boolean(capabilities), COM01A_SOURCE_PATHS.phase7, 'phase7Capabilities must be frozen');
  add(
    objectProperty(phase7, capabilities, 'commerce')?.kind === ts.SyntaxKind.FalseKeyword,
    COM01A_SOURCE_PATHS.phase7,
    'phase7Capabilities.commerce must remain the literal false',
  );
  add(Boolean(flags), COM01A_SOURCE_PATHS.phase7, 'phase7Flags must be frozen');
  add(
    objectProperty(phase7, flags, 'commerce')?.kind === ts.SyntaxKind.FalseKeyword,
    COM01A_SOURCE_PATHS.phase7,
    'phase7Flags.commerce must remain the literal false',
  );
  add(
    !/phase7CommerceEnabled|EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED/u.test(snapshot[COM01A_SOURCE_PATHS.phase7]),
    COM01A_SOURCE_PATHS.phase7,
    'commerce admission must not depend on an environment flag',
  );

  let launchAdmission = null;
  try {
    launchAdmission = JSON.parse(snapshot[COM01A_SOURCE_PATHS.launchContract]).commerceAdmission;
  } catch {
    add(false, COM01A_SOURCE_PATHS.launchContract, 'launch contract must be valid JSON');
  }
  add(
    JSON.stringify(launchAdmission) === JSON.stringify(REQUIRED_COMMERCE_ADMISSION),
    COM01A_SOURCE_PATHS.launchContract,
    'commerceAdmission must remain the exact literal-zero COM-01A machine contract',
  );

  for (const path of COMMERCE_ROUTE_PATHS) {
    const source = parsed(path);
    const text = snapshot[path];
    const routeComponent = defaultExportedFunction(source);
    add(
      JSON.stringify(importedModules(source)) ===
        JSON.stringify(['@/features/commerce/CommerceDeferredSurface']),
      path,
      'disabled direct route may import only the shared unavailable surface',
    );
    add(
      returnsOnlySelfClosingElement(source, routeComponent, 'CommerceDeferredSurface'),
      path,
      'disabled direct route must return only the shared analytics-free unavailable surface',
    );
    add(
      !/(?:Redirect|href\s*=|useEffect|useQuery|useState|track|grantCommerceConsent|recordClick|openExternalHttpsUrl|router|backOrReplace|replaceWithFallback)/u.test(
        text,
      ),
      path,
      'disabled direct route must not read state, collect consent, emit analytics, write clicks, redirect, or canonicalize',
    );
  }

  const deferred = snapshot[COM01A_SOURCE_PATHS.commerceDeferredSurface];
  const commerceDeferred = parsed(COM01A_SOURCE_PATHS.commerceDeferredSurface);
  const commerceDeferredFn = namedFunction(commerceDeferred, 'CommerceDeferredSurface');
  add(
    /surface="commerce"/u.test(deferred) &&
      /fallbackRoute=\{APP_YOU_ROUTE\}/u.test(deferred) &&
      /fallbackLabel="Back to You"/u.test(deferred) &&
      /fallbackBehavior="replace"/u.test(deferred) &&
      /trackView=\{false\}/u.test(deferred),
    COM01A_SOURCE_PATHS.commerceDeferredSurface,
    'shared commerce recovery must preserve the exact URL until a replace-only Back to You and disable view analytics',
  );
  add(
    JSON.stringify(importedModules(commerceDeferred)) ===
      JSON.stringify([
        '@/components/launch/DeferredSurface',
        '@/lib/navigation/safeBack',
      ]) &&
      commerceDeferredFn &&
      callNames(commerceDeferredFn.body).length === 0 &&
      !/(?:useEffect|useQuery|useState|track\s*\(|fetch\s*\(|supabase|openExternalHttpsUrl|Linking|WebBrowser|router\.)/u.test(
        deferred,
      ),
    COM01A_SOURCE_PATHS.commerceDeferredSurface,
    'shared commerce recovery must contain no analytics, network, state, or navigation side effect',
  );
  const sharedDeferred = parsed(COM01A_SOURCE_PATHS.deferredSurface);
  const sharedDeferredText = snapshot[COM01A_SOURCE_PATHS.deferredSurface];
  const sharedDeferredBody = functionBodyText(sharedDeferred, 'DeferredSurface');
  add(
    /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(!trackView\)\s*return;\s*track\('phase7_deferred_surface_viewed',\s*\{\s*surface\s*\}\);\s*\},\s*\[surface,\s*trackView\]\);/u.test(
      sharedDeferredBody,
    ) &&
      (sharedDeferredText.match(/\btrack\(/gu)?.length ?? 0) === 1 &&
      !/(?:fetch\s*\(|supabase|openExternalHttpsUrl|Linking|WebBrowser|XMLHttpRequest|sendBeacon)/u.test(
        sharedDeferredText,
      ),
    COM01A_SOURCE_PATHS.deferredSurface,
    'shared DeferredSurface analytics must remain singly guarded by trackView with no network or external side effect',
  );

  const whereToBuy = parsed(COM01A_SOURCE_PATHS.whereToBuy);
  const whereToBuyFn = namedFunction(whereToBuy, 'WhereToBuy');
  add(Boolean(whereToBuyFn), COM01A_SOURCE_PATHS.whereToBuy, 'WhereToBuy() is missing');
  add(
    importedModules(whereToBuy).length === 0,
    COM01A_SOURCE_PATHS.whereToBuy,
    'disabled WhereToBuy renderer must not import UI, hooks, consent, network, navigation, or analytics',
  );
  add(
    whereToBuyFn &&
      !referencesParameter(whereToBuyFn) &&
      callNames(whereToBuyFn.body).length === 0 &&
      /\breturn null\b/u.test(whereToBuyFn.body.getText(whereToBuy)),
    COM01A_SOURCE_PATHS.whereToBuy,
    'WhereToBuy must ignore caller provenance and return only null without calls',
  );

  const consentLogic = parsed(COM01A_SOURCE_PATHS.consentLogic);
  const resolveConsent = namedFunction(consentLogic, 'resolveCommerceConsent');
  add(
    runtimeImportedModules(consentLogic).length === 0 &&
      resolveConsent &&
      !referencesParameter(resolveConsent) &&
      callNames(resolveConsent.body).length === 0 &&
      /\breturn false;/u.test(resolveConsent.body.getText(consentLogic)),
    COM01A_SOURCE_PATHS.consentLogic,
    'resolveCommerceConsent() must ignore every status or receipt and return only false without calls',
  );

  const disclosureOperation = parsed(COM01A_SOURCE_PATHS.disclosureOperation);
  const disclosure = namedFunction(disclosureOperation, 'runCommerceDisclosure');
  add(
    runtimeImportedModules(disclosureOperation).length === 0 &&
      disclosure &&
      !referencesParameter(disclosure) &&
      callNames(disclosure.body).length === 0 &&
      /return\s+['"]consent_closed['"];/u.test(disclosure.body.getText(disclosureOperation)),
    COM01A_SOURCE_PATHS.disclosureOperation,
    'runCommerceDisclosure() must ignore callbacks and return consent_closed without calls',
  );

  const attribution = parsed(COM01A_SOURCE_PATHS.attribution);
  const buildOutboundUrl = namedFunction(attribution, 'buildOutboundUrl');
  const safePayload = namedFunction(attribution, 'isHealthSafePayload');
  add(
    runtimeImportedModules(attribution).length === 0 &&
      buildOutboundUrl &&
      !referencesParameter(buildOutboundUrl) &&
      callNames(buildOutboundUrl.body).length === 0 &&
      /\breturn null;/u.test(buildOutboundUrl.body.getText(attribution)),
    COM01A_SOURCE_PATHS.attribution,
    'buildOutboundUrl() must ignore retailer/token input and return only null without calls',
  );
  add(
    safePayload &&
      !referencesParameter(safePayload) &&
      callNames(safePayload.body).length === 0 &&
      /\breturn false;/u.test(safePayload.body.getText(attribution)),
    COM01A_SOURCE_PATHS.attribution,
    'isHealthSafePayload() must ignore payload input and return only false without calls',
  );
  add(
    !/(?:appendExternalQueryParam|buildClickToken|randomUUID|URLSearchParams|new\s+URL\s*\()/u.test(
      snapshot[COM01A_SOURCE_PATHS.attribution],
    ),
    COM01A_SOURCE_PATHS.attribution,
    'disabled attribution must contain no outbound URL or token construction authority',
  );

  const useCommerce = parsed(COM01A_SOURCE_PATHS.useCommerce);
  add(
    !importedModules(useCommerce).some((module) => BANNED_DISABLED_MODULE.test(module)),
    COM01A_SOURCE_PATHS.useCommerce,
    'disabled commerce hooks must not import storage, Supabase, analytics, crypto, or navigation',
  );
  add(
    !/(?:affiliate_links|commerce_click_events|isCommerceConsented|demoWhereToBuy|resolveWhereToBuy)/u.test(
      snapshot[COM01A_SOURCE_PATHS.useCommerce],
    ),
    COM01A_SOURCE_PATHS.useCommerce,
    'disabled commerce hooks must not read consent, query a catalog, or resolve retailer rows',
  );
  add(
    /enabled:\s*false/u.test(snapshot[COM01A_SOURCE_PATHS.useCommerce]),
    COM01A_SOURCE_PATHS.useCommerce,
    'disabled commerce hooks must keep their compatibility queries statically disabled',
  );

  const links = parsed(COM01A_SOURCE_PATHS.links);
  for (const name of ['resolveWhereToBuy', 'demoWhereToBuy']) {
    const fn = namedFunction(links, name);
    add(Boolean(fn), COM01A_SOURCE_PATHS.links, `${name}() is missing`);
    add(
      fn &&
        !referencesParameter(fn) &&
        functionCallsOutsideAllowlist(links, name).length === 0 &&
        /\breturn\s+\[\];/u.test(fn.body.getText(links)),
      COM01A_SOURCE_PATHS.links,
      `${name}() must ignore caller/catalog/development input and return an empty list without calls`,
    );
  }
  const outboundFor = namedFunction(links, 'outboundFor');
  add(
    outboundFor &&
      !referencesParameter(outboundFor) &&
      callNames(outboundFor.body).length === 0 &&
      /\breturn null\b/u.test(outboundFor.body.getText(links)),
    COM01A_SOURCE_PATHS.links,
    'outboundFor() must ignore option/token input and return only null without calls',
  );
  add(
    !BANNED_BYPASS.test(snapshot[COM01A_SOURCE_PATHS.links]),
    COM01A_SOURCE_PATHS.links,
    'commerce links must contain no development, environment, E2E, fixture, or example-retailer bypass',
  );

  const stacks = parsed(COM01A_SOURCE_PATHS.stacks);
  const starterStacks = unwrap(variableInitializer(stacks, 'STARTER_STACKS'));
  add(
    starterStacks && ts.isArrayLiteralExpression(starterStacks) && starterStacks.elements.length === 0,
    COM01A_SOURCE_PATHS.stacks,
    'STARTER_STACKS must remain the literal empty array',
  );
  for (const [name, expected] of [
    ['shippableStacks', 'return [];'],
    ['stackBySlug', 'return undefined;'],
  ]) {
    const fn = namedFunction(stacks, name);
    add(Boolean(fn), COM01A_SOURCE_PATHS.stacks, `${name}() is missing`);
    add(
      fn &&
        !referencesParameter(fn) &&
        callNames(fn.body).length === 0 &&
        fn.body.getText(stacks).includes(expected),
      COM01A_SOURCE_PATHS.stacks,
      `${name}() must ignore caller/reviewer/development state and stay empty without calls`,
    );
  }
  add(
    !BANNED_BYPASS.test(snapshot[COM01A_SOURCE_PATHS.stacks]),
    COM01A_SOURCE_PATHS.stacks,
    'commerce stacks must contain no development, environment, E2E, fixture, or reviewer bypass',
  );

  const consent = parsed(COM01A_SOURCE_PATHS.consent);
  const consentText = snapshot[COM01A_SOURCE_PATHS.consent];
  const grant = namedFunction(consent, 'grantCommerceConsent');
  const readConsent = namedFunction(consent, 'isCommerceConsented');
  add(
    readConsent &&
      !referencesParameter(readConsent) &&
      functionCallsOutsideAllowlist(consent, 'isCommerceConsented', ['resolve']).length === 0 &&
      /\bfalse\b/u.test(readConsent.body.getText(consent)),
    COM01A_SOURCE_PATHS.consent,
    'isCommerceConsented() must return false without private, ledger, user, or network reads',
  );
  add(
    grant &&
      firstStatementKind(grant) === ts.SyntaxKind.ThrowStatement &&
      functionCallsOutsideAllowlist(consent, 'grantCommerceConsent', ['Error']).length === 0 &&
      /COMMERCE_ADMISSION_CLOSED/u.test(grant.body.getText(consent)),
    COM01A_SOURCE_PATHS.consent,
    'grantCommerceConsent() must throw COMMERCE_ADMISSION_CLOSED before every call or mutation',
  );
  add(
    /withdrawHealthDependentConsent/u.test(consentText) &&
      /refuseHealthDependentConsent/u.test(consentText) &&
      /clearCommerceState/u.test(consentText),
    COM01A_SOURCE_PATHS.consent,
    'explicit withdrawal, refusal, and legacy local cleanup must remain available',
  );
  add(
    !/grantHealthDependentConsent|commerce_consent_granted/u.test(consentText),
    COM01A_SOURCE_PATHS.consent,
    'disabled consent module must expose no positive grant or grant analytics path',
  );

  const store = parsed(COM01A_SOURCE_PATHS.store);
  const storeText = snapshot[COM01A_SOURCE_PATHS.store];
  const recordClick = namedFunction(store, 'recordClick');
  add(
    recordClick &&
      firstStatementKind(recordClick) === ts.SyntaxKind.ThrowStatement &&
      !referencesParameter(recordClick) &&
      functionCallsOutsideAllowlist(store, 'recordClick', ['Error']).length === 0 &&
      /COMMERCE_ADMISSION_CLOSED/u.test(recordClick.body.getText(store)),
    COM01A_SOURCE_PATHS.store,
    'recordClick() must ignore payload and throw COMMERCE_ADMISSION_CLOSED before every call',
  );
  add(
    !/(?:commerce_click_events|randomUUID|runHealthDependentConsentOperation|getPersistedSupabaseUser|supabase)/u.test(
      storeText,
    ),
    COM01A_SOURCE_PATHS.store,
    'disabled commerce store must not generate tokens, acquire consent leases, read users, or query/write Supabase',
  );
  add(
    /clearCommerceState/u.test(storeText) && /removePrivateItem/u.test(storeText),
    COM01A_SOURCE_PATHS.store,
    'legacy local commerce cleanup must remain available',
  );

  const replenish = snapshot[COM01A_SOURCE_PATHS.replenishRoute];
  add(
    !/(?:features\/commerce|commerce\/consent|isCommerceConsented|See similar|similar options|shopping links|where-to-buy)/iu.test(
      replenish,
    ),
    COM01A_SOURCE_PATHS.replenishRoute,
    'Shelf replacement must contain no commerce import, consent read, similar CTA, paid-link copy, or commerce route',
  );
  const you = snapshot[COM01A_SOURCE_PATHS.youRoute];
  add(
    !/(?:features\/commerce|isCommerceConsented|commerceConsent|\/commerce\/|where-to-buy)/iu.test(you),
    COM01A_SOURCE_PATHS.youRoute,
    'You must not read commerce consent or retain commerce routes/toggles while admission is closed',
  );

  const orderPoll = parsed(COM01A_SOURCE_PATHS.orderReportPoll);
  const pollText = snapshot[COM01A_SOURCE_PATHS.orderReportPoll];
  add(
    !importedModules(orderPoll).some(
      (module) =>
        /(?:supabase-js|orderAttributionCore|_shared\/fetch|supabaseSecretKey)/u.test(module),
    ),
    COM01A_SOURCE_PATHS.orderReportPoll,
    'disabled order poll must not import provider fetch, attribution, Supabase, or secret dependencies',
  );
  add(
    !/(?:Deno\.env|SHOPMY|ORDER_REPORT_POLL_SECRET|createClient|fetch|persistOrderAttribution|commerce_click_events|order_attributions)/u.test(
      pollText,
    ),
    COM01A_SOURCE_PATHS.orderReportPoll,
    'credentials, scheduler input, or environment state must not admit provider polling or persistence',
  );
  add(
    /COM-01A: commerce admission closed/u.test(pollText),
    COM01A_SOURCE_PATHS.orderReportPoll,
    'disabled order poll must return the stable COM-01A closed result',
  );

  const migration = snapshot[COM01A_SOURCE_PATHS.migration];
  for (const fragment of [
    /force row level security/iu,
    /affiliate_links/iu,
    /creator_stacks/iu,
    /creator_stack_items/iu,
    /commerce_click_events/iu,
    /order_attributions/iu,
    /revoke\s+all/iu,
    /authenticated/iu,
    /COMMERCE_ADMISSION_CLOSED/u,
    /COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED/u,
  ]) {
    add(
      fragment.test(migration),
      COM01A_SOURCE_PATHS.migration,
      `zero-admission migration is missing ${fragment}`,
    );
  }
  const commercePublicationTables = [
    'affiliate_links',
    'creator_stacks',
    'creator_stack_items',
  ];
  add(
    commercePublicationTables.every((table) =>
      new RegExp(
        `revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`,
        'iu',
      ).test(migration),
    ),
    COM01A_SOURCE_PATHS.migration,
    'migration must revoke every ambient runtime ACL from commerce publication tables',
  );
  const commerceClickGrants =
    migration.match(
      /grant\s+[^;]+\s+on\s+table\s+public\.commerce_click_events\s+to\s+[^;]+;/giu,
    ) ?? [];
  add(
    /revoke\s+all\s+on\s+table\s+public\.commerce_click_events\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/iu.test(
      migration,
    ) &&
      /grant\s+select\s*,\s*delete\s+on\s+table\s+public\.commerce_click_events\s+to\s+authenticated\s*,\s*service_role/iu.test(
        migration,
      ) &&
      commerceClickGrants.length === 1,
    COM01A_SOURCE_PATHS.migration,
    'click runtime ACL must converge old and new projects on owner/service read-delete only',
  );
  add(
    !/grant\s+(?:select|insert|update)[^;]*affiliate_links[^;]*authenticated/iu.test(migration) &&
      !/grant\s+insert[^;]*commerce_click_events[^;]*authenticated/iu.test(migration),
    COM01A_SOURCE_PATHS.migration,
    'migration must not restore authenticated commerce publication reads or click inserts',
  );
  const orderAttributionUpdateGrants =
    migration.match(
      /grant\s+update(?:\s*\([^)]*\))?\s+on\s+table\s+public\.order_attributions[^;]*;/giu,
    ) ?? [];
  add(
    /revoke\s+all\s+on\s+table\s+public\.order_attributions\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/iu.test(
      migration,
    ) &&
      /grant\s+select\s*,\s*delete\s+on\s+table\s+public\.order_attributions\s+to\s+service_role/iu.test(
        migration,
      ) &&
      /grant\s+update\s*\(\s*click_token\s*\)\s+on\s+table\s+public\.order_attributions\s+to\s+service_role/iu.test(
        migration,
      ) &&
      orderAttributionUpdateGrants.length === 1 &&
      !/grant\s+insert[^;]*order_attributions[^;]*service_role/iu.test(migration) &&
      !/grant\s+update\s+on\s+table\s+public\.order_attributions[^;]*service_role/iu.test(migration),
    COM01A_SOURCE_PATHS.migration,
    'order attribution runtime ACL must allow only service read/delete and click-token detachment',
  );
  add(
    /create\s+trigger\s+order_attributions_admission_closed\s+before\s+insert\s+or\s+update\s+on\s+public\.order_attributions/iu.test(
      migration,
    ) &&
      /old\.click_token\s+is\s+not\s+null/iu.test(migration) &&
      /new\.click_token\s+is\s+null/iu.test(migration) &&
      /pg_catalog\.to_jsonb\(new\)\s*-\s*'click_token'/iu.test(migration) &&
      /pg_catalog\.to_jsonb\(old\)\s*-\s*'click_token'/iu.test(migration),
    COM01A_SOURCE_PATHS.migration,
    'order attribution trigger must reject inserts and permit only exact non-null-to-null token detachment',
  );

  const databaseContract = snapshot[COM01A_SOURCE_PATHS.databaseContract];
  add(
    /select plan\(23\)/u.test(databaseContract) &&
      /privileged stale poller cannot publish a new order attribution/u.test(databaseContract) &&
      /privileged stale poller cannot update attribution business fields/u.test(databaseContract) &&
      /token detachment cannot camouflage a business-field update/u.test(databaseContract) &&
      /exact installed-base click-token detachment remains available/u.test(databaseContract) &&
      /installed-base attribution deletion remains available/u.test(databaseContract),
    COM01A_SOURCE_PATHS.databaseContract,
    'database pgTAP must prove attribution publication rejection and exact legacy cleanup',
  );

  const upgradeContract = snapshot[COM01A_SOURCE_PATHS.upgradeContract];
  add(
    /select plan\(21\)/u.test(upgradeContract) &&
      /post-upgrade attribution insert guard/u.test(upgradeContract) &&
      /post-upgrade attribution business-update guard/u.test(upgradeContract) &&
      /cleanup transition cannot camouflage a business update/u.test(upgradeContract) &&
      /preserves exact installed-base attribution detachment/u.test(upgradeContract) &&
      /preserves installed-base attribution deletion/u.test(upgradeContract),
    COM01A_SOURCE_PATHS.upgradeContract,
    '0071-to-0072 pgTAP must prove stale-poller closure without losing installed-base cleanup',
  );

  const disabledRuntimePaths = [
    COM01A_SOURCE_PATHS.commerceLayout,
    ...COMMERCE_ROUTE_PATHS,
    COM01A_SOURCE_PATHS.commerceDeferredSurface,
    COM01A_SOURCE_PATHS.whereToBuy,
    COM01A_SOURCE_PATHS.consentLogic,
    COM01A_SOURCE_PATHS.disclosureOperation,
    COM01A_SOURCE_PATHS.attribution,
    COM01A_SOURCE_PATHS.useCommerce,
    COM01A_SOURCE_PATHS.links,
    COM01A_SOURCE_PATHS.stacks,
    COM01A_SOURCE_PATHS.orderReportPoll,
  ];
  for (const path of disabledRuntimePaths) {
    const source = parsed(path);
    const bannedImports = importedModules(source).filter((module) => BANNED_DISABLED_MODULE.test(module));
    const bannedNames = [...identifiers(source)].filter((name) => BANNED_RUNTIME_IDENTIFIERS.has(name));
    add(
      bannedImports.length === 0 && bannedNames.length === 0,
      path,
      `disabled commerce runtime contains side-effect authority (${[...bannedImports, ...bannedNames].join(', ')})`,
    );
  }

  for (const path of [
    COM01A_SOURCE_PATHS.checkpoint,
    COM01A_SOURCE_PATHS.featureCommerce,
    COM01A_SOURCE_PATHS.masterPlan,
    COM01A_SOURCE_PATHS.decisions,
    COM01A_SOURCE_PATHS.featureIndex,
    COM01A_SOURCE_PATHS.roadmap,
    COM01A_SOURCE_PATHS.userFlowTree,
    COM01A_SOURCE_PATHS.blockers,
    COM01A_SOURCE_PATHS.progress,
    COM01A_SOURCE_PATHS.hugeTodoIndex,
    COM01A_SOURCE_PATHS.phase7SurfaceInventory,
  ]) {
    add(
      /COM-01A/u.test(snapshot[path]) &&
        /zero[- ](?:commerce[- ])?admission|literal zero/iu.test(snapshot[path]),
      path,
      'governance source must state the truthful COM-01A literal-zero-admission posture',
    );
  }

  return Object.freeze(errors.sort());
}

export function auditCom01aCommerceAdmission(rootPath = root) {
  return auditCom01aCommerceSourceSnapshot(loadCom01aCommerceSourceSnapshot(rootPath));
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const errors = auditCom01aCommerceAdmission(process.cwd());
  if (errors.length > 0) {
    console.error(`COM-01A commerce-admission source contract failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('COM-01A commerce-admission source contract passed.');
  }
}
