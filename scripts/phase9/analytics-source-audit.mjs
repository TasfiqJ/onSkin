import ts from 'typescript';
import { dirname, extname, resolve } from 'node:path';

import { abs, listFiles, read } from './lib.mjs';

const REGISTRY_PATH = 'apps/mobile/src/lib/analytics/eventRegistry.ts';
const TRACKER_MODULE = '@/lib/analytics/track';
const TRACKER_FILE = abs('apps/mobile/src/lib/analytics/track.ts');
const TRACKER_PATH = TRACKER_FILE.replaceAll('\\', '/').replace(/\.ts$/, '').toLowerCase();
const POSTHOG_MODULE = 'posthog-react-native';
const PUBLIC_TRACKER_EXPORTS = new Set([
  'flushAnalytics',
  'freezeAnalyticsIdentityForAccountDeletion',
  'identify',
  'prepareAnalyticsEvent',
  'pseudonymousUserId',
  'resetAnalyticsIdentity',
  'sanitizeAnalyticsEventName',
  'sanitizeAnalyticsProps',
  'track',
]);
const REGISTRY_EXPORTS = [
  'ANALYTICS_ALLOWED_EVENTS',
  'ANALYTICS_ALLOWED_PROP_KEYS',
  'ANALYTICS_EVENT_SCHEMAS',
  'ANALYTICS_SPECIAL_PAYLOAD_SHAPES',
];

function normalized(path) {
  return resolve(path).replaceAll('\\', '/').toLowerCase();
}

function resolvesTrackerModule(specifier, importer) {
  if (specifier === TRACKER_MODULE) return true;
  if (!specifier.startsWith('.')) return false;
  const candidate = resolve(dirname(importer), specifier)
    .replaceAll('\\', '/')
    .replace(/\.(?:[cm]?[jt]sx?)$/, '')
    .toLowerCase();
  return candidate === TRACKER_PATH;
}

function isPostHogModule(specifier) {
  return specifier === POSTHOG_MODULE || specifier.startsWith(`${POSTHOG_MODULE}/`);
}

function isRuntimeSource(file) {
  const path = file.replaceAll('\\', '/');
  return (
    /\.(?:[cm]?[jt]sx?)$/.test(path) &&
    !/\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/.test(path) &&
    !path.includes('/__tests__/')
  );
}

function scriptKind(file) {
  const extension = extname(file).toLowerCase();
  if (['.tsx'].includes(extension)) return ts.ScriptKind.TSX;
  if (['.jsx'].includes(extension)) return ts.ScriptKind.JSX;
  if (['.js', '.mjs', '.cjs'].includes(extension)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function diagnosticLocation(sourceFile, node) {
  const point = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return `${sourceFile.fileName.replaceAll('\\', '/')}:${point.line + 1}:${point.character + 1}`;
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
}

function isExported(node) {
  return Boolean(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export);
}

function isConstAssertion(node) {
  return node.type.getText() === 'const';
}

function unwrapStaticExpression(node, errors, context) {
  let current = node;
  while (true) {
    if (ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isAsExpression(current)) {
      if (!isConstAssertion(current)) errors.push(`${context} contains an unsafe type assertion.`);
      current = current.expression;
      continue;
    }
    if (ts.isTypeAssertionExpression(current)) {
      errors.push(`${context} contains an unsafe type assertion.`);
      current = current.expression;
      continue;
    }
    return current;
  }
}

function unwrapPayloadExpression(node, errors, location) {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  if (ts.isAsExpression(current) && isConstAssertion(current)) current = current.expression;
  let unsafe = false;
  function visit(child) {
    if (ts.isAsExpression(child) || ts.isTypeAssertionExpression(child)) unsafe = true;
    ts.forEachChild(child, visit);
  }
  visit(current);
  if (unsafe) errors.push(`${location} analytics payload contains an unsafe type assertion.`);
  return current;
}

function collectTopLevelConsts(sourceFile, errors) {
  const constants = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isConst = Boolean(statement.declarationList.flags & ts.NodeFlags.Const);
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const name = declaration.name.text;
      if (constants.has(name)) {
        errors.push(`Analytics registry top-level const is duplicated: ${name}.`);
        continue;
      }
      constants.set(name, {
        exported: isExported(statement),
        initializer: declaration.initializer,
        isConst,
        node: declaration,
      });
    }
  }
  return constants;
}

function requiredRegistryConst(constants, name, errors) {
  const entry = constants.get(name);
  if (!entry || !entry.isConst || !entry.exported) {
    errors.push(`${name} must be one unique exported top-level const.`);
    return null;
  }
  return unwrapStaticExpression(entry.initializer, errors, name);
}

