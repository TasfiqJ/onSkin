import {
  adaptAppleRevocationForDeletionStep,
  appleManualRevocationDisposition,
  attestPostHogTerminalDeletion,
  attestRevenueCatV2AlreadyAbsent,
  attestRevenueCatV2Deletion,
  attestRevenueCatV2PreflightSnapshot,
  buildPostHogBulkDeleteRequest,
  buildPostHogDeletionStatusRequest,
  buildPostHogPersonLookupRequest,
  buildRevenueCatV2AliasPageRequest,
  buildRevenueCatV2CustomerLookupRequest,
  buildRevenueCatV2DeleteRequest,
  buildRevenueCatV2ProjectPageRequest,
  buildRevenueCatV2ReconciliationRequests,
  classifyAppleRevokeResponse,
  classifyAppleRevokeTransportFailure,
  classifyPostHogBulkDeleteResponse,
  classifyPostHogBulkDeleteTransportFailure,
  classifyPostHogDeletionStatusResponse,
  classifyPostHogPersonLookupResponse,
  classifyRevenueCatV1DeleteResponse,
  classifyRevenueCatV1TransportFailure,
  classifyRevenueCatV2AliasesReconciliationResponse,
  classifyRevenueCatV2AliasPageResponse,
  classifyRevenueCatV2CustomerLookupResponse,
  classifyRevenueCatV2CustomerReconciliationResponse,
  classifyRevenueCatV2DeleteResponse,
  classifyRevenueCatV2PreflightTransportFailure,
  classifyRevenueCatV2ProjectPageResponse,
  classifyRevenueCatV2ProjectTransportFailure,
  classifyRevenueCatV2ReconciliationTransportFailure,
  classifyRevenueCatV2TransportFailure,
  DurableProviderDeletionError,
  type PostHogEventStatusDisposition,
  type PostHogLookupDisposition,
  type RevenueCatV2AliasPageEvidence,
  type RevenueCatV2CustomerLookupEvidence,
  type RevenueCatV2PreflightEvidence,
} from './durableProviderDeletion.ts';
import { pseudonymousUserId } from './providerDeletion.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function assertProviderError(
  operation: () => unknown,
  code: DurableProviderDeletionError['code'],
): void {
  try {
    operation();
  } catch (error) {
    assert(error instanceof DurableProviderDeletionError, 'expected a provider core error.');
    assert(error.code === code, `expected ${code}, received ${error.code}.`);
    assert(error.message === code, 'provider errors must contain only a stable code.');
    return;
  }
  throw new Error(`expected ${code}.`);
}

async function assertProviderErrorAsync(
  operation: () => Promise<unknown>,
  code: DurableProviderDeletionError['code'],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof DurableProviderDeletionError, 'expected a provider core error.');
    assert(error.code === code, `expected ${code}, received ${error.code}.`);
    assert(error.message === code, 'provider errors must contain only a stable code.');
    return;
  }
  throw new Error(`expected ${code}.`);
}

const USER_ID = '00000000-0000-4000-8000-000000000001';
const WRONG_USER_ID = '00000000-0000-4000-8000-000000000002';
const PERSON_UUID_A = '10000000-0000-4000-8000-000000000001';
const PERSON_UUID_B = '10000000-0000-4000-8000-000000000002';
const DISPATCH_CUTOFF = '2026-07-13T12:00:00.000Z';
const CAPTURE_SHUTDOWN = '2026-07-13T11:59:00.000Z';
const CREATED_AT = '2026-07-13T12:00:01.000Z';
const VERIFIED_AT = '2026-07-13T12:05:00.000Z';
const POSTHOG_OPTIONS = {
  host: 'https://eu.posthog.com',
  projectId: 'project/id',
  personalApiKey: 'posthog-personal-key',
};
const REVENUECAT_PROJECT_ID = 'proj1ab2c3d4';
const REVENUECAT_CUSTOMER_ID = 'customer_primary_1';
const REVENUECAT_ALIAS_A = '$RCAnonymousID:alias-a';
const REVENUECAT_ALIAS_B = 'legacy_alias_b';
const REVENUECAT_SECRET = 'revenuecat-v2-secret';
const REVENUECAT_FIRST_SEEN = Date.parse('2026-07-13T10:00:00.000Z');
const REVENUECAT_LAST_SEEN = Date.parse('2026-07-13T11:30:00.000Z');
const REVENUECAT_ALIAS_A_CREATED = Date.parse('2026-07-13T10:30:00.000Z');
const REVENUECAT_ALIAS_B_CREATED = Date.parse('2026-07-13T11:00:00.000Z');
const REVENUECAT_LOOKUP_OBSERVED = '2026-07-13T12:00:00.000Z';
const REVENUECAT_PROJECT_OBSERVED = '2026-07-13T11:59:59.000Z';
const REVENUECAT_PROJECT_CREATED = Date.parse('2025-01-01T00:00:00.000Z');
const REVENUECAT_PAGE_A_OBSERVED = '2026-07-13T12:00:01.000Z';
const REVENUECAT_PAGE_B_OBSERVED = '2026-07-13T12:00:02.000Z';
const REVENUECAT_SNAPSHOT_COMPLETED = '2026-07-13T12:00:03.000Z';
const REVENUECAT_REQUEST_STARTED = '2026-07-13T12:01:00.000Z';
const REVENUECAT_RECONCILED_AT = '2026-07-13T12:02:00.000Z';
const REVENUECAT_DELETED_AT = Date.parse('2026-07-13T12:01:01.000Z');

function revenueCatCustomerBody(
  customerId = REVENUECAT_CUSTOMER_ID,
  projectId = REVENUECAT_PROJECT_ID,
) {
  return {
    object: 'customer',
    id: customerId,
    project_id: projectId,
    first_seen_at: REVENUECAT_FIRST_SEEN,
    last_seen_at: REVENUECAT_LAST_SEEN,
    last_seen_app_version: null,
    last_seen_country: 'CA',
    last_seen_platform: 'ios',
    last_seen_platform_version: '18.5',
    active_entitlements: {
      object: 'list',
      items: [],
      next_page: null,
      url: `/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${REVENUECAT_CUSTOMER_ID}/active_entitlements`,
    },
    experiment: null,
  };
}

function revenueCatError(
  type:
    | 'resource_missing'
    | 'rate_limit_error'
    | 'resource_locked_error'
    | 'server_error'
    | 'authentication_error'
    | 'authorization_error',
  retryable: boolean,
) {
  return {
    object: 'error',
    type,
    message: 'Provider response',
    retryable,
    doc_url: `https://errors.rev.cat/${type.replaceAll('_', '-')}`,
    ...(retryable ? { backoff_ms: 1_000 } : {}),
  };
}

function revenueCatProjectsBody(options: {
  projects: Array<{ id: string; createdAt: number }>;
  nextStartingAfter: string | null;
}) {
  return {
    object: 'list',
    items: options.projects.map((project) => ({
      object: 'project',
      id: project.id,
      name: `Project ${project.id}`,
      created_at: project.createdAt,
      icon_url: null,
      icon_url_large: null,
    })),
    next_page:
      options.nextStartingAfter === null
        ? null
        : `/v2/projects?starting_after=${encodeURIComponent(options.nextStartingAfter)}`,
    url: '/v2/projects',
  };
}

function revenueCatAliasPath(): string {
  return `/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${REVENUECAT_CUSTOMER_ID}/aliases`;
}

function revenueCatAliasPageBody(options: {
  aliases: Array<{ id: string; createdAt: number }>;
  nextStartingAfter: string | null;
}) {
  return {
    object: 'list',
    items: options.aliases.map((alias) => ({
      object: 'customer.alias',
      id: alias.id,
      created_at: alias.createdAt,
    })),
    next_page:
      options.nextStartingAfter === null
        ? null
        : `${revenueCatAliasPath()}?starting_after=${encodeURIComponent(
            options.nextStartingAfter,
          )}`,
    url: revenueCatAliasPath(),
  };
}

