#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const CORE07A_SOURCE_PATHS = Object.freeze({
  shareAdmission: 'apps/mobile/src/features/growth/shareAdmission.ts',
  publicLinkAdmission: 'apps/mobile/src/features/growth/publicLinkAdmission.ts',
  shareProjection: 'apps/mobile/src/features/growth/shareProjection.ts',
  conflictCard: 'apps/mobile/src/features/growth/ConflictCard.tsx',
  shareCard: 'apps/mobile/src/features/growth/shareCard.ts',
  shareLinks: 'apps/mobile/src/features/growth/shareLinks.ts',
  shareRoute: 'apps/mobile/src/app/share/conflict/[ruleId].tsx',
  publicRoute: 'apps/mobile/src/app/s/[shareId].tsx',
  conflictRoute: 'apps/mobile/src/app/conflict/[ruleId].tsx',
  phase7: 'apps/mobile/src/lib/launch/phase7.ts',
  phase8: 'apps/mobile/src/lib/launch/phase8.ts',
  publicShareHtml: 'docs/phase-8/public-site/share.html',
});

export const CONFLICT_SHARE_PROJECTION_KEYS = Object.freeze([
  'actionLabel',
  'attributionLabel',
  'brandName',
  'claim',
  'disclaimer',
  'evidenceLabel',
  'eyebrow',
  'schemaVersion',
  'severityLabel',
  'title',
  'tone',
]);

export const PUBLIC_LINK_AUTHORITY_KEYS = Object.freeze([
  'abuseResponsePolicySha256',
  'allowedOrigins',
  'authorityId',
  'decision',
  'deletionPolicySha256',
  'expiresAt',
  'incidentPolicySha256',
  'indexingPolicySha256',
  'market',
  'notBefore',
  'privacyPolicySha256',
  'recipientPolicySha256',
  'retentionPolicySha256',
  'revocationPolicySha256',
  'schemaVersion',
  'shareProjectionSha256',
  'sharePublicationReceiptId',
  'signature',
  'tokenPolicySha256',
]);

const CONFLICT_SHARE_PUBLICATION_RECEIPT_KEYS = Object.freeze([
  'allowedMarket',
  'allowedTerritories',
  'citationSetSha256',
  'contentRightsReceiptId',
  'contentRightsScopeSha256',
  'copySha256',
  'corpusId',
  'corpusSha256',
  'corpusVersion',
  'decision',
  'expiresAt',
  'notBefore',
  'projectionSha256',
  'receiptId',
  'reviewReceipts',
  'ruleId',
  'ruleSha256',
  'schemaVersion',
  'signature',
]);
const CONFLICT_SHARE_CONFIRMATION_KEYS = Object.freeze([
  'confirmed',
  'confirmedAt',
  'destination',
  'destinationBehaviorSha256',
  'exactPayloadPreviewedAt',
  'projectionSha256',
  'publicLinkIncluded',
  'renderedPayloadSha256',
  'schemaVersion',
  'sharePublicationReceiptId',
]);
const CONFLICT_SHARE_REVIEW_RECEIPT_KEYS = Object.freeze([
  'decision',
  'expiresAt',
  'receiptId',
  'reviewedArtifactSha256',
  'role',
]);
const CONFLICT_SHARE_REVIEW_ROLES = Object.freeze([
  'board_certified_dermatologist',
  'cosmetic_chemist',
  'ip_content_rights_counsel',
  'privacy_security_reviewer',
  'regulatory_claims_counsel',
  'release_signoff_operator',
]);
const DETACHED_SIGNATURE_KEYS = Object.freeze(['algorithm', 'keyId', 'value']);

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TS_SOURCE_PATHS = Object.freeze(
  Object.values(CORE07A_SOURCE_PATHS).filter((path) => /\.(?:ts|tsx)$/u.test(path)),
);
const SHARE_RUNTIME_PATHS = Object.freeze([
  CORE07A_SOURCE_PATHS.shareAdmission,
  CORE07A_SOURCE_PATHS.publicLinkAdmission,
  CORE07A_SOURCE_PATHS.shareProjection,
  CORE07A_SOURCE_PATHS.conflictCard,
  CORE07A_SOURCE_PATHS.shareCard,
  CORE07A_SOURCE_PATHS.shareLinks,
  CORE07A_SOURCE_PATHS.shareRoute,
  CORE07A_SOURCE_PATHS.publicRoute,
]);
const SIDE_EFFECT_PATHS = Object.freeze([
  CORE07A_SOURCE_PATHS.shareCard,
  CORE07A_SOURCE_PATHS.shareLinks,
  CORE07A_SOURCE_PATHS.shareRoute,
  CORE07A_SOURCE_PATHS.publicRoute,
]);
const BANNED_SIDE_EFFECT_MODULES =
  /^(?:expo-crypto|expo-file-system(?:\/legacy)?|expo-linking|expo-sharing|react-native-view-shot)$/u;
