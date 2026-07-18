import { normalizeCatalogBarcode } from '../_shared/catalogBarcode.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.toLowerCase().replace(/--.*$/gm, ' ').replace(/\s+/g, ' ').trim();
}

const migrationUrl = new URL(
  '../../migrations/20260718000059_catalog_scan_minimization.sql',
  import.meta.url,
);
const rehearsalUrl = new URL(
  '../../../scripts/phase9/catalog-scan-minimization-postgres-rehearsal.sql',
  import.meta.url,
);
const scanLogUrl = new URL('../../../apps/mobile/src/features/shelf/scanLog.ts', import.meta.url);
const exportRegistryUrl = new URL('../data-export/exportRegistry.ts', import.meta.url);
const lookupFunctionUrl = new URL('./index.ts', import.meta.url);
const searchFunctionUrl = new URL('../catalog-search/index.ts', import.meta.url);

Deno.test('CAT-04 purges and seals legacy account-linked raw scan history', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));

  assert(sql.startsWith('begin;'), 'scan minimization must be transactional');
  assert(sql.endsWith('commit;'), 'scan minimization transaction must commit');
  assert(
    sql.includes('lock table public.shelf_scans in access exclusive mode;'),
    'the purge must exclude concurrent legacy scan writes until policy revocation commits',
  );
  assert(sql.includes('delete from public.shelf_scans;'), 'existing raw scan rows must be purged');
  assert(
    sql.indexOf('lock table public.shelf_scans in access exclusive mode;') <
      sql.indexOf('delete from public.shelf_scans;') &&
      sql.indexOf('delete from public.shelf_scans;') <
        sql.indexOf('revoke all on table public.shelf_scans'),
    'the owner migration must lock, purge, and then seal API access in that order',
  );
  for (const policy of [
    'shelf_scans_select_own',
    'shelf_scans_insert_own',
    'shelf_scans_update_own',
    'health_processing_read_fence',
  ]) {
    assert(sql.includes(`drop policy if exists "${policy}"`), `legacy policy ${policy} remains`);
  }
  assert(
    sql.includes(
      'revoke all on table public.shelf_scans from public, anon, authenticated, service_role;',
    ),
    'every API role must be denied direct scan-history access',
  );
});

Deno.test('CAT-04 permanently disables the legacy external-contribution queue', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));

  assert(
    sql.includes('lock table public.obf_contribution_queue in access exclusive mode;') &&
      sql.includes('delete from public.obf_contribution_queue;'),
    'legacy contribution work must be locked and purged during the upgrade',
  );
  assert(
    sql.includes('alter table public.obf_contribution_queue force row level security;') &&
      sql.includes(
        'revoke all on table public.obf_contribution_queue from public, anon, authenticated, service_role;',
      ),
    'the retained compatibility table must be force-RLS sealed from every runtime role',
  );
  assert(
    sql.includes("and policy.tablename = 'obf_contribution_queue'") &&
      sql.includes("'drop policy %i on public.obf_contribution_queue'"),
    'every legacy contribution policy must be removed without relying on a fixed policy list',
  );
  assert(
    sql.includes("'outcome', 'contribution_lane_disabled'") &&
      sql.includes("'enqueued', false") &&
      sql.includes(
        'revoke all on function public.enqueue_obf_contribution_for_correction(uuid) from public, anon, authenticated, service_role;',
      ),
    'legacy enqueue authority must be inert and unavailable to runtime roles',
  );
});