function revenueCatPreflightEvidence(): RevenueCatV2PreflightEvidence {
  const lookup = classifyRevenueCatV2CustomerLookupResponse(
    200,
    revenueCatCustomerBody(),
    REVENUECAT_PROJECT_ID,
    USER_ID,
    REVENUECAT_LOOKUP_OBSERVED,
  );
  assert(lookup.kind === 'found', 'expected an attested customer lookup.');
  const firstPage = classifyRevenueCatV2AliasPageResponse(
    200,
    revenueCatAliasPageBody({
      aliases: [
        {
          id: REVENUECAT_ALIAS_A,
          createdAt: REVENUECAT_ALIAS_A_CREATED,
        },
      ],
      nextStartingAfter: REVENUECAT_ALIAS_A,
    }),
    REVENUECAT_PROJECT_ID,
    REVENUECAT_CUSTOMER_ID,
    null,
    REVENUECAT_PAGE_A_OBSERVED,
  );
  const secondPage = classifyRevenueCatV2AliasPageResponse(
    200,
    revenueCatAliasPageBody({
      aliases: [
        {
          id: REVENUECAT_ALIAS_B,
          createdAt: REVENUECAT_ALIAS_B_CREATED,
        },
      ],
      nextStartingAfter: null,
    }),
    REVENUECAT_PROJECT_ID,
    REVENUECAT_CUSTOMER_ID,
    REVENUECAT_ALIAS_A,
    REVENUECAT_PAGE_B_OBSERVED,
  );
  assert(firstPage.kind === 'page', 'expected an attested first alias page.');
  assert(secondPage.kind === 'page', 'expected an attested final alias page.');
  const preflight = attestRevenueCatV2PreflightSnapshot({
    customer: lookup.transientEvidence,
    aliasPages: [firstPage.transientEvidence, secondPage.transientEvidence],
    aliasSnapshotCompletedAt: REVENUECAT_SNAPSHOT_COMPLETED,
    persisted: true,
  });
  assert(preflight.kind === 'ready', 'expected a complete persisted snapshot.');
  return preflight.evidence;
}

function completedStatus(
  personUuid: string,
  options: { cutoff?: string; createdAt?: string; verifiedAt?: string } = {},
): PostHogEventStatusDisposition {
  return {
    kind: 'completed',
    resultCode: 'POSTHOG_STATUS_COMPLETED',
    transientEvidence: {
      personUuid,
      dispatchCutoffAt: options.cutoff ?? DISPATCH_CUTOFF,
      createdAt: options.createdAt ?? CREATED_AT,
      verifiedAt: options.verifiedAt ?? VERIFIED_AT,
    },
  };
}

function terminalOptions() {
  return {
    latestLookup: { kind: 'absent' } as PostHogLookupDisposition,
    targetSetEvidence: {
      personUuids: [PERSON_UUID_A, PERSON_UUID_B],
      persisted: true as const,
      capturedAt: '2026-07-13T11:59:30.000Z',
    },
    eventStatuses: [completedStatus(PERSON_UUID_A), completedStatus(PERSON_UUID_B)],
    dispatchCutoffAt: DISPATCH_CUTOFF,
    captureShutdownAt: CAPTURE_SHUTDOWN,
    absenceObservations: [
      {
        kind: 'absent' as const,
        observedAt: '2026-07-13T12:06:00.000Z',
        persisted: true as const,
      },
      {
        kind: 'absent' as const,
        observedAt: '2026-07-13T12:11:00.000Z',
        persisted: true as const,
      },
    ],
    minimumAbsenceIntervalSeconds: 300,
    noRecordingsEvidence: {
      recordingsCollected: false,
      durable: true as const,
      evidence: 'production_capture_disabled_and_storage_audited' as const,
      verifiedAt: '2026-07-13T12:05:30.000Z',
    },
  };
}

Deno.test('RevenueCat v1 classifier accepts only its exact attested legacy response', () => {
  assertDeepEqual(
    classifyRevenueCatV1DeleteResponse(
      200,
      {
        app_user_id: USER_ID,
        deleted: true,
      },
      USER_ID,
    ),
    {
      kind: 'succeeded',
      resultCode: 'REVENUECAT_V1_DELETED',
      receipt: { provider: 'revenuecat_v1', result: 'deleted' },
    },
    'the exact v1 response may attest deletion.',
  );
  for (const body of [
    null,
    {},
    { app_user_id: USER_ID },
    { app_user_id: USER_ID, deleted: false },
    { app_user_id: USER_ID, deleted: true, extra: true },
    { app_user_id: WRONG_USER_ID, deleted: true },
  ]) {
    assertDeepEqual(
      classifyRevenueCatV1DeleteResponse(200, body, USER_ID),
      { kind: 'ambiguous', resultCode: 'REVENUECAT_V1_DISPATCH_AMBIGUOUS' },
      'an unattested v1 response must remain ambiguous.',
    );
  }
  assertDeepEqual(
    classifyRevenueCatV1DeleteResponse(404, null, USER_ID),
    { kind: 'ambiguous', resultCode: 'REVENUECAT_V1_DISPATCH_AMBIGUOUS' },
    'a later 404 is not proof of the earlier dispatch.',
  );
  assertDeepEqual(
    classifyRevenueCatV1DeleteResponse(429, null, USER_ID),
    { kind: 'retryable', resultCode: 'REVENUECAT_V1_RATE_LIMITED' },
    'an explicit rate-limit response is retryable.',
  );
  assertDeepEqual(
    classifyRevenueCatV1DeleteResponse(401, null, USER_ID),
    {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V1_CONFIGURATION_REQUIRED',
    },
    'credential drift requires internal operator handling.',
  );
});

Deno.test('RevenueCat v1 request-start boundary is explicit and runtime validated', () => {
  assertDeepEqual(
    classifyRevenueCatV1TransportFailure('before_request_started'),
    { kind: 'retryable', resultCode: 'REVENUECAT_V1_RETRY' },
    'pre-request failure may retry.',
  );
  assertDeepEqual(
    classifyRevenueCatV1TransportFailure('after_request_started'),
    { kind: 'ambiguous', resultCode: 'REVENUECAT_V1_DISPATCH_AMBIGUOUS' },
    'post-request failure must reconcile.',
  );
  assertProviderError(
    () => classifyRevenueCatV1TransportFailure('unknown' as never),
    'PROVIDER_REQUEST_PHASE_INVALID',
  );
  assertProviderError(
    () => classifyRevenueCatV1DeleteResponse(0, null, USER_ID),
    'PROVIDER_RESPONSE_INVALID',
  );
  assertProviderError(
    () => classifyRevenueCatV1DeleteResponse(200, {}, ` ${USER_ID}`),
    'REVENUECAT_CUSTOMER_ID_INVALID',
  );
});

Deno.test('RevenueCat v2 preflight binds the raw UUID to an exact project customer', () => {
  const request = buildRevenueCatV2CustomerLookupRequest({
    projectId: REVENUECAT_PROJECT_ID,
    secretApiKey: REVENUECAT_SECRET,
    lookupCustomerId: USER_ID,
  });
  assert(
    request.url ===
      `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT_ID}/customers/${USER_ID}`,
    'customer lookup must use the persisted v2 project and raw UUID.',
  );
  assert(request.init.method === 'GET', 'preflight must be read-only.');
  assert(request.init.redirect === 'error', 'redirects must fail closed.');
  assert(
    (request.init.headers as Record<string, string>).Authorization ===
      `Bearer ${REVENUECAT_SECRET}`,
    'v2 must use Bearer authentication.',
  );
  assertDeepEqual(
    classifyRevenueCatV2CustomerLookupResponse(
      200,
      revenueCatCustomerBody(),
      REVENUECAT_PROJECT_ID,
      USER_ID,
      REVENUECAT_LOOKUP_OBSERVED,
    ),
    {
      kind: 'found',
      transientEvidence: {
        projectId: REVENUECAT_PROJECT_ID,
        lookupCustomerId: USER_ID,
        customerId: REVENUECAT_CUSTOMER_ID,
        firstSeenAt: REVENUECAT_FIRST_SEEN,
        lastSeenAt: REVENUECAT_LAST_SEEN,
        observedAt: REVENUECAT_LOOKUP_OBSERVED,
      },
    },
    'exact customer/project evidence may start alias enumeration.',
  );
  for (const body of [
    { ...revenueCatCustomerBody(), project_id: 'proj-wrong' },
    { ...revenueCatCustomerBody(), extra: true },
    { ...revenueCatCustomerBody(), first_seen_at: -1 },
    { ...revenueCatCustomerBody(), last_seen_at: REVENUECAT_FIRST_SEEN - 1 },
    {
      ...revenueCatCustomerBody(),
      active_entitlements: {
        object: 'list',
        items: [],
        next_page: null,
        url: '',
        extra: true,
      },
    },
  ]) {
    assertDeepEqual(
      classifyRevenueCatV2CustomerLookupResponse(
        200,
        body,
        REVENUECAT_PROJECT_ID,
        USER_ID,
        REVENUECAT_LOOKUP_OBSERVED,
      ),
      {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_PREFLIGHT_UNATTESTED',
      },
      'unbound or malformed customer objects must fail closed.',
    );
  }
});