function resolveStaticExpression(node, constants, errors, context, seen = new Set()) {
  const unwrapped = unwrapStaticExpression(node, errors, context);
  if (!ts.isIdentifier(unwrapped)) return unwrapped;
  if (seen.has(unwrapped.text)) {
    errors.push(`${context} contains a circular const reference: ${unwrapped.text}.`);
    return unwrapped;
  }
  const entry = constants.get(unwrapped.text);
  if (!entry || !entry.isConst) {
    errors.push(`${context} references a non-top-level const: ${unwrapped.text}.`);
    return unwrapped;
  }
  return resolveStaticExpression(
    entry.initializer,
    constants,
    errors,
    context,
    new Set([...seen, unwrapped.text]),
  );
}

function literalValue(node) {
  if (ts.isStringLiteralLike(node)) return { known: true, value: node.text };
  if (ts.isNumericLiteral(node)) return { known: true, value: Number(node.text) };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { known: true, value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { known: true, value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { known: true, value: null };
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return { known: true, value: -Number(node.operand.text) };
  }
  return { known: false, value: undefined };
}

function parseLiteralArray(node, constants, errors, context) {
  const resolved = resolveStaticExpression(node, constants, errors, context);
  if (!ts.isArrayLiteralExpression(resolved)) {
    errors.push(`${context} must be a literal array.`);
    return [];
  }
  const values = [];
  for (const element of resolved.elements) {
    if (ts.isSpreadElement(element)) {
      values.push(...parseLiteralArray(element.expression, constants, errors, context));
      continue;
    }
    const literal = literalValue(element);
    if (!literal.known) errors.push(`${context} must contain only primitive literals.`);
    else values.push(literal.value);
  }
  return values;
}

function objectLiteral(node, constants, errors, context) {
  const resolved = resolveStaticExpression(node, constants, errors, context);
  if (!ts.isObjectLiteralExpression(resolved)) {
    errors.push(`${context} must be one static object.`);
    return null;
  }
  return resolved;
}

function objectProperties(node, errors, context) {
  const properties = new Map();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      errors.push(`${context} may contain only property assignments.`);
      continue;
    }
    const key = propertyName(property.name);
    if (!key || properties.has(key)) {
      errors.push(`${context} contains a computed or duplicate key.`);
      continue;
    }
    properties.set(key, property.initializer);
  }
  return properties;
}

function valueKey(value) {
  return `${typeof value}:${String(value)}`;
}

function parseRuleExpression(node, constants, errors, context) {
  const resolved = resolveStaticExpression(node, constants, errors, context);
  if (ts.isCallExpression(resolved) && ts.isIdentifier(resolved.expression)) {
    if (resolved.expression.text === 'enumValue') {
      const values = [];
      for (const argument of resolved.arguments) {
        if (ts.isSpreadElement(argument)) {
          values.push(...parseLiteralArray(argument.expression, constants, errors, context));
        } else {
          const literal = literalValue(argument);
          if (!literal.known) errors.push(`${context} enumValue arguments must be literals.`);
          else values.push(literal.value);
        }
      }
      const unique = new Set(values.map(valueKey));
      if (!values.length || unique.size !== values.length) {
        errors.push(`${context} enumValue must contain unique primitive literals.`);
      }
      return { kind: 'enum', values: new Set(values.map(valueKey)), rawValues: values };
    }
    if (resolved.expression.text === 'integer') {
      if (resolved.arguments.length > 2)
        errors.push(`${context} integer accepts at most two bounds.`);
      const bounds = resolved.arguments.map(literalValue);
      if (bounds.some((bound) => !bound.known || !Number.isSafeInteger(bound.value))) {
        errors.push(`${context} integer bounds must be safe integer literals.`);
        return null;
      }
      const min = bounds[0]?.value ?? 0;
      const max = bounds[1]?.value ?? 10_000;
      if (min < 0 || max < min) errors.push(`${context} integer bounds are invalid.`);
      return { kind: 'integer', min, max };
    }
    errors.push(`${context} uses an unapproved analytics rule helper.`);
    return null;
  }
  if (ts.isObjectLiteralExpression(resolved)) {
    const properties = objectProperties(resolved, errors, context);
    const kindNode = properties.get('kind');
    const kind = kindNode ? literalValue(kindNode) : { known: false };
    if (
      properties.size !== 1 ||
      !kind.known ||
      !['app_version', 'build_number', 'opaque_id'].includes(kind.value)
    ) {
      errors.push(`${context} uses a malformed fixed analytics rule.`);
      return null;
    }
    return { kind: kind.value };
  }
  errors.push(`${context} uses a non-canonical analytics rule.`);
  return null;
}

function parseStringSet(node, constants, errors, context) {
  const values = parseLiteralArray(node, constants, errors, context);
  const strings = values.filter((value) => typeof value === 'string');
  if (strings.length !== values.length || new Set(strings).size !== strings.length) {
    errors.push(`${context} must contain unique string literals.`);
  }
  return new Set(strings);
}

