import {
  type CatalogOperatorClient,
  type CatalogOperatorDatabaseResult,
  createCatalogOperatorHttpHandler,
  parseCatalogOperatorAllowedOrigins,
  parseCatalogOperatorSupabaseUrl,
} from "./httpHandler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ORIGIN = "https://ops.example.test";
const URL = "https://project.example.test/functions/v1/catalog-operator";
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Call = Readonly<{ name: string; args: Readonly<Record<string, unknown>> }>;

function sessionData(): unknown {
  return [
    {
      operator_session_id: SESSION_ID,
      expires_at: "2026-07-22T12:10:00+00:00",
      capabilities: ["correction_triage", "source_review_record"],
      operator_user_id: USER_ID,
      operator_email: "operator@example.test",
      edge_environment: "production",
      source_revision: "b".repeat(40),
      edge_deployment_id: "project_function_42",
      admission_state: "open",
      control_generation: 7,
    },
  ];
}

function harness(options: {
  userId?: string | null;
  authSessionId?: string | null;
  result?: CatalogOperatorDatabaseResult;
  throwAuth?: boolean;
  throwRpc?: boolean;
} = {}) {
  const calls: Call[] = [];
  let clientCreations = 0;
  const handler = createCatalogOperatorHttpHandler({
    allowedOrigins: new Set([ORIGIN]),
    maxBodyBytes: 1_024,
    requestId: () => REQUEST_ID,
    createClient(authorization): CatalogOperatorClient {
      clientCreations += 1;
      assert(
        authorization === "Bearer jwt-value",
        "only the normalized bearer reaches the client",
      );
      return {
        async verifiedAuth() {
          if (options.throwAuth) throw new Error("raw auth provider detail");
          const userId = options.userId === undefined
            ? USER_ID
            : options.userId;
          const authSessionId = options.authSessionId === undefined
            ? SESSION_ID
            : options.authSessionId;
          return userId && authSessionId ? { userId, authSessionId } : null;
        },
        async rpc(name, args) {
          calls.push({ name, args });
          if (options.throwRpc) {
            throw new Error("raw database and operator detail");
          }
          return options.result ?? { data: sessionData(), error: null };
        },
      };
    },
  });
  return { handler, calls, clientCreations: () => clientCreations };
}

function post(body: unknown, headers: HeadersInit = {}): Request {
  return new Request(URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer jwt-value",
      "Content-Type": "application/json",
      Origin: ORIGIN,
      "X-Request-Id": REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("operator endpoint permits only exact configured browser origins and preflight headers", async () => {
  const { handler, clientCreations } = harness();
  const accepted = await handler(
    new Request(URL, {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers":
          "authorization, cache-control, content-type, x-request-id",
      },
    }),
  );
  assert(accepted.status === 204, "reviewed console preflight accepted");
  assert(
    accepted.headers.get("Access-Control-Allow-Origin") === ORIGIN,
    "exact origin echoed",
  );
  assert(
    accepted.headers.get("Access-Control-Max-Age") === "300",
    "preflight cache is short",
  );

  const wrongOrigin = await handler(
    new Request(URL, {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.test",
        "Access-Control-Request-Method": "POST",
      },
    }),
  );
  assert(wrongOrigin.status === 403, "unconfigured origin rejected");
  assert(
    wrongOrigin.headers.get("Access-Control-Allow-Origin") === null,
    "no attacker CORS grant",
  );

  const wrongHeaders = await handler(
    new Request(URL, {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, x-operator-secret",
      },
    }),
  );
  assert(wrongHeaders.status === 403, "unreviewed preflight header rejected");
  assert(
    clientCreations() === 0,
    "preflight never touches authentication or data",
  );
});

