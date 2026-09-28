import { createHash } from 'node:crypto';

import * as ts from 'typescript';

const SOURCE_KEYS = Object.freeze(['entrypoint', 'runtime', 'executor', 'providerDeletion']);
const REVIEWED_SOURCE_SHA256 = Object.freeze({
  entrypoint: 'd4fd2917de31d91d010788a3c45d390de61fefd770f090ff5f1242f385b2f7f2',
  runtime: '5d3f7b1c565016dbfd3bd6288c14f8c1a6b58a60a94815eb3bc85926cae8976f',
  executor: 'ccbaf7e0d38c415e013522ba82ecdd5964ca8fc58b77899e7b20974431375fcc',
  providerDeletion: '57cbc94e8d6807c45c9f92a66f321cce853679a0504cf48906d4160c8e3875ea',
});
const SOURCE_HASH_ERRORS = Object.freeze({
  entrypoint: 'Account deletion entrypoint differs from the exact reviewed source.',
  runtime: 'Durable deletion runtime work lane differs from the exact reviewed source.',
  executor: 'RevenueCat V2 dispatch differs from the exact reviewed source.',
  providerDeletion:
    'RevenueCat authenticated customer DELETE endpoint differs from the exact reviewed source.',
});
const DISPATCH_DELETE_CALL_PATHS = Object.freeze([
  'recordActionRequired',
  'establishIdentityBarrier',
  'ready.preflightEvidence.aliases.map',
  'canRequest',
  'budgetRetry',
  'buildRevenueCatV2DeleteRequest',
  'options.network.reserveMutation',
  'canRequest',
  'budgetRetry',
  'options.gateway.markRequestStarted',
  'isRecord',
  'hasExactKeys',
  'wireTimestamp',
  'timestampMs',
  'timestampMs',
  'executeNetwork',
  'providerRetryAfterMs',
  'classifyRevenueCatV2DeleteResponse',
  'classifyRevenueCatV2TransportFailure',
  'recordActionRequired',
  'canonicalizeWireTimestamp',
  'persistAndTransitionToReconciliation',
  'blankReconciliation',
  'retryAt',
]);
const DISPATCH_DELETE_STATEMENT_KINDS = Object.freeze([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ExpressionStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.TryStatement,
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.ExpressionStatement,
]);
const DISPATCH_DELETE_IF_CONDITIONS = Object.freeze([
  "claim.claimMode!=='dispatch'||claim.requestStartedAt!==null",
  '!canRequest(options,context,budget)',
  '!canRequest(options,context,budget)',
  "!isRecord(started)||!hasExactKeys(started,['requestStartedAt'])||!wireTimestamp(started.requestStartedAt)||timestampMs(started.requestStartedAt)<timestampMs(ready.preflightEvidence.aliasSnapshotCompletedAt)",
  "disposition.kind==='action_required'",
]);

function requireSources(sources) {
  if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) {
    throw new TypeError('RevenueCat deletion sources must be an object.');
  }
  const keys = Object.keys(sources).sort();
  const expected = [...SOURCE_KEYS].sort();
  if (
    keys.length !== expected.length ||
    !keys.every((key, index) => key === expected[index]) ||
    SOURCE_KEYS.some((key) => typeof sources[key] !== 'string' || sources[key].length === 0)
  ) {
    throw new TypeError('RevenueCat deletion sources must contain the exact nonempty source set.');
  }
}

function parseSources(sources, errors) {
  const parsed = {};
  for (const key of SOURCE_KEYS) {
    const sourceFile = ts.createSourceFile(
      `${key}.ts`,
      sources[key],
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    if (sourceFile.parseDiagnostics.length > 0) {
      errors.push(`${key} is not syntactically valid TypeScript.`);
    }
    parsed[key] = sourceFile;
  }
  return parsed;
}

function canonicalSourceSha256(source) {
  return createHash('sha256').update(source.replace(/\r\n?/g, '\n'), 'utf8').digest('hex');
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function hasNamedImport(sourceFile, moduleName, importedName) {
  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleName ||
      statement.importClause?.isTypeOnly === true ||
      !statement.importClause?.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      return false;
    }
    return statement.importClause.namedBindings.elements.some(
      (element) =>
        !element.isTypeOnly &&
        element.name.text === importedName &&
        (element.propertyName === undefined || element.propertyName.text === importedName),
    );
  });
}

function findTopLevelFunction(sourceFile, name) {
  return findDirectFunction(sourceFile.statements, name);
}

