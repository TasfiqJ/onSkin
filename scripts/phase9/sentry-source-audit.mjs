import ts from 'typescript';
import { dirname, resolve } from 'node:path';

import { abs, listFiles, read } from './lib.mjs';

const SENTRY_MODULE = '@sentry/react-native';
const WRAPPER_PATH = abs('apps/mobile/src/lib/observability/sentry.ts');
const ALLOWED_METHODS = new Set(['captureException', 'init', 'setTag', 'setUser']);
const EXPECTED_METHOD_COUNTS = new Map([
  ['captureException', 1],
  ['init', 1],
  ['setTag', 1],
  ['setUser', 3],
]);

function normalized(path) {
  return path.replaceAll('\\', '/').toLowerCase();
}

function isRuntimeSource(file) {
  const path = file.replaceAll('\\', '/');
  return (
    /\.(?:[cm]?[jt]sx?)$/.test(path) &&
    !/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(path) &&
    !path.includes('/__tests__/')
  );
}

function isSentryModule(specifier) {
  return specifier === SENTRY_MODULE || specifier.startsWith(`${SENTRY_MODULE}/`);
}

function resolvesSentryModule(specifier, importer) {
  if (isSentryModule(specifier)) return true;
  if (!specifier.startsWith('.')) return false;
  const resolved = normalized(resolve(dirname(importer), specifier));
  return /(?:^|\/)node_modules\/@sentry\/react-native(?:\/|$)/.test(resolved);
}

function isTypeOnlyImport(statement) {
  const clause = statement.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return (
    !clause.name &&
    clause.namedBindings &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.length > 0 &&
    clause.namedBindings.elements.every((item) => item.isTypeOnly)
  );
}

function location(sourceFile, node) {
  const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${sourceFile.fileName.replaceAll('\\', '/')}:${point.line + 1}:${point.character + 1}`;
}

function isTypePosition(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (ts.isTypeNode(current)) return true;
    current = current.parent;
  }
  return false;
}

function propertyName(name) {
  return ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : null;
}

function validateInitArgument(argument, sourceFile, errors, at) {
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    errors.push(`${at} Sentry.init must receive the fixed inline configuration object.`);
    return;
  }

  const expected = new Map([
    ['dsn', 'env.sentryDsn'],
    ['environment', 'env.appEnvironment'],
    ['sendDefaultPii', 'false'],
    ['tracesSampleRate', '0'],
    ['enableNative', "Platform.OS!=='web'"],
    ['enableCaptureFailedRequests', 'false'],
    ['attachScreenshot', 'false'],
    ['attachViewHierarchy', 'false'],
    ['maxBreadcrumbs', '0'],
    ['beforeSend', 'sanitizeSentryEvent'],
  ]);
  const seen = new Set();
  let beforeBreadcrumbSeen = false;
  for (const item of argument.properties) {
    if (!ts.isPropertyAssignment(item)) {
      errors.push(`${at} Sentry.init must not contain spreads, methods, accessors, or shorthand.`);
      continue;
    }
    const key = propertyName(item.name);
    if (!key || seen.has(key)) {
      errors.push(`${at} Sentry.init contains a computed or duplicate option.`);
      continue;
    }
    seen.add(key);
    if (key === 'beforeBreadcrumb') {
      beforeBreadcrumbSeen =
        ts.isArrowFunction(item.initializer) &&
        item.initializer.parameters.length === 0 &&
        item.initializer.body.kind === ts.SyntaxKind.NullKeyword;
      if (!beforeBreadcrumbSeen) {
        errors.push(`${at} Sentry.init.beforeBreadcrumb must be the fixed null callback.`);
      }
      continue;
    }
    const exact = expected.get(key);
    if (!exact) {
      errors.push(`${at} Sentry.init contains an unapproved option: ${key}.`);
      continue;
    }
    if (item.initializer.getText(sourceFile).replace(/\s/g, '') !== exact) {
      errors.push(`${at} Sentry.init.${key} does not match the fixed safe value.`);
    }
  }
  const required = new Set([...expected.keys(), 'beforeBreadcrumb']);
  for (const key of required) {
    if (!seen.has(key)) errors.push(`${at} Sentry.init is missing the fixed ${key} option.`);
  }
  if (seen.size !== required.size || !beforeBreadcrumbSeen) {
    errors.push(`${at} Sentry.init must use exactly the fixed privacy configuration.`);
  }
}

function isExported(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}

function validateCaptureDataFlow(sourceFile, errors) {
  const candidates = sourceFile.statements.filter(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === 'captureException' &&
      isExported(statement),
  );
  if (candidates.length !== 1 || !candidates[0].body) {
    errors.push('The Sentry wrapper must export exactly one captureException function body.');
    return;
  }
  const captureFunction = candidates[0];
  const bindings = new Map();
  for (const statement of captureFunction.body.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      const name = declaration.name.text;
      if (name !== 'safeContext' && name !== 'safeError') continue;
      if (bindings.has(name)) {
        errors.push(`captureException must declare ${name} exactly once.`);
        continue;
      }
      bindings.set(name, { declaration, isConst });
    }
  }
  const expected = new Map([
    ['safeContext', ['sanitizeObservabilityContext', 'context']],
    ['safeError', ['sanitizeCapturedException', 'error']],
  ]);
  for (const [name, [sanitizer, input]] of expected) {
    const binding = bindings.get(name);
    const initializer = binding?.declaration.initializer;
    const valid =
      binding?.isConst &&
      initializer &&
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === sanitizer &&
      initializer.arguments.length === 1 &&
      ts.isIdentifier(initializer.arguments[0]) &&
      initializer.arguments[0].text === input;
    if (!valid) {
      errors.push(`captureException must initialize const ${name} with ${sanitizer}(${input}).`);
    }
  }

  function visit(node) {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left) &&
      (node.left.text === 'safeError' || node.left.text === 'safeContext')
    ) {
      errors.push(
        `${location(sourceFile, node)} sanitized capture bindings must not be reassigned.`,
      );
    }
    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      ts.isIdentifier(node.expression) &&
      (node.expression.text === 'safeError' || node.expression.text === 'safeContext')
    ) {
      const allowedObjectKeys =
        node.expression.text === 'safeContext' &&
        ts.isCallExpression(node.parent) &&
        ts.isPropertyAccessExpression(node.parent.expression) &&
        node.parent.expression.expression.getText(sourceFile) === 'Object' &&
        node.parent.expression.name.text === 'keys';
      if (!allowedObjectKeys) {
        errors.push(
          `${location(sourceFile, node)} sanitized capture bindings must not be mutated or inspected.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(captureFunction.body);
}