Deno.test("operator endpoint rejects methods, media types, sizes, syntax, and loose shapes before RPC", async () => {
  const { handler, calls, clientCreations } = harness();
  const method = await handler(
    new Request(URL, { method: "GET", headers: { Origin: ORIGIN } }),
  );
  assert(
    method.status === 405 && method.headers.get("Allow") === "POST, OPTIONS",
    "POST only",
  );

  const media = await handler(
    new Request(URL, {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        Authorization: "Bearer jwt-value",
        "Content-Type": "text/plain",
      },
      body: "{}",
    }),
  );
  assert(media.status === 415, "JSON media type required");
  const nonUtf8 = await handler(
    new Request(URL, {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        Authorization: "Bearer jwt-value",
        "Content-Type": "application/json; charset=latin1",
      },
      body: "{}",
    }),
  );
  assert(nonUtf8.status === 415, "operator JSON must be UTF-8");

  const declaredLarge = await handler(
    post({ action: "session" }, { "Content-Length": "1025" }),
  );
  assert(declaredLarge.status === 413, "declared oversized body rejected");
  const streamedLarge = await handler(
    post({ action: "session", padding: "x".repeat(1_100) }),
  );
  assert(
    streamedLarge.status === 413,
    "actual oversized body rejected without trusting the header",
  );

  const malformed = await handler(
    new Request(URL, {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        Authorization: "Bearer jwt-value",
        "Content-Type": "application/json",
        "X-Request-Id": REQUEST_ID,
      },
      body: "{",
    }),
  );
  assert(malformed.status === 400, "malformed JSON rejected");
  assert(
    (await handler(post({ action: "session", userId: USER_ID }))).status ===
      400,
    "extra field",
  );
  assert(
    (await handler(post({
      action: "session",
      p_auth_session_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }))).status === 400,
    "caller cannot select the backend Auth session argument",
  );
  assert(
    clientCreations() === 0,
    "invalid transport and bodies do not authenticate",
  );
  assert(calls.length === 0, "invalid transport and bodies do not invoke RPCs");
});

Deno.test("operator endpoint requires a verified user JWT before the operator RPC", async () => {
  const missingHarness = harness();
  const missing = await missingHarness.handler(
    post({ action: "session" }, { Authorization: "" }),
  );
  assert(missing.status === 401, "missing bearer rejected");
  assert(missingHarness.calls.length === 0, "missing bearer issues no RPC");

  const invalidHarness = harness({ userId: null });
  const invalid = await invalidHarness.handler(post({ action: "session" }));
  assert(invalid.status === 401, "unverified JWT rejected");
  assert(invalidHarness.calls.length === 0, "unverified JWT issues no RPC");

  const malformedSessionHarness = harness({ authSessionId: "not-a-uuid" });
  const malformedSession = await malformedSessionHarness.handler(
    post({ action: "session" }),
  );
  assert(malformedSession.status === 401, "malformed signed session rejected");
  assert(
    malformedSessionHarness.calls.length === 0,
    "malformed signed session issues no RPC",
  );

  const thrownHarness = harness({ throwAuth: true });
  const thrown = await thrownHarness.handler(post({ action: "session" }));
  assert(thrown.status === 401, "auth provider failure is a generic denial");
  assert(
    !(await thrown.text()).includes("provider detail"),
    "auth internals are redacted",
  );
});

Deno.test("operator endpoint injects only verified session authority into the mapped backend RPC", async () => {
  const { handler, calls } = harness();
  const response = await handler(post({ action: "session" }));
  const body = await response.json();
  assert(response.status === 200, "valid operator session returned");
  assert(
    calls.length === 1 && calls[0]?.name === "catalog_operator_session",
    "one narrow RPC",
  );
  assert(
    JSON.stringify(calls[0]?.args) ===
      JSON.stringify({ p_auth_session_id: SESSION_ID }),
    "only the independently verified Auth session is injected",
  );
  assert(
    body.result.operatorSessionId === SESSION_ID,
    "bounded session receipt returned",
  );
  assert(
    body.result.operatorUserId === USER_ID,
    "database-derived operator identity is returned",
  );
  assert(
    body.result.operatorEmail === "operator@example.test",
    "database-confirmed normalized operator email is returned",
  );
  assert(
    body.result.environment === "production" &&
      body.result.sourceRevision === "b".repeat(40) &&
      body.result.edgeDeploymentId === "project_function_42" &&
      body.result.admissionState === "open" &&
      body.result.controlGeneration === 7,
    "database-confirmed runtime authority receipt is returned",
  );
  assert(
    body.result.expiresAt === "2026-07-22T12:10:00.000Z",
    "timestamp normalized",
  );
  assert(
    response.headers.get("Access-Control-Allow-Origin") === ORIGIN,
    "console CORS retained",
  );
  assert(
    response.headers.get("Cache-Control")?.includes("no-store"),
    "operator data is not cached",
  );
  assert(
    response.headers.get("Pragma") === "no-cache",
    "legacy cache prevention retained",
  );
  assert(
    response.headers.get("X-Content-Type-Options") === "nosniff",
    "MIME sniffing disabled",
  );
  assert(
    response.headers.get("X-Frame-Options") === "DENY",
    "framing disabled",
  );
  assert(
    response.headers.get("Content-Security-Policy")?.includes(
      "default-src 'none'",
    ),
    "JSON response has a deny-all content policy",
  );
  assert(
    response.headers.get("Referrer-Policy") === "no-referrer",
    "referrer leakage disabled",
  );
  assert(
    response.headers.get("X-Request-Id") === REQUEST_ID,
    "content-free request id echoed",
  );
});