Deno.test('server lookup analytics retain outcome buckets but no catalog identity', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));
  assert(
    sql.includes('update public.catalog_lookup_events set query = null, barcode = null,'),
    'existing lookup identity must be minimized before the constraint is installed',
  );
  for (const column of ['query', 'barcode', 'matched_product_id', 'source_key', 'quality_grade']) {
    assert(
      sql.includes(`${column} is null`),
      `lookup minimization constraint does not prohibit ${column}`,
    );
  }
  assert(
    sql.includes(
      'delete from public.catalog_lookup_events where not pg_catalog.isfinite(created_at)',
    ),
    'future/non-finite legacy lookup timestamps must be purged before rate limiting',
  );
  assert(
    sql.includes('and event.created_at <= v_now'),
    'outcome rate limiting must exclude future timestamps',
  );

  for (const url of [lookupFunctionUrl, searchFunctionUrl]) {
    const source = await Deno.readTextFile(url);
    assert(
      source.includes("admin.rpc('record_catalog_lookup_event'"),
      `${url.pathname} does not use the sealed outcome RPC`,
    );
    assert(
      !/\.from\(['"]catalog_lookup_events['"]\)\.insert/u.test(source),
      `${url.pathname} still performs a direct event insert`,
    );
    const eventCalls = [
      ...source.matchAll(/admin\.rpc\(['"]record_catalog_lookup_event['"],\s*\{([\s\S]*?)\}\)/gu),
    ];
    assert(eventCalls.length > 0, `${url.pathname} no longer records bounded outcomes`);
    const eventArguments = eventCalls.map((match) => match[1] ?? '').join('\n');
    for (const field of [
      'p_query:',
      'p_barcode:',
      'p_matched_product_id:',
      'p_source_key:',
      'p_quality_grade:',
    ]) {
      assert(
        !eventArguments.includes(field),
        `lookup RPC retained prohibited identity field ${field}`,
      );
    }
    assert(eventArguments.includes('p_lookup_type:'), 'lookup outcome omitted its bounded type');
    assert(eventArguments.includes('p_result:'), 'lookup outcome omitted its bounded result');
    assert(
      source.includes('headers: { [HEALTH_PROCESSING_EPOCH_HEADER]: healthProcessingEpoch }'),
      'service RPC client must forward the exact health epoch',
    );
  }
});

Deno.test('server barcode intake rejects lossy or non-string normalization', () => {
  assert(
    normalizeCatalogBarcode(' 012-345-678-905 ') === '012345678905',
    'manual separators should normalize without changing the identifier',
  );
  assert(
    normalizeCatalogBarcode('0036000291452') === '036000291452',
    'leading-zero EAN-13 must canonicalize to the equivalent UPC-A key',
  );
  for (const [padded, canonical] of [
    ['00000096385074', '96385074'],
    ['00012345678905', '012345678905'],
    ['04006381333931', '4006381333931'],
    ['10012345000017', '10012345000017'],
  ]) {
    assert(
      normalizeCatalogBarcode(padded) === canonical,
      `fixed-length GTIN ${padded} did not canonicalize to ${canonical}`,
    );
  }
  assert(
    normalizeCatalogBarcode('lot 012345678905') === null,
    'letters must not be silently deleted from lookup identity',
  );
  assert(
    normalizeCatalogBarcode('012345/678905') === null,
    'unexpected punctuation must not be silently deleted from lookup identity',
  );
  assert(
    normalizeCatalogBarcode(12345678) === null,
    'numeric JSON input can lose leading zeroes and must be rejected',
  );
  assert(normalizeCatalogBarcode('123456789') === null, 'undefined GTIN lengths must fail');
  assert(normalizeCatalogBarcode('012345678906') === null, 'bad GTIN checksums must fail');
});

Deno.test('database serving lanes require checksum-valid canonical GTIN identity', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));
  assert(
    sql.includes('lock table public.products in access exclusive mode;') &&
      sql.includes('lock table public.product_barcodes in access exclusive mode;'),
    'catalog identity remediation must exclude concurrent serving-state writes',
  );
  assert(
    sql.includes("set status = 'blocked', review_status = 'blocked', quality_grade = 'blocked'") &&
      sql.includes("set review_status = 'blocked'"),
    'pre-existing invalid reviewed catalog identity must fail closed',
  );
  for (const constraint of [
    'products_reviewed_active_barcode_gtin',
    'product_barcodes_reviewed_barcode_gtin',
  ]) {
    assert(sql.includes(`add constraint ${constraint} check`), `${constraint} is missing`);
  }
  assert(
    sql.includes('create or replace function private.catalog_gtin_is_canonical') &&
      sql.includes('pg_catalog.length(p_value) in (13, 14)') &&
      sql.includes('not private.catalog_gtin_is_canonical(barcode)') &&
      sql.includes('or private.catalog_gtin_is_canonical(barcode)'),
    'reviewed serving constraints must enforce checksum and reject padded GTIN-13/14 identity',
  );
  assert(
    sql.includes("when barcode like '000000%' then pg_catalog.substring(barcode, 7)") &&
      sql.includes("when barcode like '00%' then pg_catalog.substring(barcode, 3)") &&
      sql.includes('else pg_catalog.substring(barcode, 2)'),
    'legacy GTIN-14 aliases must collapse deterministically to GTIN-8, UPC-A, or EAN-13',
  );
});

Deno.test('mobile scan analytics cannot persist raw barcode or product identity', async () => {
  const source = await Deno.readTextFile(scanLogUrl);

  assert(!source.includes("from('shelf_scans')"), 'mobile must not insert legacy scan rows');
  assert(!source.includes('matchedProductId'), 'mobile scan analytics retained product identity');
  assert(!source.includes('barcode:'), 'mobile scan analytics retained a barcode property');
  assert(source.includes("track('barcode_scanned'"), 'bounded funnel measurement disappeared');
  assert(source.includes('result,'), 'bounded result category must remain observable');
});

