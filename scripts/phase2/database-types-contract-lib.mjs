import { createHash } from 'node:crypto';

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
  const requiredFragments = [
    'export type Json =',
    'export type Database =',
    'public: {',
    'Tables: {',
    'Views: {',
    'Functions: {',
    'Enums: {',
    'CompositeTypes: {',
  ];
  if (
    text.length < 100 ||
    requiredFragments.some((fragment) => !text.includes(fragment)) ||
    (text.match(/export type Database\s*=/gu) ?? []).length !== 1
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
