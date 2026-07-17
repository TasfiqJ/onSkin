const catalogFunctions = ['catalog-lookup', 'catalog-search', 'catalog-report'] as const;

const firstSensitiveOperations = {
  'catalog-lookup': [
    'const admin = createClient(supabaseUrl, serviceKey',
    'await enforceRateLimit(',
    'const barcode = await requestBarcode(req)',
  ],
  'catalog-search': [
    'const admin = createClient(supabaseUrl, serviceKey',
    'await enforceRateLimit(',
    'await readLimitedJson(req, maxBodyBytes',
  ],
  'catalog-report': [
    'const parsed = await requestBody(req)',
    'const admin = createClient(supabaseUrl, serviceKey',
    "await admin.rpc('submit_catalog_correction'",
  ],
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertOrdered(source: string, markers: readonly string[], message: string): void {
  let previous = -1;
  for (const marker of markers) {
    const index = source.indexOf(marker, previous + 1);
    assert(index !== -1, `${message}: missing ${marker}`);
    assert(index > previous, `${message}: ${marker} is out of order`);
    previous = index;
  }
}

for (const functionName of catalogFunctions) {
  Deno.test(
    `${functionName} validates, forwards, and permits the health epoch header`,
    async () => {
      const source = await Deno.readTextFile(
        new URL(`../${functionName}/index.ts`, import.meta.url),
      );
      const readIndex = source.indexOf('readHealthProcessingEpochHeader(req.headers)');
      const clientIndex = source.indexOf('const caller = createClient');
      const authIndex = source.indexOf('caller.auth.getUser()');
      const requiredIndex = source.indexOf('HEALTH_PROCESSING_EPOCH_REQUIRED');
      const initialGateIndex = source.indexOf(
        'const initialHealthError = await requireActiveHealthProcessing(',
      );
      assert(readIndex !== -1, `${functionName} must strictly parse the caller epoch`);
      assert(
        clientIndex > readIndex,
        `${functionName} must parse before constructing PostgREST caller`,
      );
      assert(authIndex > clientIndex, `${functionName} must authenticate the bearer`);
      assert(
        requiredIndex > authIndex,
        `${functionName} must preserve 401 precedence, then require epoch`,
      );
      assert(
        initialGateIndex > requiredIndex,
        `${functionName} must authorize active consent after auth and the required epoch`,
      );
      for (const operation of firstSensitiveOperations[functionName]) {
        const operationIndex = source.indexOf(operation);
        assert(operationIndex !== -1, `${functionName} sensitive operation must remain detectable`);
        assert(
          initialGateIndex < operationIndex,
          `${functionName} must preflight active consent before ${operation}`,
        );
      }
      assert(
        source.includes('healthProcessingCallerHeaders(authHeader, healthProcessingEpoch)'),
        `${functionName} must forward only the validated epoch`,
      );
      assert(
        source.includes('content-type, x-health-processing-epoch'),
        `${functionName} CORS must allow the epoch header`,
      );
      assert(
        source.includes('preflightActiveHealthProcessing(caller, userId, epoch)'),
        `${functionName} must use the shared authoritative status preflight`,
      );
    },
  );
}

Deno.test(
  'catalog lookup rechecks each awaited catalog boundary before using its result',
  async () => {
    const source = await Deno.readTextFile(new URL('../catalog-lookup/index.ts', import.meta.url));
    assertOrdered(
      source,
      [
        'const initialHealthError = await requireActiveHealthProcessing(',
        'const rateLimitError = await enforceRateLimit(',
        'const bodyHealthError = await requireActiveHealthProcessing(',
        'const barcode = await requestBarcode(req)',
        'const catalogHealthError = await requireActiveHealthProcessing(',
        'await admin.rpc(CATALOG_LOOKUP_RPC',
        'const persistHealthError = await requireActiveHealthProcessing(',
        ".from('catalog_lookup_events')",
        "return json({ result: 'matched'",
      ],
      'catalog lookup local-match gate order',
    );
  },
);

Deno.test('catalog search rechecks after body and admin work before persistence', async () => {
  const source = await Deno.readTextFile(new URL('../catalog-search/index.ts', import.meta.url));
  assertOrdered(
    source,
    [
      'const initialHealthError = await requireActiveHealthProcessing(',
      'const rateLimitError = await enforceRateLimit(',
      'const bodyHealthError = await requireActiveHealthProcessing(',
      'const parsed = await readLimitedJson(',
      'const searchHealthError = await requireActiveHealthProcessing(',
      'await admin.rpc(CATALOG_SEARCH_RPC',
      'const persistHealthError = await requireActiveHealthProcessing(',
      ".from('catalog_lookup_events')",
    ],
    'catalog search gate order',
  );
  assertOrdered(
    source,
    [
      'const parsed = await readLimitedJson(',
      'const responseHealthError = await requireActiveHealthProcessing(',
      "return json({ result: 'too_short'",
    ],
    'catalog search short-query response gate order',
  );
});

Deno.test(
  'catalog report rechecks after body work and relies on atomic service-RPC admission',
  async () => {
    const source = await Deno.readTextFile(new URL('../catalog-report/index.ts', import.meta.url));
    assertOrdered(
      source,
      [
        'const initialHealthError = await requireActiveHealthProcessing(',
        'const parsed = await requestBody(req)',
        'const persistHealthError = await requireActiveHealthProcessing(',
        'const admin = createClient(supabaseUrl, serviceKey',
        "await admin.rpc('submit_catalog_correction'",
        'noteSuppressedObfContributionRequest(correctionType)',
        'const responseHealthError = await requireActiveHealthProcessing(',
        "return json({ result: 'reported'",
      ],
      'catalog report gate order',
    );
    assert(
      source.includes('headers: { [HEALTH_PROCESSING_EPOCH_HEADER]: healthProcessingEpoch }'),
      'catalog report must forward the exact caller epoch to the service RPC trigger.',
    );
    assert(
      !source.includes("from('catalog_corrections')"),
      'catalog report must not retain direct correction-table DML.',
    );
  },
);

Deno.test(
  'catalog lookup keeps misses local and rechecks before manual fallback persistence',
  async () => {
    const source = await Deno.readTextFile(new URL('../catalog-lookup/index.ts', import.meta.url));
    for (const forbidden of [
      'fetchOpenBeautyFacts',
      'fetchWithTimeout',
      'world.openbeautyfacts.org',
      'OBF_API_ENABLED',
      'external_candidate',
    ]) {
      assert(!source.includes(forbidden), `catalog lookup must not contain ${forbidden}`);
    }
    assertOrdered(
      source,
      [
        'await admin.rpc(CATALOG_LOOKUP_RPC',
        'const fallbackHealthError = await requireActiveHealthProcessing(',
        ".from('catalog_lookup_events')",
        "return json({ result: 'no_match', manualFallback: true });",
      ],
      'catalog lookup manual-fallback gate order',
    );
  },
);

for (const functionName of ['catalog-lookup', 'catalog-search'] as const) {
  Deno.test(`${functionName} does not ignore guarded event-insert failures`, async () => {
    const source = (
      await Deno.readTextFile(new URL(`../${functionName}/index.ts`, import.meta.url))
    ).replace(/\s+/g, ' ');
    assert(
      /const \{ error: eventError \} = await caller\.from\(["']catalog_lookup_events["']\)/.test(
        source,
      ),
      `${functionName} must capture the trigger-protected insert result`,
    );
    assert(
      source.includes('if (eventError) {'),
      `${functionName} must fail when the insert is rejected`,
    );
    assert(
      source.includes('return withdrawalError ?? json('),
      `${functionName} must map a raced withdrawal without hiding unrelated database failures`,
    );
  });
}
