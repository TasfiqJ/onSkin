import { CATALOG_LOOKUP_RPC } from './catalogContract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const servingGateMigrationUrl = new URL(
  '../../migrations/20260717000056_catalog_serving_eligibility_gate.sql',
  import.meta.url,
);

Deno.test('catalog lookup uses the service-only production eligibility RPC', async () => {
  const sql = compact(await Deno.readTextFile(servingGateMigrationUrl));

  assert(
    CATALOG_LOOKUP_RPC === 'lookup_catalog_product_by_barcode',
    'the reviewed lookup RPC name changed',
  );
  assert(
    sql.includes('create or replace function public.lookup_catalog_product_by_barcode('),
    'the exact barcode lookup RPC is missing',
  );
  assert(
    sql.includes('join public.catalog_servable_products as product'),
    'barcode lookup must consume the central production-serving gate',
  );
  assert(
    sql.includes('language sql stable security definer set search_path ='),
    'the service-only lookup RPC must own its table access with an empty search path',
  );
  assert(
    sql.includes("mapping.review_status = 'reviewed'"),
    'an unreviewed barcode mapping must not resolve',
  );
  assert(
    sql.includes(
      'revoke all on function public.lookup_catalog_product_by_barcode(text) from public, anon, authenticated',
    ) &&
      sql.includes(
        'grant execute on function public.lookup_catalog_product_by_barcode(text) to service_role',
      ),
    'the lookup RPC must remain reachable only through the service-role Edge path',
  );
});

Deno.test(
  'central catalog serving view requires positive source, product, and correction evidence',
  async () => {
    const sql = compact(await Deno.readTextFile(servingGateMigrationUrl));

    for (const predicate of [
      'cs.id = p.source_id',
      'cs.source_key = p.source',
      'cs.production_approved is true',
      "cs.review_status = 'legal_approved'",
      "p.region = 'us'",
      "p.status = 'active'",
      "p.review_status = 'reviewed'",
      'p.last_reviewed_at is not null',
      'p.last_reviewed_at <= pg_catalog.now()',
      "p.quality_grade in ('verified', 'usable')",
      'p.recommendation_eligible is true',
      'p.unresolved_correction_count = 0',
      "nullif(pg_catalog.btrim(p.source_ref), '') is not null",
      'p.source_snapshot_date is not null',
      'p.source_snapshot_date <= current_date',
      "correction.status in ('triaged', 'accepted')",
      'correction.operator_reviewed_at is not null',
      'correction.operator_reviewed_at <= pg_catalog.now()',
      "nullif(pg_catalog.btrim(correction.operator_reviewed_by), '') is not null",
      "nullif(pg_catalog.btrim(correction.operator_review_note), '') is not null",
    ]) {
      assert(sql.includes(predicate), `catalog serving gate is missing ${predicate}`);
    }
    assert(
      sql.includes("freshness.review_status = 'reviewed'") &&
        sql.includes('freshness_source.id = freshness.source_id') &&
        sql.includes('freshness_source.production_approved is true') &&
        sql.includes("freshness_source.review_status = 'legal_approved'") &&
        sql.includes('freshness.region = p.region'),
      'only reviewed, territory-matching freshness evidence from an approved source may leave the gate',
    );
    assert(
      sql.includes('with (security_invoker = true)'),
      'the central serving view must retain invoker RLS semantics',
    );
    assert(
      sql.includes(
        'revoke all on public.catalog_servable_products from public, anon, authenticated, service_role',
      ),
      'no API role may bypass the narrow RPCs through the central view',
    );
    assert(
      sql.includes('cs.reviewed_at <= pg_catalog.now()') &&
        sql.includes('cs.requires_attribution is false') &&
        sql.includes("nullif(pg_catalog.btrim(cs.attribution_text), '') is not null") &&
        sql.includes("nullif(pg_catalog.btrim(cs.attribution_url), '') is not null"),
      'future review evidence and incomplete mandatory attribution must fail closed',
    );
  },
);