Deno.test("operator endpoint maps known conflicts but redacts every other database failure", async () => {
  const conflictHarness = harness({
    result: {
      data: null,
      error: { message: "CATALOG_OPERATOR_VERSION_CONFLICT" },
    },
  });
  const conflict = await conflictHarness.handler(post({ action: "session" }));
  assert(conflict.status === 409, "known CAS conflict is actionable");
  assert(
    JSON.stringify(await conflict.json()) ===
      JSON.stringify({ error: "conflict" }),
    "generic conflict",
  );

  const rawHarness = harness({
    result: {
      data: null,
      error: {
        message: "database connection failed for reporter@example.test",
        details: "raw proposed_payload and JWT",
      },
    },
  });
  const raw = await rawHarness.handler(post({ action: "session" }));
  const rawText = await raw.text();
  assert(raw.status === 503, "unknown database error is unavailable");
  assert(
    !rawText.includes("reporter") && !rawText.includes("payload"),
    "database details redacted",
  );
  assert(
    raw.headers.get("Retry-After") === "30",
    "bounded retry advice returned",
  );

  for (
    const code of [
      "CATALOG_OPERATOR_AUDIT_INPUT_INVALID",
      "CATALOG_OPERATOR_CLAIM_CLEANUP_INPUT_INVALID",
      "CATALOG_OPERATOR_LEDGER_IMMUTABLE",
      "CATALOG_OPERATOR_LEDGER_TIME_INVALID",
    ]
  ) {
    const invariantHarness = harness({
      result: { data: null, error: { message: code } },
    });
    const invariant = await invariantHarness.handler(
      post({ action: "session" }),
    );
    assert(invariant.status === 503, `${code} remains an internal invariant`);
    assert(
      JSON.stringify(await invariant.json()) ===
        JSON.stringify({ error: "operator_unavailable" }),
      "internal invariant is redacted",
    );
  }

  const thrownHarness = harness({ throwRpc: true });
  const thrown = await thrownHarness.handler(post({ action: "session" }));
  const thrownText = await thrown.text();
  assert(thrown.status === 503, "RPC exception is unavailable");
  assert(
    !thrownText.includes("database") && !thrownText.includes("operator detail"),
    "exception redacted",
  );
});