const BANNED_SIDE_EFFECT_IDENTIFIERS = new Set([
  'Crypto',
  'FileSystem',
  'Linking',
  'Share',
  'Sharing',
  'XMLHttpRequest',
  'axios',
  'buildPublicGrowthUrl',
  'captureRef',
  'createShareId',
  'deleteAsync',
  'digestStringAsync',
  'downloadAsync',
  'fetch',
  'isAvailableAsync',
  'moveAsync',
  'openURL',
  'randomUUID',
  'sendBeacon',
  'shareAsync',
  'uploadAsync',
  'writeAsStringAsync',
]);
const BANNED_SHARE_BYPASS_PATTERN =
  /(?:__DEV__|EXPO_PUBLIC_(?:E2E|PHASE[78]).*(?:SHARE|LINK)|process\.env|e2e.*(?:share|conflict)|fixture.*(?:share|conflict))/iu;
const BANNED_PUBLIC_RECORD_COPY =
  /\b(?:reviewed\s+(?:product|conflict|check|card|record)|shared\s+(?:card|check|conflict|link|record|shelf)|shelf\s+check|this\s+(?:card|link|record)|per-user\s+record|product-order\s+check|record\s+(?:exists|found|ready)|checked\s+with)\b/iu;
const BANNED_PUBLIC_LINK_ANALYTICS =
  /\b(?:landing_viewed|share_link_(?:created|opened)|share_card_(?:exported|opened)|store_click)\b/iu;
const BANNED_PRIVATE_MODULE_PATTERN =
  /(?:^|\/)(?:features\/(?:intelligence|shelf)|lib\/analytics)(?:\/|$)/u;
const BANNED_PRIVATE_PROJECTION_FIELD =
  /(?:account|conflict|goal|health|photo|pregnan|product|profile|recommendation|routine|rule|safety|shareId|shelf|token|user)/iu;