Deno.test('RevenueCat v2 project visibility is exact, non-creating, and bounded', () => {
  const firstRequest = buildRevenueCatV2ProjectPageRequest({
    secretApiKey: REVENUECAT_SECRET,
    startingAfter: null,
    pageNumber: 0,
  });
  assert(
    firstRequest.url === 'https://api.revenuecat.com/v2/projects',
    'configuration attestation must use the official read-only project list.',
  );
  assert(firstRequest.init.method === 'GET', 'project attestation is read-only.');
  const otherProjectId = 'proj_other_1';
  assertDeepEqual(
    classifyRevenueCatV2ProjectPageResponse(
      200,
      revenueCatProjectsBody({
        projects: [
          {
            id: otherProjectId,
            createdAt: REVENUECAT_PROJECT_CREATED,
          },
        ],
        nextStartingAfter: otherProjectId,
      }),
      REVENUECAT_PROJECT_ID,
      null,
      0,
      REVENUECAT_PROJECT_OBSERVED,
    ),
    { kind: 'continue', nextStartingAfter: otherProjectId },
    'a validated forward cursor may continue the bounded search.',
  );
  const secondRequest = buildRevenueCatV2ProjectPageRequest({
    secretApiKey: REVENUECAT_SECRET,
    startingAfter: otherProjectId,
    pageNumber: 1,
  });
  assert(
    secondRequest.url.endsWith(`?starting_after=${otherProjectId}`),
    'the next project request rebuilds the validated cursor.',
  );
  assertDeepEqual(
    classifyRevenueCatV2ProjectPageResponse(
      200,
      revenueCatProjectsBody({
        projects: [
          {
            id: REVENUECAT_PROJECT_ID,
            createdAt: REVENUECAT_PROJECT_CREATED,
          },
        ],
        nextStartingAfter: null,
      }),
      REVENUECAT_PROJECT_ID,
      otherProjectId,
      1,
      REVENUECAT_PROJECT_OBSERVED,
    ),
    {
      kind: 'found',
      transientEvidence: {
        projectId: REVENUECAT_PROJECT_ID,
        projectCreatedAt: REVENUECAT_PROJECT_CREATED,
        observedAt: REVENUECAT_PROJECT_OBSERVED,
      },
    },
    'an exact listed project attests key/project configuration.',
  );
  assertDeepEqual(
    classifyRevenueCatV2ProjectPageResponse(
      200,
      revenueCatProjectsBody({
        projects: [
          {
            id: otherProjectId,
            createdAt: REVENUECAT_PROJECT_CREATED,
          },
        ],
        nextStartingAfter: otherProjectId,
      }),
      REVENUECAT_PROJECT_ID,
      null,
      49,
      REVENUECAT_PROJECT_OBSERVED,
    ),
    {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_UNRESOLVED',
    },
    'the project scan cannot exceed fifty pages.',
  );
  for (const phase of ['before_request_started', 'after_request_started'] as const) {
    assertDeepEqual(
      classifyRevenueCatV2ProjectTransportFailure(phase),
      {
        kind: 'retryable',
        resultCode: 'REVENUECAT_V2_PROJECT_ATTESTATION_RETRY',
      },
      'a project-list GET is safely retryable in either transport phase.',
    );
  }
});

Deno.test('RevenueCat v2 customer 404 completes only with persisted project visibility', () => {
  const absence = classifyRevenueCatV2CustomerLookupResponse(
    404,
    revenueCatError('resource_missing', false),
    REVENUECAT_PROJECT_ID,
    USER_ID,
    REVENUECAT_LOOKUP_OBSERVED,
  );
  assertDeepEqual(
    absence,
    {
      kind: 'absent',
      transientEvidence: {
        projectId: REVENUECAT_PROJECT_ID,
        lookupCustomerId: USER_ID,
        observedAt: REVENUECAT_LOOKUP_OBSERVED,
      },
    },
    'a bare 404 is transient evidence, never a terminal disposition.',
  );
  assert(absence.kind === 'absent', 'expected exact transient absence.');
  const result = attestRevenueCatV2AlreadyAbsent({
    projectVisibility: {
      projectId: REVENUECAT_PROJECT_ID,
      projectCreatedAt: REVENUECAT_PROJECT_CREATED,
      observedAt: REVENUECAT_PROJECT_OBSERVED,
    },
    customerAbsence: absence.transientEvidence,
    persisted: true,
  });
  assertDeepEqual(
    result,
    {
      kind: 'succeeded',
      resultCode: 'REVENUECAT_V2_ALREADY_ABSENT_VERIFIED',
      receipt: {
        provider: 'revenuecat_v2',
        result: 'already_absent_verified',
        scope: 'customer_and_alias_family',
      },
    },
    'same-project visibility plus exact raw-UUID 404 proves already absent.',
  );
  assert(!JSON.stringify(result).includes(USER_ID), 'the receipt must omit the UUID.');
  assertProviderError(
    () =>
      attestRevenueCatV2AlreadyAbsent({
        projectVisibility: {
          projectId: 'proj_wrong',
          projectCreatedAt: REVENUECAT_PROJECT_CREATED,
          observedAt: REVENUECAT_PROJECT_OBSERVED,
        },
        customerAbsence: absence.transientEvidence,
        persisted: true,
      }),
    'REVENUECAT_V2_EVIDENCE_INVALID',
  );

  assertDeepEqual(
    classifyRevenueCatV2CustomerLookupResponse(
      429,
      revenueCatError('rate_limit_error', true),
      REVENUECAT_PROJECT_ID,
      USER_ID,
      REVENUECAT_LOOKUP_OBSERVED,
    ),
    { kind: 'retryable', resultCode: 'REVENUECAT_V2_PREFLIGHT_RETRY' },
    'an exact read rate-limit is retryable.',
  );
  for (const phase of ['before_request_started', 'after_request_started'] as const) {
    assertDeepEqual(
      classifyRevenueCatV2PreflightTransportFailure(phase),
      { kind: 'retryable', resultCode: 'REVENUECAT_V2_PREFLIGHT_RETRY' },
      'a failed GET is safe to repeat in either transport phase.',
    );
  }
  assertProviderError(
    () => classifyRevenueCatV2PreflightTransportFailure('bad' as never),
    'PROVIDER_REQUEST_PHASE_INVALID',
  );
});