function findDirectFunction(statements, name) {
  const matches = statements.filter(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function isConstVariableStatement(statement) {
  return (
    ts.isVariableStatement(statement) &&
    (statement.declarationList.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const
  );
}

function findConstDeclaration(statements, name) {
  const matches = [];
  for (const statement of statements) {
    if (!isConstVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        matches.push(declaration);
      }
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
}

function visitDescendants(root, visitor) {
  function visit(node) {
    visitor(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
}

function declarationsNamed(root, name) {
  const declarations = [];
  visitDescendants(root, (node) => {
    if (
      ts.isIdentifier(node) &&
      node.text === name &&
      (ts.isVariableDeclaration(node.parent) ||
        ts.isBindingElement(node.parent) ||
        ts.isParameter(node.parent) ||
        ts.isFunctionDeclaration(node.parent) ||
        ts.isFunctionExpression(node.parent) ||
        ts.isClassDeclaration(node.parent) ||
        ts.isClassExpression(node.parent) ||
        ts.isEnumDeclaration(node.parent) ||
        ts.isImportSpecifier(node.parent) ||
        ts.isImportClause(node.parent) ||
        ts.isNamespaceImport(node.parent) ||
        ts.isImportEqualsDeclaration(node.parent))
    ) {
      declarations.push(node);
    }
  });
  return declarations;
}

function hasExactDeclaration(root, name, parentKind) {
  const declarations = declarationsNamed(root, name);
  return declarations.length === 1 && declarations[0].parent.kind === parentKind;
}

function identifiersNamed(root, name) {
  const identifiers = [];
  visitDescendants(root, (node) => {
    if (ts.isIdentifier(node) && node.text === name) identifiers.push(node);
  });
  return identifiers;
}

function identifierWrites(root, name) {
  const writes = [];
  function expressionRoot(node) {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      return expressionRoot(node.expression);
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      return expressionRoot(node.expression);
    }
    return null;
  }

  function assignmentTargetWrites(node) {
    if (expressionRoot(node) === name) return true;
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.some(
        (element) => !ts.isOmittedExpression(element) && assignmentTargetWrites(element),
      );
    }
    if (ts.isObjectLiteralExpression(node)) {
      return node.properties.some((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return property.name.text === name;
        if (ts.isPropertyAssignment(property)) return assignmentTargetWrites(property.initializer);
        if (ts.isSpreadAssignment(property)) return assignmentTargetWrites(property.expression);
        return false;
      });
    }
    if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) {
      return assignmentTargetWrites(node.expression);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return assignmentTargetWrites(node.left);
    }
    return false;
  }

  visitDescendants(root, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      ts.isAssignmentExpression(node) &&
      assignmentTargetWrites(node.left)
    ) {
      writes.push(node);
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      (node.operator === ts.SyntaxKind.PlusPlusToken ||
        node.operator === ts.SyntaxKind.MinusMinusToken) &&
      expressionRoot(node.operand) === name
    ) {
      writes.push(node);
    }
    if (ts.isDeleteExpression(node) && expressionRoot(node.expression) === name) {
      writes.push(node);
    }
    if (
      (ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      !ts.isVariableDeclarationList(node.initializer) &&
      assignmentTargetWrites(node.initializer)
    ) {
      writes.push(node);
    }
  });
  return writes;
}

function hasIdentifierWrite(root, name) {
  return identifierWrites(root, name).length > 0;
}

function expressionPath(node) {
  if (node === undefined || node === null) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const parent = expressionPath(node.expression);
    return parent === null ? null : `${parent}.${node.name.text}`;
  }
  return null;
}

function isPath(node, expected) {
  return expressionPath(node) === expected;
}

function unwrapAwait(node) {
  if (node === undefined || node === null) return undefined;
  return ts.isAwaitExpression(node) ? node.expression : node;
}

function asCall(node, calleePath) {
  const unwrapped = unwrapAwait(node);
  return unwrapped !== undefined &&
    ts.isCallExpression(unwrapped) &&
    isPath(unwrapped.expression, calleePath)
    ? unwrapped
    : undefined;
}

function asAwaitedCall(node, calleePath) {
  return node !== undefined && ts.isAwaitExpression(node) ? asCall(node, calleePath) : undefined;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function propertyInitializer(objectLiteral, name) {
  if (objectLiteral === undefined || !ts.isObjectLiteralExpression(objectLiteral)) {
    return undefined;
  }
  if (objectLiteral.properties.some(ts.isSpreadAssignment)) return undefined;
  const matches = objectLiteral.properties.filter(
    (property) => property.name !== undefined && propertyName(property.name) === name,
  );
  if (matches.length !== 1) return undefined;
  if (ts.isPropertyAssignment(matches[0])) return matches[0].initializer;
  if (ts.isShorthandPropertyAssignment(matches[0])) return matches[0].name;
  return undefined;
}

function objectMethod(objectLiteral, name) {
  if (
    objectLiteral === undefined ||
    !ts.isObjectLiteralExpression(objectLiteral) ||
    objectLiteral.properties.some(ts.isSpreadAssignment)
  ) {
    return undefined;
  }
  const matches = objectLiteral.properties.filter(
    (property) => property.name !== undefined && propertyName(property.name) === name,
  );
  return matches.length === 1 && ts.isMethodDeclaration(matches[0]) ? matches[0] : undefined;
}

function directReturnExpression(functionDeclaration) {
  if (!functionDeclaration?.body) return undefined;
  const returns = functionDeclaration.body.statements.filter(ts.isReturnStatement);
  return returns.length === 1 ? returns[0].expression : undefined;
}

function isString(node, value) {
  return node !== undefined && ts.isStringLiteralLike(node) && node.text === value;
}

function numericValue(node) {
  if (node === undefined || !ts.isNumericLiteral(node)) return null;
  const value = Number(node.getText().replaceAll('_', ''));
  return Number.isFinite(value) ? value : null;
}

function callHasExactPaths(call, paths) {
  return (
    call.arguments.length === paths.length &&
    call.arguments.every((argument, index) => isPath(argument, paths[index]))
  );
}

function callExpressions(root, calleePath) {
  const calls = [];
  visitDescendants(root, (node) => {
    if (ts.isCallExpression(node) && isPath(node.expression, calleePath)) calls.push(node);
  });
  return calls;
}

function callPathSequence(root) {
  const paths = [];
  visitDescendants(root, (node) => {
    if (!ts.isCallExpression(node)) return;
    const path = expressionPath(node.expression);
    paths.push(path ?? '<dynamic>');
  });
  return paths;
}

function exactStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function canonicalNodeText(node, sourceFile) {
  return node.getText(sourceFile).replace(/\s+/g, '');
}

function exactKindArray(statements, expectedKinds) {
  return (
    statements.length === expectedKinds.length &&
    statements.every((statement, index) => statement.kind === expectedKinds[index])
  );
}

function literalValue(node) {
  if (node === undefined || node === null) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return numericValue(node);
  return undefined;
}

function constantBoolean(node) {
  if (node === undefined || node === null) return null;
  if (ts.isParenthesizedExpression(node)) return constantBoolean(node.expression);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = constantBoolean(node.operand);
    return operand === null ? null : !operand;
  }
  if (!ts.isBinaryExpression(node)) return null;
  const leftBoolean = constantBoolean(node.left);
  if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    if (leftBoolean === false) return false;
    if (leftBoolean === true) return constantBoolean(node.right);
    return null;
  }
  if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    if (leftBoolean === true) return true;
    if (leftBoolean === false) return constantBoolean(node.right);
    return null;
  }
  const left = literalValue(node.left);
  const right = literalValue(node.right);
  if (left === undefined || right === undefined) return null;
  if (
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
  ) {
    return left === right;
  }
  if (
    node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
    node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken
  ) {
    return left !== right;
  }
  return null;
}

function hasConstantControlFlow(functionDeclaration) {
  if (functionDeclaration?.body === undefined) return true;
  let found = false;
  function visit(node) {
    if (node !== functionDeclaration.body && ts.isFunctionLike(node)) return;
    if (
      (ts.isIfStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        ts.isConditionalExpression(node)) &&
      constantBoolean(node.expression) !== null
    ) {
      found = true;
    }
    if (ts.isForStatement(node) && node.condition === undefined) found = true;
    if (ts.isSwitchStatement(node) && literalValue(node.expression) !== undefined) found = true;
    ts.forEachChild(node, visit);
  }
  visit(functionDeclaration.body);
  return found;
}