function parseRegistry(errors, registrySourceFile) {
  for (const diagnostic of registrySourceFile.parseDiagnostics ?? []) {
    errors.push(`Analytics registry parse error: ${diagnostic.messageText}.`);
  }
  const constants = collectTopLevelConsts(registrySourceFile, errors);
  const required = Object.fromEntries(
    REGISTRY_EXPORTS.map((name) => [name, requiredRegistryConst(constants, name, errors)]),
  );
  const events = required.ANALYTICS_ALLOWED_EVENTS
    ? parseStringSet(
        required.ANALYTICS_ALLOWED_EVENTS,
        constants,
        errors,
        'ANALYTICS_ALLOWED_EVENTS',
      )
    : new Set();
  const props = required.ANALYTICS_ALLOWED_PROP_KEYS
    ? parseStringSet(
        required.ANALYTICS_ALLOWED_PROP_KEYS,
        constants,
        errors,
        'ANALYTICS_ALLOWED_PROP_KEYS',
      )
    : new Set();
  const schemas = new Map();
  const schemaRoot = required.ANALYTICS_EVENT_SCHEMAS
    ? objectLiteral(required.ANALYTICS_EVENT_SCHEMAS, constants, errors, 'ANALYTICS_EVENT_SCHEMAS')
    : null;
  if (schemaRoot) {
    for (const [event, schemaNode] of objectProperties(
      schemaRoot,
      errors,
      'ANALYTICS_EVENT_SCHEMAS',
    )) {
      const schemaObject = objectLiteral(
        schemaNode,
        constants,
        errors,
        `Analytics schema ${event}`,
      );
      if (!schemaObject || schemas.has(event)) continue;
      const rules = new Map();
      for (const [key, ruleNode] of objectProperties(
        schemaObject,
        errors,
        `Analytics schema ${event}`,
      )) {
        const rule = parseRuleExpression(ruleNode, constants, errors, `${event}.${key}`);
        if (rule) rules.set(key, rule);
      }
      schemas.set(event, rules);
    }
  }

  for (const event of events) {
    if (!schemas.has(event)) errors.push(`Analytics event is missing its exact schema: ${event}.`);
  }
  for (const event of schemas.keys()) {
    if (!events.has(event))
      errors.push(`Analytics schema is not registered as an event: ${event}.`);
  }
  const usedProps = new Set();
  for (const [event, rules] of schemas) {
    for (const key of rules.keys()) {
      usedProps.add(key);
      if (!props.has(key)) errors.push(`Analytics schema ${event} uses unknown prop: ${key}.`);
    }
  }
  for (const key of props) {
    if (!usedProps.has(key))
      errors.push(`Globally allowed analytics prop has no event schema: ${key}.`);
  }

  const shapes = new Map();
  const shapeRoot = required.ANALYTICS_SPECIAL_PAYLOAD_SHAPES
    ? objectLiteral(
        required.ANALYTICS_SPECIAL_PAYLOAD_SHAPES,
        constants,
        errors,
        'ANALYTICS_SPECIAL_PAYLOAD_SHAPES',
      )
    : null;
  if (shapeRoot) {
    for (const [event, branchesNode] of objectProperties(
      shapeRoot,
      errors,
      'ANALYTICS_SPECIAL_PAYLOAD_SHAPES',
    )) {
      if (!events.has(event))
        errors.push(`Payload shapes reference an unregistered event: ${event}.`);
      const schema = schemas.get(event) ?? new Map();
      const resolvedBranches = resolveStaticExpression(
        branchesNode,
        constants,
        errors,
        `Payload shapes for ${event}`,
      );
      if (!ts.isArrayLiteralExpression(resolvedBranches)) {
        errors.push(`Payload shapes for ${event} must be a literal array.`);
        continue;
      }
      if (schema.size === 0) {
        errors.push(`No-property event must not define special payload shapes: ${event}.`);
      }
      if (resolvedBranches.elements.length === 0) {
        errors.push(`Payload shapes for ${event} must contain at least one branch.`);
      }
      const branches = [];
      const covered = new Set();
      for (const branchNode of resolvedBranches.elements) {
        const branchObject = objectLiteral(
          branchNode,
          constants,
          errors,
          `Payload shape for ${event}`,
        );
        if (!branchObject) continue;
        const fields = objectProperties(branchObject, errors, `Payload shape for ${event}`);
        for (const key of fields.keys()) {
          if (!['integers', 'optional', 'required', 'values'].includes(key)) {
            errors.push(`Payload shape for ${event} has an unknown field: ${key}.`);
          }
        }
        const requiredKeys = fields.get('required')
          ? parseStringSet(
              fields.get('required'),
              constants,
              errors,
              `${event} required shape keys`,
            )
          : new Set();
        const optionalKeys = fields.get('optional')
          ? parseStringSet(
              fields.get('optional'),
              constants,
              errors,
              `${event} optional shape keys`,
            )
          : new Set();
        if (!requiredKeys.size) errors.push(`Payload shape for ${event} needs a required key.`);
        const fixedValues = new Map();
        if (fields.has('values')) {
          const valuesObject = objectLiteral(
            fields.get('values'),
            constants,
            errors,
            `Payload shape values for ${event}`,
          );
          if (valuesObject) {
            for (const [key, valuesNode] of objectProperties(
              valuesObject,
              errors,
              `Payload shape values for ${event}`,
            )) {
              const values = parseLiteralArray(
                valuesNode,
                constants,
                errors,
                `${event}.${key} shape values`,
              );
              if (values.length === 0) {
                errors.push(`${event}.${key} shape values must not be empty.`);
              }
              fixedValues.set(key, new Set(values.map(valueKey)));
              const rule = schema.get(key);
              if (!rule || !requiredKeys.has(key)) {
                errors.push(`${event} shape values must target a required schema key: ${key}.`);
              } else if (
                rule.kind !== 'enum' ||
                values.some((value) => !rule.values.has(valueKey(value)))
              ) {
                errors.push(`${event}.${key} shape values exceed the event enum.`);
              }
            }
          }
        }
        const integerRanges = new Map();
        if (fields.has('integers')) {
          const integersObject = objectLiteral(
            fields.get('integers'),
            constants,
            errors,
            `Payload shape integer ranges for ${event}`,
          );
          if (integersObject) {
            for (const [key, rangeNode] of objectProperties(
              integersObject,
              errors,
              `Payload shape integer ranges for ${event}`,
            )) {
              const rangeObject = objectLiteral(
                rangeNode,
                constants,
                errors,
                `${event}.${key} shape integer range`,
              );
              if (!rangeObject) continue;
              const rangeFields = objectProperties(
                rangeObject,
                errors,
                `${event}.${key} shape integer range`,
              );
              const minLiteral = rangeFields.has('min')
                ? literalValue(rangeFields.get('min'))
                : { known: false };
              const maxLiteral = rangeFields.has('max')
                ? literalValue(rangeFields.get('max'))
                : { known: false };
              const validRange =
                rangeFields.size === 2 &&
                minLiteral.known &&
                maxLiteral.known &&
                Number.isSafeInteger(minLiteral.value) &&
                Number.isSafeInteger(maxLiteral.value) &&
                minLiteral.value <= maxLiteral.value;
              const rule = schema.get(key);
              if (
                !validRange ||
                !rule ||
                rule.kind !== 'integer' ||
                !requiredKeys.has(key) ||
                minLiteral.value < rule?.min ||
                maxLiteral.value > rule?.max
              ) {
                errors.push(
                  `${event}.${key} shape integer range must be a required in-schema bounded integer.`,
                );
                continue;
              }
              integerRanges.set(key, { max: maxLiteral.value, min: minLiteral.value });
            }
          }
        }
        for (const key of [...requiredKeys, ...optionalKeys]) {
          if (covered.has(`${branches.length}:${key}`) || !schema.has(key)) {
            if (!schema.has(key)) errors.push(`${event} payload shape uses unknown key: ${key}.`);
          }
          covered.add(key);
          if (requiredKeys.has(key) && optionalKeys.has(key)) {
            errors.push(`${event} payload shape repeats required key as optional: ${key}.`);
          }
        }
        const branch = {
          fixedValues,
          integerRanges,
          optional: optionalKeys,
          required: requiredKeys,
        };
        const allowed = new Set([...requiredKeys, ...optionalKeys]);
        for (const previous of branches) {
          const previousAllowed = new Set([...previous.required, ...previous.optional]);
          const requiredUnion = new Set([...requiredKeys, ...previous.required]);
          let overlaps = [...requiredUnion].every(
            (key) => allowed.has(key) && previousAllowed.has(key),
          );
          if (overlaps) {
            for (const [key, values] of fixedValues) {
              const previousValues = previous.fixedValues.get(key);
              if (previousValues && ![...values].some((value) => previousValues.has(value))) {
                overlaps = false;
                break;
              }
            }
          }
          if (overlaps) {
            for (const [key, range] of integerRanges) {
              const previousRange = previous.integerRanges.get(key);
              if (
                previousRange &&
                (range.max < previousRange.min || previousRange.max < range.min)
              ) {
                overlaps = false;
                break;
              }
            }
          }
          if (overlaps) {
            errors.push(`${event} payload shapes contain overlapping or duplicate branches.`);
            break;
          }
        }
        branches.push(branch);
      }
      for (const key of schema.keys()) {
        if (!covered.has(key)) errors.push(`${event} payload shapes omit schema key: ${key}.`);
      }
      for (const [key, rule] of schema) {
        if (rule.kind !== 'enum') continue;
        const coveredValues = new Set();
        for (const branch of branches) {
          if (!branch.required.has(key) && !branch.optional.has(key)) continue;
          const fixed = branch.fixedValues.get(key);
          for (const value of fixed ?? rule.values) coveredValues.add(value);
        }
        for (const value of rule.values) {
          if (!coveredValues.has(value)) {
            errors.push(`${event}.${key} payload shapes omit an allowed enum alternative.`);
            break;
          }
        }
      }
      if (shapes.has(event)) errors.push(`Payload shapes are duplicated for event: ${event}.`);
      shapes.set(event, branches);
    }
  }
  for (const [event, schema] of schemas) {
    if (!shapes.has(event)) {
      shapes.set(event, [
        {
          fixedValues: new Map(),
          integerRanges: new Map(),
          optional: new Set(),
          required: new Set(schema.keys()),
        },
      ]);
    }
  }
  return { events, props, schemas, shapes };
}