Deno.test('RevenueCat v2 alias pagination is exact, bounded, and project/customer bound', () => {
  const firstRequest = buildRevenueCatV2AliasPageRequest({
    projectId: REVENUECAT_PROJECT_ID,
    secretApiKey: REVENUECAT_SECRET,
    customerId: REVENUECAT_CUSTOMER_ID,
    startingAfter: null,
  });
  const secondRequest = buildRevenueCatV2AliasPageRequest({
    projectId: REVENUECAT_PROJECT_ID,
    secretApiKey: REVENUECAT_SECRET,
    customerId: REVENUECAT_CUSTOMER_ID,
    startingAfter: REVENUECAT_ALIAS_A,
  });
  assert(!firstRequest.url.includes('?'), 'the first page uses the documented default.');
  assert(
    secondRequest.url.endsWith(`?starting_after=${encodeURIComponent(REVENUECAT_ALIAS_A)}`),
    'the next request must reconstruct the validated cursor itself.',
  );
  const firstPage = classifyRevenueCatV2AliasPageResponse(
    200,
    revenueCatAliasPageBody({
      aliases: [
        {
          id: REVENUECAT_ALIAS_A,
          createdAt: REVENUECAT_ALIAS_A_CREATED,
        },
      ],
      nextStartingAfter: REVENUECAT_ALIAS_A,
    }),
    REVENUECAT_PROJECT_ID,
    REVENUECAT_CUSTOMER_ID,
    null,
    REVENUECAT_PAGE_A_OBSERVED,
  );
  assert(firstPage.kind === 'page', 'expected an exact first page.');
  assert(
    firstPage.transientEvidence.nextStartingAfter === REVENUECAT_ALIAS_A,
    'the exact next cursor must be retained.',
  );
  for (const body of [
    {
      ...revenueCatAliasPageBody({
        aliases: [
          {
            id: REVENUECAT_ALIAS_A,
            createdAt: REVENUECAT_ALIAS_A_CREATED,
          },
        ],
        nextStartingAfter: REVENUECAT_ALIAS_A,
      }),
      extra: true,
    },
    {
      ...revenueCatAliasPageBody({
        aliases: [
          {
            id: REVENUECAT_ALIAS_A,
            createdAt: REVENUECAT_ALIAS_A_CREATED,
          },
        ],
        nextStartingAfter: REVENUECAT_ALIAS_A,
      }),
      url: '/v2/projects/wrong/customers/wrong/aliases',
    },
    {
      ...revenueCatAliasPageBody({
        aliases: [
          {
            id: REVENUECAT_ALIAS_A,
            createdAt: REVENUECAT_ALIAS_A_CREATED,
          },
        ],
        nextStartingAfter: REVENUECAT_ALIAS_A,
      }),
      next_page: 'https://attacker.example/aliases?starting_after=x',
    },
    revenueCatAliasPageBody({
      aliases: [
        {
          id: REVENUECAT_ALIAS_A,
          createdAt: REVENUECAT_ALIAS_A_CREATED,
        },
      ],
      nextStartingAfter: 'not-the-last-item',
    }),
    revenueCatAliasPageBody({
      aliases: [
        { id: REVENUECAT_ALIAS_A, createdAt: REVENUECAT_ALIAS_A_CREATED },
        { id: REVENUECAT_ALIAS_A, createdAt: REVENUECAT_ALIAS_A_CREATED },
      ],
      nextStartingAfter: null,
    }),
  ]) {
    assertDeepEqual(
      classifyRevenueCatV2AliasPageResponse(
        200,
        body,
        REVENUECAT_PROJECT_ID,
        REVENUECAT_CUSTOMER_ID,
        null,
        REVENUECAT_PAGE_A_OBSERVED,
      ),
      {
        kind: 'action_required',
        resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
      },
      'pagination drift must prevent DELETE dispatch.',
    );
  }
});

Deno.test('RevenueCat v2 preflight persists a complete bounded alias family before DELETE', () => {
  const evidence = revenueCatPreflightEvidence();
  assert(evidence.persisted, 'preflight evidence must be marked persisted.');
  assert(evidence.aliasPageCount === 2, 'every traversed page must be counted.');
  assertDeepEqual(
    evidence.aliases,
    [
      { id: REVENUECAT_ALIAS_A, createdAt: REVENUECAT_ALIAS_A_CREATED },
      { id: REVENUECAT_ALIAS_B, createdAt: REVENUECAT_ALIAS_B_CREATED },
    ],
    'the encrypted snapshot must retain the exact canonical alias set.',
  );

  const customer: RevenueCatV2CustomerLookupEvidence = {
    projectId: REVENUECAT_PROJECT_ID,
    lookupCustomerId: USER_ID,
    customerId: REVENUECAT_CUSTOMER_ID,
    firstSeenAt: REVENUECAT_FIRST_SEEN,
    lastSeenAt: REVENUECAT_LAST_SEEN,
    observedAt: REVENUECAT_LOOKUP_OBSERVED,
  };
  const incompletePage: RevenueCatV2AliasPageEvidence = {
    projectId: REVENUECAT_PROJECT_ID,
    customerId: REVENUECAT_CUSTOMER_ID,
    requestedStartingAfter: null,
    nextStartingAfter: REVENUECAT_ALIAS_A,
    aliases: [
      {
        id: REVENUECAT_ALIAS_A,
        createdAt: REVENUECAT_ALIAS_A_CREATED,
      },
    ],
    observedAt: REVENUECAT_PAGE_A_OBSERVED,
  };
  assertDeepEqual(
    attestRevenueCatV2PreflightSnapshot({
      customer,
      aliasPages: [incompletePage],
      aliasSnapshotCompletedAt: REVENUECAT_SNAPSHOT_COMPLETED,
      persisted: true,
    }),
    {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    },
    'a non-null final cursor must block deletion.',
  );

  const forgedCursorPages: RevenueCatV2AliasPageEvidence[] = [
    { ...incompletePage, nextStartingAfter: 'forged_cursor' },
    {
      projectId: REVENUECAT_PROJECT_ID,
      customerId: REVENUECAT_CUSTOMER_ID,
      requestedStartingAfter: 'forged_cursor',
      nextStartingAfter: null,
      aliases: [
        {
          id: REVENUECAT_ALIAS_B,
          createdAt: REVENUECAT_ALIAS_B_CREATED,
        },
      ],
      observedAt: REVENUECAT_PAGE_B_OBSERVED,
    },
  ];
  assertDeepEqual(
    attestRevenueCatV2PreflightSnapshot({
      customer,
      aliasPages: forgedCursorPages,
      aliasSnapshotCompletedAt: REVENUECAT_SNAPSHOT_COMPLETED,
      persisted: true,
    }),
    {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    },
    'persisted pages must independently bind every next cursor to the last returned alias.',
  );

  const overCapPages: RevenueCatV2AliasPageEvidence[] = [];
  let requestedStartingAfter: string | null = null;
  for (let offset = 0; offset < 65; offset += 20) {
    const aliases = Array.from({ length: Math.min(20, 65 - offset) }, (_, index) => ({
      id: `bounded_alias_${String(offset + index).padStart(3, '0')}`,
      createdAt: REVENUECAT_ALIAS_A_CREATED,
    }));
    const hasMore = offset + aliases.length < 65;
    const nextStartingAfter = hasMore ? aliases[aliases.length - 1].id : null;
    overCapPages.push({
      projectId: REVENUECAT_PROJECT_ID,
      customerId: REVENUECAT_CUSTOMER_ID,
      requestedStartingAfter,
      nextStartingAfter,
      aliases,
      observedAt: REVENUECAT_PAGE_B_OBSERVED,
    });
    requestedStartingAfter = nextStartingAfter;
  }
  assertDeepEqual(
    attestRevenueCatV2PreflightSnapshot({
      customer,
      aliasPages: overCapPages,
      aliasSnapshotCompletedAt: REVENUECAT_SNAPSHOT_COMPLETED,
      persisted: true,
    }),
    {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_ALIAS_SNAPSHOT_UNATTESTED',
    },
    'an alias family too large for bounded encrypted reconciliation is never deleted blindly.',
  );
});