function functionOwnedNodes(functionDeclaration, predicate) {
  if (functionDeclaration?.body === undefined) return [];
  const matches = [];
  function visit(node) {
    if (node !== functionDeclaration.body && ts.isFunctionLike(node)) return;
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(functionDeclaration.body);
  return matches;
}

function hasDirectAbruptCompletionBefore(statements, position) {
  return statements.some(
    (statement) =>
      statement.getStart() < position &&
      (ts.isReturnStatement(statement) ||
        ts.isThrowStatement(statement) ||
        ts.isWhileStatement(statement) ||
        ts.isDoStatement(statement) ||
        ts.isForStatement(statement) ||
        ts.isForInStatement(statement) ||
        ts.isForOfStatement(statement)),
  );
}

function requiredEnvDeclaration(declaration, envName, maximum) {
  const call = declaration?.initializer && asCall(declaration.initializer, 'requiredEnv');
  return (
    call !== undefined &&
    call.arguments.length === 3 &&
    isPath(call.arguments[0], 'readEnvironment') &&
    isString(call.arguments[1], envName) &&
    numericValue(call.arguments[2]) === maximum
  );
}

function objectCallDeclaration(declaration, calleePath, expectedProperties) {
  const call = declaration?.initializer && asCall(declaration.initializer, calleePath);
  if (
    call === undefined ||
    call.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(call.arguments[0])
  ) {
    return false;
  }
  return Object.entries(expectedProperties).every(([name, path]) => {
    const initializer = propertyInitializer(call.arguments[0], name);
    return initializer !== undefined && isPath(initializer, path);
  });
}

function auditProviderBudget(runtime, sourceFile) {
  const budget = findDirectFunction(runtime.body.statements, 'acquireRevenueCatProviderBudget');
  if (
    budget?.body === undefined ||
    !hasModifier(budget, ts.SyntaxKind.AsyncKeyword) ||
    hasConstantControlFlow(budget) ||
    !hasExactDeclaration(
      sourceFile,
      'acquireRevenueCatProviderBudget',
      ts.SyntaxKind.FunctionDeclaration,
    ) ||
    !hasExactDeclaration(budget, 'domain', ts.SyntaxKind.Parameter) ||
    !exactKindArray(budget.body.statements, [
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.TryStatement,
      ts.SyntaxKind.IfStatement,
    ])
  ) {
    return false;
  }
  const calls = callExpressions(budget.body, 'gateway.consumeRevenueCatProviderBudget');
  if (
    calls.length !== 1 ||
    !callHasExactPaths(calls[0], ['revenueCatProviderBudgetKey', 'domain'])
  ) {
    return false;
  }
  const awaited = calls[0].parent;
  const assignment = awaited.parent;
  const declarationStatement = budget.body.statements[0];
  const tryStatement = budget.body.statements[1];
  const failure = budget.body.statements[2];
  if (
    !ts.isVariableStatement(declarationStatement) ||
    (declarationStatement.declarationList.flags & ts.NodeFlags.Let) !== ts.NodeFlags.Let ||
    declarationStatement.declarationList.declarations.length !== 1 ||
    !ts.isIdentifier(declarationStatement.declarationList.declarations[0].name) ||
    declarationStatement.declarationList.declarations[0].name.text !== 'allowed' ||
    declarationStatement.declarationList.declarations[0].initializer?.kind !==
      ts.SyntaxKind.FalseKeyword ||
    !hasExactDeclaration(budget, 'allowed', ts.SyntaxKind.VariableDeclaration) ||
    !ts.isTryStatement(tryStatement) ||
    tryStatement.finallyBlock !== undefined ||
    tryStatement.tryBlock.statements.length !== 1 ||
    !ts.isExpressionStatement(tryStatement.tryBlock.statements[0]) ||
    tryStatement.tryBlock.statements[0].expression !== assignment ||
    tryStatement.catchClause === undefined ||
    tryStatement.catchClause.variableDeclaration !== undefined ||
    tryStatement.catchClause.block.statements.length !== 0 ||
    !ts.isAwaitExpression(awaited) ||
    !ts.isBinaryExpression(assignment) ||
    assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
    !isPath(assignment.left, 'allowed') ||
    assignment.right !== awaited ||
    identifierWrites(budget, 'allowed').length !== 1 ||
    identifierWrites(budget, 'allowed')[0] !== assignment ||
    !ts.isIfStatement(failure) ||
    canonicalNodeText(failure.expression, sourceFile) !== '!allowed' ||
    failure.elseStatement !== undefined ||
    !ts.isBlock(failure.thenStatement) ||
    failure.thenStatement.statements.length !== 1 ||
    !ts.isThrowStatement(failure.thenStatement.statements[0])
  ) {
    return false;
  }
  const thrown = failure.thenStatement.statements[0].expression;
  return (
    thrown !== undefined &&
    ts.isNewExpression(thrown) &&
    isPath(thrown.expression, 'AccountDeletionWorkerCapacityError') &&
    thrown.arguments?.length === 1 &&
    isString(thrown.arguments[0], 'DELETION_WORKER_PROVIDER_CAPACITY_EXHAUSTED')
  );
}

function auditRuntimeAdapters(sourceFile, runtime, executorDeclaration) {
  const executorCall =
    executorDeclaration?.initializer &&
    asCall(executorDeclaration.initializer, 'createRevenueCatV2DeletionExecutor');
  if (
    executorCall === undefined ||
    executorCall.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(executorCall.arguments[0]) ||
    !hasNamedImport(
      sourceFile,
      './durableDeletionDatabaseGateway.ts',
      'DurableDeletionDatabaseGateway',
    ) ||
    !hasNamedImport(
      sourceFile,
      './deletionProviderNetwork.ts',
      'createDeletionProviderJsonNetwork',
    ) ||
    !hasNamedImport(
      sourceFile,
      './revenueCatV2DeletionExecutor.ts',
      'deriveRevenueCatV2CredentialBinding',
    )
  ) {
    return false;
  }
  for (const [name, kind] of [
    ['DurableDeletionDatabaseGateway', ts.SyntaxKind.ImportSpecifier],
    ['createDeletionProviderJsonNetwork', ts.SyntaxKind.ImportSpecifier],
    ['deriveRevenueCatV2CredentialBinding', ts.SyntaxKind.ImportSpecifier],
    ['gateway', ts.SyntaxKind.VariableDeclaration],
    ['revenueCatProviderBudgetKey', ts.SyntaxKind.VariableDeclaration],
    ['revenueCatProviderNetwork', ts.SyntaxKind.VariableDeclaration],
    ['revenueCatBudgetDomain', ts.SyntaxKind.FunctionDeclaration],
  ]) {
    if (hasExactDeclaration(sourceFile, name, kind) && !hasIdentifierWrite(sourceFile, name)) {
      continue;
    }
    return false;
  }

  const gateway = findConstDeclaration(runtime.body.statements, 'gateway');
  const gatewayConstruction = gateway?.initializer;
  if (
    gatewayConstruction === undefined ||
    !ts.isNewExpression(gatewayConstruction) ||
    !isPath(gatewayConstruction.expression, 'DurableDeletionDatabaseGateway') ||
    gatewayConstruction.arguments?.length !== 1 ||
    !isPath(gatewayConstruction.arguments[0], 'options.client')
  ) {
    return false;
  }
  const budgetKey = findConstDeclaration(runtime.body.statements, 'revenueCatProviderBudgetKey');
  const budgetKeyCall =
    budgetKey?.initializer &&
    asAwaitedCall(budgetKey.initializer, 'deriveRevenueCatV2CredentialBinding');
  if (budgetKeyCall === undefined || !callHasExactPaths(budgetKeyCall, ['revenueCatSecret'])) {
    return false;
  }
  const providerNetwork = findConstDeclaration(
    runtime.body.statements,
    'revenueCatProviderNetwork',
  );
  const providerNetworkCall =
    providerNetwork?.initializer &&
    asCall(providerNetwork.initializer, 'createDeletionProviderJsonNetwork');
  if (
    providerNetworkCall === undefined ||
    providerNetworkCall.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(providerNetworkCall.arguments[0]) ||
    !isPath(
      propertyInitializer(providerNetworkCall.arguments[0], 'maxResponseBytes'),
      'ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES',
    ) ||
    !isPath(propertyInitializer(providerNetworkCall.arguments[0], 'now'), 'now') ||
    !isPath(propertyInitializer(providerNetworkCall.arguments[0], 'fetcher'), 'fetchWithTimeout')
  ) {
    return false;
  }
  const timeout = propertyInitializer(providerNetworkCall.arguments[0], 'maxTimeoutMs');
  const timeoutCall = timeout && asCall(timeout, 'Math.min');
  if (
    timeoutCall === undefined ||
    !callHasExactPaths(timeoutCall, [
      'providerTimeoutMs',
      'REVENUECAT_V2_MAX_NETWORK_TIMEOUT_MS',
    ]) ||
    !auditProviderBudget(runtime, sourceFile)
  ) {
    return false;
  }

  const executorOptions = executorCall.arguments[0];
  const network = propertyInitializer(executorOptions, 'network');
  const reserve = propertyInitializer(network, 'reserveMutation');
  const execute = objectMethod(network, 'execute');
  if (
    reserve === undefined ||
    !ts.isArrowFunction(reserve) ||
    reserve.parameters.length !== 0 ||
    ts.isBlock(reserve.body) ||
    asCall(reserve.body, 'acquireRevenueCatProviderBudget')?.arguments.length !== 1 ||
    !isString(
      asCall(reserve.body, 'acquireRevenueCatProviderBudget')?.arguments[0],
      'customer-information',
    ) ||
    execute?.body === undefined ||
    !hasModifier(execute, ts.SyntaxKind.AsyncKeyword) ||
    !hasExactDeclaration(execute, 'request', ts.SyntaxKind.Parameter) ||
    !hasExactDeclaration(execute, 'context', ts.SyntaxKind.Parameter) ||
    hasIdentifierWrite(execute, 'request') ||
    hasIdentifierWrite(execute, 'context') ||
    hasConstantControlFlow(execute) ||
    !exactKindArray(execute.body.statements, [
      ts.SyntaxKind.IfStatement,
      ts.SyntaxKind.ReturnStatement,
    ])
  ) {
    return false;
  }
  const methodIf = execute.body.statements[0];
  const methodReturn = execute.body.statements[1];
  if (
    !ts.isIfStatement(methodIf) ||
    canonicalNodeText(methodIf.expression, sourceFile) !== 'context.requestBudgetReserved' ||
    !ts.isBlock(methodIf.thenStatement) ||
    methodIf.thenStatement.statements.length !== 1 ||
    !ts.isIfStatement(methodIf.thenStatement.statements[0]) ||
    canonicalNodeText(methodIf.thenStatement.statements[0].expression, sourceFile) !==
      "String(request.init.method)!=='DELETE'" ||
    methodIf.elseStatement === undefined ||
    !ts.isBlock(methodIf.elseStatement) ||
    methodIf.elseStatement.statements.length !== 1 ||
    !ts.isExpressionStatement(methodIf.elseStatement.statements[0]) ||
    !ts.isAwaitExpression(methodIf.elseStatement.statements[0].expression) ||
    !ts.isReturnStatement(methodReturn)
  ) {
    return false;
  }
  const unreservedCall = asAwaitedCall(
    methodIf.elseStatement.statements[0].expression,
    'acquireRevenueCatProviderBudget',
  );
  const domainCall =
    unreservedCall?.arguments[0] && asCall(unreservedCall.arguments[0], 'revenueCatBudgetDomain');
  const providerExecute =
    methodReturn.expression &&
    asAwaitedCall(methodReturn.expression, 'revenueCatProviderNetwork.execute');
  if (
    unreservedCall === undefined ||
    unreservedCall.arguments.length !== 1 ||
    domainCall === undefined ||
    !callHasExactPaths(domainCall, ['request']) ||
    providerExecute === undefined ||
    !callHasExactPaths(providerExecute, ['request', 'context']) ||
    !exactStringArray(callPathSequence(execute.body), [
      'String',
      'acquireRevenueCatProviderBudget',
      'revenueCatBudgetDomain',
      'revenueCatProviderNetwork.execute',
    ])
  ) {
    return false;
  }

  const gatewayAdapter = propertyInitializer(executorOptions, 'gateway');
  const markStarted = objectMethod(gatewayAdapter, 'markRequestStarted');
  const markReturn = directReturnExpression(markStarted);
  if (
    markStarted?.body === undefined ||
    !hasModifier(markStarted, ts.SyntaxKind.AsyncKeyword) ||
    !hasExactDeclaration(markStarted, 'claim', ts.SyntaxKind.Parameter) ||
    hasIdentifierWrite(markStarted, 'claim') ||
    hasConstantControlFlow(markStarted) ||
    !exactKindArray(markStarted.body.statements, [ts.SyntaxKind.ReturnStatement]) ||
    markReturn === undefined ||
    !ts.isObjectLiteralExpression(markReturn)
  ) {
    return false;
  }
  const startedAt = propertyInitializer(markReturn, 'requestStartedAt');
  const markCall = startedAt && asAwaitedCall(startedAt, 'gateway.markRequestStarted');
  return markCall !== undefined && callHasExactPaths(markCall, ['claim']);
}

function auditEntrypoint(sourceFile) {
  if (
    !hasNamedImport(sourceFile, './durableDeletionRuntime.ts', 'createDurableDeletionRuntime') ||
    !hasNamedImport(
      sourceFile,
      './durableDeletionHttpHandler.ts',
      'createDurableDeletionHttpHandler',
    ) ||
    !hasNamedImport(
      sourceFile,
      '../_shared/stagingTrafficFreeze.ts',
      'stagingTrafficFreezeResponse',
    ) ||
    !hasExactDeclaration(
      sourceFile,
      'createDurableDeletionRuntime',
      ts.SyntaxKind.ImportSpecifier,
    ) ||
    !hasExactDeclaration(
      sourceFile,
      'createDurableDeletionHttpHandler',
      ts.SyntaxKind.ImportSpecifier,
    ) ||
    !hasExactDeclaration(
      sourceFile,
      'stagingTrafficFreezeResponse',
      ts.SyntaxKind.ImportSpecifier,
    ) ||
    declarationsNamed(sourceFile, 'Deno').length !== 0 ||
    hasIdentifierWrite(sourceFile, 'createDurableDeletionRuntime') ||
    hasIdentifierWrite(sourceFile, 'createDurableDeletionHttpHandler')
  ) {
    return false;
  }
  const dependencies = findConstDeclaration(sourceFile.statements, 'dependencies');
  const runtimeCall =
    dependencies?.initializer &&
    asAwaitedCall(dependencies.initializer, 'createDurableDeletionRuntime');
  if (
    runtimeCall === undefined ||
    runtimeCall.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(runtimeCall.arguments[0]) ||
    !isPath(propertyInitializer(runtimeCall.arguments[0], 'client'), 'client') ||
    !isPath(propertyInitializer(runtimeCall.arguments[0], 'schedule'), 'schedule')
  ) {
    return false;
  }
  const handler = findConstDeclaration(sourceFile.statements, 'handler');
  const handlerCall =
    handler?.initializer && asCall(handler.initializer, 'createDurableDeletionHttpHandler');
  if (
    handlerCall === undefined ||
    !callHasExactPaths(handlerCall, ['dependencies']) ||
    !hasExactDeclaration(sourceFile, 'dependencies', ts.SyntaxKind.VariableDeclaration) ||
    !hasExactDeclaration(sourceFile, 'handler', ts.SyntaxKind.VariableDeclaration) ||
    hasIdentifierWrite(sourceFile, 'dependencies') ||
    hasIdentifierWrite(sourceFile, 'handler')
  ) {
    return false;
  }
  const serveCalls = callExpressions(sourceFile, 'Deno.serve');
  if (serveCalls.length !== 1 || serveCalls[0].arguments.length !== 1) return false;
  const serveStatement = serveCalls[0].parent;
  if (
    !ts.isExpressionStatement(serveStatement) ||
    serveStatement.expression !== serveCalls[0] ||
    !sourceFile.statements.includes(serveStatement) ||
    sourceFile.statements.at(-1) !== serveStatement ||
    hasDirectAbruptCompletionBefore(sourceFile.statements, serveStatement.getStart(sourceFile))
  ) {
    return false;
  }
  const callback = serveCalls[0].arguments[0];
  if (
    !ts.isArrowFunction(callback) ||
    callback.parameters.length !== 1 ||
    !ts.isIdentifier(callback.parameters[0].name) ||
    callback.parameters[0].name.text !== 'request' ||
    !ts.isBinaryExpression(callback.body) ||
    callback.body.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken
  ) {
    return false;
  }
  const freezeCall = asCall(callback.body.left, 'stagingTrafficFreezeResponse');
  const liveHandlerCall = asCall(callback.body.right, 'handler');
  return (
    freezeCall !== undefined &&
    freezeCall.arguments.length === 0 &&
    liveHandlerCall !== undefined &&
    callHasExactPaths(liveHandlerCall, ['request']) &&
    handler.getStart(sourceFile) < serveCalls[0].getStart(sourceFile)
  );
}

function auditRuntime(sourceFile) {
  if (
    !hasNamedImport(
      sourceFile,
      './revenueCatV2DeletionExecutor.ts',
      'createRevenueCatV2DeletionExecutor',
    ) ||
    !hasNamedImport(sourceFile, './durableDeletionWorker.ts', 'runAccountDeletionWorker') ||
    !hasExactDeclaration(
      sourceFile,
      'createRevenueCatV2DeletionExecutor',
      ts.SyntaxKind.ImportSpecifier,
    ) ||
    !hasExactDeclaration(sourceFile, 'runAccountDeletionWorker', ts.SyntaxKind.ImportSpecifier) ||
    hasIdentifierWrite(sourceFile, 'createRevenueCatV2DeletionExecutor') ||
    hasIdentifierWrite(sourceFile, 'runAccountDeletionWorker')
  ) {
    return false;
  }
  const runtime = findTopLevelFunction(sourceFile, 'createDurableDeletionRuntime');
  if (
    runtime?.body === undefined ||
    !hasModifier(runtime, ts.SyntaxKind.ExportKeyword) ||
    !hasModifier(runtime, ts.SyntaxKind.AsyncKeyword) ||
    hasConstantControlFlow(runtime)
  ) {
    return false;
  }
  const statements = runtime.body.statements;
  const projectId = findConstDeclaration(statements, 'revenueCatProjectId');
  const secret = findConstDeclaration(statements, 'revenueCatSecret');
  const executor = findConstDeclaration(statements, 'revenueCatExecutor');
  const executorCall =
    executor?.initializer && asCall(executor.initializer, 'createRevenueCatV2DeletionExecutor');
  const executorOptions =
    executorCall?.arguments.length === 1 && ts.isObjectLiteralExpression(executorCall.arguments[0])
      ? executorCall.arguments[0]
      : undefined;
  const budgetKey = findConstDeclaration(statements, 'revenueCatProviderBudgetKey');
  const budgetKeyCall =
    budgetKey?.initializer &&
    asAwaitedCall(budgetKey.initializer, 'deriveRevenueCatV2CredentialBinding');
  const executorSecret = propertyInitializer(executorOptions, 'secretApiKey');
  const secretIdentifiers = identifiersNamed(runtime, 'revenueCatSecret');
  const executors = findConstDeclaration(statements, 'executors');
  const runWorker = findDirectFunction(statements, 'runWorker');
  const workerReturn = directReturnExpression(runWorker);
  const workerCall = workerReturn && asAwaitedCall(workerReturn, 'runAccountDeletionWorker');
  const runtimeReturn = directReturnExpression(runtime);
  const runtimeReturns = functionOwnedNodes(runtime, ts.isReturnStatement);
  if (
    !(
      requiredEnvDeclaration(projectId, 'REVENUECAT_PROJECT_ID', 255) &&
      requiredEnvDeclaration(secret, 'REVENUECAT_V2_SECRET_API_KEY', 1_000) &&
      budgetKeyCall !== undefined &&
      callHasExactPaths(budgetKeyCall, ['revenueCatSecret']) &&
      callExpressions(runtime.body, 'deriveRevenueCatV2CredentialBinding').length === 1 &&
      executorSecret !== undefined &&
      isPath(executorSecret, 'revenueCatSecret') &&
      secretIdentifiers.length === 3 &&
      secretIdentifiers.includes(secret.name) &&
      secretIdentifiers.includes(budgetKeyCall.arguments[0]) &&
      secretIdentifiers.includes(executorSecret) &&
      objectCallDeclaration(executor, 'createRevenueCatV2DeletionExecutor', {
        projectId: 'revenueCatProjectId',
        secretApiKey: 'revenueCatSecret',
      }) &&
      auditRuntimeAdapters(sourceFile, runtime, executor) &&
      executors?.initializer !== undefined &&
      ts.isObjectLiteralExpression(executors.initializer) &&
      isPath(
        propertyInitializer(executors.initializer, 'revenuecat_delete'),
        'revenueCatExecutor',
      ) &&
      workerCall !== undefined &&
      workerCall.arguments.length === 1 &&
      ts.isObjectLiteralExpression(workerCall.arguments[0]) &&
      isPath(propertyInitializer(workerCall.arguments[0], 'executors'), 'executors') &&
      runtimeReturn !== undefined &&
      ts.isObjectLiteralExpression(runtimeReturn) &&
      isPath(propertyInitializer(runtimeReturn, 'runWorker'), 'runWorker') &&
      runtimeReturns.length === 1 &&
      runtimeReturns[0].expression === runtimeReturn
    )
  ) {
    return false;
  }
  return (
    hasExactDeclaration(sourceFile, 'revenueCatProjectId', ts.SyntaxKind.VariableDeclaration) &&
    hasExactDeclaration(sourceFile, 'revenueCatSecret', ts.SyntaxKind.VariableDeclaration) &&
    hasExactDeclaration(sourceFile, 'revenueCatExecutor', ts.SyntaxKind.VariableDeclaration) &&
    hasExactDeclaration(sourceFile, 'executors', ts.SyntaxKind.VariableDeclaration) &&
    hasExactDeclaration(sourceFile, 'runWorker', ts.SyntaxKind.FunctionDeclaration) &&
    !hasConstantControlFlow(runWorker) &&
    exactKindArray(runWorker.body.statements, [
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.ReturnStatement,
    ]) &&
    !hasIdentifierWrite(sourceFile, 'revenueCatProjectId') &&
    !hasIdentifierWrite(sourceFile, 'revenueCatSecret') &&
    !hasIdentifierWrite(sourceFile, 'revenueCatExecutor') &&
    !hasIdentifierWrite(sourceFile, 'executors') &&
    !hasIdentifierWrite(sourceFile, 'runWorker') &&
    executor.getStart(sourceFile) < executors.getStart(sourceFile) &&
    executors.getStart(sourceFile) < runWorker.getStart(sourceFile)
  );
}

function directAwaitedCallStatement(statements, calleePath) {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isAwaitExpression(statement.expression))
      continue;
    const call = asCall(statement.expression, calleePath);
    if (call !== undefined) return { call, statement };
  }
  return undefined;
}

