import {
  allowedContextKeys,
  allowedPayloadKeys,
  allowedTopLevelKeys,
  catalogReportIdentityError,
  correctionTypes,
  normalizeBarcode,
  normalizeProductId,
  normalizeReportRequestId,
  safeString,
  safeUrl,
  sanitizeObject,
  validateAllowedKeys,
} from './privacy.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('catalog-report privacy contract keeps request fields allowlisted', () => {
  assert(correctionTypes.has('wrong_match'), 'wrong_match correction type should be supported.');
  assert(
    correctionTypes.has('missing_product'),
    'missing_product correction type should be supported.',
  );
  assert(
    validateAllowedKeys(
      {
        reportRequestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        correctionType: 'wrong_match',
        productId: '00000000-0000-4000-8000-000000000000',
        barcode: '012345678905',
        description: 'Wrong match from product detail',
        proposedPayload: {},
        clientContext: {},
      },
      allowedTopLevelKeys,
    ),
    'expected known top-level report fields to pass.',
  );
  assert(
    !validateAllowedKeys(
      { correctionType: 'wrong_match', freeText: 'private note' },
      allowedTopLevelKeys,
    ),
    'unexpected top-level free text must fail.',
  );
});

Deno.test('catalog-report requires a random UUID report request identity', () => {
  assert(
    normalizeReportRequestId(' AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA ') ===
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a version-4 UUID should normalize for replay-safe intake.',
  );
  assert(
    normalizeReportRequestId('aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa') === null,
    'non-random UUID versions must not become report request identities.',
  );
  assert(normalizeReportRequestId(null) === null, 'a request identity is mandatory.');
});

Deno.test('catalog-report privacy contract normalizes only non-personal product fields', () => {
  const sanitized = sanitizeObject(
    {
      productName: '  Photoderm   Aquafluide  ',
      brand: 'Image Skincare',
      sourceUrl: 'https://openbeautyfacts.example/products/012345678905?token=secret#review',
      ingredientsText: 'Aqua, Glycerin, Niacinamide',
      qualityIssue: 'photo shows a diagnosis and user email',
      defaultPaoMonths: Number.NaN,
    },
    allowedPayloadKeys,
    'invalid_proposed_payload',
  );

  assert(sanitized.errorCode === null, 'known product payload keys should not error.');
  assert(
    sanitized.value.productName === 'Photoderm Aquafluide',
    'safe product names should be normalized.',
  );
  assert(
    sanitized.value.brand === 'Image Skincare',
    'catalog words that resemble media labels must not be mistaken for private images.',
  );
  assert(
    sanitized.value.sourceUrl === 'https://openbeautyfacts.example/products/012345678905',
    'source URLs should drop query strings and fragments.',
  );
  assert(
    sanitized.value.ingredientsText === 'Aqua, Glycerin, Niacinamide',
    'safe ingredient text should stay.',
  );
  assert(!('qualityIssue' in sanitized.value), 'sensitive support text must be dropped.');
  assert(!('defaultPaoMonths' in sanitized.value), 'non-finite numbers must be dropped.');
});

Deno.test('catalog-report privacy contract rejects unexpected nested shapes', () => {
  const context = sanitizeObject(
    { route: 'shelf_detail', shelfProductId: 'local-private-id' },
    allowedContextKeys,
    'invalid_client_context',
  );
  assert(
    context.errorCode === 'invalid_client_context',
    'unexpected context keys should be rejected.',
  );

  const arrayPayload = sanitizeObject([], allowedPayloadKeys, 'invalid_proposed_payload');
  assert(
    arrayPayload.errorCode === 'invalid_proposed_payload',
    'array payloads should be rejected.',
  );

  const duplicateBarcode = sanitizeObject(
    { productName: 'Known product', barcode: 'lot-serial-123' },
    allowedPayloadKeys,
    'invalid_proposed_payload',
  );
  assert(
    duplicateBarcode.errorCode === 'invalid_proposed_payload',
    'proposed payload must not create a second unvalidated barcode lane.',
  );
});

Deno.test(
  'catalog-report privacy contract rejects direct sensitive scalars and credentials',
  () => {
    assert(
      safeString('file:///var/mobile/private-photo.jpg', 200) === null,
      'local photo paths must be rejected.',
    );
    assert(
      safeString('user email test@example.com', 200) === null,
      'email-like support text must be rejected.',
    );
    assert(
      safeString('pregnancy medication concern', 200) === null,
      'health-inference text must be rejected.',
    );
    assert(
      safeUrl('https://user:pass@example.com/catalog') === null,
      'credentialed URLs must be rejected.',
    );
  },
);