Deno.test('RevenueCat v2 DELETE acknowledgements are exact and always nonterminal', () => {
  const evidence = revenueCatPreflightEvidence();
  const request = buildRevenueCatV2DeleteRequest({
    evidence,
    secretApiKey: REVENUECAT_SECRET,
  });
  assert(request.init.method === 'DELETE', 'the attested customer is deleted once.');
  assert(
    request.url.endsWith(`/customers/${REVENUECAT_CUSTOMER_ID}`),
    'DELETE must target the preflight customer, not an unbound environment value.',
  );
  const body = {
    object: 'customer',
    id: REVENUECAT_CUSTOMER_ID,
    deleted_at: REVENUECAT_DELETED_AT,
  };
  assertDeepEqual(
    classifyRevenueCatV2DeleteResponse(200, body, evidence),
    {
      kind: 'verification_required',
      resultCode: 'REVENUECAT_V2_DELETE_ACKNOWLEDGED',
      acknowledgement: {
        mode: 'completed',
        deletedAt: REVENUECAT_DELETED_AT,
      },
    },
    '200 selects reconciliation but is not terminal success.',
  );
  assertDeepEqual(
    classifyRevenueCatV2DeleteResponse(202, body, evidence),
    {
      kind: 'verification_required',
      resultCode: 'REVENUECAT_V2_DELETE_QUEUED',
      acknowledgement: {
        mode: 'queued',
        deletedAt: REVENUECAT_DELETED_AT,
      },
    },
    '202 is queue acceptance only.',
  );
  assertDeepEqual(
    classifyRevenueCatV2DeleteResponse(404, revenueCatError('resource_missing', false), evidence),
    {
      kind: 'verification_required',
      resultCode: 'REVENUECAT_V2_DELETE_ABSENT_RECONCILE',
      acknowledgement: { mode: 'already_absent', deletedAt: null },
    },
    'a post-preflight DELETE 404 still requires full read reconciliation.',
  );
  for (const malformed of [
    { ...body, id: WRONG_USER_ID },
    { ...body, deleted_at: REVENUECAT_FIRST_SEEN - 1 },
    { ...body, extra: true },
    null,
  ]) {
    assertDeepEqual(
      classifyRevenueCatV2DeleteResponse(200, malformed, evidence),
      { kind: 'ambiguous', resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS' },
      'an unbound success response must enter reconciliation-only ambiguity.',
    );
  }
  assertDeepEqual(
    classifyRevenueCatV2DeleteResponse(429, revenueCatError('rate_limit_error', true), evidence),
    { kind: 'retryable', resultCode: 'REVENUECAT_V2_RATE_LIMITED' },
    'the documented exact rate-limit response did not execute the request.',
  );
});

Deno.test('RevenueCat v2 request-start phase prevents blind DELETE redispatch', () => {
  assertDeepEqual(
    classifyRevenueCatV2TransportFailure('before_request_started'),
    { kind: 'retryable', resultCode: 'REVENUECAT_V2_RETRY' },
    'failure before request start may dispatch.',
  );
  assertDeepEqual(
    classifyRevenueCatV2TransportFailure('after_request_started'),
    { kind: 'ambiguous', resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS' },
    'failure after request start must use GET reconciliation only.',
  );
  assertProviderError(
    () => classifyRevenueCatV2TransportFailure('unknown' as never),
    'PROVIDER_REQUEST_PHASE_INVALID',
  );
});

Deno.test(
  'RevenueCat v2 reconciliation probes every persisted identity and aliases read-only',
  () => {
    const evidence = revenueCatPreflightEvidence();
    const requests = buildRevenueCatV2ReconciliationRequests({
      evidence,
      secretApiKey: REVENUECAT_SECRET,
    });
    assert(requests.customers.length === 4, 'raw, customer, and both aliases are probed.');
    assert(
      requests.customers.every((request) => request.init.method === 'GET'),
      'customer reconciliation must be read-only.',
    );
    assert(requests.aliases.init.method === 'GET', 'aliases reconciliation is read-only.');
    assertDeepEqual(
      requests.customers.map((request) => request.targetIndex),
      [0, 1, 2, 3],
      'opaque indexes bind each observation without copying IDs to outcomes.',
    );
    for (const phase of ['before_request_started', 'after_request_started'] as const) {
      assertDeepEqual(
        classifyRevenueCatV2ReconciliationTransportFailure(phase),
        {
          kind: 'retryable',
          resultCode: 'REVENUECAT_V2_RECONCILIATION_RETRY',
        },
        'failed GET reconciliation is safe to repeat.',
      );
    }
  },
);

Deno.test('RevenueCat v2 terminal proof requires exact persisted 404s for the full family', () => {
  const evidence = revenueCatPreflightEvidence();
  const requests = buildRevenueCatV2ReconciliationRequests({
    evidence,
    secretApiKey: REVENUECAT_SECRET,
  });
  const customerObservations = requests.customers.map((request) => {
    const observation = classifyRevenueCatV2CustomerReconciliationResponse(
      404,
      revenueCatError('resource_missing', false),
      evidence,
      request.targetIndex,
      REVENUECAT_RECONCILED_AT,
    );
    assert(observation.kind === 'absent', 'expected exact customer absence.');
    return observation;
  });
  const aliasesObservation = classifyRevenueCatV2AliasesReconciliationResponse(
    404,
    revenueCatError('resource_missing', false),
    evidence,
    REVENUECAT_RECONCILED_AT,
  );
  assert(aliasesObservation.kind === 'absent', 'expected exact aliases absence.');
  const result = attestRevenueCatV2Deletion({
    preflightEvidence: evidence,
    dispatchEvidence: {
      persisted: true,
      requestStartedAt: REVENUECAT_REQUEST_STARTED,
      resultCode: 'REVENUECAT_V2_DELETE_ACKNOWLEDGED',
      deletedAt: REVENUECAT_DELETED_AT,
    },
    reconciliationEvidence: {
      persisted: true,
      customerObservations,
      aliasesObservation,
    },
  });
  assertDeepEqual(
    result,
    {
      kind: 'succeeded',
      resultCode: 'REVENUECAT_V2_DELETION_VERIFIED',
      receipt: {
        provider: 'revenuecat_v2',
        result: 'deleted_verified',
        scope: 'customer_and_alias_family',
      },
    },
    'only full persisted preflight + dispatch + read absence is terminal.',
  );
  const serialized = JSON.stringify(result);
  for (const identifier of [
    USER_ID,
    REVENUECAT_CUSTOMER_ID,
    REVENUECAT_ALIAS_A,
    REVENUECAT_ALIAS_B,
  ]) {
    assert(!serialized.includes(identifier), 'terminal receipts must omit identifiers.');
  }
});

Deno.test('RevenueCat v2 presence, malformed 404, or incomplete evidence cannot complete', () => {
  const evidence = revenueCatPreflightEvidence();
  const requests = buildRevenueCatV2ReconciliationRequests({
    evidence,
    secretApiKey: REVENUECAT_SECRET,
  });
  const absent = requests.customers.map((request) => ({
    kind: 'absent' as const,
    targetIndex: request.targetIndex,
    targetCustomerId: request.targetCustomerId,
    observedAt: REVENUECAT_RECONCILED_AT,
  }));
  const present = classifyRevenueCatV2CustomerReconciliationResponse(
    200,
    revenueCatCustomerBody(),
    evidence,
    0,
    REVENUECAT_RECONCILED_AT,
  );
  assert(present.kind === 'present', 'a surviving customer must be explicit.');
  const pending = attestRevenueCatV2Deletion({
    preflightEvidence: evidence,
    dispatchEvidence: {
      persisted: true,
      requestStartedAt: REVENUECAT_REQUEST_STARTED,
      resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
      deletedAt: null,
    },
    reconciliationEvidence: {
      persisted: true,
      customerObservations: [present, ...absent.slice(1)],
      aliasesObservation: {
        kind: 'absent',
        customerId: REVENUECAT_CUSTOMER_ID,
        observedAt: REVENUECAT_RECONCILED_AT,
      },
    },
  });
  assertDeepEqual(
    pending,
    {
      kind: 'pending',
      resultCode: 'REVENUECAT_V2_CUSTOMER_STILL_PRESENT',
    },
    'a present identity remains nonterminal after an ambiguous dispatch.',
  );
  assertDeepEqual(
    classifyRevenueCatV2CustomerReconciliationResponse(
      404,
      { object: 'error', type: 'resource_missing', message: 'missing' },
      evidence,
      0,
      REVENUECAT_RECONCILED_AT,
    ),
    {
      kind: 'action_required',
      resultCode: 'REVENUECAT_V2_TERMINAL_VERIFICATION_UNRESOLVED',
    },
    'a malformed 404 cannot attest absence.',
  );
  assertProviderError(
    () =>
      attestRevenueCatV2Deletion({
        preflightEvidence: { ...evidence, persisted: false } as never,
        dispatchEvidence: {
          persisted: true,
          requestStartedAt: REVENUECAT_REQUEST_STARTED,
          resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
          deletedAt: null,
        },
        reconciliationEvidence: {
          persisted: true,
          customerObservations: absent,
          aliasesObservation: {
            kind: 'absent',
            customerId: REVENUECAT_CUSTOMER_ID,
            observedAt: REVENUECAT_RECONCILED_AT,
          },
        },
      }),
    'REVENUECAT_V2_EVIDENCE_INVALID',
  );
  assertProviderError(
    () =>
      attestRevenueCatV2Deletion({
        preflightEvidence: evidence,
        dispatchEvidence: {
          persisted: true,
          requestStartedAt: REVENUECAT_REQUEST_STARTED,
          resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
          deletedAt: null,
        },
        reconciliationEvidence: {
          persisted: true,
          customerObservations: absent.slice(1),
          aliasesObservation: {
            kind: 'absent',
            customerId: REVENUECAT_CUSTOMER_ID,
            observedAt: REVENUECAT_RECONCILED_AT,
          },
        },
      }),
    'REVENUECAT_V2_EVIDENCE_INVALID',
  );
  assertProviderError(
    () =>
      attestRevenueCatV2Deletion({
        preflightEvidence: evidence,
        dispatchEvidence: {
          persisted: true,
          requestStartedAt: REVENUECAT_REQUEST_STARTED,
          resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
          deletedAt: null,
        },
        reconciliationEvidence: {
          persisted: true,
          customerObservations: [
            { ...absent[0], targetCustomerId: WRONG_USER_ID },
            ...absent.slice(1),
          ],
          aliasesObservation: {
            kind: 'absent',
            customerId: REVENUECAT_CUSTOMER_ID,
            observedAt: REVENUECAT_RECONCILED_AT,
          },
        },
      }),
    'REVENUECAT_V2_EVIDENCE_INVALID',
  );
  assertProviderError(
    () =>
      attestRevenueCatV2Deletion({
        preflightEvidence: evidence,
        dispatchEvidence: {
          persisted: true,
          requestStartedAt: REVENUECAT_REQUEST_STARTED,
          resultCode: 'REVENUECAT_V2_DISPATCH_AMBIGUOUS',
          deletedAt: null,
        },
        reconciliationEvidence: {
          persisted: true,
          customerObservations: absent,
          aliasesObservation: {
            kind: 'absent',
            customerId: 'wrong_customer',
            observedAt: REVENUECAT_RECONCILED_AT,
          },
        },
      }),
    'REVENUECAT_V2_EVIDENCE_INVALID',
  );
});

Deno.test('RevenueCat v2 aliases endpoint presence remains nonterminal', () => {
  const evidence = revenueCatPreflightEvidence();
  assertDeepEqual(
    classifyRevenueCatV2AliasesReconciliationResponse(
      200,
      revenueCatAliasPageBody({
        aliases: [
          {
            id: REVENUECAT_ALIAS_A,
            createdAt: REVENUECAT_ALIAS_A_CREATED,
          },
        ],
        nextStartingAfter: null,
      }),
      evidence,
      REVENUECAT_RECONCILED_AT,
    ),
    {
      kind: 'present',
      customerId: REVENUECAT_CUSTOMER_ID,
      observedAt: REVENUECAT_RECONCILED_AT,
    },
    'a live aliases resource blocks completion even when a page is empty or partial.',
  );
});

Deno.test('Apple manual outcome adapts to a successful step without claiming revocation', () => {
  const revoked = classifyAppleRevokeResponse({ status: 200, body: '', responseBytes: 0 });
  assertDeepEqual(
    adaptAppleRevocationForDeletionStep(revoked),
    revoked,
    'an attested revoke remains successful.',
  );
  const manual = appleManualRevocationDisposition();
  assertDeepEqual(
    adaptAppleRevocationForDeletionStep(manual),
    {
      kind: 'succeeded',
      resultCode: 'APPLE_MANUAL_REVOCATION_RECORDED',
      receipt: { provider: 'apple', result: 'manual_action_recorded' },
      notice: { action: 'remove_apple_authorization' },
    },
    'manual Apple action must not block whole-account deletion.',
  );
  for (const status of [201, 204, 400, 401, 403, 404]) {
    assertDeepEqual(
      classifyAppleRevokeResponse({ status, body: '', responseBytes: 0 }),
      manual,
      `${status} must preserve the manual notice.`,
    );
  }
  for (const body of ['unexpected', ' ']) {
    assertDeepEqual(
      classifyAppleRevokeResponse({
        status: 200,
        body,
        responseBytes: new TextEncoder().encode(body).byteLength,
      }),
      manual,
      'a nonempty 200 response must not attest automatic revocation.',
    );
  }
  assertDeepEqual(
    classifyAppleRevokeResponse({ status: 200, body: '', responseBytes: 3 }),
    manual,
    'decoded-empty UTF-8 BOM bytes must not attest automatic revocation.',
  );
  for (const malformed of [
    { status: 200, body: '' },
    { status: 200, body: '', responseBytes: -1 },
    { status: 200, body: '', responseBytes: 0, extra: true },
  ]) {
    assertProviderError(
      () => classifyAppleRevokeResponse(malformed as never),
      'APPLE_DISPOSITION_INVALID',
    );
  }
  for (const phase of ['before_request_started', 'after_request_started'] as const) {
    assertDeepEqual(
      classifyAppleRevokeTransportFailure(phase),
      { kind: 'retryable', resultCode: 'APPLE_REVOKE_RETRY' },
      'Apple revocation is documented idempotent.',
    );
  }
  assertProviderError(
    () => adaptAppleRevocationForDeletionStep({ ...manual, extra: true } as never),
    'APPLE_DISPOSITION_INVALID',
  );
});

Deno.test('PostHog lookup binds both current and legacy identities', async () => {
  const request = await buildPostHogPersonLookupRequest({
    ...POSTHOG_OPTIONS,
    appUserId: USER_ID,
  });
  const currentIdentity = await pseudonymousUserId(USER_ID);
  assert(
    currentIdentity === 'u_2ea5a67b3d02fe13d0e65c4b781195ed',
    'the current identity must match the Layerwell mobile pseudonym contract.',
  );
  assertDeepEqual(
    JSON.parse(String(request.init.body)),
    { distinct_ids: [currentIdentity, USER_ID] },
    'lookup must cover both known distinct IDs.',
  );
  assertDeepEqual(
    request.expectedDistinctIds,
    [currentIdentity, USER_ID],
    'response parsing must bind to the request.',
  );
  assert(request.init.method === 'POST', 'lookup must use POST.');
  assert(request.init.redirect === 'error', 'redirects must fail closed.');
  await assertProviderErrorAsync(
    () =>
      buildPostHogPersonLookupRequest({
        ...POSTHOG_OPTIONS,
        appUserId: USER_ID,
        extra: true,
      } as never),
    'PROVIDER_REQUEST_INVALID',
  );
});

Deno.test('PostHog lookup parser is exact, deduplicated, and fail closed', async () => {
  const currentIdentity = await pseudonymousUserId(USER_ID);
  const expected = [currentIdentity, USER_ID];
  assertDeepEqual(
    classifyPostHogPersonLookupResponse(
      200,
      {
        results: {
          [currentIdentity]: { uuid: PERSON_UUID_A },
          [USER_ID]: { uuid: PERSON_UUID_A },
        },
      },
      expected,
    ),
    { kind: 'found', personUuids: [PERSON_UUID_A] },
    'aliases for one person must deduplicate.',
  );
  assertDeepEqual(
    classifyPostHogPersonLookupResponse(200, { results: {} }, expected),
    { kind: 'absent' },
    'an exact empty map attests current person absence.',
  );
  for (const body of [
    null,
    {},
    { results: [], extra: true },
    { results: {}, extra: true },
    { results: { unexpected: { uuid: PERSON_UUID_A } } },
    { results: { [USER_ID]: { uuid: 'not-a-uuid' } } },
  ]) {
    assertDeepEqual(
      classifyPostHogPersonLookupResponse(200, body, expected),
      { kind: 'action_required', resultCode: 'POSTHOG_LOOKUP_UNATTESTED' },
      'schema drift must fail closed.',
    );
  }
});

Deno.test('PostHog bulk deletion binds target set and current dispatch cutoff', () => {
  const request = buildPostHogBulkDeleteRequest({
    ...POSTHOG_OPTIONS,
    personUuids: [PERSON_UUID_B, PERSON_UUID_A.toUpperCase(), PERSON_UUID_A],
    deleteRecordings: false,
    dispatchCutoffAt: DISPATCH_CUTOFF,
  });
  assertDeepEqual(
    JSON.parse(String(request.init.body)),
    {
      ids: [PERSON_UUID_A, PERSON_UUID_B],
      delete_events: true,
      delete_recordings: false,
    },
    'request targets must be canonical and deduplicated.',
  );
  assertDeepEqual(
    request.expectedPersonUuids,
    [PERSON_UUID_A, PERSON_UUID_B],
    'transient evidence must retain the exact target set.',
  );
  assert(request.dispatchCutoffAt === DISPATCH_CUTOFF, 'dispatch cutoff must be bound.');

  const expected = {
    personUuids: request.expectedPersonUuids,
    deleteRecordings: false,
    dispatchCutoffAt: DISPATCH_CUTOFF,
  };
  const valid = {
    persons_found: 2,
    persons_deleted: 2,
    events_queued_for_deletion: true,
    recordings_queued_for_deletion: false,
    deletion_errors: [],
  };
  assertDeepEqual(
    classifyPostHogBulkDeleteResponse(202, valid, expected),
    {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      queue: {
        events: true,
        recordings: false,
        dispatchCutoffAt: DISPATCH_CUTOFF,
        targetCount: 2,
      },
    },
    'exact 202 evidence may attest queue acceptance only.',
  );
  assertDeepEqual(
    classifyPostHogBulkDeleteResponse(
      202,
      Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'deletion_errors')),
      expected,
    ),
    {
      kind: 'queued',
      resultCode: 'POSTHOG_DELETE_QUEUED',
      queue: {
        events: true,
        recordings: false,
        dispatchCutoffAt: DISPATCH_CUTOFF,
        targetCount: 2,
      },
    },
    "the provider's optional deletion_errors field may be omitted.",
  );
  for (const body of [
    { ...valid, deletion_errors: undefined },
    { ...valid, deletion_errors: [null] },
    { ...valid, persons_found: 1 },
    { ...valid, extra: true },
  ]) {
    assertDeepEqual(
      classifyPostHogBulkDeleteResponse(202, body, expected),
      { kind: 'ambiguous', resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS' },
      'deletion_errors must be omitted or the exact empty array and all fields must match.',
    );
  }
});

Deno.test('PostHog deletion transport failure is bound to request_started', () => {
  assertDeepEqual(
    classifyPostHogBulkDeleteTransportFailure('before_request_started'),
    { kind: 'retryable', resultCode: 'POSTHOG_DELETE_RETRY' },
    'pre-request failure is safely retryable.',
  );
  assertDeepEqual(
    classifyPostHogBulkDeleteTransportFailure('after_request_started'),
    { kind: 'ambiguous', resultCode: 'POSTHOG_DELETE_DISPATCH_AMBIGUOUS' },
    'post-request failure is reconciliation-only.',
  );
  assertProviderError(
    () => classifyPostHogBulkDeleteTransportFailure(false as never),
    'PROVIDER_REQUEST_PHASE_INVALID',
  );
});

Deno.test('PostHog status evidence is target-bound and temporally after current dispatch', () => {
  const request = buildPostHogDeletionStatusRequest({
    ...POSTHOG_OPTIONS,
    personUuid: PERSON_UUID_A,
    dispatchCutoffAt: DISPATCH_CUTOFF,
  });
  assert(request.expectedPersonUuid === PERSON_UUID_A, 'status request must bind target UUID.');
  assert(request.dispatchCutoffAt === DISPATCH_CUTOFF, 'status request must bind cutoff.');
  const url = new URL(request.url);
  assert(url.searchParams.get('person_uuid') === PERSON_UUID_A, 'query must bind target.');

  const completedBody = {
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        person_uuid: PERSON_UUID_A,
        created_at: CREATED_AT,
        status: 'completed',
        delete_verified_at: VERIFIED_AT,
      },
    ],
  };
  assertDeepEqual(
    classifyPostHogDeletionStatusResponse(200, completedBody, PERSON_UUID_A, DISPATCH_CUTOFF),
    completedStatus(PERSON_UUID_A),
    'completed evidence must retain UUID, cutoff, created, and verified timestamps.',
  );
  assertDeepEqual(
    classifyPostHogDeletionStatusResponse(
      200,
      {
        ...completedBody,
        results: [
          {
            ...completedBody.results[0],
            status: 'pending',
            delete_verified_at: null,
          },
        ],
      },
      PERSON_UUID_A,
      DISPATCH_CUTOFF,
    ),
    { kind: 'pending', resultCode: 'POSTHOG_STATUS_PENDING' },
    'current pending rows remain pending.',
  );
  assertDeepEqual(
    classifyPostHogDeletionStatusResponse(
      200,
      {
        ...completedBody,
        results: [
          {
            ...completedBody.results[0],
            created_at: CAPTURE_SHUTDOWN,
          },
        ],
      },
      PERSON_UUID_A,
      DISPATCH_CUTOFF,
    ),
    { kind: 'missing', resultCode: 'POSTHOG_STATUS_MISSING' },
    'historical rows before the dispatch cutoff cannot attest current deletion.',
  );
});

