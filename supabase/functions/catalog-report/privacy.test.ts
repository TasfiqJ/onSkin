import {
  allowedContextKeys,
  allowedPayloadKeys,
  allowedTopLevelKeys,
  correctionTypes,
  normalizeBarcode,
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

Deno.test('catalog-report privacy contract normalizes only non-personal product fields', () => {
  const sanitized = sanitizeObject(
    {
      productName: '  Gentle   Cleanser  ',
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
    sanitized.value.productName === 'Gentle Cleanser',
    'safe product names should be normalized.',
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
});
