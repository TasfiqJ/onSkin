import {
  ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES,
  APPLE_MANUAL_REVOCATION_INSTRUCTION,
  APPLE_MANUAL_REVOCATION_URL,
  appleManualRevocationOutcome,
  appleRevocationFailureCode,
  attestAppleTokenExchange,
  attestAppleTokenRevocation,
  buildPostHogBulkDeleteRequest,
  buildRevenueCatDeletionRequest,
  normalizePostHogApiHost,
  planAppleDeletion,
  postHogDeletionRequiredForEnvironment,
  postHogDeletionDisposition,
  pseudonymousUserId,
  requireAppleRevocationConfiguration,
  resolveAppleAutomaticRevocation,
  revenueCatDeletionDisposition,
} from './providerDeletion.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function assertThrowsCode(operation: () => unknown, code: string): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof Error, 'expected an Error.');
    assert(error.message === code, `expected ${code}, received ${error.message}.`);
    return;
  }
  throw new Error(`expected ${code} rejection.`);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';

Deno.test('Apple-linked deletion without a usable code continues with manual instructions', () => {
  const expected = {
    action: 'manual_revocation',
    outcome: {
      status: 'manual_revocation_required',
      reason: 'credential_unavailable',
      instruction: APPLE_MANUAL_REVOCATION_INSTRUCTION,
      instruction_url: APPLE_MANUAL_REVOCATION_URL,
    },
  };

  for (const code of [undefined, null, '', '   ', 7, {}, []]) {
    const plan = planAppleDeletion(true, code);
    assertDeepEqual(plan, expected, `expected ${JSON.stringify(code)} to use manual revocation.`);
    assert(
      plan.action === 'manual_revocation' && plan.outcome.status === 'manual_revocation_required',
      'manual fallback must never claim that Apple revocation succeeded.',
    );
  }
  assert(
    APPLE_MANUAL_REVOCATION_URL === 'https://support.apple.com/en-us/102571',
    'manual fallback must use the Apple destination cited by TN3194.',
  );
});

Deno.test('Apple deletion attempts automatic revocation only with an exact fresh code', () => {
  assertDeepEqual(
    planAppleDeletion(true, 'fresh-authorization-code'),
    { action: 'attempt_revocation', authorizationCode: 'fresh-authorization-code' },
    'expected an Apple-linked account with a code to attempt revocation.',
  );
  assertDeepEqual(
    planAppleDeletion(true, ' fresh-authorization-code '),
    {
      action: 'manual_revocation',
      outcome: {
        status: 'manual_revocation_required',
        reason: 'credential_unavailable',
        instruction: APPLE_MANUAL_REVOCATION_INSTRUCTION,
        instruction_url: APPLE_MANUAL_REVOCATION_URL,
      },
    },
    'whitespace-wrapped provider material must not be sent to Apple.',
  );
  assertDeepEqual(
    planAppleDeletion(false, 'unexpected-code'),
    { action: 'skip', outcome: { status: 'not_linked' } },
    'a non-Apple account must not send a supplied code to Apple.',
  );
});

Deno.test('Apple automatic revocation requires the explicit client identifier', () => {
  assertDeepEqual(
    requireAppleRevocationConfiguration({
      teamId: 'TEAM123',
      keyId: 'KEY123',
      clientId: 'com.example.explicit-client',
      nativeBundleId: 'com.example.explicit-client',
      privateKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
    }),
    {
      teamId: 'TEAM123',
      keyId: 'KEY123',
      clientId: 'com.example.explicit-client',
      privateKey: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
    },
    'expected the explicit Apple revocation configuration.',
  );

  for (const input of [
    {
      teamId: 'TEAM123',
      keyId: 'KEY123',
      privateKey: 'private-key',
      serviceId: 'legacy-service-fallback',
      bundleId: 'legacy-bundle-fallback',
    },
    { teamId: 'TEAM123', keyId: 'KEY123', clientId: '', privateKey: 'private-key' },
    {
      teamId: 'TEAM123',
      keyId: 'KEY123',
      clientId: '   ',
      nativeBundleId: 'com.example.explicit-client',
      privateKey: 'private-key',
    },
    {
      teamId: 'TEAM123',
      keyId: 'KEY123',
      clientId: ' com.example.not-exact ',
      nativeBundleId: 'com.example.not-exact',
      privateKey: 'private-key',
    },
  ]) {
    assertThrowsCode(
      () => requireAppleRevocationConfiguration(input),
      'APPLE_REVOCATION_NOT_CONFIGURED',
    );
  }

  assertThrowsCode(
    () =>
      requireAppleRevocationConfiguration({
        teamId: 'TEAM123',
        keyId: 'KEY123',
        clientId: 'com.example.wrong-client',
        nativeBundleId: 'com.example.native-app',
        privateKey: 'private-key',
      }),
    'APPLE_REVOCATION_CLIENT_ID_MISMATCH',
  );
});

