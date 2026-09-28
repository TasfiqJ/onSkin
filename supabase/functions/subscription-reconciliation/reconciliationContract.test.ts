function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const indexUrl = new URL('./index.ts', import.meta.url);
const coreUrl = new URL('./reconciliationCore.ts', import.meta.url);
const configUrl = new URL('../../config.toml', import.meta.url);
const manifestUrl = new URL('../manifest.json', import.meta.url);
const migrationUrl = new URL(
  '../../migrations/20260714000053_entitlement_authority_lanes.sql',
  import.meta.url,
);

Deno.test(
  'subscription reconciliation derives its subject and rejects all request fields',
  async () => {
    const source = await Deno.readTextFile(indexUrl);
    assert(source.includes('admin.auth.getUser(token)'), 'JWT subject validation is missing.');
    assert(
      source.includes('Object.keys(parsed).length !== 0') &&
        source.includes("{ error: 'unexpected_input' }"),
      'the endpoint must reject every caller field, including a subject or timestamp.',
    );
    assert(
      source.includes('buildRevenueCatCustomerInfoRequest(userId, revenueCatSecretKey)'),
      'the provider request is not bound to the authenticated user.',
    );
    assert(
      source.includes('[200, 201].includes(providerResponse.status)'),
      'RevenueCat get-or-create success statuses are not both accepted.',
    );
    assert(
      /admin\.rpc\(\s*'reconcile_revenuecat_entitlement_snapshot'\s*,\s*snapshot\s*,?\s*\)/.test(
        source,
      ),
      'the provider-derived snapshot is not sent to the service-only RPC.',
    );
  },
);

Deno.test('subscription reconciliation recognizes only fresh RevenueCat request_date', async () => {
  const source = await Deno.readTextFile(coreUrl);
  assert(source.includes('body.request_date'), 'provider request_date is missing.');
  assert(!source.includes('body.requestDate'), 'camel-case requestDate must not become authority.');
  assert(!source.includes('body.observedAt'), 'v2 observedAt must not become authority.');
  assert(
    source.includes("'REVENUECAT_CUSTOMER_INFO_STALE'") &&
      source.includes('requestDate.milliseconds < nowMs - maxSnapshotAgeMs'),
    'cache-affected provider snapshots must be bounded by freshness.',
  );
  assert(
    source.includes("if (normalized === 'PROMOTIONAL') return 'promotional'") &&
      !source.includes("return 'app_granted'"),
    'RevenueCat promotional access must not enter the local app-grant lane.',
  );
});

Deno.test('subscription reconciliation is deployed, authenticated, and secret-bound', async () => {
  const config = await Deno.readTextFile(configUrl);
  const manifest = JSON.parse(await Deno.readTextFile(manifestUrl));
  const definition = manifest.functions?.['subscription-reconciliation'];
  assert(
    config.includes('[functions.subscription-reconciliation]') &&
      /\[functions\.subscription-reconciliation\][\s\S]*?verify_jwt\s*=\s*true/.test(config),
    'Supabase config must verify reconciliation JWTs.',
  );
  assert(definition?.deployByDefault === true, 'reconciliation must deploy by default.');
  assert(definition?.access === 'authenticated', 'reconciliation must be authenticated-only.');
  assert(
    JSON.stringify(definition.requiredSecrets).includes('REVENUECAT_SECRET_API_KEY'),
    'the server-only RevenueCat v1 key must be declared.',
  );
});

Deno.test('snapshot RPC cannot be called by a client role', async () => {
  const migration = await Deno.readTextFile(migrationUrl);
  assert(
    /revoke all on function public\.reconcile_revenuecat_entitlement_snapshot\([\s\S]*?\) from public, anon, authenticated, service_role;/.test(
      migration,
    ),
    'snapshot RPC default/client privileges are not revoked.',
  );
  assert(
    /grant execute on function public\.reconcile_revenuecat_entitlement_snapshot\([\s\S]*?\) to service_role;/.test(
      migration,
    ),
    'snapshot RPC must be service-role-only.',
  );
  assert(
    /v_account_scope := p_scope in \([\s\S]*?'subscription-reconciliation'[\s\S]*?\);/.test(
      migration,
    ) &&
      /edge_rate_limits_scope_owner_classification[\s\S]*?'subscription-reconciliation'/.test(
        migration,
      ),
    'reconciliation must have an owner-scoped, deletion-fenced rate-limit bucket.',
  );
});