function buildProgram(errors) {
  const configPath = abs('apps/mobile/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    errors.push(`Unable to read mobile tsconfig: ${config.error.messageText}.`);
    return null;
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    dirname(configPath),
    { allowJs: true, checkJs: false, noEmit: true },
    configPath,
  );
  for (const diagnostic of parsed.errors) {
    errors.push(`Mobile tsconfig parse error: ${diagnostic.messageText}.`);
  }
  return ts.createProgram({ options: parsed.options, rootNames: parsed.fileNames });
}

function unalias(checker, symbol) {
  if (!symbol) return null;
  try {
    return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  } catch {
    return symbol;
  }
}

function canonicalTrackSymbol(program) {
  if (!program) return null;
  const checker = program.getTypeChecker();
  const tracker = program
    .getSourceFiles()
    .find((file) => normalized(file.fileName) === normalized(TRACKER_FILE));
  const moduleSymbol = tracker ? checker.getSymbolAtLocation(tracker) : null;
  const exported = moduleSymbol
    ? checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === 'track')
    : null;
  return unalias(checker, exported);
}

function typeContainsUnsafe(type) {
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never)) return true;
  return type.isUnionOrIntersection?.() ? type.types.some(typeContainsUnsafe) : false;
}

function typeLiteralValue(type) {
  if (type.flags & ts.TypeFlags.StringLiteral) return { known: true, value: type.value };
  if (type.flags & ts.TypeFlags.NumberLiteral) return { known: true, value: type.value };
  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return { known: true, value: type.intrinsicName === 'true' };
  }
  if (type.flags & ts.TypeFlags.Null) return { known: true, value: null };
  return { known: false, value: undefined };
}

