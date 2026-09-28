import { createHash } from 'node:crypto';

import ts from 'typescript';

export const DATABASE_TYPES_RELATIVE_PATH = 'packages/types/src/database.types.ts';

export function canonicalizeDatabaseTypes(raw) {
  const normalized = String(raw)
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n?|\n/gu, '\n')
    .trimEnd();
  return `${normalized}\n`;
}

export function summarizeCanonicalDatabaseTypes(raw) {
  const text = canonicalizeDatabaseTypes(raw);
  return Object.freeze({
    text,
    lineCount: text.split('\n').length,
    sha256: createHash('sha256').update(text).digest('hex'),
  });
}

export function summarizeDatabaseTypes(raw, { failureCode = 'DB08_GENERATED_TYPES_INVALID' } = {}) {
  const summary = summarizeCanonicalDatabaseTypes(raw);
  const { text } = summary;
  const source = ts.createSourceFile(
    DATABASE_TYPES_RELATIVE_PATH,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exportedTypeAliases = source.statements.filter(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
  const aliasesNamed = (name) =>
    exportedTypeAliases.filter((declaration) => declaration.name.text === name);
  const propertyNamed = (literal, name) =>
    literal.members.find(
      (member) =>
        ts.isPropertySignature(member) &&
        ((ts.isIdentifier(member.name) && member.name.text === name) ||
          (ts.isStringLiteral(member.name) && member.name.text === name)),
    );
  const databaseAliases = aliasesNamed('Database');
  const jsonAliases = aliasesNamed('Json');
  const databaseType = databaseAliases[0]?.type;
  const publicProperty = databaseType && ts.isTypeLiteralNode(databaseType)
    ? propertyNamed(databaseType, 'public')
    : undefined;
  const publicType = publicProperty?.type;
  const requiredPublicMembers = ['Tables', 'Views', 'Functions', 'Enums', 'CompositeTypes'];
  if (
    text.length < 100 ||
    source.parseDiagnostics.length !== 0 ||
    jsonAliases.length !== 1 ||
    databaseAliases.length !== 1 ||
    !databaseType ||
    !ts.isTypeLiteralNode(databaseType) ||
    !publicProperty ||
    !publicType ||
    !ts.isTypeLiteralNode(publicType) ||
    requiredPublicMembers.some((name) => {
      const member = propertyNamed(publicType, name);
      return !member || (!ts.isTypeLiteralNode(member.type) && !ts.isMappedTypeNode(member.type));
    })
  ) {
    const error = new Error(failureCode);
    error.code = failureCode;
    throw error;
  }
  return summary;
}

export function databaseTypesMatch(left, right) {
  return summarizeDatabaseTypes(left).sha256 === summarizeDatabaseTypes(right).sha256;
}