Deno.test("operator endpoint maps exact live auth, capability, input, and lookup denials", async () => {
  for (
    const code of [
      "CATALOG_OPERATOR_AAL2_SESSION_REQUIRED",
      "CATALOG_OPERATOR_NONANONYMOUS_REQUIRED",
      "CATALOG_OPERATOR_AUTH_SESSION_NOT_LIVE",
      "CATALOG_OPERATOR_ACCOUNT_ACCESS_DENIED",
      "CATALOG_OPERATOR_VERIFIED_MFA_REQUIRED",
      "CATALOG_OPERATOR_VERIFIED_TOTP_SESSION_REQUIRED",
      "CATALOG_OPERATOR_GRANT_REQUIRED",
      "CATALOG_OPERATOR_CAPABILITY_DENIED",
      "CATALOG_OPERATOR_SESSION_EXPIRED",
      "CATALOG_OPERATOR_SECOND_PERSON_REQUIRED",
      "CATALOG_OPERATOR_REPAIR_ATTESTATION_SEPARATION_REQUIRED",
      "CATALOG_OPERATOR_REPAIR_ARTIFACT_AUTHOR_SEPARATION_REQUIRED",
      "CATALOG_OPERATOR_THIRD_PERSON_RELEASE_REQUIRED",
    ]
  ) {
    const { handler } = harness({
      result: { data: null, error: { message: code } },
    });
    const response = await handler(post({ action: "session" }));
    assert(response.status === 403, `${code} is a secure denial`);
    assert(
      JSON.stringify(await response.json()) ===
        JSON.stringify({ error: "forbidden" }),
      "denial is generic",
    );
  }
  for (
    const code of [
      "CATALOG_OPERATOR_CAPABILITY_INVALID",
      "CATALOG_OPERATOR_ITEM_KIND_INVALID",
      "CATALOG_OPERATOR_QUEUE_INPUT_INVALID",
      "CATALOG_OPERATOR_DETAIL_INPUT_INVALID",
      "CATALOG_OPERATOR_CLAIM_INPUT_INVALID",
      "CATALOG_OPERATOR_TRANSITION_INPUT_INVALID",
      "CATALOG_OPERATOR_TRANSITION_NOT_ALLOWED",
      "CATALOG_OPERATOR_CORRECTION_REASON_MISMATCH",
      "CATALOG_OPERATOR_HOLD_MUTATION_INPUT_INVALID",
      "CATALOG_OPERATOR_RELEASE_INPUT_INVALID",
    ]
  ) {
    const { handler } = harness({
      result: { data: null, error: { message: code } },
    });
    const response = await handler(post({ action: "session" }));
    assert(response.status === 400, `${code} is an invalid request`);
    assert(
      JSON.stringify(await response.json()) ===
        JSON.stringify({ error: "invalid_request" }),
      "input denial is generic",
    );
  }
  for (
    const code of [
      "CATALOG_OPERATOR_ITEM_NOT_FOUND",
      "CATALOG_OPERATOR_HOLD_NOT_FOUND",
      "CATALOG_OPERATOR_PRODUCT_NOT_FOUND",
    ]
  ) {
    const { handler } = harness({
      result: { data: null, error: { message: code } },
    });
    const missing = await handler(post({ action: "session" }));
    assert(missing.status === 404, `${code} is not found`);
    assert(
      JSON.stringify(await missing.json()) ===
        JSON.stringify({ error: "not_found" }),
      "generic not found",
    );
  }

  for (
    const code of [
      "CATALOG_OPERATOR_OPERATION_CONFLICT",
      "CATALOG_OPERATOR_ITEM_ALREADY_CLAIMED",
      "CATALOG_OPERATOR_LEASE_INVALID",
      "CATALOG_OPERATOR_TRANSITION_STATE_INVALID",
      "CATALOG_OPERATOR_HOLD_STATE_CHANGED",
      "CATALOG_OPERATOR_BLOCKING_REPORTS_REMAIN",
      "CATALOG_OPERATOR_REPAIR_PROJECTION_UNCHANGED",
      "CATALOG_OPERATOR_PROMOTION_RECOMMENDATION_NOT_READY",
      "CATALOG_OPERATOR_ROLLBACK_RECOMMENDATION_NOT_READY",
      "CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED",
      "CATALOG_OPERATOR_NAMED_REPAIR_AUTHORITY_REQUIRED",
      "CATALOG_OPERATOR_DETAIL_UNAVAILABLE",
      "CATALOG_OPERATOR_REPAIR_RECEIPT_STALE",
    ]
  ) {
    const conflictHarness = harness({
      result: { data: null, error: { message: code } },
    });
    const response = await conflictHarness.handler(post({ action: "session" }));
    assert(response.status === 409, `${code} is a bounded conflict`);
    assert(
      JSON.stringify(await response.json()) ===
        JSON.stringify({ error: "conflict" }),
      "state conflict is generic",
    );
  }

  const rateHarness = harness({
    result: {
      data: null,
      error: { message: "CATALOG_OPERATOR_RATE_LIMITED" },
    },
  });
  const limited = await rateHarness.handler(post({ action: "session" }));
  assert(limited.status === 429, "database rate budget maps to HTTP 429");
  assert(
    JSON.stringify(await limited.json()) ===
      JSON.stringify({ error: "rate_limited" }),
    "rate denial is generic",
  );
  assert(
    limited.headers.get("Retry-After") === "900",
    "retry advice spans the full server budget window",
  );
});