Deno.test(
  'Apple automatic-revocation failure falls back truthfully without leaking details',
  async () => {
    assertDeepEqual(
      appleManualRevocationOutcome('automatic_revocation_failed'),
      {
        status: 'manual_revocation_required',
        reason: 'automatic_revocation_failed',
        instruction: APPLE_MANUAL_REVOCATION_INSTRUCTION,
        instruction_url: APPLE_MANUAL_REVOCATION_URL,
      },
      'failed automatic revocation must direct the caller to manual removal.',
    );

    const secretProviderBody = 'secret-provider-response-and-authorization-code';
    assert(
      appleRevocationFailureCode(
        new Error(`APPLE_TOKEN_REVOKE_FAILED:400:${secretProviderBody}`),
      ) === 'APPLE_TOKEN_REVOKE_FAILED',
      'known failures must be reduced to a stable code.',
    );
    assert(
      appleRevocationFailureCode(new Error(secretProviderBody)) === 'APPLE_REVOCATION_FAILED',
      'unknown failures must be reduced to a generic stable code.',
    );
    assert(
      !JSON.stringify(appleManualRevocationOutcome('automatic_revocation_failed')).includes(
        secretProviderBody,
      ),
      'the caller-facing outcome must contain no provider failure detail.',
    );

    assertDeepEqual(
      await resolveAppleAutomaticRevocation(async () => undefined),
      { outcome: { status: 'revoked' }, warningCode: null },
      'only a completed attested attempt may report revoked.',
    );
    for (const failure of [
      'APPLE_REVOCATION_NOT_CONFIGURED',
      'APPLE_REVOCATION_CLIENT_ID_MISMATCH',
      'APPLE_TOKEN_EXCHANGE_FAILED',
      'APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN',
      'APPLE_TOKEN_REVOKE_FAILED',
    ]) {
      const resolution = await resolveAppleAutomaticRevocation(async () => {
        throw new Error(`${failure}:${secretProviderBody}`);
      });
      assertDeepEqual(
        resolution,
        {
          outcome: {
            status: 'manual_revocation_required',
            reason: 'automatic_revocation_failed',
            instruction: APPLE_MANUAL_REVOCATION_INSTRUCTION,
            instruction_url: APPLE_MANUAL_REVOCATION_URL,
          },
          warningCode: failure,
        },
        `${failure} must fall back without withholding account deletion.`,
      );
      assert(
        !JSON.stringify(resolution).includes(secretProviderBody),
        `${failure} must not expose provider detail.`,
      );
    }
  },
);

Deno.test('Apple automatic revocation accepts only exact documented 200 attestations', () => {
  assertDeepEqual(
    attestAppleTokenExchange(200, {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    }),
    { token: 'refresh-token', tokenTypeHint: 'refresh_token' },
    'a refresh token from an exact 200 must be preferred for revocation.',
  );
  assertDeepEqual(
    attestAppleTokenExchange(200, { access_token: 'access-token' }),
    { token: 'access-token', tokenTypeHint: 'access_token' },
    'an access token from an exact 200 may be revoked when no refresh token exists.',
  );
  attestAppleTokenRevocation(200);

  for (const status of [0, 199, 201, 202, 204, 299, 400, 500]) {
    assertThrowsCode(
      () => attestAppleTokenExchange(status, { refresh_token: 'must-not-be-trusted' }),
      'APPLE_TOKEN_EXCHANGE_FAILED',
    );
    assertThrowsCode(() => attestAppleTokenRevocation(status), 'APPLE_TOKEN_REVOKE_FAILED');
  }

  for (const body of [
    undefined,
    null,
    [],
    {},
    { refresh_token: '' },
    { refresh_token: '   ' },
    { refresh_token: 7 },
    { access_token: '' },
    { access_token: ' access-token ' },
  ]) {
    assertThrowsCode(
      () => attestAppleTokenExchange(200, body),
      'APPLE_TOKEN_EXCHANGE_RETURNED_NO_TOKEN',
    );
  }
});