function typeAllowedByRule(type, rule, allowUndefined = false) {
  if (typeContainsUnsafe(type)) return false;
  const allMembers = type.isUnionOrIntersection?.() ? type.types : [type];
  const hasUndefined = allMembers.some(
    (member) => member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void),
  );
  if (hasUndefined && !allowUndefined) {
    return false;
  }
  const members = allMembers.filter(
    (member) => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)),
  );
  if (members.length === 0) return allowUndefined;
  if (rule.kind === 'enum') {
    return members.every((member) => {
      const literal = typeLiteralValue(member);
      return literal.known && rule.values.has(valueKey(literal.value));
    });
  }
  if (rule.kind === 'integer') {
    return members.every((member) => {
      const literal = typeLiteralValue(member);
      return literal.known
        ? ruleAcceptsLiteral(rule, literal.value)
        : Boolean(member.flags & ts.TypeFlags.Number);
    });
  }
  return members.every(
    (member) =>
      Boolean(member.flags & ts.TypeFlags.String) ||
      (typeLiteralValue(member).known && typeof typeLiteralValue(member).value === 'string'),
  );
}

function ruleAcceptsLiteral(rule, value) {
  switch (rule.kind) {
    case 'enum':
      return rule.values.has(valueKey(value));
    case 'integer':
      return Number.isSafeInteger(value) && value >= rule.min && value <= rule.max;
    case 'opaque_id':
      return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
    case 'app_version':
      return (
        typeof value === 'string' &&
        /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][A-Za-z0-9.-]{1,32})?$/.test(value)
      );
    case 'build_number':
      return typeof value === 'string' && /^(?:dev|\d{1,18})$/.test(value);
    default:
      return false;
  }
}

