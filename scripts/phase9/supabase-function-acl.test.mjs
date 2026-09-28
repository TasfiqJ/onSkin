import assert from 'node:assert/strict';
import test from 'node:test';

import { publicFunctionCatalog } from './supabase-function-acl.mjs';

const functionSql = (name, body = 'select true') => `
  create function public.${name}(p_value text)
  returns boolean
  language sql
  security definer
  set search_path = ''
  as $$ ${body} $$;
`;

test('models plain CREATE FUNCTION as a new PUBLIC-executable routine', () => {
  const result = publicFunctionCatalog(functionSql('plain_create'));
  const routine = result.functions.get('plain_create(text)');

  assert.ok(routine);
  assert.match(routine.definition, /security\s+definer/i);
  assert.deepEqual([...routine.effectiveGrantRoles], ['public']);
  assert.deepEqual(result.unresolvedPrivilegeEvents, []);
  assert.deepEqual(result.unresolvedRenameEvents, []);
});

test('preserves effective ACLs when a routine is renamed', () => {
  const sql = `
    ${functionSql('original')}
    revoke all on function public.original(text) from public, anon, authenticated, service_role;
    grant execute on function public.original(text) to authenticated;
    alter function public.original(text) rename to hidden_original;
  `;
  const result = publicFunctionCatalog(sql);
  const renamed = result.functions.get('hidden_original(text)');

  assert.equal(result.functions.has('original(text)'), false);
  assert.ok(renamed);
  assert.deepEqual([...renamed.effectiveGrantRoles], ['authenticated']);
  assert.deepEqual(result.unresolvedRenameEvents, []);
});

test('applies post-rename revocation to the preserved routine ACL', () => {
  const sql = `
    ${functionSql('original')}
    revoke all on function public.original(text) from public, anon, authenticated, service_role;
    grant execute on function public.original(text) to authenticated;
    alter function public.original(text) rename to hidden_original;
    revoke all on function public.hidden_original(text)
      from public, anon, authenticated, service_role;
  `;
  const result = publicFunctionCatalog(sql);
  const renamed = result.functions.get('hidden_original(text)');

  assert.ok(renamed);
  assert.deepEqual([...renamed.effectiveGrantRoles], []);
  assert.equal(
    renamed.privilegeEventsAfterDefinition.at(-1)?.roles.includes('authenticated'),
    true,
  );
});

test('CREATE OR REPLACE preserves ACLs but starts a new explicit-privilege audit window', () => {
  const sql = `
    create or replace function public.replace_me(p_value text)
    returns boolean language sql security definer set search_path = ''
    as $$ select true $$;
    revoke all on function public.replace_me(text) from public, anon, authenticated, service_role;
    grant execute on function public.replace_me(text) to authenticated;
    create or replace function public.replace_me(p_value text)
    returns boolean language sql security definer set search_path = ''
    as $$ select false $$;
  `;
  const result = publicFunctionCatalog(sql);
  const routine = result.functions.get('replace_me(text)');

  assert.ok(routine);
  assert.deepEqual([...routine.effectiveGrantRoles], ['authenticated']);
  assert.deepEqual(routine.privilegeEventsAfterDefinition, []);
  assert.match(routine.definition, /select false/);
});

test('removes dropped overloads from the installed catalog model', () => {
  const sql = `${functionSql('removed')} drop function public.removed(text);`;
  const result = publicFunctionCatalog(sql);

  assert.equal(result.functions.has('removed(text)'), false);
});