function normalize(text) {
  return String(text).replaceAll('\r\n', '\n');
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

function unwrapExpression(node) {
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
  if (
    current &&
    ts.isCallExpression(current) &&
    ts.isPropertyAccessExpression(current.expression) &&
    current.expression.expression.getText() === 'Object' &&
    current.expression.name.text === 'freeze' &&
    current.arguments.length === 1
  ) {
    return unwrapExpression(current.arguments[0]);
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

function objectPropertyInitializer(source, objectName, propertyName) {
  const initializer = unwrapExpression(variableInitializer(source, objectName));
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) return null;
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
    const name = property.name?.getText(source).replace(/^['"]|['"]$/gu, '');
    if (name !== propertyName) continue;
    return ts.isPropertyAssignment(property) ? unwrapExpression(property.initializer) : property;
  }
  return null;
}

function functionDeclaration(source, name) {
  let match = null;
  const visit = (node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) &&
      node.name &&
      node.name.getText(source) === name
    ) {
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
    if (ts.isReturnStatement(child)) returns.push(unwrapExpression(child.expression));
    ts.forEachChild(child, visit);
  };
  visit(node.body);
  return returns;
}

function namedTypeNode(source, name) {
  let found = null;
  source.forEachChild((node) => {
    if (
      (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      node.name.text === name
    ) {
      found = node;
    }
  });
  return found;
}

function unwrapReadonlyType(node) {
  if (
    node &&
    ts.isTypeReferenceNode(node) &&
    node.typeName.getText() === 'Readonly' &&
    node.typeArguments?.length === 1
  ) {
    return { node: node.typeArguments[0], wrapped: true };
  }
  return { node, wrapped: false };
}

function typeMembers(source, name) {
  const declaration = namedTypeNode(source, name);
  if (!declaration) return { declaration: null, members: [], readonly: false };
  if (ts.isInterfaceDeclaration(declaration)) {
    return {
      declaration,
      members: [...declaration.members],
      readonly: declaration.members.every(
        (member) =>
          !ts.isPropertySignature(member) ||
          member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword),
      ),
    };
  }
  const unwrapped = unwrapReadonlyType(declaration.type);
  if (!unwrapped.node || !ts.isTypeLiteralNode(unwrapped.node)) {
    return { declaration, members: [], readonly: false };
  }
  return {
    declaration,
    members: [...unwrapped.node.members],
    readonly:
      unwrapped.wrapped ||
      unwrapped.node.members.every(
        (member) =>
          !ts.isPropertySignature(member) ||
          member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword),
      ),
  };
}

function memberNames(source, members) {
  return members
    .filter((member) => ts.isPropertySignature(member) || ts.isPropertyDeclaration(member))
    .map((member) => member.name?.getText(source).replace(/^['"]|['"]$/gu, ''))
    .filter(Boolean)
    .sort();
}

function typeProperty(source, typeName, propertyName) {
  const info = typeMembers(source, typeName);
  return (
    info.members.find(
      (member) =>
        ts.isPropertySignature(member) &&
        member.name?.getText(source).replace(/^['"]|['"]$/gu, '') === propertyName,
    ) ?? null
  );
}

function literalTypeValues(node) {
  const values = [];
  const visit = (child) => {
    if (ts.isLiteralTypeNode(child) && ts.isStringLiteral(child.literal)) {
      values.push(child.literal.text);
    }
    ts.forEachChild(child, visit);
  };
  if (node) visit(node);
  return values.sort();
}

function nestedReadonlyPropertyNames(source, typeName, propertyName) {
  const property = typeProperty(source, typeName, propertyName);
  if (!property?.type) return { names: [], readonly: false };
  const unwrapped = unwrapReadonlyType(property.type);
  if (!unwrapped.node || !ts.isTypeLiteralNode(unwrapped.node)) {
    return { names: [], readonly: false };
  }
  return {
    names: memberNames(source, [...unwrapped.node.members]),
    readonly:
      unwrapped.wrapped ||
      unwrapped.node.members.every(
        (member) =>
          !ts.isPropertySignature(member) ||
          member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword),
      ),
  };
}

function importedModules(source) {
  return source.statements
    .filter(ts.isImportDeclaration)
    .map((node) => node.moduleSpecifier.text)
    .sort();
}

function importedBindings(source) {
  const bindings = [];
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !node.importClause) continue;
    const clause = node.importClause;
    if (clause.name) bindings.push(clause.name.text);
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      bindings.push(...clause.namedBindings.elements.map((element) => element.name.text));
    }
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.push(clause.namedBindings.name.text);
    }
  }
  return bindings.sort();
}

function identifiers(source) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function callNames(source) {
  const names = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) names.push(expression.text);
      if (ts.isPropertyAccessExpression(expression)) names.push(expression.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names.sort();
}

function memberCalls(source, rootName) {
  const calls = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === rootName
    ) {
      calls.push({
        method: node.expression.name.text,
        arguments: [...node.arguments].map((argument) => argument.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}

function stringLiterals(source) {
  const values = [];
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isJsxText(node)
    ) {
      values.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

function propertyAccessesFrom(source, rootName) {
  const names = [];
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === rootName
    ) {
      names.push(node.name.text);
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === rootName &&
      node.argumentExpression &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      names.push(node.argumentExpression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names.sort();
}

function exportedRuntimeNames(source) {
  const names = [];
  for (const statement of source.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name) names.push(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
  }
  return names.sort();
}

function auditIssuerlessAdmissionModule({
  add,
  path,
  source,
  openName,
  predicateName,
  requiredTypes,
  allowedRuntimeNames,
}) {
  const open = unwrapExpression(variableInitializer(source, openName));
  add(open?.kind === ts.SyntaxKind.FalseKeyword, path, `${openName} must remain the literal false`);

  const predicate = functionDeclaration(source, predicateName);
  const returns = returnExpressions(predicate);
  add(Boolean(predicate), path, `${predicateName}() is missing`);
  add(
    returns.length > 0 &&
      returns.every((expression) => expression?.kind === ts.SyntaxKind.FalseKeyword),
    path,
    `${predicateName}() must return only the literal false`,
  );
  add(
    predicate ? callNames(sourceFile(path, predicate.getText(source))).length === 0 : false,
    path,
    `${predicateName}() must not delegate authority to another runtime helper`,
  );

  for (const typeName of requiredTypes) {
    const info = typeMembers(source, typeName);
    add(Boolean(info.declaration), path, `${typeName} is missing`);
    add(info.readonly, path, `${typeName} must be structurally readonly`);
  }

  const runtimeNames = exportedRuntimeNames(source);
  const unexpected = runtimeNames.filter((name) => !allowedRuntimeNames.includes(name));
  add(
    unexpected.length === 0,
    path,
    `future authority schemas must remain issuerless; unexpected runtime exports: ${unexpected.join(', ')}`,
  );
  add(
    !runtimeNames.some((name) =>
      /(?:admit|create|issue|mint|sign).*(?:authority|confirmation|receipt|share|link)|(?:authority|confirmation|receipt).*(?:create|issue|mint|sign)/iu.test(
        name,
      ),
    ),
    path,
    'future authority schemas must not expose an issuer, signer, minter, or admission constructor',
  );
  add(
    !BANNED_SHARE_BYPASS_PATTERN.test(source.text),
    path,
    'share admission must not depend on environment flags, development state, or E2E fixtures',
  );
}

export function loadCore07aSourceSnapshot(root = scriptRoot) {
  const snapshot = {};
  for (const path of Object.values(CORE07A_SOURCE_PATHS)) {
    const absolute = resolve(root, path);
    if (existsSync(absolute)) snapshot[path] = normalize(readFileSync(absolute, 'utf8'));
  }
  return Object.freeze(snapshot);
}

export function auditCore07aSourceSnapshot(snapshot) {
  const errors = [];
  const add = (condition, path, message) => {
    if (!condition) errors.push(`${path}: ${message}.`);
  };

  for (const path of Object.values(CORE07A_SOURCE_PATHS)) {
    add(typeof snapshot[path] === 'string', path, 'required CORE-07A source is missing');
  }
  if (errors.length > 0) return Object.freeze(errors.sort());

  const sources = Object.fromEntries(
    TS_SOURCE_PATHS.map((path) => [path, sourceFile(path, snapshot[path])]),
  );
  const shareAdmission = sources[CORE07A_SOURCE_PATHS.shareAdmission];
  const publicLinkAdmission = sources[CORE07A_SOURCE_PATHS.publicLinkAdmission];
  const shareProjection = sources[CORE07A_SOURCE_PATHS.shareProjection];
  const conflictCard = sources[CORE07A_SOURCE_PATHS.conflictCard];
  const shareCard = sources[CORE07A_SOURCE_PATHS.shareCard];
  const shareLinks = sources[CORE07A_SOURCE_PATHS.shareLinks];
  const shareRoute = sources[CORE07A_SOURCE_PATHS.shareRoute];
  const publicRoute = sources[CORE07A_SOURCE_PATHS.publicRoute];
  const conflictRoute = sources[CORE07A_SOURCE_PATHS.conflictRoute];
  const phase7 = sources[CORE07A_SOURCE_PATHS.phase7];
  const phase8 = sources[CORE07A_SOURCE_PATHS.phase8];

  auditIssuerlessAdmissionModule({
    add,
    path: CORE07A_SOURCE_PATHS.shareAdmission,
    source: shareAdmission,
    openName: 'CONFLICT_SHARE_ADMISSION_OPEN',
    predicateName: 'isConflictShareAdmitted',
    requiredTypes: ['ConflictSharePublicationReceipt', 'ConflictSharePayloadConfirmation'],
    allowedRuntimeNames: ['CONFLICT_SHARE_ADMISSION_OPEN', 'isConflictShareAdmitted'],
  });
  for (const [typeName, expectedKeys] of [
    ['ConflictShareReviewReceipt', CONFLICT_SHARE_REVIEW_RECEIPT_KEYS],
    ['ConflictSharePublicationReceipt', CONFLICT_SHARE_PUBLICATION_RECEIPT_KEYS],
    ['ConflictSharePayloadConfirmation', CONFLICT_SHARE_CONFIRMATION_KEYS],
  ]) {
    const info = typeMembers(shareAdmission, typeName);
    add(Boolean(info.declaration), CORE07A_SOURCE_PATHS.shareAdmission, `${typeName} is missing`);
    add(info.readonly, CORE07A_SOURCE_PATHS.shareAdmission, `${typeName} must be readonly`);
    add(
      JSON.stringify(memberNames(shareAdmission, info.members)) === JSON.stringify(expectedKeys),
      CORE07A_SOURCE_PATHS.shareAdmission,
      `${typeName} does not bind its exact issuerless future authority fields`,
    );
  }
  const reviewRoles = literalTypeValues(
    typeProperty(shareAdmission, 'ConflictShareReviewReceipt', 'role')?.type,
  );
  add(
    JSON.stringify(reviewRoles) === JSON.stringify(CONFLICT_SHARE_REVIEW_ROLES),
    CORE07A_SOURCE_PATHS.shareAdmission,
    `ConflictShareReviewReceipt.role must remain the exact six-role launch review union: ${CONFLICT_SHARE_REVIEW_ROLES.join(', ')}`,
  );
  for (const [typeName, propertyName, expectedText] of [
    ['ConflictShareReviewReceipt', 'decision', "'approved'"],
    ['ConflictSharePublicationReceipt', 'schemaVersion', '1'],
    ['ConflictSharePublicationReceipt', 'decision', "'admitted'"],
    ['ConflictSharePayloadConfirmation', 'schemaVersion', '1'],
    ['ConflictSharePayloadConfirmation', 'destination', "'native_share_sheet'"],
    ['ConflictSharePayloadConfirmation', 'publicLinkIncluded', 'false'],
    ['ConflictSharePayloadConfirmation', 'confirmed', 'true'],
  ]) {
    const property = typeProperty(shareAdmission, typeName, propertyName);
    add(
      property?.type?.getText(shareAdmission) === expectedText,
      CORE07A_SOURCE_PATHS.shareAdmission,
      `${typeName}.${propertyName} must remain the exact literal ${expectedText}`,
    );
  }
  const shareSignature = nestedReadonlyPropertyNames(
    shareAdmission,
    'ConflictSharePublicationReceipt',
    'signature',
  );
  add(
    shareSignature.readonly &&
      JSON.stringify(shareSignature.names) === JSON.stringify(DETACHED_SIGNATURE_KEYS),
    CORE07A_SOURCE_PATHS.shareAdmission,
    'ConflictSharePublicationReceipt.signature must remain an exact readonly algorithm/keyId/value envelope',
  );
  add(
    typeProperty(shareAdmission, 'ConflictSharePublicationReceipt', 'signature')
      ?.type?.getText(shareAdmission)
      .includes("algorithm: 'ed25519'") === true,
    CORE07A_SOURCE_PATHS.shareAdmission,
    "ConflictSharePublicationReceipt.signature.algorithm must remain the literal 'ed25519'",
  );
  auditIssuerlessAdmissionModule({
    add,
    path: CORE07A_SOURCE_PATHS.publicLinkAdmission,
    source: publicLinkAdmission,
    openName: 'PUBLIC_CONFLICT_LINK_ADMISSION_OPEN',
    predicateName: 'isPublicConflictLinkAdmitted',
    requiredTypes: ['PublicConflictLinkAuthority'],
    allowedRuntimeNames: ['PUBLIC_CONFLICT_LINK_ADMISSION_OPEN', 'isPublicConflictLinkAdmitted'],
  });

  const publicAuthority = typeMembers(publicLinkAdmission, 'PublicConflictLinkAuthority');
  add(
    JSON.stringify(memberNames(publicLinkAdmission, publicAuthority.members)) ===
      JSON.stringify(PUBLIC_LINK_AUTHORITY_KEYS),
    CORE07A_SOURCE_PATHS.publicLinkAdmission,
    `PublicConflictLinkAuthority must expose exactly ${PUBLIC_LINK_AUTHORITY_KEYS.join(', ')}`,
  );
  for (const [propertyName, expectedText] of [
    ['schemaVersion', '1'],
    ['decision', "'admitted'"],
  ]) {
    add(
      typeProperty(publicLinkAdmission, 'PublicConflictLinkAuthority', propertyName)?.type?.getText(
        publicLinkAdmission,
      ) === expectedText,
      CORE07A_SOURCE_PATHS.publicLinkAdmission,
      `PublicConflictLinkAuthority.${propertyName} must remain the exact literal ${expectedText}`,
    );
  }
  const publicLinkSignature = nestedReadonlyPropertyNames(
    publicLinkAdmission,
    'PublicConflictLinkAuthority',
    'signature',
  );
  add(
    publicLinkSignature.readonly &&
      JSON.stringify(publicLinkSignature.names) === JSON.stringify(DETACHED_SIGNATURE_KEYS),
    CORE07A_SOURCE_PATHS.publicLinkAdmission,
    'PublicConflictLinkAuthority.signature must remain an exact readonly algorithm/keyId/value envelope',
  );

  const projection = typeMembers(shareProjection, 'ConflictShareProjection');
  const projectionKeys = memberNames(shareProjection, projection.members);
  add(
    Boolean(projection.declaration),
    CORE07A_SOURCE_PATHS.shareProjection,
    'ConflictShareProjection is missing',
  );
  add(
    projection.readonly,
    CORE07A_SOURCE_PATHS.shareProjection,
    'ConflictShareProjection must be structurally readonly',
  );
  add(
    JSON.stringify(projectionKeys) === JSON.stringify(CONFLICT_SHARE_PROJECTION_KEYS),
    CORE07A_SOURCE_PATHS.shareProjection,
    `ConflictShareProjection must expose exactly ${CONFLICT_SHARE_PROJECTION_KEYS.join(', ')}`,
  );
  add(
    projectionKeys.every((key) => !BANNED_PRIVATE_PROJECTION_FIELD.test(key)),
    CORE07A_SOURCE_PATHS.shareProjection,
    'ConflictShareProjection contains a private Shelf, health, rule, product, account, or token field',
  );
  const projectionParser = functionDeclaration(shareProjection, 'parseConflictShareProjection');
  const exactProjectionKeys = functionDeclaration(shareProjection, 'hasExactProjectionKeys');
  add(
    Boolean(projectionParser),
    CORE07A_SOURCE_PATHS.shareProjection,
    'parseConflictShareProjection() is missing',
  );
  const parserText = projectionParser?.getText(shareProjection) ?? '';
  const exactProjectionKeysText = exactProjectionKeys?.getText(shareProjection) ?? '';
  add(
    /hasExactProjectionKeys\s*\(\s*value\s*\)/u.test(parserText) &&
      /Object\.keys\s*\(/u.test(exactProjectionKeysText) &&
      /CONFLICT_SHARE_PROJECTION_KEYS/u.test(exactProjectionKeysText) &&
      /actual\.length\s*===\s*expected\.length/u.test(exactProjectionKeysText) &&
      /actual\.every\s*\(/u.test(exactProjectionKeysText) &&
      /Object\.freeze\s*\(/u.test(parserText) &&
      /return\s+null\b/u.test(parserText),
    CORE07A_SOURCE_PATHS.shareProjection,
    'projection parser must use the bounded exact-key helper, reject invalid input, and return an immutable detached copy',
  );
  add(
    !BANNED_SHARE_BYPASS_PATTERN.test(shareProjection.text),
    CORE07A_SOURCE_PATHS.shareProjection,
    'projection parsing must not have a flag, development, environment, or fixture bypass',
  );

  const rendererIdentifiers = identifiers(conflictCard);
  add(
    !rendererIdentifiers.has('DetectedConflict'),
    CORE07A_SOURCE_PATHS.conflictCard,
    'renderer must never accept or reference raw DetectedConflict',
  );
  add(
    importedModules(conflictCard).every(
      (moduleName) => !BANNED_PRIVATE_MODULE_PATTERN.test(moduleName),
    ),
    CORE07A_SOURCE_PATHS.conflictCard,
    'renderer must not import Shelf, intelligence, or analytics modules',
  );
  add(
    conflictCard.text.includes('ConflictShareProjection') &&
      /\{\s*projection\s*:\s*ConflictShareProjection\s*\}/u.test(conflictCard.text),
    CORE07A_SOURCE_PATHS.conflictCard,
    'renderer props must contain only projection: ConflictShareProjection',
  );
  add(
    !/\b(?:conflict|shareUrl)\s*:/u.test(conflictCard.text),
    CORE07A_SOURCE_PATHS.conflictCard,
    'renderer props must not reintroduce a conflict or public-link value',
  );
  const rendererProjectionAccesses = propertyAccessesFrom(conflictCard, 'projection');
  add(
    rendererProjectionAccesses.every((name) => CONFLICT_SHARE_PROJECTION_KEYS.includes(name)),
    CORE07A_SOURCE_PATHS.conflictCard,
    `renderer accesses a non-allowlisted projection field: ${rendererProjectionAccesses
      .filter((name) => !CONFLICT_SHARE_PROJECTION_KEYS.includes(name))
      .join(', ')}`,
  );

  for (const path of SHARE_RUNTIME_PATHS) {
    add(
      !BANNED_SHARE_BYPASS_PATTERN.test(snapshot[path]),
      path,
      'share/public-link runtime must not have a flag, environment, development, or fixture bypass',
    );
  }

  for (const path of SIDE_EFFECT_PATHS) {
    const source = sources[path];
    const bannedModules = importedModules(source).filter((moduleName) =>
      BANNED_SIDE_EFFECT_MODULES.test(moduleName),
    );
    const bannedBindings = importedBindings(source).filter((name) =>
      BANNED_SIDE_EFFECT_IDENTIFIERS.has(name),
    );
    const bannedCalls = callNames(source).filter((name) =>
      BANNED_SIDE_EFFECT_IDENTIFIERS.has(name),
    );
    add(
      bannedModules.length === 0 && bannedBindings.length === 0 && bannedCalls.length === 0,
      path,
      `closed share/public-link runtime contains capture, temporary-file, network, link, crypto, or native-share side effects: ${[
        ...bannedModules,
        ...bannedBindings,
        ...bannedCalls,
      ]
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort()
        .join(', ')}`,
    );
  }

  add(
    importedModules(shareCard).length === 0,
    CORE07A_SOURCE_PATHS.shareCard,
    'closed share-card helper must not import runtime dependencies',
  );
  const shareFunction = functionDeclaration(shareCard, 'shareConflictCard');
  const shareReturns = returnExpressions(shareFunction);
  add(
    Boolean(shareFunction) &&
      shareReturns.length > 0 &&
      shareReturns.every((expression) => expression?.kind === ts.SyntaxKind.FalseKeyword) &&
      callNames(shareCard).length === 0,
    CORE07A_SOURCE_PATHS.shareCard,
    'shareConflictCard() must be a side-effect-free literal-false stub',
  );

  add(
    importedModules(shareLinks).length === 0,
    CORE07A_SOURCE_PATHS.shareLinks,
    'closed public-link helper must not import runtime dependencies',
  );
  const linkFunction = functionDeclaration(shareLinks, 'createConflictShareLink');
  const linkReturns = returnExpressions(linkFunction);
  add(
    Boolean(linkFunction) &&
      linkReturns.length > 0 &&
      linkReturns.every((expression) => expression?.kind === ts.SyntaxKind.NullKeyword) &&
      callNames(shareLinks).length === 0,
    CORE07A_SOURCE_PATHS.shareLinks,
    'createConflictShareLink() must be a side-effect-free literal-null stub',
  );
  add(
    !/\b(?:createShareId|randomUUID|digestStringAsync|buildPublicGrowthUrl|Date\.now|\/s\/)\b/u.test(
      shareLinks.text,
    ),
    CORE07A_SOURCE_PATHS.shareLinks,
    'closed public-link helper must not create an identifier, digest, URL, or route',
  );

  const phase7ShareCard = objectPropertyInitializer(phase7, 'phase7Flags', 'shareCard');
  const phase7ShareCapability = objectPropertyInitializer(
    phase7,
    'phase7Capabilities',
    'conflictSharePublication',
  );
  add(
    phase7ShareCard?.kind === ts.SyntaxKind.FalseKeyword,
    CORE07A_SOURCE_PATHS.phase7,
    'phase7Flags.shareCard must remain the literal false',
  );
  add(
    phase7ShareCapability?.kind === ts.SyntaxKind.FalseKeyword,
    CORE07A_SOURCE_PATHS.phase7,
    'phase7Capabilities.conflictSharePublication must remain the literal false',
  );
  add(
    !/phase7(?:ShareCard|ReviewedConflictSharing)Enabled|E2E_REVIEWED_CONFLICT_SHARING|e2eReviewedConflictSharingEnabled/iu.test(
      phase7.text,
    ),
    CORE07A_SOURCE_PATHS.phase7,
    'Phase 7 share admission must not be derived from flags, environment values, or E2E state',
  );
  const shareEligibility = functionDeclaration(phase7, 'canShareConflictCard');
  const shareEligibilityReturns = returnExpressions(shareEligibility);
  add(
    Boolean(shareEligibility) &&
      shareEligibilityReturns.length > 0 &&
      shareEligibilityReturns.every(
        (expression) => expression?.kind === ts.SyntaxKind.FalseKeyword,
      ),
    CORE07A_SOURCE_PATHS.phase7,
    'canShareConflictCard() must remain a literal-false predicate',
  );

  const phase8PublicLinks = objectPropertyInitializer(phase8, 'phase8Flags', 'publicLinks');
  add(
    phase8PublicLinks?.kind === ts.SyntaxKind.FalseKeyword,
    CORE07A_SOURCE_PATHS.phase8,
    'phase8Flags.publicLinks must remain the literal false',
  );
  add(
    !/phase8PublicLinksEnabled|EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED/iu.test(phase8.text),
    CORE07A_SOURCE_PATHS.phase8,
    'Phase 8 public-link admission must not be derived from a flag or environment value',
  );

  const shareRouteIds = identifiers(shareRoute);
  for (const name of [
    'ConflictCard',
    'DetectedConflict',
    'canShareConflictCard',
    'createConflictShareLink',
    'phase7Flags',
    'shareConflictCard',
    'useLocalSearchParams',
    'useShelf',
  ]) {
    add(
      !shareRouteIds.has(name),
      CORE07A_SOURCE_PATHS.shareRoute,
      `closed share route must not reference ${name}`,
    );
  }
  add(
    importedModules(shareRoute).every(
      (moduleName) => !BANNED_PRIVATE_MODULE_PATTERN.test(moduleName),
    ),
    CORE07A_SOURCE_PATHS.shareRoute,
    'closed share route must not import private Shelf/intelligence or analytics modules',
  );
  add(
    /<DeferredSurface\b[\s\S]*?surface=["']shareCard["']/u.test(shareRoute.text),
    CORE07A_SOURCE_PATHS.shareRoute,
    'closed share route must render only the truthful shareCard deferred surface',
  );

  const conflictRouteIds = identifiers(conflictRoute);
  add(
    !conflictRouteIds.has('canShareConflictCard') &&
      !/\/share\/conflict|conflictShareRoute/u.test(conflictRoute.text),
    CORE07A_SOURCE_PATHS.conflictRoute,
    'private conflict detail must not expose a launcher into the closed share route',
  );

  const publicRouteIds = identifiers(publicRoute);
  for (const name of ['Link', 'isSafeOpaqueId', 'shareId', 'track', 'useLocalSearchParams']) {
    add(
      !publicRouteIds.has(name),
      CORE07A_SOURCE_PATHS.publicRoute,
      `closed public route must not parse tokens, navigate, or emit analytics through ${name}`,
    );
  }
  add(
    importedModules(publicRoute).every(
      (moduleName) =>
        !BANNED_PRIVATE_MODULE_PATTERN.test(moduleName) &&
        !/(?:^|\/)growth\/attribution(?:\/|$)/u.test(moduleName),
    ),
    CORE07A_SOURCE_PATHS.publicRoute,
    'closed public route must not import token parsing or analytics modules',
  );
  const publicRecoveryCalls = memberCalls(publicRoute, 'router');
  const allowedPublicRecoveryDestinations = new Set([
    "'/shelf/manual'",
    '"/shelf/manual"',
    'APP_SHELF_ROUTE',
  ]);
  add(
    publicRecoveryCalls.length === 2 &&
      publicRecoveryCalls.every(
        (call) =>
          call.method === 'replace' &&
          call.arguments.length === 1 &&
          allowedPublicRecoveryDestinations.has(call.arguments[0]),
      ),
    CORE07A_SOURCE_PATHS.publicRoute,
    'closed public route may navigate only by replacement to the fixed first-party Shelf and manual-add recovery destinations',
  );
  const publicCopy = stringLiterals(publicRoute).join('\n');
  add(
    !BANNED_PUBLIC_RECORD_COPY.test(publicCopy),
    CORE07A_SOURCE_PATHS.publicRoute,
    'public unavailable copy must not imply a shared, reviewed, or per-user record',
  );
  add(
    !BANNED_PUBLIC_LINK_ANALYTICS.test(publicRoute.text),
    CORE07A_SOURCE_PATHS.publicRoute,
    'closed public route must not emit public-link analytics',
  );

  const publicHtml = snapshot[CORE07A_SOURCE_PATHS.publicShareHtml];
  add(
    !/<(?:a|button|form|iframe|script)\b/iu.test(publicHtml),
    CORE07A_SOURCE_PATHS.publicShareHtml,
    'closed public HTML must not contain navigation, form, script, or destination side effects',
  );
  add(
    !/(?:URLSearchParams|window\.location|share[_-]?id|sendBeacon|fetch\s*\(|XMLHttpRequest|data-store-url|__APP_STORE_URL__|__PLAY_STORE_URL__)/iu.test(
      publicHtml,
    ),
    CORE07A_SOURCE_PATHS.publicShareHtml,
    'closed public HTML must not parse tokens, send network data, or activate store destinations',
  );
  add(
    !BANNED_PUBLIC_RECORD_COPY.test(publicHtml),
    CORE07A_SOURCE_PATHS.publicShareHtml,
    'public HTML must not imply a shared, reviewed, or per-user record',
  );
  add(
    !BANNED_PUBLIC_LINK_ANALYTICS.test(publicHtml),
    CORE07A_SOURCE_PATHS.publicShareHtml,
    'closed public HTML must not emit public-link analytics',
  );
  add(
    /\b(?:public links?|sharing)\b[\s\S]{0,80}\b(?:unavailable|not available|disabled)\b/iu.test(
      publicHtml,
    ),
    CORE07A_SOURCE_PATHS.publicShareHtml,
    'public HTML must state that the public-link surface is unavailable',
  );

  return Object.freeze(errors.sort());
}

export function auditCore07aShareAdmission(root = scriptRoot) {
  return auditCore07aSourceSnapshot(loadCore07aSourceSnapshot(root));
}
