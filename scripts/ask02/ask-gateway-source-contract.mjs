import ts from "typescript";

const PROVIDER_NAME = /(?:openai|anthropic|gemini|mistral|cohere|groq)/iu;
const PROVIDER_CREDENTIAL =
  /(?:(?:openai|anthropic|gemini|mistral|cohere|groq|ask[_-]?provider).*(?:key|token|secret)|(?:key|token|secret).*(?:openai|anthropic|gemini|mistral|cohere|groq|ask[_-]?provider))/iu;

function parse(path, text) {
  return ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function callName(call) {
  if (!ts.isCallExpression(call)) return "";
  if (ts.isIdentifier(call.expression)) return call.expression.text;
  if (ts.isPropertyAccessExpression(call.expression)) {
    return call.expression.name.text;
  }
  return "";
}

function hasCall(node, name) {
  let found = false;
  walk(node, (candidate) => {
    if (ts.isCallExpression(candidate) && callName(candidate) === name) {
      found = true;
    }
  });
  return found;
}

function findCalls(node, name) {
  const calls = [];
  walk(node, (candidate) => {
    if (ts.isCallExpression(candidate) && callName(candidate) === name) {
      calls.push(candidate);
    }
  });
  return calls;
}

function property(object, name) {
  if (!ts.isObjectLiteralExpression(object)) return undefined;
  return object.properties.find((entry) =>
    ts.isPropertyAssignment(entry) &&
    ((ts.isIdentifier(entry.name) && entry.name.text === name) ||
      (ts.isStringLiteral(entry.name) && entry.name.text === name))
  );
}

function initializer(object, name) {
  const entry = property(object, name);
  return entry && ts.isPropertyAssignment(entry)
    ? entry.initializer
    : undefined;
}

function functionDeclaration(source, name) {
  return source.statements.find((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === name
  );
}

function isDirectAwaitedCallStatement(statement, name) {
  if (!ts.isVariableStatement(statement)) return false;
  return statement.declarationList.declarations.some((declaration) => {
    const expression = declaration.initializer;
    return expression && ts.isAwaitExpression(expression) &&
      ts.isCallExpression(expression.expression) &&
      callName(expression.expression) === name;
  });
}

function directAwaitedBinding(statement, binding, name) {
  if (!ts.isVariableStatement(statement)) return false;
  return statement.declarationList.declarations.some((declaration) => {
    const expression = declaration.initializer;
    return ts.isIdentifier(declaration.name) &&
      declaration.name.text === binding &&
      expression && ts.isAwaitExpression(expression) &&
      ts.isCallExpression(expression.expression) &&
      callName(expression.expression) === name;
  });
}

function isNegatedOk(node, binding) {
  return ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isPropertyAccessExpression(node.operand) &&
    ts.isIdentifier(node.operand.expression) &&
    node.operand.expression.text === binding && node.operand.name.text === "ok";
}

function isNegatedIdentifier(node, binding) {
  return ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(node.operand) && node.operand.text === binding;
}

function terminalReturn(node) {
  if (ts.isReturnStatement(node)) return node;
  if (!ts.isBlock(node) || node.statements.length === 0) return undefined;
  const last = node.statements[node.statements.length - 1];
  return ts.isReturnStatement(last) ? last : undefined;
}

function exactObjectKeys(node, expected) {
  if (
    !ts.isObjectLiteralExpression(node) ||
    node.properties.some((entry) =>
      !ts.isPropertyAssignment(entry) &&
      !ts.isShorthandPropertyAssignment(entry)
    )
  ) return false;
  const names = node.properties.map((entry) => {
    const name = entry.name;
    return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : "";
  }).sort();
  return names.join(",") === [...expected].sort().join(",");
}

function auditEndpoint(indexText, errors) {
  const source = parse("index.ts", indexText);
  const serve = findCalls(source, "serve").find((call) =>
    ts.isPropertyAccessExpression(call.expression) &&
    ts.isIdentifier(call.expression.expression) &&
    call.expression.expression.text === "Deno"
  );
  const callback = serve?.arguments[0];
  if (
    !callback ||
    (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback)) ||
    !ts.isBlock(callback.body)
  ) {
    errors.push(
      "ask-layerwell endpoint must use an executable Deno.serve callback.",
    );
    return;
  }
  const body = callback.body;
  const runCalls = findCalls(body, "runAskGateway");
  if (runCalls.length !== 1) {
    errors.push(
      "Deno.serve must contain exactly one executable runAskGateway call.",
    );
    return;
  }
  const run = runCalls[0];
  const argument = run.arguments[0];
  if (
    !argument || !exactObjectKeys(argument, [
      "ownerId",
      "request",
      "config",
      "quota",
      "provider",
      "circuit",
    ])
  ) {
    errors.push(
      "runAskGateway executable input must have the exact production keys.",
    );
  }
  const config = argument && initializer(argument, "config");
  const enabled = config && initializer(config, "enabled");
  const quota = argument && initializer(argument, "quota");
  const provider = argument && initializer(argument, "provider");
  if (enabled?.kind !== ts.SyntaxKind.FalseKeyword) {
    errors.push(
      "runAskGateway executable config.enabled must be the false literal.",
    );
  }
  if (
    !quota || !ts.isNewExpression(quota) ||
    !ts.isIdentifier(quota.expression) ||
    quota.expression.text !== "DisabledQuotaLedger"
  ) {
    errors.push(
      "runAskGateway must construct DisabledQuotaLedger at the executable callsite.",
    );
  }
  if (
    !provider || !ts.isNewExpression(provider) ||
    !ts.isIdentifier(provider.expression) ||
    provider.expression.text !== "DisabledProvider"
  ) {
    errors.push(
      "runAskGateway must construct DisabledProvider at the executable callsite.",
    );
  }

  const statements = body.statements;
  const runIndex = statements.findIndex((statement) =>
    statement.pos <= run.pos && run.end <= statement.end
  );
  const runStatement = statements[runIndex];
  const directRun = runStatement && ts.isVariableStatement(runStatement) &&
    runStatement.declarationList.declarations.length === 1 &&
    (() => {
      const declaration = runStatement.declarationList.declarations[0];
      return ts.isIdentifier(declaration.name) &&
        declaration.name.text === "gatewayResult" && declaration.initializer &&
        ts.isAwaitExpression(declaration.initializer) &&
        declaration.initializer.expression === run;
    })();
  if (!directRun) {
    errors.push(
      "runAskGateway must be the direct awaited gatewayResult declaration.",
    );
  }
  const getUserIndex = statements.slice(0, runIndex).findIndex((statement) =>
    isDirectAwaitedCallStatement(statement, "getUser")
  );
  const userIdDeclaration = statements[getUserIndex + 1];
  const userIdGuard = statements[getUserIndex + 2];
  const declaresUserId = userIdDeclaration &&
    ts.isVariableStatement(userIdDeclaration) &&
    userIdDeclaration.declarationList.declarations.some((entry) =>
      ts.isIdentifier(entry.name) && entry.name.text === "userId"
    );
  if (
    getUserIndex === -1 || !declaresUserId || !userIdGuard ||
    !ts.isIfStatement(userIdGuard) ||
    !isNegatedIdentifier(userIdGuard.expression, "userId") ||
    !terminalReturn(userIdGuard.thenStatement)
  ) {
    errors.push(
      "getUser must be followed by userId extraction and exact if (!userId) return guard.",
    );
  }

  for (
    const [binding, name] of [
      ["initialAccountAccess", "preflightAccountAccess"],
      ["healthAdmission", "preflightActiveHealthProcessing"],
      ["askConsent", "preflightAskConsent"],
      ["providerHealthError", "preflightActiveHealthProcessing"],
    ]
  ) {
    const declarationIndex = statements.slice(0, runIndex).findIndex((
      statement,
    ) => directAwaitedBinding(statement, binding, name));
    const guard = statements[declarationIndex + 1];
    if (
      declarationIndex === -1 || !guard || !ts.isIfStatement(guard) ||
      !isNegatedOk(guard.expression, binding) ||
      !terminalReturn(guard.thenStatement)
    ) {
      errors.push(
        `${binding} must be immediately dominated by exact if (!${binding}.ok) return guard.`,
      );
    }
  }

  const providerAccountIndex = statements.slice(0, runIndex).findIndex((
    statement,
  ) =>
    directAwaitedBinding(
      statement,
      "providerAccountError",
      "requireSameAccountAccess",
    )
  );
  const providerAccountGuard = statements[providerAccountIndex + 1];
  if (
    providerAccountIndex === -1 || !providerAccountGuard ||
    !ts.isIfStatement(providerAccountGuard) ||
    !ts.isIdentifier(providerAccountGuard.expression) ||
    providerAccountGuard.expression.text !== "providerAccountError" ||
    !terminalReturn(providerAccountGuard.thenStatement)
  ) {
    errors.push(
      "providerAccountError must be immediately dominated by if (providerAccountError) return guard.",
    );
  }

  const declaration = statements[runIndex - 2];
  const rejection = statements[runIndex - 1];
  let adjacentConsent = false;
  if (
    declaration && ts.isVariableStatement(declaration) && rejection &&
    ts.isIfStatement(rejection)
  ) {
    const declarations = declaration.declarationList.declarations;
    const execution = declarations.length === 1 ? declarations[0] : undefined;
    adjacentConsent = Boolean(
      execution && ts.isIdentifier(execution.name) &&
        execution.name.text === "executionConsent" &&
        execution.initializer &&
        hasCall(execution.initializer, "preflightAskConsent") &&
        isNegatedOk(rejection.expression, "executionConsent") &&
        rejection.thenStatement && terminalReturn(rejection.thenStatement) &&
        hasCall(terminalReturn(rejection.thenStatement), "askConsentError"),
    );
  }
  if (!adjacentConsent) {
    errors.push(
      "purpose consent declaration and fail-closed rejection must be the two executable statements immediately before runAskGateway.",
    );
  }
}

function auditConsent(consentText, errors) {
  const source = parse("consentAdmission.ts", consentText);
  const preflight = functionDeclaration(source, "preflightAskConsent");
  if (!preflight?.body) {
    errors.push("preflightAskConsent function is missing.");
    return;
  }
  let authorityFailure = false;
  walk(preflight.body, (node) => {
    if (
      ts.isStringLiteral(node) &&
      node.text === "ASK_CONSENT_AUTHORITY_UNAVAILABLE"
    ) {
      authorityFailure = true;
    }
    if (
      ts.isReturnStatement(node) && node.expression &&
      ts.isObjectLiteralExpression(node.expression)
    ) {
      const ok = initializer(node.expression, "ok");
      if (ok?.kind === ts.SyntaxKind.TrueKeyword) {
        errors.push(
          "preflightAskConsent cannot return executable ok:true without registry authority.",
        );
      }
    }
  });
  if (!authorityFailure) {
    errors.push(
      "preflightAskConsent must explicitly fail for unavailable registry authority.",
    );
  }
}

function auditImportsAndCredentials(files, errors) {
  for (const [path, text] of Object.entries(files)) {
    const source = parse(path, text);
    walk(source, (node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        PROVIDER_NAME.test(node.moduleSpecifier.text)
      ) {
        errors.push(
          `${path} imports provider SDK ${node.moduleSpecifier.text}.`,
        );
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          callName(node) === "require") &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0]) &&
        PROVIDER_NAME.test(node.arguments[0].text)
      ) {
        errors.push(
          `${path} dynamically loads provider SDK ${node.arguments[0].text}.`,
        );
      }
      if (ts.isStringLiteral(node) && PROVIDER_CREDENTIAL.test(node.text)) {
        errors.push(
          `${path} contains provider credential identifier ${node.text}.`,
        );
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        PROVIDER_CREDENTIAL.test(node.getText(source))
      ) {
        errors.push(`${path} contains provider credential property access.`);
      }
      if (
        ts.isCallExpression(node) && callName(node) === "get" &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === "Deno" &&
        node.expression.expression.name.text === "env"
      ) {
        const key = node.arguments[0];
        if (!key || !ts.isStringLiteral(key) || key.text !== "SUPABASE_URL") {
          errors.push(
            `${path} contains an unapproved direct environment read.`,
          );
        }
      }
    });
  }
}

