const protectedAuthenticatedFunctions = [
  'catalog-lookup',
  'catalog-report',
  'catalog-search',
  'consent-withdrawal',
  'data-export',
  'subscription-grants',
  'subscription-reconciliation',
] as const;

const firstSensitiveOperation = {
  'catalog-lookup': 'const admin = createClient(supabaseUrl, serviceKey',
  'catalog-report': 'const parsed = await requestBody(req)',
  'catalog-search': 'const admin = createClient(supabaseUrl, serviceKey',
  'consent-withdrawal': 'const parsed = await readLimitedJson(req',
  'data-export': 'const requestBody = await readLimitedJson(req',
  'subscription-grants': 'const parsed = await readLimitedJson(req',
  'subscription-reconciliation': 'const rateLimitResponse = await enforceRateLimit(',
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function count(source: string, marker: string): number {
  return source.split(marker).length - 1;
}

Deno.test(
  'authenticated manifest data functions remain covered by the account access fence',
  async () => {
    const manifest = JSON.parse(
      await Deno.readTextFile(new URL('../manifest.json', import.meta.url)),
    ) as { functions?: Record<string, { access?: unknown }> };
    assert(manifest.functions, 'function manifest is malformed');
    const authenticated = Object.entries(manifest.functions)
      .filter(([, config]) => config.access === 'authenticated')
      .map(([name]) => name)
      .sort();
    const expected = [...protectedAuthenticatedFunctions, 'apple-auth-lifecycle'].sort();
    assert(
      JSON.stringify(authenticated) === JSON.stringify(expected),
      `authenticated manifest surface changed without an account-access decision: ${authenticated.join(',')}`,
    );

    for (const functionName of protectedAuthenticatedFunctions) {
      const source = await Deno.readTextFile(
        new URL(`../${functionName}/index.ts`, import.meta.url),
      );
      const authIndex = Math.max(
        source.indexOf('caller.auth.getUser()'),
        source.indexOf('supabase.auth.getUser(token)'),
        source.indexOf('admin.auth.getUser(token)'),
        source.indexOf('supabase.auth.getUser()'),
      );
      const initialIndex = source.indexOf(
        'const initialAccountAccess = await preflightAccountAccess(',
      );
      const sensitiveIndex = source.indexOf(firstSensitiveOperation[functionName]);
      assert(
        source.includes("from '../_shared/accountAccess.ts'"),
        `${functionName} must import the shared exact-session lifecycle authority`,
      );
      assert(authIndex !== -1, `${functionName} authentication boundary is not detectable`);
      assert(
        initialIndex > authIndex,
        `${functionName} must derive the owner before access preflight`,
      );
      assert(
        sensitiveIndex > initialIndex,
        `${functionName} must preflight before service/data work`,
      );
      assert(
        count(source, 'await requireSameAccountAccess(') >= 2,
        `${functionName} must pin the generation after non-atomic work and before delivery`,
      );
    }
  },
);

Deno.test(
  'bootstrap and deletion escape hatches do not depend on active Apple access',
  async () => {
    for (const functionName of ['apple-auth-lifecycle', 'account-deletion'] as const) {
      const source = await Deno.readTextFile(
        new URL(`../${functionName}/index.ts`, import.meta.url),
      );
      assert(
        !source.includes("from '../_shared/accountAccess.ts'"),
        `${functionName} must remain reachable to establish lifecycle authority or delete a blocked account`,
      );
    }
  },
);

Deno.test(
  'RevenueCat and export delivery are rechecked at their long-lived boundaries',
  async () => {
    const reconciliation = await Deno.readTextFile(
      new URL('../subscription-reconciliation/index.ts', import.meta.url),
    );
    const providerStart = reconciliation.indexOf('const providerAdmissionError');
    const providerFetch = reconciliation.indexOf('await fetchWithTimeout(');
    const providerEnd = reconciliation.indexOf('const providerResponseAccountError');
    const providerBody = reconciliation.indexOf('await readLimitedResponseJson');
    const providerBodyEnd = reconciliation.indexOf('const providerBodyAccountError');
    const projection = reconciliation.indexOf("'reconcile_revenuecat_entitlement_snapshot'");
    const delivery = reconciliation.lastIndexOf('const responseAccountError');
    assert(
      providerStart < providerFetch && providerFetch < providerEnd,
      'RevenueCat fetch must be admitted and rechecked under one generation',
    );
    assert(
      providerEnd < providerBody && providerBody < providerBodyEnd,
      'RevenueCat response-body read must be generation rechecked',
    );
    assert(
      providerBodyEnd < projection && projection < delivery,
      'RevenueCat projection and delivery must remain generation fenced',
    );

    const dataExport = await Deno.readTextFile(new URL('../data-export/index.ts', import.meta.url));
    assert(
      /DATA_EXPORT_PHOTO_URL_TTL_SECONDS',\s*60,\s*30,\s*60/.test(dataExport),
      'photo URL TTL must default to and be capped at 60 seconds',
    );
    assert(
      dataExport.indexOf('const signingAccountError') < dataExport.indexOf('.createSignedUrl(') &&
        dataExport.indexOf('.createSignedUrl(') < dataExport.indexOf('const deliveryAccountError'),
      'signed URLs must be bracketed by account generation checks',
    );
  },
);
