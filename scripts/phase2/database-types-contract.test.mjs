import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import {
  canonicalizeDatabaseTypes,
  summarizeCanonicalDatabaseTypes,
  summarizeDatabaseTypes,
} from './database-types-contract-lib.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES_PATH = join(REPO_ROOT, 'packages', 'types', 'src', 'database.types.ts');
const OVERLAY_PATH = join(REPO_ROOT, 'packages', 'types', 'src', 'client-database.types.ts');
const MOBILE_ROOT = join(REPO_ROOT, 'apps', 'mobile', 'src');

function sourceFiles(root) {
  const files = [];
  for (const name of readdirSync(root).sort((left, right) => left.localeCompare(right))) {
    const path = join(root, name);
    const metadata = statSync(path);
    if (metadata.isDirectory()) files.push(...sourceFiles(path));
    else if (/\.(?:ts|tsx)$/u.test(name) && !/\.test\.(?:ts|tsx)$/u.test(name)) files.push(path);
  }
  return files;
}

function directMutation(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
  const operation = node.expression.name.text;
  if (!['insert', 'update', 'upsert', 'delete'].includes(operation)) return null;
  const receiver = node.expression.expression;
  if (!ts.isCallExpression(receiver) || !ts.isPropertyAccessExpression(receiver.expression)) {
    return null;
  }
  if (
    receiver.expression.name.text !== 'from' ||
    !ts.isIdentifier(receiver.expression.expression) ||
    receiver.expression.expression.text !== 'supabase' ||
    receiver.arguments.length !== 1 ||
    !ts.isStringLiteral(receiver.arguments[0])
  ) {
    return null;
  }
  return { operation, table: receiver.arguments[0].text };
}

function scanMobileCapabilities() {
  const mutations = [];
  const unsafeRpcCasts = [];
  for (const path of sourceFiles(MOBILE_ROOT)) {
    const source = readFileSync(path, 'utf8');
    const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      const mutation = directMutation(node);
      if (mutation) {
        const position = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
        mutations.push({
          ...mutation,
          path: relative(REPO_ROOT, path).replaceAll('\\', '/'),
          line: position.line + 1,
        });
      }
      if (ts.isAsExpression(node)) {
        const castText = node.getText(parsed);
        if (/\bsupabase\b[\s\S]*\brpc\b|\bsupabase\.rpc\b/u.test(castText)) {
          const position = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
          unsafeRpcCasts.push({
            path: relative(REPO_ROOT, path).replaceAll('\\', '/'),
            line: position.line + 1,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
  }
  return { mutations, unsafeRpcCasts };
}

test('generated type canonicalization is stable across line endings and rejects malformed output', () => {
  const valid = `export type Json = string\nexport type Database = {\n  public: {\n    Tables: {}\n    Views: {}\n    Functions: {}\n    Enums: {}\n    CompositeTypes: {}\n  }\n}\n`;
  const windowsLineEndings = valid.replaceAll('\n', '\r\n');
  assert.equal(canonicalizeDatabaseTypes(windowsLineEndings), valid);
  assert.equal(
    summarizeDatabaseTypes(valid).sha256,
    summarizeDatabaseTypes(windowsLineEndings).sha256,
  );
  assert.throws(() => summarizeDatabaseTypes('export type Database = {}\n'), {
    message: 'DB08_GENERATED_TYPES_INVALID',
  });
  assert.throws(
    () =>
      summarizeDatabaseTypes(`export type Json = string
export type Database = {
  // public: { Tables: {}; Views: {}; Functions: {}; Enums: {}; CompositeTypes: {} }
  unrelated: string
}
`),
    { message: 'DB08_GENERATED_TYPES_INVALID' },
  );
  assert.throws(
    () =>
      summarizeDatabaseTypes(`export type Json = string
export type Database = {
  public: {
    Tables: {}
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
`),
    { message: 'DB08_GENERATED_TYPES_INVALID' },
  );
  assert.throws(
    () =>
      summarizeDatabaseTypes(`export type Json = string
export type Database = {
  public: {
    Tables: string
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
`),
    { message: 'DB08_GENERATED_TYPES_INVALID' },
  );
  assert.doesNotThrow(() => summarizeCanonicalDatabaseTypes('legacy pre-image'));
});

test('repository type artifact is generated-only and the client overlay is deny-by-default', () => {
  const generated = readFileSync(TYPES_PATH, 'utf8');
  const overlay = readFileSync(OVERLAY_PATH, 'utf8');
  summarizeDatabaseTypes(generated);
  assert.doesNotMatch(generated, /hand-authored|BLOCKED: B-SUPABASE|Keep in sync with/u);
  assert.match(
    overlay,
    /type MobileTableName = 'consents' \| 'photos' \| 'routine_completions' \| 'skin_profiles'/u,
  );
  assert.match(overlay, /Insert: TableName extends DirectMobileInsertTable/u);
  assert.match(overlay, /Update: never/u);
  assert.match(overlay, /Views: Pick<PublicSchema\['Views'\], never>/u);
  assert.match(
    overlay,
    /type CompletionFunctionArgs =[\s\S]*?p_routine_type: 'AM' \| 'PM';[\s\S]*?p_step_id: string;[\s\S]*?p_step_order: number;[\s\S]*?p_user_product_id: string;[\s\S]*?p_routine_type: 'PM';[\s\S]*?p_step_id: null;[\s\S]*?p_step_order: null;[\s\S]*?p_user_product_id: null;/u,
  );
  assert.match(
    overlay,
    /FunctionName extends 'set_recommendation_preferences'[\s\S]*?p_budget_band: string \| null;/u,
  );
});

test('mobile direct table mutations and RPC typing stay on the reviewed capability lanes', () => {
  const capabilities = scanMobileCapabilities();
  assert.deepEqual(
    capabilities.mutations.map(({ operation, table, path }) => ({ operation, table, path })),
    [
      {
        operation: 'insert',
        table: 'skin_profiles',
        path: 'apps/mobile/src/features/onboarding/OnboardingContext.tsx',
      },
      {
        operation: 'delete',
        table: 'photos',
        path: 'apps/mobile/src/features/photos/store.ts',
      },
      {
        operation: 'insert',
        table: 'consents',
        path: 'apps/mobile/src/lib/consent/consent.ts',
      },
    ],
  );
  assert.deepEqual(capabilities.unsafeRpcCasts, []);
});