function validateTrackCall({ checker, errors, node, registry, sourceFile }) {
  const before = errors.length;
  const location = diagnosticLocation(sourceFile, node);
  const [eventNode, payloadNode, ...extraArguments] = node.arguments;
  let owner = node;
  while (owner.parent && !ts.isStatement(owner)) owner = owner.parent;
  const leading = sourceFile.text.slice(owner.getFullStart(), owner.getStart(sourceFile));
  if (/@ts-(?:expect-error|ignore)/.test(leading)) {
    errors.push(`${location} analytics calls must not rely on TypeScript diagnostic suppression.`);
  }
  if (!eventNode || !ts.isStringLiteral(eventNode)) {
    errors.push(`${location} analytics event must be a plain string literal.`);
    return null;
  }
  const event = eventNode.text;
  if (!registry.events.has(event)) {
    errors.push(`${location} analytics event is not registered: ${event}.`);
    return null;
  }
  const schema = registry.schemas.get(event) ?? new Map();
  if (!schema.size) {
    if (payloadNode || extraArguments.length) {
      errors.push(`${location} no-property event received a payload: ${event}.`);
    }
    return errors.length === before ? event : null;
  }
  if (!payloadNode || extraArguments.length) {
    errors.push(`${location} event requires one inline payload: ${event}.`);
    return null;
  }
  const payload = unwrapPayloadExpression(payloadNode, errors, location);
  if (!ts.isObjectLiteralExpression(payload)) {
    errors.push(`${location} analytics payload must be an inline object literal.`);
    return null;
  }
  const seen = new Set();
  const staticValues = new Map();
  for (const property of payload.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
      errors.push(`${location} analytics payload contains a spread, method, or accessor.`);
      continue;
    }
    const key = propertyName(property.name);
    if (!key || seen.has(key)) {
      errors.push(`${location} analytics payload contains a computed or duplicate key.`);
      continue;
    }
    seen.add(key);
    const rule = schema.get(key);
    if (!rule) {
      errors.push(`${location} ${event} payload uses a key outside its schema: ${key}.`);
      continue;
    }
    const initializer = ts.isPropertyAssignment(property) ? property.initializer : property.name;
    const literal = literalValue(initializer);
    if (literal.known) {
      staticValues.set(key, literal.value);
      if (!ruleAcceptsLiteral(rule, literal.value)) {
        errors.push(`${location} ${event}.${key} uses a value outside its exact rule.`);
      }
    } else if (checker) {
      const type = checker.getTypeAtLocation(initializer);
      const optional = (registry.shapes.get(event) ?? []).some((shape) => shape.optional.has(key));
      if (!typeAllowedByRule(type, rule, optional)) {
        errors.push(`${location} ${event}.${key} has a type outside its exact runtime rule.`);
      }
    }
  }
  const branchMatches = (registry.shapes.get(event) ?? []).some((shape) => {
    const allowed = new Set([...shape.required, ...shape.optional]);
    if (![...shape.required].every((key) => seen.has(key))) return false;
    if (![...seen].every((key) => allowed.has(key))) return false;
    for (const [key, values] of shape.fixedValues) {
      if (staticValues.has(key) && !values.has(valueKey(staticValues.get(key)))) return false;
    }
    for (const [key, range] of shape.integerRanges) {
      if (staticValues.has(key)) {
        const value = staticValues.get(key);
        if (!Number.isSafeInteger(value) || value < range.min || value > range.max) return false;
      }
    }
    return true;
  });
  if (!branchMatches) errors.push(`${location} ${event} payload does not match an exact branch.`);
  return errors.length === before ? event : null;
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