function validateCall(method, call, sourceFile, errors) {
  const args = call.arguments.map((argument) => argument.getText(sourceFile));
  const at = location(sourceFile, call);
  if (method === 'init') {
    if (args.length !== 1) {
      errors.push(`${at} Sentry.init must receive exactly one configuration object.`);
    }
    validateInitArgument(call.arguments[0], sourceFile, errors, at);
  }
  if (
    method === 'setTag' &&
    (args.length !== 2 || args[0] !== "'app_environment'" || args[1] !== 'env.appEnvironment')
  ) {
    errors.push(`${at} Sentry.setTag may produce only app_environment from env.appEnvironment.`);
  }
  if (method === 'captureException') {
    const hint = call.arguments[1];
    const exactSafeHint =
      hint &&
      ts.isConditionalExpression(hint) &&
      hint.condition.getText(sourceFile).replace(/\s/g, '') === 'Object.keys(safeContext).length' &&
      ts.isObjectLiteralExpression(hint.whenTrue) &&
      hint.whenTrue.properties.length === 1 &&
      ts.isPropertyAssignment(hint.whenTrue.properties[0]) &&
      hint.whenTrue.properties[0].name.getText(sourceFile) === 'extra' &&
      hint.whenTrue.properties[0].initializer.getText(sourceFile) === 'safeContext' &&
      ts.isIdentifier(hint.whenFalse) &&
      hint.whenFalse.text === 'undefined';
    if (args.length !== 2 || args[0] !== 'safeError' || !exactSafeHint) {
      errors.push(
        `${at} Sentry.captureException must receive only the sanitized throwable and fixed safe context hint.`,
      );
    }
  }
  if (method === 'setUser') {
    const argument = call.arguments[0];
    const validObject =
      argument &&
      ts.isObjectLiteralExpression(argument) &&
      argument.properties.length === 1 &&
      ts.isShorthandPropertyAssignment(argument.properties[0]) &&
      argument.properties[0].name.text === 'id';
    if (args.length !== 1 || (args[0] !== 'null' && !validObject)) {
      errors.push(`${at} Sentry.setUser may receive only null or the pseudonymous id object.`);
    }
  }
}

