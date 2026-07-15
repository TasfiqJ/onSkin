function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ');
}

Deno.test(
  'catalog-report suppresses OBF queueing until the RPC has an atomic health epoch guard',
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
      !source.includes('readSupabaseSecretKey'),
      'the disabled contribution lane must not retain a service-role client.',
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
  'catalog-report deployment does not require a service secret for a disabled lane',
  async () => {
    const manifest = JSON.parse(
      await Deno.readTextFile(new URL('../manifest.json', import.meta.url)),
    ) as {
      functions?: Record<string, { requiredSecrets?: unknown[]; optionalEnvironment?: unknown[] }>;
    };
    const definition = manifest.functions?.['catalog-report'];
    assert(definition !== undefined, 'catalog-report must remain in the Edge manifest.');
    assert(
      Array.isArray(definition.requiredSecrets) && definition.requiredSecrets.length === 0,
      'suppressed contribution-back must not retain an unused service-role credential.',
    );
    assert(
      definition.optionalEnvironment?.includes('OBF_CONTRIBUTION_ENABLED') === true,
      'the legacy flag must remain declared while it emits the explicit suppression warning.',
    );
  },
);