function auditTrackerImplementation(sourceFile, errors, dynamicVendorImports) {
  const exported = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      exported.add(statement.name.text);
    } else if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text);
      }
    }
  }
  const missing = [...PUBLIC_TRACKER_EXPORTS].filter((name) => !exported.has(name));
  const extra = [...exported].filter((name) => !PUBLIC_TRACKER_EXPORTS.has(name));
  if (missing.length || extra.length) {
    errors.push(
      `Analytics tracker runtime exports must match the fixed API (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}).`,
    );
  }
  const captures = [];
  function visit(node) {
    const isCapture =
      (ts.isPropertyAccessExpression(node) && node.name.text === 'capture') ||
      (ts.isElementAccessExpression(node) &&
        node.argumentExpression &&
        ts.isStringLiteralLike(node.argumentExpression) &&
        node.argumentExpression.text === 'capture');
    if (isCapture) captures.push(node);
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'posthog'
    ) {
      errors.push(`${diagnosticLocation(sourceFile, node)} computed PostHog access is forbidden.`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (captures.length !== 1) {
    errors.push(
      `Analytics tracker must contain exactly one PostHog capture call; found ${captures.length}.`,
    );
  } else {
    const capture = captures[0];
    const call = capture.parent;
    let owner = call;
    while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
    const validOwner =
      ts.isCallExpression(call) &&
      call.expression === capture &&
      ts.isPropertyAccessExpression(capture) &&
      ts.isIdentifier(capture.expression) &&
      capture.expression.text === 'posthog' &&
      owner?.name?.text === 'track' &&
      Boolean(owner.body);
    const argumentsText = ts.isCallExpression(call)
      ? call.arguments.map((argument) => argument.getText(sourceFile))
      : [];
    if (
      !validOwner ||
      argumentsText.length !== 2 ||
      argumentsText[0] !== 'prepared.event' ||
      argumentsText[1] !== 'prepared.props'
    ) {
      errors.push(
        'Analytics tracker capture must be the exact prepared.event/prepared.props call.',
      );
    }
  }
  const trackImplementation = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === 'track' &&
      Boolean(statement.body),
  );
  const trackStatements = trackImplementation?.body?.statements ?? [];
  const preparedIndex = trackStatements.findIndex((statement) => {
    if (!ts.isVariableStatement(statement)) return false;
    const declarations = statement.declarationList.declarations;
    if (declarations.length !== 1) return false;
    const declaration = declarations[0];
    const initializer = declaration.initializer;
    return (
      Boolean(statement.declarationList.flags & ts.NodeFlags.Const) &&
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === 'prepared' &&
      initializer &&
      ts.isCallExpression(initializer) &&
      ts.isIdentifier(initializer.expression) &&
      initializer.expression.text === 'prepareAnalyticsEvent' &&
      initializer.arguments.map((argument) => argument.getText(sourceFile)).join(',') ===
        'event,props'
    );
  });
  const guardIndex = trackStatements.findIndex((statement) => {
    if (!ts.isIfStatement(statement)) return false;
    const condition = statement.expression;
    const guardedReturn = ts.isBlock(statement.thenStatement)
      ? statement.thenStatement.statements.length === 1 &&
        ts.isReturnStatement(statement.thenStatement.statements[0])
      : ts.isReturnStatement(statement.thenStatement);
    return (
      ts.isPrefixUnaryExpression(condition) &&
      condition.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isIdentifier(condition.operand) &&
      condition.operand.text === 'prepared' &&
      guardedReturn
    );
  });
  if (preparedIndex < 0 || guardIndex <= preparedIndex) {
    errors.push(
      'Analytics tracker must prepare the event through prepareAnalyticsEvent and return on rejection before capture.',
    );
  }
  const capturePosition = captures[0]?.parent?.getStart(sourceFile) ?? -1;
  const guardEnd =
    guardIndex >= 0 ? trackStatements[guardIndex].getEnd() : Number.POSITIVE_INFINITY;
  if (capturePosition <= guardEnd) {
    errors.push('Analytics tracker rejection guard must dominate the prepared capture.');
  }
  if (trackImplementation?.body) {
    function visitPrepared(node) {
      if (ts.isIdentifier(node) && node.text === 'prepared') {
        const parent = node.parent;
        const declarationName = ts.isVariableDeclaration(parent) && parent.name === node;
        const guardOperand =
          ts.isPrefixUnaryExpression(parent) &&
          parent.operator === ts.SyntaxKind.ExclamationToken &&
          parent.operand === node;
        const captureProperty =
          ts.isPropertyAccessExpression(parent) &&
          parent.expression === node &&
          (parent.name.text === 'event' || parent.name.text === 'props') &&
          ts.isCallExpression(parent.parent) &&
          parent.parent.expression === captures[0];
        if (!declarationName && !guardOperand && !captureProperty) {
          errors.push(
            `${diagnosticLocation(sourceFile, node)} prepared analytics payload must not be reassigned, mutated, inspected, or escaped.`,
          );
        }
      }
      ts.forEachChild(node, visitPrepared);
    }
    visitPrepared(trackImplementation.body);
  }

  const prepareImplementation = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === 'prepareAnalyticsEvent' &&
      Boolean(statement.body),
  );
  const prepareText = prepareImplementation?.body?.getText(sourceFile).replace(/\s/g, '') ?? '';
  if (
    !prepareText.includes('constsafeEvent=sanitizeAnalyticsEventName(event);') ||
    !prepareText.includes('if(!safeEvent)returnnull;') ||
    !prepareText.includes('constpayload=sanitizeAnalyticsPayload(safeEvent,props);') ||
    !prepareText.includes('returnpayload.accepted?{event:safeEvent,props:payload.props}:null;')
  ) {
    errors.push('prepareAnalyticsEvent must apply both fail-closed event and payload sanitizers.');
  }
  const sanitizerImplementation = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === 'sanitizeAnalyticsPayload' &&
      Boolean(statement.body),
  );
  const sanitizerCalls = new Set();
  if (sanitizerImplementation?.body) {
    function visitSanitizer(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        sanitizerCalls.add(node.expression.text);
      }
      ts.forEachChild(node, visitSanitizer);
    }
    visitSanitizer(sanitizerImplementation.body);
  }
  for (const guard of [
    'analyticsSchemaForEvent',
    'isAllowedAnalyticsPayloadShape',
    'isAllowedAnalyticsPropKey',
    'isAllowedAnalyticsPropValue',
  ]) {
    if (!sanitizerCalls.has(guard)) {
      errors.push(`sanitizeAnalyticsPayload must enforce ${guard}.`);
    }
  }
  if (dynamicVendorImports !== 1) {
    errors.push(
      `Analytics tracker must own exactly one runtime PostHog acquisition; found ${dynamicVendorImports}.`,
    );
  }
}