function directAwaitedCallDeclaration(statements, name, calleePath) {
  const declaration = findConstDeclaration(statements, name);
  const call = declaration?.initializer && asAwaitedCall(declaration.initializer, calleePath);
  return call === undefined ? undefined : { call, declaration };
}

function awaitedCallExpressionStatement(statement, calleePath) {
  if (!ts.isExpressionStatement(statement) || !ts.isAwaitExpression(statement.expression)) {
    return undefined;
  }
  return asAwaitedCall(statement.expression, calleePath);
}

function isEmptyReturn(statement) {
  return ts.isReturnStatement(statement) && statement.expression === undefined;
}

function guardedAwaitedCall(statement, calleePath, validateCall) {
  if (
    !ts.isIfStatement(statement) ||
    statement.elseStatement !== undefined ||
    !ts.isBlock(statement.thenStatement) ||
    !exactKindArray(statement.thenStatement.statements, [
      ts.SyntaxKind.ExpressionStatement,
      ts.SyntaxKind.ReturnStatement,
    ])
  ) {
    return false;
  }
  const call = awaitedCallExpressionStatement(statement.thenStatement.statements[0], calleePath);
  return (
    call !== undefined && validateCall(call) && isEmptyReturn(statement.thenStatement.statements[1])
  );
}