Deno.test('catalog-report privacy contract normalizes barcodes conservatively', () => {
  assert(
    normalizeBarcode(' 012-345-678-905 ') === '012345678905',
    'barcode digits should normalize.',
  );
  assert(normalizeBarcode('1234567') === null, 'short barcodes should be rejected.');
  assert(normalizeBarcode('123456789012345') === null, 'long barcodes should be rejected.');
  assert(
    normalizeBarcode('lot 012345678905') === null,
    'letters must not be silently stripped from a supplied barcode.',
  );
  assert(
    normalizeBarcode('012345/678905') === null,
    'unexpected punctuation must not be silently stripped from a supplied barcode.',
  );
  assert(normalizeBarcode(12345678) === null, 'JSON numbers must not be accepted as barcodes.');
});

Deno.test(
  'catalog-report missing-product identity requires a barcode or bounded product name',
  () => {
    assert(
      catalogReportIdentityError({
        correctionType: 'missing_product',
        productId: null,
        barcode: '012345678905',
        productName: null,
      }) === null,
      'a normalized barcode should identify a missing product.',
    );
    assert(
      catalogReportIdentityError({
        correctionType: 'missing_product',
        productId: null,
        barcode: null,
        productName: 'Unknown sunscreen',
      }) === null,
      'a bounded product name should identify a missing product.',
    );
    for (const productName of ['Photoderm Aquafluide', 'Image Skincare Vital C']) {
      const sanitized = sanitizeObject(
        {
          productName,
          sourceUrl: 'https://catalog.example/products/123?token=private#review',
        },
        allowedPayloadKeys,
        'invalid_proposed_payload',
      );
      assert(sanitized.errorCode === null, `${productName} should sanitize as catalog identity.`);
      assert(
        catalogReportIdentityError({
          correctionType: 'missing_product',
          productId: null,
          barcode: null,
          productName: sanitized.value.productName,
        }) === null,
        `${productName} must remain valid identity after payload sanitization.`,
      );
      assert(
        sanitized.value.sourceUrl === 'https://catalog.example/products/123',
        'Edge URL normalization should match the client disclosure and transport body.',
      );
    }
    assert(
      catalogReportIdentityError({
        correctionType: 'missing_product',
        productId: null,
        barcode: '1234567',
        productName: 'x'.repeat(201),
      }) === 'missing_product_identity_required',
      'invalid barcode and oversized product names must not create empty reports.',
    );
  },
);

Deno.test('catalog-report wrong-match identity requires a valid product UUID and identity', () => {
  const productId = '00000000-0000-4000-8000-000000000100';
  assert(normalizeProductId(` ${productId} `) === productId, 'product UUIDs should normalize.');
  assert(normalizeProductId('catalog-100') === null, 'non-UUID product IDs must be rejected.');
  assert(
    catalogReportIdentityError({
      correctionType: 'wrong_match',
      productId,
      barcode: '012345678905',
      productName: null,
    }) === null,
    'a valid product UUID plus barcode should identify a wrong match.',
  );
  assert(
    catalogReportIdentityError({
      correctionType: 'wrong_match',
      productId,
      barcode: null,
      productName: 'Reviewed catalog serum',
    }) === null,
    'a valid product UUID plus bounded product name should identify a wrong match.',
  );
  assert(
    catalogReportIdentityError({
      correctionType: 'wrong_match',
      productId: 'catalog-100',
      barcode: '012345678905',
      productName: 'Reviewed catalog serum',
    }) === 'wrong_match_product_id_required',
    'wrong-match reports must never accept a non-UUID catalog identity.',
  );
  assert(
    catalogReportIdentityError({
      correctionType: 'wrong_match',
      productId,
      barcode: null,
      productName: null,
    }) === 'wrong_match_identity_required',
    'a product UUID alone is insufficient for wrong-match triage.',
  );
});

Deno.test(
  'catalog-report applies semantic identity validation before its service RPC',
  async () => {
    const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
    const validation = source.indexOf('const identityError = catalogReportIdentityError({');
    const rpc = source.indexOf("admin.rpc('submit_catalog_correction'");
    assert(validation >= 0, 'the Edge handler must invoke catalog report identity validation.');
    assert(
      rpc > validation,
      'identity validation must run before the service-only correction RPC.',
    );
    assert(
      source.includes("return json({ error: 'invalid_product_id' }, 400);"),
      'malformed supplied product IDs must be rejected instead of dropped.',
    );
    assert(
      source.includes("return json({ error: 'invalid_barcode' }, 400);"),
      'malformed supplied barcodes must be rejected instead of dropped.',
    );
    assert(
      source.includes("return json({ error: 'invalid_report_request_id' }, 400);"),
      'missing or malformed report request identities must fail before persistence.',
    );
    assert(
      source.includes('p_report_request_id: reportRequestId'),
      'the validated report request identity must reach the transactional RPC.',
    );
  },
);