Deno.test("operator endpoint rejects malformed or unsafe database projections instead of passing them through", async () => {
  const malformedHarness = harness({
    result: {
      data: [
        {
          operator_session_id: SESSION_ID,
          expires_at: "2026-07-22T12:10:00Z",
          capabilities: ["source_review_record"],
          operator_user_id: USER_ID,
          operator_email: "operator@example.test",
          edge_environment: "production",
          source_revision: "b".repeat(40),
          edge_deployment_id: "project_function_42",
          admission_state: "open",
          control_generation: 7,
          user_id: USER_ID,
        },
      ],
      error: null,
    },
  });
  const malformed = await malformedHarness.handler(post({ action: "session" }));
  assert(
    malformed.status === 503,
    "unexpected identity field fails the response closed",
  );
  assert(
    !(await malformed.text()).includes(USER_ID),
    "unexpected identity is never forwarded",
  );

  const rawDetailHarness = harness({
    result: {
      data: [
        {
          item_kind: "correction_report",
          item_id: USER_ID,
          item_version: 1,
          status: "open",
          detail: { proposed_payload: { message: "private health narrative" } },
        },
      ],
      error: null,
    },
  });
  const rawDetail = await rawDetailHarness.handler(
    post({
      action: "detail",
      itemKind: "correction_report",
      itemId: USER_ID,
      leaseId: SESSION_ID,
      expectedVersion: 1,
    }),
  );
  assert(rawDetail.status === 503, "raw payload projection rejected");
  assert(
    !(await rawDetail.text()).includes("health narrative"),
    "raw payload never forwarded",
  );
});

Deno.test("operator origin configuration is exact, HTTPS-only outside local development, and fail closed", () => {
  const configured = parseCatalogOperatorAllowedOrigins(
    "https://ops.example.test,https://backup.example.test:8443",
    "production",
  );
  assert(
    configured.size === 2 && configured.has(ORIGIN),
    "reviewed HTTPS origins accepted",
  );
  const local = parseCatalogOperatorAllowedOrigins(
    "http://localhost:4173",
    "development",
  );
  assert(
    local.has("http://localhost:4173"),
    "loopback HTTP is local-development-only",
  );

  for (
    const [value, environment] of [
      ["", "production"],
      ["*", "production"],
      ["http://ops.example.test", "production"],
      ["http://localhost:4173", "production"],
      ["https://user:password@ops.example.test", "production"],
      ["https://ops.example.test/path", "production"],
      ["https://ops.example.test,https://ops.example.test", "production"],
    ]
  ) {
    let failed = false;
    try {
      parseCatalogOperatorAllowedOrigins(value, environment);
    } catch {
      failed = true;
    }
    assert(failed, `unsafe origin configuration rejected: ${value}`);
  }
});

Deno.test("operator database transport is HTTPS except for exact development loopback", () => {
  assert(
    parseCatalogOperatorSupabaseUrl(
      "https://project.supabase.co",
      "production",
    ) === "https://project.supabase.co",
    "hosted HTTPS authority accepted",
  );
  assert(
    parseCatalogOperatorSupabaseUrl(
      "http://127.0.0.1:54321",
      "development",
    ) === "http://127.0.0.1:54321",
    "local Supabase accepted only in development",
  );
  for (
    const [value, environment] of [
      ["", "production"],
      ["http://project.supabase.co", "production"],
      ["http://127.0.0.1:54321", "staging"],
      ["https://user:password@project.supabase.co", "production"],
      ["https://project.supabase.co/rest/v1", "production"],
      ["https://project.supabase.co?token=secret", "production"],
    ]
  ) {
    let failed = false;
    try {
      parseCatalogOperatorSupabaseUrl(value, environment);
    } catch {
      failed = true;
    }
    assert(failed, `unsafe Supabase URL rejected: ${value}`);
  }
});

Deno.test("operator request ids are exact UUIDv4 values and never become an RPC argument", async () => {
  const { handler, calls } = harness();
  const invalid = await handler(
    post(
      { action: "session" },
      { "X-Request-Id": "bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb" },
    ),
  );
  assert(invalid.status === 400, "non-v4 correlation id rejected");
  assert(calls.length === 0, "invalid correlation id issues no RPC");

  const accepted = await handler(
    new Request(URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer jwt-value",
        "Content-Type": "application/json",
        Origin: ORIGIN,
      },
      body: JSON.stringify({ action: "session" }),
    }),
  );
  assert(accepted.status === 200, "missing correlation id is generated safely");
  assert(
    accepted.headers.get("X-Request-Id") === REQUEST_ID,
    "generated id returned",
  );
  assert(
    Number(calls.length) === 1 &&
      JSON.stringify(calls[0]?.args) ===
        JSON.stringify({ p_auth_session_id: SESSION_ID }),
    "request id is not authority and only verified session identity is injected",
  );
});