Deno.test('sealed scan history cannot re-enter the caller data-export registry', async () => {
  const source = await Deno.readTextFile(exportRegistryUrl);
  const callerStart = source.indexOf('export const CALLER_RLS_EXPORT_TABLES');
  const callerEnd = source.indexOf('export const SPECIAL_SERVICE_ROLE_FILTERED_EXPORTS');
  const callerRegistry = source.slice(callerStart, callerEnd);
  const denylistStart = source.indexOf('export const SERVICE_ONLY_EXPORT_DENYLIST');
  const denylistEnd = source.indexOf('export const CALLER_RLS_EXPORT_TABLES');
  const denylist = source.slice(denylistStart, denylistEnd);

  assert(callerStart >= 0 && callerEnd > callerStart, 'export registry boundaries changed');
  assert(
    !/table:\s*["']shelf_scans["']/u.test(callerRegistry),
    'sealed scan history is exportable',
  );
  assert(
    /["']shelf_scans["']/u.test(denylist),
    'export mutation guard does not deny the sealed table',
  );
});

Deno.test('catalog correction identity has one canonical barcode lane', async () => {
  const sql = compact(await Deno.readTextFile(migrationUrl));
  assert(
    !sql.includes('private.catalog_strip_barcode_keys'),
    'hostile legacy JSON must not be traversed with a recursive PL/pgSQL helper',
  );
  assert(
    sql.includes('create or replace function private.catalog_sanitize_report_object') &&
      sql.includes('from pg_catalog.jsonb_each(p_value) as entry(key, value)') &&
      sql.includes('pg_catalog.pg_column_size(p_value) > 4096') &&
      sql.includes("p_kind = 'proposed'") &&
      sql.includes("p_kind = 'context'"),
    'legacy payload remediation must be bounded, top-level-only, and kind-specific',
  );
  for (const key of [
    'productName',
    'brand',
    'category',
    'ingredientsText',
    'sourceUrl',
    'sourceName',
    'defaultPaoMonths',
    'qualityIssue',
    'suggestedCorrection',
    'addedVia',
    'quality',
    'source',
    'platform',
    'appVersion',
    'buildNumber',
    'route',
  ]) {
    assert(
      sql.includes(`'${key.toLowerCase()}'`) || sql.includes(`'${key}'`),
      `${key} allowlist entry is missing`,
    );
  }
  assert(
    sql.includes("description = private.catalog_report_safe_text('description', description)") &&
      sql.includes('proposed_payload = private.catalog_sanitize_report_object(') &&
      sql.includes('client_context = private.catalog_sanitize_report_object(') &&
      sql.includes('add constraint catalog_corrections_description_sanitized check') &&
      sql.includes('add constraint catalog_corrections_payloads_no_barcode check'),
    'legacy rows and future writes must share the same finite sanitization contract',
  );
  assert(
    sql.includes('pg_catalog.strpos(v_value, pg_catalog.chr(92)) > 0'),
    'embedded Windows/local paths must fail closed in every retained text field',
  );
  assert(
    sql.includes('pg_catalog.octet_length(p_value) > v_limit * 4') &&
      sql.indexOf('pg_catalog.octet_length(p_value) > v_limit * 4') <
        sql.indexOf('v_value := pg_catalog.regexp_replace'),
    'unbounded legacy text must be rejected before whitespace normalization allocates a copy',
  );
  assert(
    sql.includes('not private.catalog_gtin_is_canonical(p_barcode)'),
    'sealed correction intake must checksum-validate and canonicalize its top-level GTIN',
  );
  assert(
    !sql.includes("'productname', 'brand', 'barcode', 'category'"),
    'sealed correction intake must not allowlist a nested barcode',
  );

  const rehearsal = await Deno.readTextFile(rehearsalUrl);
  assert(
    rehearsal.includes('for v_index in 1..96 loop') &&
      rehearsal.includes(String.raw`C:\\Users\\name\\photo.jpg`) &&
      rehearsal.includes("pg_catalog.repeat('D', 100000)") &&
      rehearsal.includes('unbounded legacy correction text or JSON did not fail closed') &&
      rehearsal.includes('deeply nested legacy correction was not minimized nonrecursively'),
    'PostgreSQL rehearsal must cover deep JSON and an embedded Windows-path legacy value',
  );
});