Deno.test(
  'RevenueCat deletion request uses the documented customer endpoint and bearer key',
  () => {
    const request = buildRevenueCatDeletionRequest('customer/id with spaces', 'revenuecat-secret');
    const headers = new Headers(request.init.headers);

    assert(
      request.url === 'https://api.revenuecat.com/v1/subscribers/customer%2Fid%20with%20spaces',
      'expected an encoded RevenueCat v1 customer path.',
    );
    assert(request.init.method === 'DELETE', 'expected RevenueCat DELETE.');
    assert(request.init.redirect === 'error', 'expected provider redirects to fail closed.');
    assert(headers.get('Authorization') === 'Bearer revenuecat-secret', 'expected bearer auth.');
    assert(headers.get('Accept') === 'application/json', 'expected JSON response negotiation.');
    assert(request.init.body === undefined, 'expected no RevenueCat request body.');
  },
);

Deno.test('RevenueCat deletion accepts only an exact attested 200 response', () => {
  assert(
    revenueCatDeletionDisposition(200, { app_user_id: USER_ID, deleted: true }, USER_ID) ===
      'deleted',
    'expected the documented response to attest deletion.',
  );
  for (const [status, body] of [
    [200, null],
    [200, []],
    [200, {}],
    [200, { deleted: false }],
    [200, { deleted: true }],
    [200, { deleted: 'true' }],
    [200, { deleted: true, app_user_id: 7 }],
    [200, { deleted: true, app_user_id: 'wrong-customer' }],
    [201, { arbitrary: 'success' }],
    [204, { app_user_id: USER_ID, deleted: true }],
    [404, null],
    [404, { app_user_id: USER_ID, deleted: true }],
    [400, { deleted: true }],
    [500, { deleted: true }],
  ] as Array<[number, unknown]>) {
    assert(
      revenueCatDeletionDisposition(status, body, USER_ID) === 'unattested',
      `expected status ${status} body ${JSON.stringify(body)} to fail closed.`,
    );
  }
});

Deno.test(
  'PostHog request uses only the project bulk-delete contract and both known identities',
  async () => {
    const request = await buildPostHogBulkDeleteRequest({
      host: 'https://eu.posthog.com/',
      projectId: 'project/id',
      personalApiKey: 'posthog-secret',
      userId: USER_ID,
    });
    const headers = new Headers(request.init.headers);
    const payload = JSON.parse(String(request.init.body)) as Record<string, unknown>;
    const expectedPseudonym = await pseudonymousUserId(USER_ID);

    assert(
      request.url === 'https://eu.posthog.com/api/projects/project%2Fid/persons/bulk_delete/',
      'expected the documented project endpoint.',
    );
    assert(
      !request.url.includes('/api/environments/'),
      'deprecated environment endpoint remained.',
    );
    assert(request.init.method === 'POST', 'expected PostHog POST.');
    assert(request.init.redirect === 'error', 'expected provider redirects to fail closed.');
    assert(headers.get('Authorization') === 'Bearer posthog-secret', 'expected bearer auth.');
    assert(headers.get('Content-Type') === 'application/json', 'expected JSON request content.');
    assert(headers.get('Accept') === 'application/json', 'expected JSON response negotiation.');
    assertDeepEqual(
      payload,
      {
        distinct_ids: [expectedPseudonym, USER_ID],
        delete_events: true,
        delete_recordings: true,
      },
      'expected the exact minimized PostHog deletion request.',
    );
    assert(
      /^u_[0-9a-f]{32}$/.test(expectedPseudonym),
      'expected the pseudonymous current identity.',
    );
    assert(
      expectedPseudonym !== USER_ID,
      'the current identity must differ from the legacy raw id.',
    );
  },
);

Deno.test('PostHog API host accepts only the reviewed EU cloud origin', () => {
  assert(
    normalizePostHogApiHost('https://eu.posthog.com') === 'https://eu.posthog.com',
    'expected the exact EU API origin.',
  );
  assert(
    normalizePostHogApiHost('https://EU.POSTHOG.COM/') === 'https://eu.posthog.com',
    'expected URL parsing to canonicalize the reviewed origin.',
  );

  for (const host of [
    'http://eu.posthog.com',
    'https://us.posthog.com',
    'https://eu.i.posthog.com',
    'https://eu.posthog.com.evil.example',
    'https://eu.posthog.com@evil.example',
    'https://username@eu.posthog.com',
    'https://eu.posthog.com/api',
    'https://eu.posthog.com/?redirect=https://evil.example',
    'https://eu.posthog.com/#fragment',
    ' https://eu.posthog.com',
    'not-a-url',
  ]) {
    assertThrowsCode(() => normalizePostHogApiHost(host), 'POSTHOG_DELETION_NOT_CONFIGURED');
  }
});

