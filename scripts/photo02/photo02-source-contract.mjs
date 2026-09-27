import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = {
  layout: 'apps/mobile/src/app/_layout.tsx',
  provider: 'apps/mobile/src/lib/applock/AppLockProvider.tsx',
  decision: 'apps/mobile/src/lib/applock/preferenceDecision.ts',
  accountOperations: 'apps/mobile/src/lib/applock/accountOperations.ts',
  authenticate: 'apps/mobile/src/lib/applock/authenticate.ts',
  availability: 'apps/mobile/src/lib/storage/PrivateDataAvailabilityGate.tsx',
  timelineGate: 'apps/mobile/src/features/photos/PhotoTimelineLockGate.tsx',
  progress: 'apps/mobile/src/app/(tabs)/progress.tsx',
  capture: 'apps/mobile/src/app/progress/capture.tsx',
  review: 'apps/mobile/src/app/progress/review.tsx',
  detail: 'apps/mobile/src/app/progress/[id].tsx',
};

const read = (name) =>
  fs.readFileSync(path.join(ROOT, FILES[name]), 'utf8').replace(/\r\n/g, '\n');
const parse = (name, text) =>
  ts.createSourceFile(FILES[name], text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function nodes(root, predicate) {
  const found = [];
  walk(root, (node) => {
    if (predicate(node)) found.push(node);
  });
  return found;
}

function namedFunction(root, name) {
  const declaration = nodes(
    root,
    (node) =>
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))),
  )[0];
  if (!declaration) throw new Error(`missing function ${name}`);
  return ts.isVariableDeclaration(declaration) ? declaration.initializer : declaration;
}

function defaultFunction(root) {
  const fn = nodes(
    root,
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword),
  )[0];
  if (!fn) throw new Error('missing default route component');
  return fn;
}