Deno.test('PostHog status rejects wrong targets, invalid chronology, pages, and extra keys', () => {
  const row = {
    person_uuid: PERSON_UUID_A,
    created_at: CREATED_AT,
    status: 'completed',
    delete_verified_at: VERIFIED_AT,
  };
  for (const body of [
    null,
    {},
    { count: 1, next: 'next', previous: null, results: [row] },
    { count: 2, next: null, previous: null, results: [row] },
    {
      count: 1,
      next: null,
      previous: null,
      results: [{ ...row, person_uuid: PERSON_UUID_B }],
    },
    {
      count: 1,
      next: null,
      previous: null,
      results: [{ ...row, delete_verified_at: '2026-07-13T12:00:00.000Z' }],
    },
    {
      count: 1,
      next: null,
      previous: null,
      results: [{ ...row, extra: true }],
    },
    { count: 1, next: null, previous: null, results: [row], extra: true },
  ]) {
    assertDeepEqual(
      classifyPostHogDeletionStatusResponse(200, body, PERSON_UUID_A, DISPATCH_CUTOFF),
      { kind: 'action_required', resultCode: 'POSTHOG_STATUS_UNATTESTED' },
      'unbound or contradictory status evidence must fail closed.',
    );
  }
});

Deno.test('PostHog terminal success requires exact targets and two durable absences', () => {
  const result = attestPostHogTerminalDeletion(terminalOptions());
  assertDeepEqual(
    result,
    {
      kind: 'succeeded',
      resultCode: 'POSTHOG_DELETION_VERIFIED',
      receipt: {
        provider: 'posthog',
        result: 'deleted_verified',
        scope: 'persons_and_events',
        recordings: 'attested_not_collected',
        absenceObservations: 2,
      },
    },
    'all terminal evidence must jointly attest completion.',
  );
  assert(
    !JSON.stringify(result).includes(PERSON_UUID_A),
    'terminal receipt must omit target UUIDs.',
  );
  assert(
    !JSON.stringify(result).includes(PERSON_UUID_B),
    'terminal receipt must omit target UUIDs.',
  );
});