Deno.test('barcode and direct catalog lanes cannot launder held child evidence', async () => {
  const sql = compact(await Deno.readTextFile(servingGateMigrationUrl));

  assert(
    sql.includes('mapping_source.id = mapping.source_id') &&
      sql.includes('mapping_source.production_approved is true') &&
      sql.includes("mapping_source.review_status = 'legal_approved'") &&
      sql.includes('mapping.source_id = product.catalog_source_id'),
    'a reviewed barcode mapping must still carry the exact independently approved product source',
  );
  for (const policy of [
    'products_read_servable',
    'product_barcodes_read_servable',
    'product_ingredients_read_servable',
    'product_ingredient_lists_read_servable',
    'product_ingredient_tokens_read_servable',
    'product_active_bands_read_servable',
    'product_pao_expiry_read_servable',
  ]) {
    assert(sql.includes(`create policy "${policy}"`), `missing fail-closed ${policy} policy`);
  }
  assert(
    sql.includes('using (private.catalog_product_is_servable(id))') &&
      sql.includes("correction.status in ('triaged', 'accepted')") &&
      sql.includes('correction.operator_reviewed_at is not null'),
    'direct product reads must use the cross-owner operator-audited hold predicate',
  );
  assert(
    sql.includes('create or replace function private.catalog_product_is_servable(') &&
      sql.includes('stable security definer') &&
      sql.includes("set search_path = ''"),
    'the RLS eligibility predicate must be search-path-sealed and owner-evaluated',
  );
  assert(
    sql.includes(
      'revoke all on function private.catalog_product_is_servable(uuid) from public, anon, authenticated, service_role',
    ) &&
      sql.includes(
        'grant execute on function private.catalog_product_is_servable(uuid) to authenticated',
      ),
    'the private predicate must be callable by stored authenticated policies without becoming a public RPC',
  );
  assert(
    sql.includes('parent_product.id = product_barcodes.product_id') &&
      sql.includes('parent_product.source_id = product_barcodes.source_id'),
    'direct barcode RLS must bind the mapping source to its parent product source',
  );
});

Deno.test('source attribution is bounded and base review metadata stays sealed', async () => {
  const sql = compact(await Deno.readTextFile(servingGateMigrationUrl));

  assert(
    sql.includes('drop policy if exists "catalog_sources_read_all" on public.catalog_sources') &&
      sql.includes('revoke select on public.catalog_sources from public, anon, authenticated'),
    'client API roles must not retain direct catalog_sources reads',
  );
  assert(
    sql.includes('create or replace view public.recommendable_catalog_products') &&
      sql.includes('where private.catalog_product_is_servable(p.id)'),
    'the legacy recommendation view must not depend on client access to source-review metadata',
  );
  assert(
    sql.includes("'id', cs.id") &&
      sql.includes("'display_name', cs.display_name") &&
      sql.includes("'source_key', cs.source_key") &&
      sql.includes("'attribution_text', cs.attribution_text") &&
      sql.includes("'attribution_url', cs.attribution_url"),
    'the catalog response must retain the bounded public attribution projection',
  );
});

Deno.test('untrusted correction intake cannot become a cross-user serving hold', async () => {
  const sql = compact(await Deno.readTextFile(servingGateMigrationUrl));

  assert(
    sql.includes("'open', p_description") &&
      sql.includes('operator_reviewed_at') &&
      sql.includes('create or replace function public.review_catalog_correction('),
    'intake must remain open and operator audit evidence must come from a separate review RPC',
  );
  assert(
    sql.includes('revoke insert, update, delete on public.catalog_corrections from service_role') &&
      sql.includes(
        'grant execute on function public.review_catalog_correction(uuid, bigint, text, text, text) to service_role',
      ),
    'even service-role callers must use the audited transition instead of direct correction DML',
  );
  assert(
    sql.includes("tg_table_name = 'catalog_corrections'") &&
      sql.includes("tg_name = 'trg_catalog_corrections_health_write'") &&
      sql.includes('pg_catalog.pg_trigger_depth() > 1') &&
      sql.includes("tg_argv[0] = 'user_id'") &&
      sql.includes("pg_catalog.to_jsonb(old) - 'product_id'") &&
      sql.includes("pg_catalog.to_jsonb(new) - 'product_id'") &&
      sql.includes('from public.products as parent_product'),
    'product rollback may only perform the exact FK-driven correction detach while preserving audit data',
  );
});

Deno.test('catalog lookup Edge handler cannot bypass the atomic eligibility RPC', async () => {
  const source = compact(await Deno.readTextFile(new URL('./index.ts', import.meta.url)));

  assert(
    /admin\.rpc\(catalog_lookup_rpc,\s*\{/.test(source),
    'Edge lookup must invoke the reviewed eligibility RPC',
  );
  assert(source.includes('p_barcode: barcode'), 'the RPC must receive only the normalized barcode');
  assert(!source.includes(".from('products')"), 'Edge lookup must not read products directly');
  assert(
    !source.includes(".from('product_barcodes')"),
    'Edge lookup must not split barcode and product eligibility across reads',
  );
});

Deno.test('catalog lookup has no provider path and preserves manual fallback', async () => {
  const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
  for (const forbidden of [
    'fetchOpenBeautyFacts',
    'fetchWithTimeout',
    'world.openbeautyfacts.org',
    'OBF_API_ENABLED',
    'OBF_USER_AGENT',
    'external_candidate',
  ]) {
    assert(!source.includes(forbidden), `catalog lookup must not contain ${forbidden}`);
  }
  assert(
    source.includes("return json({ result: 'no_match', manualFallback: true });"),
    'an unknown or ineligible local candidate must retain manual entry',
  );
});