function callName(node) {
  if (!ts.isCallExpression(node)) return null;
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function jsxName(node) {
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  return null;
}

function jsxAncestor(node, name) {
  for (let current = node.parent; current; current = current.parent) {
    if (jsxName(current) === name) return true;
  }
  return false;
}

function failUnless(condition, message) {
  if (!condition) throw new Error(message);
}

function assertLayout(root) {
  const sensitive = nodes(root, (node) => ['Stack', 'OfflineSync'].includes(jsxName(node)));
  failUnless(sensitive.length > 0, 'layout must expose the routed app tree');
  for (const node of sensitive) {
    failUnless(jsxAncestor(node, 'AppLockProvider'), 'no routed content may mount before AppLockProvider');
    failUnless(
      jsxAncestor(node, 'PrivateDataAvailabilityGate'),
      'no routed content may mount before private-data readiness',
    );
  }
}

function assertProviderMountBoundary(root) {
  const fn = namedFunction(root, 'AppLockProvider');
  const render = nodes(fn.body, ts.isReturnStatement).at(-1)?.expression;
  failUnless(render, 'app-lock provider must render a guarded tree');
  const childRefs = nodes(render, (node) => ts.isIdentifier(node) && node.text === 'children');
  failUnless(childRefs.length === 1, 'app content must have exactly one mount path');
  const conditional = childRefs[0].parent;
  failUnless(
    ts.isConditionalExpression(conditional) &&
      conditional.whenTrue === childRefs[0] &&
      conditional.condition.getText(root) === 'loaded' &&
      conditional.whenFalse.kind === ts.SyntaxKind.NullKeyword,
    'app content must not mount before the app-lock preference resolves',
  );

  const unlockCalls = nodes(
    fn.body,
    (node) => callName(node) === 'setLocked' && node.arguments[0]?.kind === ts.SyntaxKind.FalseKeyword,
  );
  failUnless(unlockCalls.length > 0, 'provider must publish successful unlocks');
  const allowedDominators = new Set([
    "result.status === 'success'",
    "attempt.status === 'success' && requestIsCurrent()",
    '!attempt.enabled || interactionLifecycle.current.preservedLease === interaction',
  ]);
  for (const call of unlockCalls) {
    let owner = call.parent;
    let guarded = false;
    while (owner && owner !== fn.body) {
      if (ts.isIfStatement(owner)) {
        const condition = owner.expression.getText(root);
        if (allowedDominators.has(condition)) {
          guarded = true;
          break;
        }
      }
      owner = owner.parent;
    }
    failUnless(guarded, 'setLocked(false) must be dominated by authenticated success');
  }
}

function assertDecisionFlow(root) {
  const fn = namedFunction(root, 'decideAppLockPreference');
  const statements = fn.body.statements;
  failUnless(statements.length === 2, 'corrupt or unsupported preference cannot gain an early unlock');
  const [availableBranch, fallback] = statements;
  failUnless(ts.isIfStatement(availableBranch), 'readable preference branch must be explicit');
  failUnless(
    availableBranch.expression.getText(root).replace(/\s/g, '') ===
      "result.status==='absent'||result.status==='available'",
    'only absent or readable preferences may use their stored enabled value',
  );
  failUnless(
    nodes(availableBranch.thenStatement, ts.isReturnStatement).length === 1,
    'readable preference branch must have one decision',
  );
  failUnless(
    ts.isReturnStatement(fallback) &&
      fallback.expression &&
      ts.isObjectLiteralExpression(fallback.expression),
    'unreadable preference must have one terminal decision',
  );
  const property = (name) => fallback.expression.properties.find((p) => p.name?.getText(root) === name);
  failUnless(
    property('enabled')?.initializer?.kind === ts.SyntaxKind.TrueKeyword &&
      property('locked')?.initializer?.kind === ts.SyntaxKind.TrueKeyword,
    'unreadable preference must fail closed',
  );
}

function hasIfAncestor(node, rootNode, conditionText) {
  for (let current = node.parent; current && current !== rootNode; current = current.parent) {
    if (ts.isIfStatement(current) && current.expression.getText().includes(conditionText)) return true;
  }
  return false;
}

function branchTerminates(statement) {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (!ts.isBlock(statement) || statement.statements.length === 0) return false;
  const terminal = statement.statements.at(-1);
  return ts.isReturnStatement(terminal) || ts.isThrowStatement(terminal);
}

function assertAccountOperations(root) {
  const unlock = namedFunction(root, 'attemptAppUnlockForCurrentAccount');
  const unlockAuth = nodes(unlock.body, (node) => callName(node) === 'authenticateWithLease')[0];
  const clear = nodes(
    unlock.body,
    (node) => ts.isIdentifier(node) && node.text === 'clearMalformedAppLockPreference',
  )[0];
  failUnless(
    unlockAuth && clear && unlockAuth.pos < clear.pos,
    'authenticated reset must authenticate before destructive repair',
  );
  const resetFailureGuard = nodes(
    unlock.body,
    (node) => ts.isIfStatement(node) && node.expression.getText(root).includes("status !== 'success'"),
  )[0];
  failUnless(
    resetFailureGuard?.expression.getText(root) === "status !== 'success'" &&
      resetFailureGuard.pos > unlockAuth.pos &&
      resetFailureGuard.pos < clear.pos &&
      branchTerminates(resetFailureGuard.thenStatement),
    'reset authentication failure must terminate before destructive repair',
  );
  failUnless(
    hasIfAncestor(clear, unlock.body, 'input.repairRequired'),
    'malformed preference reset must remain repair-only',
  );

  const save = namedFunction(root, 'setAppLockPreferenceForCurrentAccount');
  const auth = nodes(save.body, (node) => callName(node) === 'authenticateWithLease')[0];
  const write = nodes(save.body, (node) => callName(node) === 'setAppLockEnabledStored')[0];
  failUnless(
    auth && write && auth.pos < write.pos,
    'preference writes must authenticate before storage mutation',
  );
  const saveFailureGuard = nodes(
    save.body,
    (node) =>
      ts.isIfStatement(node) && node.expression.getText(root).includes("authStatus !== 'success'"),
  )[0];
  failUnless(
    saveFailureGuard?.expression.getText(root) === "authStatus !== 'success'" &&
      saveFailureGuard.pos > auth.pos &&
      saveFailureGuard.pos < write.pos &&
      branchTerminates(saveFailureGuard.thenStatement),
    'preference authentication failure must terminate before storage mutation',
  );
  failUnless(
    !hasIfAncestor(auth, save.body, 'input.enabled'),
    'preference authentication must cover both enable and disable',
  );
}

function assertNativeAuthentication(root) {
  const fn = namedFunction(root, 'authenticateAppLock');
  const nativeCall = nodes(fn.body, (node) => callName(node) === 'authenticateAsync')[0];
  failUnless(nativeCall, 'device authentication must use the native provider');
  failUnless(
    nativeCall.arguments[0]?.getText(root).includes('disableDeviceFallback: false'),
    'device PIN/passcode fallback must remain enabled',
  );
  const finalReturn = nodes(fn.body, ts.isReturnStatement).at(-1);
  failUnless(
    finalReturn?.getText(root).includes('authenticationInvalidationEpoch') &&
      finalReturn.getText(root).includes('isRequestCurrent()'),
    'native success must be revalidated before publication',
  );
}

function assertAvailability(root) {
  const fn = namedFunction(root, 'PrivateDataAvailabilityGate');
  const childReturns = nodes(fn.body, ts.isReturnStatement).filter(
    (ret) => nodes(ret, (node) => ts.isIdentifier(node) && node.text === 'children').length > 0,
  );
  failUnless(childReturns.length === 1, 'private content must have exactly one guarded mount path');
  let owner = childReturns[0].parent;
  while (owner && owner !== fn.body && !ts.isIfStatement(owner)) owner = owner.parent;
  failUnless(
    ts.isIfStatement(owner) &&
      owner.expression.getText(root).replace(/\s/g, '') ===
        "appUnlocked&&(availability==='ready'||availability==='restoring')",
    'private content must mount only after successful encrypted-read readiness',
  );
}

function assertTimelineGate(root) {
  const fn = namedFunction(root, 'PhotoTimelineLockGate');
  const childReturns = nodes(fn.body, ts.isReturnStatement).filter(
    (ret) => ret.expression && ts.isIdentifier(ret.expression) && ret.expression.text === 'children',
  );
  failUnless(childReturns.length === 1, 'timeline content must have exactly one unlock path');
  let owner = childReturns[0].parent;
  while (owner && owner !== fn.body && !ts.isIfStatement(owner)) owner = owner.parent;
  failUnless(
    ts.isIfStatement(owner) && owner.expression.getText(root) === '!locked',
    'timeline content may mount only after the shared unlock',
  );
}

function assertRoute(root, route) {
  const outer = defaultFunction(root);
  const importedPhotoHooks = new Set();
  for (const declaration of nodes(root, ts.isImportDeclaration)) {
    if (declaration.moduleSpecifier.text !== '@/features/photos/usePhotos') continue;
    for (const specifier of declaration.importClause?.namedBindings?.elements ?? []) {
      importedPhotoHooks.add(specifier.name.text);
    }
  }
  const photoHook = (node) => importedPhotoHooks.has(callName(node));
  failUnless(
    nodes(outer.body, photoHook).length === 0,
    `${route} cannot read photos before PhotoTimelineLockGate mounts its child`,
  );
  const gates = nodes(outer.body, (node) => jsxName(node) === 'PhotoTimelineLockGate');
  failUnless(gates.length > 0, `${route} must mount the shared Progress unlock`);
  const allHooks = nodes(root, photoHook);
  failUnless(allHooks.length > 0, `${route} must retain its photo data implementation`);
  for (const hook of allHooks) {
    failUnless(
      hook.pos < outer.pos || hook.end > outer.end,
      `${route} photo hooks must live in a gated child component`,
    );
  }
}

export function auditPhoto02Sources(overrides = {}) {
  const roots = Object.fromEntries(
    Object.keys(FILES).map((name) => [name, parse(name, overrides[name] ?? read(name))]),
  );
  assertLayout(roots.layout);
  assertProviderMountBoundary(roots.provider);
  assertDecisionFlow(roots.decision);
  assertAccountOperations(roots.accountOperations);
  assertNativeAuthentication(roots.authenticate);
  assertAvailability(roots.availability);
  assertTimelineGate(roots.timelineGate);
  for (const route of ['progress', 'capture', 'review', 'detail']) assertRoute(roots[route], route);
  return { checks: 11, status: 'pass' };
}

export function photo02Source(name) {
  return read(name);
}