export function auditAnalyticsSource() {
  const errors = [];
  const program = buildProgram(errors);
  const checker = program?.getTypeChecker() ?? null;
  const canonicalTrack = canonicalTrackSymbol(program);
  if (!canonicalTrack) errors.push('Unable to resolve the canonical analytics track symbol.');
  const programFiles = new Map(
    (program?.getSourceFiles() ?? []).map((sourceFile) => [
      normalized(sourceFile.fileName),
      sourceFile,
    ]),
  );
  const registrySourceFile =
    programFiles.get(normalized(abs(REGISTRY_PATH))) ??
    ts.createSourceFile(
      REGISTRY_PATH,
      read(REGISTRY_PATH),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
  const registry = parseRegistry(errors, registrySourceFile);
  const trackedEvents = new Set();
  let callCount = 0;
  let trackerDynamicVendorImports = 0;
  const files = listFiles('apps/mobile/src').filter(isRuntimeSource);

  for (const absoluteFile of files) {
    const isTracker = normalized(absoluteFile) === normalized(TRACKER_FILE);
    const relativeFile = absoluteFile.replace(`${abs('.')}\\`, '').replace(`${abs('.')}/`, '');
    const sourceFile =
      programFiles.get(normalized(absoluteFile)) ??
      ts.createSourceFile(
        relativeFile,
        read(absoluteFile),
        ts.ScriptTarget.Latest,
        true,
        scriptKind(absoluteFile),
      );
    for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
      errors.push(`${relativeFile} has a parse error: ${diagnostic.messageText}.`);
    }
    const fallbackTrackBindings = new Set();

    for (const statement of sourceFile.statements) {
      if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
        const specifier = ts.isStringLiteralLike(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : null;
        if (specifier && resolvesTrackerModule(specifier, absoluteFile)) {
          errors.push(`${relativeFile} must not re-export the analytics tracker.`);
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
        if (specifier && isPostHogModule(specifier) && !statement.isTypeOnly) {
          errors.push(`${relativeFile} must not acquire PostHog with import-equals.`);
        }
      }
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteralLike(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      if (isPostHogModule(specifier) && !isTypeOnlyImport(statement)) {
        errors.push(`${relativeFile} must not acquire PostHog through a value import.`);
      }
      const clause = statement.importClause;
      if (resolvesTrackerModule(specifier, absoluteFile)) {
        if (specifier !== TRACKER_MODULE) {
          errors.push(`${relativeFile} must import analytics APIs through ${TRACKER_MODULE}.`);
        }
        if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
          errors.push(`${relativeFile} must use named analytics imports.`);
        } else {
          for (const item of clause.namedBindings.elements) {
            const imported = item.propertyName?.text ?? item.name.text;
            if (!PUBLIC_TRACKER_EXPORTS.has(imported)) {
              errors.push(
                `${relativeFile} imports an analytics API outside the fixed public surface.`,
              );
            }
            if (imported === 'track') fallbackTrackBindings.add(item.name.text);
          }
        }
      }
    }

    function symbolIsCanonicalTrack(node) {
      if (!checker || !canonicalTrack) return false;
      return unalias(checker, checker.getSymbolAtLocation(node)) === canonicalTrack;
    }

    function visit(node) {
      if (ts.isCallExpression(node)) {
        const moduleArgument = node.arguments[0];
        const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
        const isModuleRequire =
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'module' &&
          node.expression.name.text === 'require';
        if (isDynamicImport || isRequire || isModuleRequire) {
          if (!moduleArgument || !ts.isStringLiteralLike(moduleArgument)) {
            errors.push(
              `${diagnosticLocation(sourceFile, node)} runtime module acquisition must use a literal specifier.`,
            );
          } else {
            const specifier = moduleArgument.text;
            if (resolvesTrackerModule(specifier, absoluteFile)) {
              errors.push(
                `${diagnosticLocation(sourceFile, node)} analytics tracker cannot be loaded dynamically.`,
              );
            }
            if (isPostHogModule(specifier)) {
              if (!isDynamicImport || !isTracker || specifier !== POSTHOG_MODULE) {
                errors.push(
                  `${diagnosticLocation(sourceFile, node)} PostHog runtime acquisition is owned only by the analytics tracker.`,
                );
              } else trackerDynamicVendorImports += 1;
            }
          }
        }
        const callTarget = node.expression;
        const canonicalCall =
          symbolIsCanonicalTrack(callTarget) ||
          (!checker && ts.isIdentifier(callTarget) && fallbackTrackBindings.has(callTarget.text));
        if (!isTracker && canonicalCall) {
          callCount += 1;
          const event = validateTrackCall({ checker, errors, node, registry, sourceFile });
          if (event) trackedEvents.add(event);
        }
      }

      if (!isTracker && ts.isIdentifier(node) && symbolIsCanonicalTrack(node)) {
        const parent = node.parent;
        const isImport = ts.isImportSpecifier(parent);
        const isCallTarget = ts.isCallExpression(parent) && parent.expression === node;
        if (!isImport && !isCallTarget) {
          errors.push(`${diagnosticLocation(sourceFile, node)} analytics tracker binding escaped.`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    if (isTracker) auditTrackerImplementation(sourceFile, errors, trackerDynamicVendorImports);
  }

  return {
    allowedEventCount: registry.events.size,
    allowedEvents: new Set(registry.events),
    allowedProps: new Set(registry.props),
    callCount,
    errors: [...new Set(errors)].sort(),
    trackedEventCount: trackedEvents.size,
    trackedEvents,
  };
}
