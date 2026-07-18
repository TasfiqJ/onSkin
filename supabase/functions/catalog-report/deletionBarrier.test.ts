function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ');
}

Deno.test(
  'catalog-report confines serving-control correction intake to its health-bound service RPC',
  async () => {
    const source = compact(await Deno.readTextFile(new URL('./index.ts', import.meta.url)));
    assert(
      source.includes('service-role enqueue RPC does not accept an'),
      'the source must explain why the optional contribution lane is disabled.',
    );
    assert(
      !source.includes('enqueue_obf_contribution_for_correction'),
      'an Edge preflight cannot make the legacy service-role enqueue RPC withdrawal-safe.',
    );
    assert(
      !source.includes("from('obf_contribution_queue')"),
      'catalog-report must not mutate the contribution queue directly.',
    );
    assert(
      source.includes('readSupabaseSecretKey') &&
        source.includes("await admin.rpc('submit_catalog_correction'") &&
        source.includes('p_report_request_id: reportRequestId') &&
        !source.includes("from('catalog_corrections')"),
      'the service credential must be used only through the guarded correction RPC, never direct table DML.',
    );
  },
);

Deno.test(
  'catalog-report makes feature-flag suppression explicit and preserves correction reporting',
  async () => {
    const source = compact(await Deno.readTextFile(new URL('./index.ts', import.meta.url)));
    assert(
      source.includes('Deno.env.get(') &&
        source.includes('OBF_CONTRIBUTION_ENABLED') &&
        source.includes('correctionType ==='),
      'an accidentally enabled legacy flag must take the explicit suppression path.',
    );
    assert(
      source.includes('console.warn(') &&
        source.includes('[catalog-report]') &&
        source.includes('obf_contribution_enqueue_disabled_health_guard_required'),
      'suppression should use one stable, non-sensitive operational log code.',
    );
    assert(
      source.includes('return json({ result:') &&
        source.includes('reported') &&
        source.includes('correction'),
      'correction reporting must remain successful while contribution-back is suppressed.',
    );
  },
);

Deno.test(
  'catalog-report deployment requires one hosted-compatible service secret tuple for correction intake',
  async () => {
    const manifest = JSON.parse(
      await Deno.readTextFile(new URL('../manifest.json', import.meta.url)),
    ) as {
      functions?: Record<string, { requiredSecrets?: unknown[]; optionalEnvironment?: unknown[] }>;
    };
    const definition = manifest.functions?.['catalog-report'];
    assert(definition !== undefined, 'catalog-report must remain in the Edge manifest.');
    assert(
      JSON.stringify(definition.requiredSecrets) ===
        JSON.stringify([
          ['SUPABASE_SECRET_KEYS', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
        ]),
      'the guarded correction RPC must resolve exactly one supported service-key source.',
    );
    assert(
      definition.optionalEnvironment?.includes('OBF_CONTRIBUTION_ENABLED') === true,
      'the legacy flag must remain declared while it emits the explicit suppression warning.',
    );
  },
);