export function auditAskGatewaySources(snapshot) {
  const errors = [];
  auditEndpoint(
    snapshot.files["supabase/functions/ask-layerwell/index.ts"],
    errors,
  );
  auditConsent(
    snapshot.files["supabase/functions/ask-layerwell/consentAdmission.ts"],
    errors,
  );
  auditImportsAndCredentials(snapshot.files, errors);

  const definition = snapshot.manifest.functions?.["ask-layerwell"];
  if (
    !definition ||
    definition.entrypoint !== "supabase/functions/ask-layerwell/index.ts" ||
    definition.verifyJwt !== true || definition.access !== "authenticated" ||
    !Array.isArray(definition.requiredSecrets) ||
    definition.requiredSecrets.length !== 0
  ) {
    errors.push(
      "ask-layerwell manifest authority must be authenticated with no provider secrets.",
    );
  }
  if (
    PROVIDER_NAME.test(JSON.stringify(definition ?? {})) ||
    PROVIDER_NAME.test(snapshot.config) ||
    PROVIDER_CREDENTIAL.test(snapshot.config)
  ) {
    errors.push("ask-layerwell manifest/config contains provider material.");
  }
  const dependencies = {
    ...snapshot.packageJson.dependencies,
    ...snapshot.packageJson.devDependencies,
    ...snapshot.packageJson.optionalDependencies,
  };
  for (const dependency of Object.keys(dependencies)) {
    if (PROVIDER_NAME.test(dependency)) {
      errors.push(`package.json adds provider SDK ${dependency}.`);
    }
  }
  if (PROVIDER_CREDENTIAL.test(JSON.stringify(snapshot.packageJson))) {
    errors.push("package.json contains provider credential material.");
  }
  const askCommand = "npm run ask02:gateway-source-contract:test";
  if (
    !String(snapshot.packageJson.scripts?.["launch:contract:verify"] ?? "")
      .includes(askCommand)
  ) {
    errors.push(
      "launch:contract:verify must execute the ASK-02 source contract.",
    );
  }
  if (
    !String(snapshot.packageJson.scripts?.["launch:verify"] ?? "").includes(
      "npm run launch:contract:verify",
    )
  ) {
    errors.push("launch:verify must inherit launch:contract:verify.");
  }
  return errors;
}