Deno.test('PostHog deletion cannot silently skip in staging or production', () => {
  for (const appEnvironment of ['staging', 'production', ' preview ', ' PRODUCTION ']) {
    assert(
      postHogDeletionRequiredForEnvironment({ appEnvironment }),
      `${appEnvironment} must require PostHog deletion even when provider settings drift out.`,
    );
  }
  assert(
    postHogDeletionRequiredForEnvironment({
      appEnvironment: 'development',
      publicAppEnvironment: 'production',
    }),
    'a production public environment must not be hidden by a conflicting development label.',
  );
  for (const configured of [
    { mobileKey: 'phc_project_key' },
    { projectId: '12345' },
    { personalApiKey: 'phx_person_write_key' },
  ]) {
    assert(
      postHogDeletionRequiredForEnvironment({ appEnvironment: 'development', ...configured }),
      'any configured PostHog signal must require deletion.',
    );
  }
  assert(
    !postHogDeletionRequiredForEnvironment({ appEnvironment: 'development' }),
    'an explicit provider-free development environment may skip PostHog deletion.',
  );
  assert(
    !postHogDeletionRequiredForEnvironment({}),
    'a provider-free local test environment may skip PostHog deletion.',
  );
});

Deno.test('PostHog classifies only an exact typed 202 as absent or queued', () => {
  const valid = {
    persons_found: 1,
    persons_deleted: 1,
    events_queued_for_deletion: true,
    recordings_queued_for_deletion: true,
    deletion_errors: [],
  };
  assert(
    postHogDeletionDisposition(202, valid) === 'queued',
    'expected the fully attested queue response.',
  );
  const { deletion_errors: _omitted, ...withoutErrors } = valid;
  assert(
    postHogDeletionDisposition(202, withoutErrors) === 'queued',
    'expected the optional deletion_errors field to be omittable.',
  );
  assert(
    postHogDeletionDisposition(202, {
      persons_found: 0,
      persons_deleted: 0,
      events_queued_for_deletion: false,
      recordings_queued_for_deletion: false,
    }) === 'already_absent',
    'expected zero matched persons to be an idempotent absence without queue work.',
  );
  assert(
    postHogDeletionDisposition(202, {
      persons_found: 0,
      persons_deleted: 0,
      events_queued_for_deletion: true,
      recordings_queued_for_deletion: true,
    }) === 'queued',
    'zero matched person rows must still wait when event and recording deletion was queued.',
  );

  const invalid: Array<[number, unknown]> = [
    [200, valid],
    [201, valid],
    [204, valid],
    [202, null],
    [202, []],
    [202, {}],
    [202, { ...valid, persons_found: 0, persons_deleted: 1 }],
    [
      202,
      {
        persons_found: 0,
        persons_deleted: 0,
        events_queued_for_deletion: true,
        recordings_queued_for_deletion: false,
      },
    ],
    [202, { ...valid, persons_found: -1, persons_deleted: -1 }],
    [202, { ...valid, persons_found: 1.5, persons_deleted: 1.5 }],
    [
      202,
      {
        ...valid,
        persons_found: Number.MAX_SAFE_INTEGER + 1,
        persons_deleted: Number.MAX_SAFE_INTEGER + 1,
      },
    ],
    [202, { ...valid, persons_found: '1', persons_deleted: 1 }],
    [202, { ...valid, persons_found: 2, persons_deleted: 1 }],
    [202, { ...valid, events_queued_for_deletion: false }],
    [202, { ...valid, recordings_queued_for_deletion: false }],
    [202, { ...valid, deletion_errors: [{ person_uuid: 'provider-detail' }] }],
    [202, { ...valid, deletion_errors: null }],
    [202, { ...valid, deletion_errors: 'none' }],
    [202, { ...valid, events_queued_for_deletion: undefined }],
    [202, { ...valid, recordings_queued_for_deletion: undefined }],
  ];

  for (const [status, body] of invalid) {
    assert(
      postHogDeletionDisposition(status, body) === 'unattested',
      `expected status ${status} body ${JSON.stringify(body)} to fail closed.`,
    );
  }
});

Deno.test('provider deletion responses use a small fixed body limit', () => {
  assert(
    ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES > 0 &&
      ACCOUNT_DELETION_PROVIDER_RESPONSE_MAX_BYTES <= 32_768,
    'expected a fixed provider response limit no larger than 32 KiB.',
  );
});