function exactAssignmentCallStatement(statement, targetPath, calleePath, validateCall) {
  if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) {
    return false;
  }
  const assignment = statement.expression;
  if (
    assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
    !isPath(assignment.left, targetPath) ||
    !ts.isCallExpression(assignment.right) ||
    !isPath(assignment.right.expression, calleePath)
  ) {
    return false;
  }
  return validateCall(assignment.right);
}

function exactErrorThrow(statement, constructorPath, errorCode) {
  const expression = ts.isThrowStatement(statement) ? statement.expression : undefined;
  return (
    expression !== undefined &&
    ts.isNewExpression(expression) &&
    isPath(expression.expression, constructorPath) &&
    expression.arguments?.length === 1 &&
    isString(expression.arguments[0], errorCode)
  );
}

function auditDispatchBudgetGuards(sourceFile) {
  const deadline = findTopLevelFunction(sourceFile, 'hasDeadlineReserve');
  const canRequest = findTopLevelFunction(sourceFile, 'canRequest');
  const deadlineReturn = directReturnExpression(deadline);
  const requestReturn = directReturnExpression(canRequest);
  return (
    deadline?.body !== undefined &&
    canRequest?.body !== undefined &&
    hasExactDeclaration(sourceFile, 'hasDeadlineReserve', ts.SyntaxKind.FunctionDeclaration) &&
    hasExactDeclaration(sourceFile, 'canRequest', ts.SyntaxKind.FunctionDeclaration) &&
    hasExactDeclaration(deadline, 'options', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(deadline, 'context', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(canRequest, 'options', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(canRequest, 'context', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(canRequest, 'budget', ts.SyntaxKind.Parameter) &&
    !hasIdentifierWrite(sourceFile, 'hasDeadlineReserve') &&
    !hasIdentifierWrite(sourceFile, 'canRequest') &&
    !hasIdentifierWrite(deadline, 'options') &&
    !hasIdentifierWrite(deadline, 'context') &&
    !hasIdentifierWrite(canRequest, 'options') &&
    !hasIdentifierWrite(canRequest, 'context') &&
    !hasIdentifierWrite(canRequest, 'budget') &&
    !hasConstantControlFlow(deadline) &&
    !hasConstantControlFlow(canRequest) &&
    exactKindArray(deadline.body.statements, [ts.SyntaxKind.ReturnStatement]) &&
    exactKindArray(canRequest.body.statements, [ts.SyntaxKind.ReturnStatement]) &&
    deadlineReturn !== undefined &&
    requestReturn !== undefined &&
    canonicalNodeText(deadlineReturn, sourceFile) ===
      'checkedNow(options.clock)+options.deadlineReserveMs<context.deadlineAtMs' &&
    canonicalNodeText(requestReturn, sourceFile) ===
      'budget.used<options.maxRequests&&hasDeadlineReserve(options,context)'
  );
}

function auditExecuteNetworkHelper(sourceFile) {
  const executeNetwork = findTopLevelFunction(sourceFile, 'executeNetwork');
  if (
    executeNetwork?.body === undefined ||
    !hasModifier(executeNetwork, ts.SyntaxKind.AsyncKeyword) ||
    hasConstantControlFlow(executeNetwork) ||
    !exactKindArray(executeNetwork.body.statements, [
      ts.SyntaxKind.ExpressionStatement,
      ts.SyntaxKind.ReturnStatement,
    ]) ||
    !hasExactDeclaration(sourceFile, 'executeNetwork', ts.SyntaxKind.FunctionDeclaration) ||
    !hasExactDeclaration(sourceFile, 'responseOrThrow', ts.SyntaxKind.FunctionDeclaration) ||
    hasIdentifierWrite(sourceFile, 'executeNetwork') ||
    hasIdentifierWrite(sourceFile, 'responseOrThrow') ||
    !hasExactDeclaration(executeNetwork, 'options', ts.SyntaxKind.Parameter) ||
    !hasExactDeclaration(executeNetwork, 'request', ts.SyntaxKind.Parameter) ||
    !hasExactDeclaration(executeNetwork, 'context', ts.SyntaxKind.Parameter) ||
    !hasExactDeclaration(executeNetwork, 'budget', ts.SyntaxKind.Parameter) ||
    !hasExactDeclaration(executeNetwork, 'requestBudgetReserved', ts.SyntaxKind.Parameter)
  ) {
    return false;
  }
  const incrementStatement = executeNetwork.body.statements[0];
  const increment = ts.isExpressionStatement(incrementStatement)
    ? incrementStatement.expression
    : undefined;
  const budgetWrites = identifierWrites(executeNetwork, 'budget');
  if (
    increment === undefined ||
    !ts.isBinaryExpression(increment) ||
    increment.operatorToken.kind !== ts.SyntaxKind.PlusEqualsToken ||
    !isPath(increment.left, 'budget.used') ||
    numericValue(increment.right) !== 1 ||
    budgetWrites.length !== 1 ||
    budgetWrites[0] !== increment ||
    hasIdentifierWrite(executeNetwork, 'options') ||
    hasIdentifierWrite(executeNetwork, 'request') ||
    hasIdentifierWrite(executeNetwork, 'context') ||
    hasIdentifierWrite(executeNetwork, 'requestBudgetReserved')
  ) {
    return false;
  }
  const returned = directReturnExpression(executeNetwork);
  const responseCall = returned && asCall(returned, 'responseOrThrow');
  if (responseCall === undefined || responseCall.arguments.length !== 1) return false;
  const networkCall = asAwaitedCall(responseCall.arguments[0], 'options.network.execute');
  if (
    networkCall === undefined ||
    networkCall.arguments.length !== 2 ||
    !isPath(networkCall.arguments[0], 'request') ||
    !ts.isObjectLiteralExpression(networkCall.arguments[1]) ||
    !isPath(
      propertyInitializer(networkCall.arguments[1], 'deadlineAtMs'),
      'context.deadlineAtMs',
    ) ||
    !isPath(
      propertyInitializer(networkCall.arguments[1], 'requestBudgetReserved'),
      'requestBudgetReserved',
    )
  ) {
    return false;
  }
  const networkCalls = callExpressions(executeNetwork.body, 'options.network.execute');
  return networkCalls.length === 1 && networkCalls[0] === networkCall;
}

function auditExecutor(sourceFile) {
  if (
    !hasNamedImport(sourceFile, './durableProviderDeletion.ts', 'buildRevenueCatV2DeleteRequest') ||
    !hasExactDeclaration(
      sourceFile,
      'buildRevenueCatV2DeleteRequest',
      ts.SyntaxKind.ImportSpecifier,
    ) ||
    hasIdentifierWrite(sourceFile, 'buildRevenueCatV2DeleteRequest') ||
    !auditDispatchBudgetGuards(sourceFile) ||
    !auditExecuteNetworkHelper(sourceFile)
  ) {
    return false;
  }
  const dispatch = findTopLevelFunction(sourceFile, 'dispatchDelete');
  if (dispatch?.body === undefined || !hasModifier(dispatch, ts.SyntaxKind.AsyncKeyword))
    return false;
  const statements = dispatch.body.statements;
  const request = findConstDeclaration(statements, 'request');
  const requestCall =
    request?.initializer && asCall(request.initializer, 'buildRevenueCatV2DeleteRequest');
  if (
    requestCall === undefined ||
    requestCall.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(requestCall.arguments[0]) ||
    !isPath(propertyInitializer(requestCall.arguments[0], 'evidence'), 'ready.preflightEvidence') ||
    !isPath(propertyInitializer(requestCall.arguments[0], 'secretApiKey'), 'options.secretApiKey')
  ) {
    return false;
  }
  const reserve = directAwaitedCallStatement(statements, 'options.network.reserveMutation');
  const started = directAwaitedCallDeclaration(
    statements,
    'started',
    'options.gateway.markRequestStarted',
  );
  const tryStatement = statements.find(ts.isTryStatement);
  const response =
    tryStatement === undefined
      ? undefined
      : directAwaitedCallDeclaration(
          tryStatement.tryBlock.statements,
          'response',
          'executeNetwork',
        );
  if (
    reserve === undefined ||
    reserve.call.arguments.length !== 1 ||
    !ts.isObjectLiteralExpression(reserve.call.arguments[0]) ||
    !isPath(
      propertyInitializer(reserve.call.arguments[0], 'deadlineAtMs'),
      'context.deadlineAtMs',
    ) ||
    started === undefined ||
    !callHasExactPaths(started.call, ['claim']) ||
    response === undefined ||
    response.call.arguments.length !== 5 ||
    !isPath(response.call.arguments[0], 'options') ||
    !isPath(response.call.arguments[1], 'request') ||
    !isPath(response.call.arguments[2], 'context') ||
    !isPath(response.call.arguments[3], 'budget') ||
    response.call.arguments[4].kind !== ts.SyntaxKind.TrueKeyword
  ) {
    return false;
  }
  const executeCalls = callExpressions(dispatch.body, 'executeNetwork');
  const identityBarrierCall = awaitedCallExpressionStatement(
    statements[1],
    'establishIdentityBarrier',
  );
  const persistenceCall = awaitedCallExpressionStatement(
    statements.at(-1),
    'persistAndTransitionToReconciliation',
  );
  const guards = statements.filter(ts.isIfStatement);
  const ifConditions = guards.map((statement) =>
    canonicalNodeText(statement.expression, sourceFile),
  );
  const invalidStartedGuard = guards[3];
  const invalidStartedThrow =
    invalidStartedGuard !== undefined &&
    ts.isBlock(invalidStartedGuard.thenStatement) &&
    invalidStartedGuard.thenStatement.statements.length === 1
      ? invalidStartedGuard.thenStatement.statements[0]
      : undefined;
  const tryStatements = tryStatement?.tryBlock.statements ?? [];
  const catchClause = tryStatement?.catchClause;
  const catchStatements = catchClause?.block.statements ?? [];
  const capacityGuard = catchStatements[0];
  return (
    hasExactDeclaration(sourceFile, 'dispatchDelete', ts.SyntaxKind.FunctionDeclaration) &&
    hasExactDeclaration(dispatch, 'options', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(dispatch, 'claim', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(dispatch, 'context', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(dispatch, 'budget', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(dispatch, 'ready', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(dispatch, 'request', ts.SyntaxKind.VariableDeclaration) &&
    !hasIdentifierWrite(dispatch, 'request') &&
    !hasIdentifierWrite(dispatch, 'options') &&
    hasConstantControlFlow(dispatch) === false &&
    exactKindArray(statements, DISPATCH_DELETE_STATEMENT_KINDS) &&
    exactStringArray(ifConditions, DISPATCH_DELETE_IF_CONDITIONS) &&
    identityBarrierCall !== undefined &&
    identityBarrierCall.arguments.length === 3 &&
    isPath(identityBarrierCall.arguments[0], 'options') &&
    isPath(identityBarrierCall.arguments[1], 'claim') &&
    ts.isObjectLiteralExpression(identityBarrierCall.arguments[2]) &&
    isPath(
      propertyInitializer(identityBarrierCall.arguments[2], 'projectId'),
      'ready.preflightEvidence.projectId',
    ) &&
    persistenceCall !== undefined &&
    persistenceCall.arguments.length === 4 &&
    isPath(persistenceCall.arguments[0], 'options') &&
    isPath(persistenceCall.arguments[1], 'claim') &&
    guardedAwaitedCall(
      guards[0],
      'recordActionRequired',
      (call) =>
        call.arguments.length === 3 &&
        isPath(call.arguments[0], 'options') &&
        isPath(call.arguments[1], 'claim') &&
        isString(call.arguments[2], 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED'),
    ) &&
    guardedAwaitedCall(guards[1], 'budgetRetry', (call) =>
      callHasExactPaths(call, ['options', 'claim', 'ready']),
    ) &&
    guardedAwaitedCall(guards[2], 'budgetRetry', (call) =>
      callHasExactPaths(call, ['options', 'claim', 'ready']),
    ) &&
    invalidStartedGuard !== undefined &&
    invalidStartedGuard.elseStatement === undefined &&
    invalidStartedThrow !== undefined &&
    exactErrorThrow(
      invalidStartedThrow,
      'RevenueCatV2DeletionExecutorError',
      'REVENUECAT_V2_EXECUTOR_RESPONSE_INVALID',
    ) &&
    guardedAwaitedCall(guards[4], 'recordActionRequired', (call) =>
      callHasExactPaths(call, ['options', 'claim', 'disposition.resultCode']),
    ) &&
    tryStatement.finallyBlock === undefined &&
    exactKindArray(tryStatement.tryBlock.statements, [
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.ExpressionStatement,
      ts.SyntaxKind.ExpressionStatement,
    ]) &&
    tryStatements[0] === response.declaration.parent.parent &&
    exactAssignmentCallStatement(
      tryStatements[1],
      'providerMinimumDelayMs',
      'providerRetryAfterMs',
      (call) => callHasExactPaths(call, ['response']),
    ) &&
    exactAssignmentCallStatement(
      tryStatements[2],
      'disposition',
      'classifyRevenueCatV2DeleteResponse',
      (call) =>
        call.arguments.length === 3 &&
        isPath(call.arguments[0], 'response.status') &&
        isPath(call.arguments[1], 'response.body') &&
        isPath(call.arguments[2], 'ready.preflightEvidence'),
    ) &&
    catchClause !== undefined &&
    catchClause.variableDeclaration !== undefined &&
    ts.isIdentifier(catchClause.variableDeclaration.name) &&
    catchClause.variableDeclaration.name.text === 'error' &&
    exactKindArray(catchStatements, [
      ts.SyntaxKind.IfStatement,
      ts.SyntaxKind.ExpressionStatement,
    ]) &&
    ts.isIfStatement(capacityGuard) &&
    canonicalNodeText(capacityGuard.expression, sourceFile) ===
      'errorinstanceofAccountDeletionWorkerCapacityError' &&
    capacityGuard.elseStatement === undefined &&
    ts.isThrowStatement(capacityGuard.thenStatement) &&
    isPath(capacityGuard.thenStatement.expression, 'error') &&
    exactAssignmentCallStatement(
      catchStatements[1],
      'disposition',
      'classifyRevenueCatV2TransportFailure',
      (call) => call.arguments.length === 1 && isString(call.arguments[0], 'after_request_started'),
    ) &&
    exactStringArray(callPathSequence(dispatch.body), DISPATCH_DELETE_CALL_PATHS) &&
    executeCalls.length === 1 &&
    executeCalls[0] === response.call &&
    callExpressions(dispatch.body, 'options.network.execute').length === 0 &&
    !hasDirectAbruptCompletionBefore(statements, response.declaration.getStart(sourceFile)) &&
    request.getStart(sourceFile) < reserve.statement.getStart(sourceFile) &&
    reserve.statement.getStart(sourceFile) < started.declaration.getStart(sourceFile) &&
    started.declaration.getStart(sourceFile) < response.declaration.getStart(sourceFile)
  );
}

function isSingleSpanTemplate(node, head, expressionPathValue, tail) {
  return (
    node !== undefined &&
    ts.isTemplateExpression(node) &&
    node.head.text === head &&
    node.templateSpans.length === 1 &&
    isPath(node.templateSpans[0].expression, expressionPathValue) &&
    node.templateSpans[0].literal.text === tail
  );
}

function isEncodeCall(node, argumentName) {
  const call = asCall(node, 'encodeURIComponent');
  return call !== undefined && callHasExactPaths(call, [argumentName]);
}

function auditRevenueCatHeaders(sourceFile) {
  const headers = findTopLevelFunction(sourceFile, 'revenueCatV2Headers');
  const returned = directReturnExpression(headers);
  if (
    returned === undefined ||
    !ts.isObjectLiteralExpression(returned) ||
    !hasExactDeclaration(sourceFile, 'revenueCatV2Headers', ts.SyntaxKind.FunctionDeclaration) ||
    !hasExactDeclaration(headers, 'secretApiKey', ts.SyntaxKind.Parameter) ||
    hasConstantControlFlow(headers) ||
    !exactKindArray(headers.body.statements, [ts.SyntaxKind.ReturnStatement]) ||
    hasIdentifierWrite(sourceFile, 'revenueCatV2Headers') ||
    hasIdentifierWrite(headers, 'secretApiKey')
  ) {
    return false;
  }
  const authorization = propertyInitializer(returned, 'Authorization');
  return (
    isString(propertyInitializer(returned, 'Accept'), 'application/json') &&
    authorization !== undefined &&
    isSingleSpanTemplate(authorization, 'Bearer ', 'secretApiKey', '')
  );
}

function auditRevenueCatCustomerPath(sourceFile) {
  const path = findTopLevelFunction(sourceFile, 'revenueCatV2CustomerPath');
  const returned = directReturnExpression(path);
  return (
    hasExactDeclaration(
      sourceFile,
      'revenueCatV2CustomerPath',
      ts.SyntaxKind.FunctionDeclaration,
    ) &&
    hasExactDeclaration(path, 'projectId', ts.SyntaxKind.Parameter) &&
    hasExactDeclaration(path, 'customerId', ts.SyntaxKind.Parameter) &&
    !hasIdentifierWrite(sourceFile, 'revenueCatV2CustomerPath') &&
    !hasIdentifierWrite(path, 'projectId') &&
    !hasIdentifierWrite(path, 'customerId') &&
    !hasConstantControlFlow(path) &&
    exactKindArray(path.body.statements, [ts.SyntaxKind.ReturnStatement]) &&
    returned !== undefined &&
    ts.isTemplateExpression(returned) &&
    returned.head.text === '/v2/projects/' &&
    returned.templateSpans.length === 2 &&
    isEncodeCall(returned.templateSpans[0].expression, 'projectId') &&
    returned.templateSpans[0].literal.text === '/customers/' &&
    isEncodeCall(returned.templateSpans[1].expression, 'customerId') &&
    returned.templateSpans[1].literal.text === ''
  );
}

function isRevenueCatDeleteUrl(node) {
  if (
    node === undefined ||
    !ts.isTemplateExpression(node) ||
    node.head.text !== '' ||
    node.templateSpans.length !== 2
  ) {
    return false;
  }
  const first = node.templateSpans[0];
  const second = node.templateSpans[1];
  const sliceCall = asCall(second.expression, 'path.slice');
  return (
    isPath(first.expression, 'REVENUECAT_V2_API_BASE') &&
    first.literal.text === '' &&
    sliceCall !== undefined &&
    sliceCall.arguments.length === 1 &&
    numericValue(sliceCall.arguments[0]) === 3 &&
    second.literal.text === ''
  );
}

function auditDeleteBuilder(sourceFile) {
  const apiBase = findConstDeclaration(sourceFile.statements, 'REVENUECAT_V2_API_BASE');
  if (
    !isString(apiBase?.initializer, 'https://api.revenuecat.com/v2') ||
    !hasExactDeclaration(sourceFile, 'REVENUECAT_V2_API_BASE', ts.SyntaxKind.VariableDeclaration) ||
    hasIdentifierWrite(sourceFile, 'REVENUECAT_V2_API_BASE')
  ) {
    return false;
  }
  const builder = findTopLevelFunction(sourceFile, 'buildRevenueCatV2DeleteRequest');
  if (
    builder?.body === undefined ||
    !hasModifier(builder, ts.SyntaxKind.ExportKeyword) ||
    !hasExactDeclaration(
      sourceFile,
      'buildRevenueCatV2DeleteRequest',
      ts.SyntaxKind.FunctionDeclaration,
    ) ||
    !hasExactDeclaration(builder, 'options', ts.SyntaxKind.Parameter) ||
    hasIdentifierWrite(sourceFile, 'buildRevenueCatV2DeleteRequest') ||
    hasIdentifierWrite(builder, 'options') ||
    hasConstantControlFlow(builder) ||
    !exactKindArray(builder.body.statements, [
      ts.SyntaxKind.IfStatement,
      ts.SyntaxKind.ExpressionStatement,
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.ReturnStatement,
    ])
  )
    return false;
  const path = findConstDeclaration(builder.body.statements, 'path');
  const guard = builder.body.statements[0];
  const assertion = builder.body.statements[1];
  const guardThrow =
    ts.isIfStatement(guard) &&
    ts.isBlock(guard.thenStatement) &&
    guard.thenStatement.statements.length === 1
      ? guard.thenStatement.statements[0]
      : undefined;
  const assertionCall = ts.isExpressionStatement(assertion)
    ? asCall(assertion.expression, 'assertRevenueCatV2PreflightEvidence')
    : undefined;
  const pathCall = path?.initializer && asCall(path.initializer, 'revenueCatV2CustomerPath');
  if (
    !ts.isIfStatement(guard) ||
    canonicalNodeText(guard.expression, sourceFile) !==
      "!isRecord(options)||!hasExactKeys(options,['evidence','secretApiKey'])||!boundedExactString(options.secretApiKey,1_000)" ||
    guard.elseStatement !== undefined ||
    guardThrow === undefined ||
    !exactErrorThrow(guardThrow, 'DurableProviderDeletionError', 'PROVIDER_REQUEST_INVALID') ||
    assertionCall === undefined ||
    !callHasExactPaths(assertionCall, ['options.evidence']) ||
    pathCall === undefined ||
    !callHasExactPaths(pathCall, ['options.evidence.projectId', 'options.evidence.customerId']) ||
    !hasExactDeclaration(builder, 'path', ts.SyntaxKind.VariableDeclaration) ||
    hasIdentifierWrite(builder, 'path')
  ) {
    return false;
  }
  const returned = directReturnExpression(builder);
  if (returned === undefined || !ts.isObjectLiteralExpression(returned)) return false;
  const init = propertyInitializer(returned, 'init');
  const headers = ts.isObjectLiteralExpression(init)
    ? propertyInitializer(init, 'headers')
    : undefined;
  const headersCall = headers === undefined ? undefined : asCall(headers, 'revenueCatV2Headers');
  return (
    isRevenueCatDeleteUrl(propertyInitializer(returned, 'url')) &&
    ts.isObjectLiteralExpression(init) &&
    isString(propertyInitializer(init, 'method'), 'DELETE') &&
    isString(propertyInitializer(init, 'redirect'), 'error') &&
    headersCall !== undefined &&
    callHasExactPaths(headersCall, ['options.secretApiKey'])
  );
}

export function auditRevenueCatDeletionSourceContract(sources) {
  requireSources(sources);
  const errors = [];
  for (const key of SOURCE_KEYS) {
    if (canonicalSourceSha256(sources[key]) !== REVIEWED_SOURCE_SHA256[key]) {
      errors.push(SOURCE_HASH_ERRORS[key]);
    }
  }
  const parsed = parseSources(sources, errors);

  if (errors.length === 0 && !auditEntrypoint(parsed.entrypoint)) {
    errors.push('Account deletion entrypoint does not construct the durable deletion runtime.');
  }
  if (errors.length === 0 && !auditRuntime(parsed.runtime)) {
    errors.push(
      'Durable deletion runtime does not bind the RevenueCat V2 executor to its work lane.',
    );
  }
  if (errors.length === 0 && !auditExecutor(parsed.executor)) {
    errors.push('RevenueCat V2 executor does not dispatch the attested durable delete request.');
  }
  if (
    errors.length === 0 &&
    (!auditRevenueCatHeaders(parsed.providerDeletion) ||
      !auditRevenueCatCustomerPath(parsed.providerDeletion) ||
      !auditDeleteBuilder(parsed.providerDeletion))
  ) {
    errors.push(
      'RevenueCat V2 request builder does not target the authenticated customer DELETE endpoint.',
    );
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}