Deno.test('PostHog terminal attestation enforces exact target-set equality', () => {
  const wrong = terminalOptions();
  wrong.eventStatuses = [completedStatus(PERSON_UUID_A), completedStatus(WRONG_USER_ID)];
  assertDeepEqual(
    attestPostHogTerminalDeletion(wrong),
    { kind: 'ambiguous', resultCode: 'POSTHOG_STATUS_UNATTESTED' },
    'a wrong target cannot attest deletion.',
  );
  const duplicate = terminalOptions();
  duplicate.eventStatuses = [completedStatus(PERSON_UUID_A), completedStatus(PERSON_UUID_A)];
  assertDeepEqual(
    attestPostHogTerminalDeletion(duplicate),
    { kind: 'ambiguous', resultCode: 'POSTHOG_STATUS_UNATTESTED' },
    'duplicate evidence cannot substitute for the full target set.',
  );
  const missing = terminalOptions();
  missing.eventStatuses = [completedStatus(PERSON_UUID_A)];
  assertDeepEqual(
    attestPostHogTerminalDeletion(missing),
    { kind: 'ambiguous', resultCode: 'POSTHOG_STATUS_UNATTESTED' },
    'missing one target cannot attest deletion.',
  );

  const unpersistedTargets = terminalOptions();
  unpersistedTargets.targetSetEvidence.persisted = false as true;
  assertProviderError(
    () => attestPostHogTerminalDeletion(unpersistedTargets),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
  const targetsCapturedAfterDispatch = terminalOptions();
  targetsCapturedAfterDispatch.targetSetEvidence.capturedAt = '2026-07-13T12:00:01.000Z';
  assertProviderError(
    () => attestPostHogTerminalDeletion(targetsCapturedAfterDispatch),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
});

Deno.test('PostHog terminal chronology binds verified >= created >= cutoff', () => {
  const beforeCutoff = terminalOptions();
  beforeCutoff.eventStatuses[0] = completedStatus(PERSON_UUID_A, {
    createdAt: CAPTURE_SHUTDOWN,
  });
  assertProviderError(
    () => attestPostHogTerminalDeletion(beforeCutoff),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
  const verifiedBeforeCreated = terminalOptions();
  verifiedBeforeCreated.eventStatuses[0] = completedStatus(PERSON_UUID_A, {
    createdAt: VERIFIED_AT,
    verifiedAt: CREATED_AT,
  });
  assertProviderError(
    () => attestPostHogTerminalDeletion(verifiedBeforeCreated),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
  const wrongCutoff = terminalOptions();
  wrongCutoff.eventStatuses[0] = completedStatus(PERSON_UUID_A, {
    cutoff: '2026-07-13T11:00:00.000Z',
  });
  assertProviderError(
    () => attestPostHogTerminalDeletion(wrongCutoff),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
});

Deno.test('PostHog quiescence needs two persisted observations after shutdown and dispatch', () => {
  const onlyOne = terminalOptions();
  onlyOne.absenceObservations = [onlyOne.absenceObservations[0]];
  assertDeepEqual(
    attestPostHogTerminalDeletion(onlyOne),
    { kind: 'pending', resultCode: 'POSTHOG_QUIESCENCE_PENDING' },
    'one absence is insufficient.',
  );
  const tooClose = terminalOptions();
  tooClose.absenceObservations[1] = {
    kind: 'absent',
    observedAt: '2026-07-13T12:10:59.000Z',
    persisted: true,
  };
  assertDeepEqual(
    attestPostHogTerminalDeletion(tooClose),
    { kind: 'pending', resultCode: 'POSTHOG_QUIESCENCE_PENDING' },
    'the configured minimum interval must be enforced.',
  );
  const beforeDispatch = terminalOptions();
  beforeDispatch.absenceObservations[0] = {
    kind: 'absent',
    observedAt: DISPATCH_CUTOFF,
    persisted: true,
  };
  assertDeepEqual(
    attestPostHogTerminalDeletion(beforeDispatch),
    { kind: 'pending', resultCode: 'POSTHOG_QUIESCENCE_PENDING' },
    'observations must be strictly after capture shutdown and dispatch.',
  );
  const notPersisted = terminalOptions();
  notPersisted.absenceObservations[0] = {
    kind: 'absent',
    observedAt: '2026-07-13T12:06:00.000Z',
    persisted: false as true,
  };
  assertProviderError(
    () => attestPostHogTerminalDeletion(notPersisted),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
});

Deno.test('PostHog requires explicit durable evidence that recordings were not collected', () => {
  const recordings = terminalOptions();
  recordings.noRecordingsEvidence.recordingsCollected = true;
  assertDeepEqual(
    attestPostHogTerminalDeletion(recordings),
    {
      kind: 'action_required',
      resultCode: 'POSTHOG_RECORDING_VERIFICATION_REQUIRED',
    },
    'recording collection requires a separately attestable workflow.',
  );
  const staleEvidence = terminalOptions();
  staleEvidence.noRecordingsEvidence.verifiedAt = '2026-07-13T11:58:00.000Z';
  assertDeepEqual(
    attestPostHogTerminalDeletion(staleEvidence),
    {
      kind: 'action_required',
      resultCode: 'POSTHOG_RECORDING_VERIFICATION_REQUIRED',
    },
    'recording evidence must postdate capture shutdown.',
  );
  const extraEvidence = terminalOptions();
  (extraEvidence.noRecordingsEvidence as Record<string, unknown>).extra = true;
  assertProviderError(
    () => attestPostHogTerminalDeletion(extraEvidence),
    'POSTHOG_STATUS_INPUT_INVALID',
  );
});

Deno.test('PostHog latest lookup and incomplete status remain nonterminal', () => {
  const reappeared = terminalOptions();
  reappeared.latestLookup = { kind: 'found', personUuids: [PERSON_UUID_A] };
  assertDeepEqual(
    attestPostHogTerminalDeletion(reappeared),
    { kind: 'pending', resultCode: 'POSTHOG_PERSON_REAPPEARED' },
    'a recreated person blocks completion.',
  );
  const pending = terminalOptions();
  pending.eventStatuses = [
    { kind: 'pending', resultCode: 'POSTHOG_STATUS_PENDING' },
    completedStatus(PERSON_UUID_B),
  ];
  assertDeepEqual(
    attestPostHogTerminalDeletion(pending),
    { kind: 'pending', resultCode: 'POSTHOG_STATUS_PENDING' },
    'pending event deletion blocks completion.',
  );
  const missing = terminalOptions();
  missing.eventStatuses = [
    { kind: 'missing', resultCode: 'POSTHOG_STATUS_MISSING' },
    completedStatus(PERSON_UUID_B),
  ];
  assertDeepEqual(
    attestPostHogTerminalDeletion(missing),
    { kind: 'ambiguous', resultCode: 'POSTHOG_STATUS_UNATTESTED' },
    'missing current dispatch status cannot attest completion.',
  );
});

Deno.test('provider durable results and errors never include raw customer identifiers', () => {
  const secretCustomerId = 'raw-customer-identifier-that-must-not-persist';
  const outputs = [
    classifyRevenueCatV1DeleteResponse(
      200,
      { app_user_id: secretCustomerId, deleted: true },
      secretCustomerId,
    ),
    classifyRevenueCatV1DeleteResponse(
      200,
      { app_user_id: WRONG_USER_ID, deleted: true },
      secretCustomerId,
    ),
    adaptAppleRevocationForDeletionStep(appleManualRevocationDisposition()),
    attestPostHogTerminalDeletion(terminalOptions()),
  ];
  for (const output of outputs) {
    assert(
      !JSON.stringify(output).includes(secretCustomerId),
      'durable provider outcomes must omit raw customer identifiers.',
    );
  }
  const rawProviderId = 'not-a-provider-uuid-customer-secret';
  try {
    buildPostHogBulkDeleteRequest({
      ...POSTHOG_OPTIONS,
      personUuids: [rawProviderId],
      deleteRecordings: false,
      dispatchCutoffAt: DISPATCH_CUTOFF,
    });
  } catch (error) {
    assert(error instanceof DurableProviderDeletionError, 'expected stable provider error.');
    assert(!error.message.includes(rawProviderId), 'errors must not echo provider handles.');
    return;
  }
  throw new Error('expected malformed UUID rejection.');
});