export function auditSentrySource() {
  const errors = [];
  const acquisitionFiles = new Set();
  const methods = new Set();
  const methodCounts = new Map();
  let wrapperSourceFile = null;
  let wrapperBinding = null;

  for (const absoluteFile of listFiles('apps/mobile/src').filter(isRuntimeSource)) {
    const source = read(absoluteFile);
    const sourceFile = ts.createSourceFile(
      absoluteFile,
      source,
      ts.ScriptTarget.Latest,
      true,
      absoluteFile.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const isWrapper = normalized(absoluteFile) === normalized(WRAPPER_PATH);
    if (isWrapper) wrapperSourceFile = sourceFile;
    for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
      errors.push(`${absoluteFile} has a parse error: ${diagnostic.messageText}.`);
    }

    for (const statement of sourceFile.statements) {
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteralLike(statement.moduleSpecifier) &&
        resolvesSentryModule(statement.moduleSpecifier.text, absoluteFile)
      ) {
        const typeOnly =
          statement.isTypeOnly ||
          (statement.exportClause &&
            ts.isNamedExports(statement.exportClause) &&
            statement.exportClause.elements.length > 0 &&
            statement.exportClause.elements.every((item) => item.isTypeOnly));
        if (!typeOnly) {
          acquisitionFiles.add(normalized(absoluteFile));
          errors.push(`${absoluteFile} must not re-export the Sentry SDK at runtime.`);
        }
      }
      if (ts.isImportEqualsDeclaration(statement)) {
        const reference = statement.moduleReference;
        const specifier =
          ts.isExternalModuleReference(reference) &&
          reference.expression &&
          ts.isStringLiteralLike(reference.expression)
            ? reference.expression.text
            : null;
        if (specifier && resolvesSentryModule(specifier, absoluteFile) && !statement.isTypeOnly) {
          acquisitionFiles.add(normalized(absoluteFile));
          errors.push(`${absoluteFile} must not acquire the Sentry SDK with import-equals.`);
        }
      }
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      if (!resolvesSentryModule(specifier, absoluteFile) || isTypeOnlyImport(statement)) continue;
      acquisitionFiles.add(normalized(absoluteFile));
      if (!isWrapper || specifier !== SENTRY_MODULE) {
        errors.push(`${absoluteFile} must not acquire the Sentry SDK outside the fixed wrapper.`);
        continue;
      }
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamespaceImport(bindings) || statement.importClause?.name) {
        errors.push('The Sentry wrapper must use one namespace import for the SDK.');
      } else if (wrapperBinding) {
        errors.push('The Sentry wrapper must have exactly one runtime SDK import.');
      } else wrapperBinding = bindings.name.text;
    }

    function visitAcquisition(node) {
      if (ts.isCallExpression(node)) {
        const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
        if (isDynamicImport || isRequire) {
          const argument = node.arguments[0];
          if (!argument || !ts.isStringLiteralLike(argument)) {
            errors.push(
              `${location(sourceFile, node)} runtime SDK imports must use literal modules.`,
            );
          } else if (resolvesSentryModule(argument.text, absoluteFile)) {
            acquisitionFiles.add(normalized(absoluteFile));
            errors.push(`${location(sourceFile, node)} Sentry cannot be loaded dynamically.`);
          }
        }
      }
      ts.forEachChild(node, visitAcquisition);
    }
    visitAcquisition(sourceFile);
  }

  if (!wrapperSourceFile || !wrapperBinding) {
    errors.push('The fixed Sentry wrapper and namespace import are required.');
  } else {
    validateCaptureDataFlow(wrapperSourceFile, errors);
    function visitWrapper(node) {
      if (
        ts.isIdentifier(node) &&
        node.text === wrapperBinding &&
        ts.isNamespaceImport(node.parent)
      ) {
        return;
      }
      if (
        ts.isIdentifier(node) &&
        node.text === wrapperBinding &&
        !(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) &&
        !(
          ts.isQualifiedName(node.parent) &&
          node.parent.left === node &&
          isTypePosition(node.parent)
        )
      ) {
        errors.push(`${location(wrapperSourceFile, node)} Sentry SDK namespace binding escaped.`);
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === wrapperBinding
      ) {
        errors.push(
          `${location(wrapperSourceFile, node)} computed Sentry method access is forbidden.`,
        );
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === wrapperBinding
      ) {
        const method = node.name.text;
        if (isTypePosition(node)) {
          if (method !== 'init') {
            errors.push(
              `${location(wrapperSourceFile, node)} unapproved Sentry type access: ${method}.`,
            );
          }
        } else {
          const call = node.parent;
          if (!ts.isCallExpression(call) || call.expression !== node) {
            errors.push(`${location(wrapperSourceFile, node)} Sentry methods cannot be aliased.`);
          } else if (!ALLOWED_METHODS.has(method)) {
            errors.push(
              `${location(wrapperSourceFile, node)} unapproved Sentry method: ${method}.`,
            );
          } else {
            methods.add(method);
            methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);
            validateCall(method, call, wrapperSourceFile, errors);
          }
        }
      }
      ts.forEachChild(node, visitWrapper);
    }
    visitWrapper(wrapperSourceFile);
  }

  for (const [method, count] of EXPECTED_METHOD_COUNTS) {
    if ((methodCounts.get(method) ?? 0) !== count) {
      errors.push(`Sentry wrapper must call ${method} exactly ${count} time(s).`);
    }
  }
  if (acquisitionFiles.size !== 1 || !acquisitionFiles.has(normalized(WRAPPER_PATH))) {
    errors.push('Only the fixed Sentry wrapper may acquire the Sentry SDK directly.');
  }

  return {
    acquisitionFiles: [...acquisitionFiles].sort(),
    errors: [...new Set(errors)].sort(),
    methods,
  };
}
