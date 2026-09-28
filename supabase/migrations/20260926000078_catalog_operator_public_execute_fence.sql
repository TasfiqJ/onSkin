-- =============================================================================
-- 0078 - Close PUBLIC execution inherited by the catalog-operator login
-- =============================================================================
-- PostgreSQL's PUBLIC pseudo-role is inherited by every login. Revoking a
-- function only from catalog_operator_edge therefore does not close a PUBLIC
-- EXECUTE grant. Reassert the complete current-function boundary and both the
-- global and schema-scoped defaults for the migration owner. Explicit grants
-- to anon, authenticated, service_role, or other reviewed roles are preserved.

begin;
set local lock_timeout = '5s';

revoke execute on all functions in schema public, private
  from public, catalog_operator_edge;

alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema private
  revoke execute on functions from public;

commit;
