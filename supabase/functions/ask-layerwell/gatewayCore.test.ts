import {
  ASK_GATEWAY_OPERATION,
  ASK_GATEWAY_PROTOCOL_VERSION,
  type AskGatewayRequest,
  type AskGatewaySuccess,
} from "./contract.ts";
import {
  type AskCircuitBreaker,
  type AskProvider,
  type AskQuotaLedger,
  NonAuthoritativeCircuitBreaker,
  ProviderFailure,
  type ProviderResult,
  type QuotaLease,
  type QuotaReservation,
  runAskGateway,
} from "./gatewayCore.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

const REQUEST: AskGatewayRequest = {
  protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
  operation: ASK_GATEWAY_OPERATION,
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  consentGeneration: "4",
  locale: "en",
  question: "What does this evidence card say?",
  context: {
    skinType: "dry",
    sensitivity: true,
    pregnancyAware: false,
    goalConcern: "appearance_of_texture",
    ingredientNames: ["niacinamide"],
  },
  grounding: {
    corpusVersion: "corpus-v1",
    promptVersion: "prompt-v1",
    evidenceCardIds: ["card-1"],
  },
};

const RESULT: ProviderResult = {
  narration: "A constrained, grounded connective sentence.",
  citationCardIds: ["card-1"],
  modelSnapshot: "fake-model-2026-09-26",
  usage: { inputTokens: 40, outputTokens: 12, estimatedCostMicros: 25 },
};

const CONFIG = {
  enabled: true,
  maximumCostMicros: 100,
  maxOutputTokens: 50,
  timeoutMs: 250,
  maxAttempts: 1 as const,
};

async function requestFingerprint(request: AskGatewayRequest): Promise<string> {
  const canonical = JSON.stringify({
    protocolVersion: request.protocolVersion,
    operation: request.operation,
    requestId: request.requestId,
    consentGeneration: request.consentGeneration,
    locale: request.locale,
    question: request.question,
    context: {
      skinType: request.context.skinType,
      sensitivity: request.context.sensitivity,
      pregnancyAware: request.context.pregnancyAware,
      goalConcern: request.context.goalConcern,
      ingredientNames: [...request.context.ingredientNames],
    },
    grounding: {
      corpusVersion: request.grounding.corpusVersion,
      promptVersion: request.grounding.promptVersion,
      evidenceCardIds: [...request.grounding.evidenceCardIds],
    },
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

class Ledger implements AskQuotaLedger {
  readonly events: string[] = [];
  override: QuotaReservation | undefined;
  commitResult: unknown = true;
  reservedFingerprint: string | undefined;

  reserve(
    input: Parameters<AskQuotaLedger["reserve"]>[0],
  ): Promise<QuotaReservation> {
    this.events.push("reserve");
    this.reservedFingerprint = input.requestFingerprint;
    return Promise.resolve(
      this.override === undefined
        ? {
          state: "reserved" as const,
          lease: {
            token: "lease",
            ownerId: input.ownerId,
            requestId: input.requestId,
            requestFingerprint: input.requestFingerprint,
          },
        }
        : this.override,
    );
  }
  commit(_lease: QuotaLease, _response: AskGatewaySuccess): Promise<boolean> {
    this.events.push("commit");
    return Promise.resolve(this.commitResult) as Promise<boolean>;
  }
  release(
    _lease: QuotaLease,
    disposition: "provider_failed" | "provider_timeout",
  ): Promise<void> {
    this.events.push(`release:${disposition}`);
    return Promise.resolve();
  }
}

function provider(run: () => Promise<ProviderResult>): AskProvider {
  return { generate: () => run() };
}

function statefulPayload() {
  let narrationReads = 0;
  let outputTokenReads = 0;
  const usage = {
    inputTokens: 40,
    get outputTokens() {
      outputTokenReads += 1;
      return outputTokenReads <= 3 ? 12 : 999;
    },
    estimatedCostMicros: 25,
  };
  const payload = {
    get narration() {
      narrationReads += 1;
      return narrationReads <= 4
        ? "A constrained, grounded connective sentence."
        : "UNVALIDATED_MUTATION";
    },
    citationCardIds: ["card-1"],
    modelSnapshot: "fake-model-2026-09-26",
    usage,
  };
  return {
    payload: payload as ProviderResult,
    reads: () => ({ narrationReads, outputTokenReads }),
  };
}

function invoke(
  ledger: Ledger,
  askProvider: AskProvider,
  circuit: AskCircuitBreaker = new NonAuthoritativeCircuitBreaker(),
  config = CONFIG,
  request = REQUEST,
) {
  return runAskGateway({
    ownerId: "owner-a",
    request,
    config,
    quota: ledger,
    provider: askProvider,
    circuit,
  });
}

Deno.test("full canonical request fingerprint is bound atomically before provider work", async () => {
  const ledger = new Ledger();
  const result = await invoke(
    ledger,
    provider(() => {
      assert(
        ledger.events.join(",") === "reserve",
        "provider ran before reservation",
      );
      ledger.events.push("provider");
      return Promise.resolve(RESULT);
    }),
  );
  assert(result.status === "grounded");
  assert(ledger.events.join(",") === "reserve,provider,commit");
  assert(
    ledger.reservedFingerprint === await requestFingerprint(REQUEST),
  );
  for (
    const changed of [
      { ...REQUEST, question: `${REQUEST.question}!` },
      { ...REQUEST, consentGeneration: "5" },
      { ...REQUEST, context: { ...REQUEST.context, sensitivity: false } },
      {
        ...REQUEST,
        grounding: { ...REQUEST.grounding, promptVersion: "prompt-v2" },
      },
      {
        ...REQUEST,
        grounding: { ...REQUEST.grounding, evidenceCardIds: ["card-2"] },
      },
    ]
  ) {
    assert(
      await requestFingerprint(changed) !==
        ledger.reservedFingerprint,
    );
  }
});

Deno.test("strict runtime config rejects malformed and out-of-range values before quota/provider", async () => {
  const invalid = [
    { ...CONFIG, maximumCostMicros: 0 },
    { ...CONFIG, maxOutputTokens: 1025 },
    { ...CONFIG, timeoutMs: 249 },
    { ...CONFIG, maxAttempts: 2 },
    { ...CONFIG, surprise: true },
  ];
  for (const config of invalid) {
    const ledger = new Ledger();
    let calls = 0;
    const result = await invoke(
      ledger,
      provider(() => Promise.resolve((calls += 1, RESULT))),
      new NonAuthoritativeCircuitBreaker(),
      config as typeof CONFIG,
    );
    assert(result.status === "error" && result.error === "gateway_unavailable");
    assert(ledger.events.length === 0 && calls === 0);
  }
});

Deno.test("throwing request coercion is redacted before fingerprint and reservation", async () => {
  const ledger = new Ledger();
  let calls = 0;
  const throwingRequest = new Proxy(REQUEST, {
    get(target, property, receiver) {
      if (property === "protocolVersion") {
        throw new Error("private coercion detail");
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const result = await invoke(
    ledger,
    provider(() => Promise.resolve((calls += 1, RESULT))),
    new NonAuthoritativeCircuitBreaker(),
    CONFIG,
    throwingRequest,
  );
  assert(result.status === "error" && result.error === "gateway_unavailable");
  assert(!JSON.stringify(result).includes("coercion"));
  assert(ledger.events.length === 0 && calls === 0);
});

Deno.test("every reservation variant is exact and identity-bound before provider work", async () => {
  const fingerprint = await requestFingerprint(REQUEST);
  const response: AskGatewaySuccess = {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    requestId: REQUEST.requestId,
    status: "grounded",
    ...RESULT,
  };
  const lease = {
    token: "lease",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: fingerprint,
  };
  const malformed: unknown[] = [
    null,
    {},
    { state: "unknown" },
    { state: "busy", extra: true },
    { state: "quota_exceeded", extra: true },
    { state: "cost_ceiling", extra: true },
    { state: "unavailable", extra: true },
    { state: "reserved", lease: null },
    { state: "reserved", lease: { ...lease, token: "" } },
    { state: "reserved", lease: { ...lease, ownerId: "owner-b" } },
    {
      state: "reserved",
      lease: { ...lease, requestId: "123e4567-e89b-42d3-a456-426614174001" },
    },
    {
      state: "reserved",
      lease: { ...lease, requestFingerprint: "0".repeat(64) },
    },
    { state: "reserved", lease: { ...lease, extra: true } },
    { state: "reserved", lease, extra: true },
    { state: "replay", requestFingerprint: fingerprint, response },
    {
      state: "replay",
      ownerId: "owner-b",
      requestId: REQUEST.requestId,
      requestFingerprint: fingerprint,
      response,
    },
    {
      state: "replay",
      ownerId: "owner-a",
      requestId: "123e4567-e89b-42d3-a456-426614174001",
      requestFingerprint: fingerprint,
      response,
    },
    {
      state: "replay",
      ownerId: "owner-a",
      requestId: REQUEST.requestId,
      requestFingerprint: "0".repeat(64),
      response,
    },
    {
      state: "replay",
      ownerId: "owner-a",
      requestId: REQUEST.requestId,
      requestFingerprint: fingerprint,
      response: null,
    },
    {
      state: "replay",
      ownerId: "owner-a",
      requestId: REQUEST.requestId,
      requestFingerprint: fingerprint,
      response,
      extra: true,
    },
  ];
  for (const reservation of malformed) {
    const ledger = new Ledger();
    ledger.override = reservation as QuotaReservation;
    let calls = 0;
    const result = await invoke(
      ledger,
      provider(() => Promise.resolve((calls += 1, RESULT))),
    );
    assert(
      result.status === "error" && result.error === "gateway_unavailable",
      `malformed reservation admitted: ${JSON.stringify(reservation)}`,
    );
    assert(calls === 0, `provider called for: ${JSON.stringify(reservation)}`);
  }
});

Deno.test("provider and stored outputs require exact keys and canonical construction", async () => {
  for (
    const invalid of [
      { ...RESULT, injected: "secret" },
      { ...RESULT, usage: { ...RESULT.usage, injected: 1 } },
      { ...RESULT, citationCardIds: [] },
    ]
  ) {
    const ledger = new Ledger();
    const result = await invoke(
      ledger,
      provider(() => Promise.resolve(invalid as ProviderResult)),
    );
    assert(result.status === "error" && result.error === "gateway_unavailable");
    assert(!ledger.events.includes("commit"));
  }

  const fingerprint = await requestFingerprint(REQUEST);
  const stored = {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    requestId: REQUEST.requestId,
    status: "grounded" as const,
    ...RESULT,
  };
  const extraLedger = new Ledger();
  extraLedger.override = {
    state: "replay",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: fingerprint,
    response: { ...stored, injected: "secret" } as AskGatewaySuccess,
  };
  const rejected = await invoke(
    extraLedger,
    provider(() => Promise.resolve(RESULT)),
  );
  assert(
    rejected.status === "error" && rejected.error === "gateway_unavailable",
  );

  const validLedger = new Ledger();
  validLedger.override = {
    state: "replay",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: fingerprint,
    response: stored,
  };
  const replay = await invoke(
    validLedger,
    provider(() => Promise.resolve(RESULT)),
  );
  assert(replay.status === "grounded" && replay !== stored);
  assert(
    Object.keys(replay).sort().join(",") ===
      "citationCardIds,modelSnapshot,narration,protocolVersion,requestId,status,usage",
  );
});

Deno.test("live provider output is snapshotted once before validation and delivery", async () => {
  const stateful = statefulPayload();
  const result = await invoke(
    new Ledger(),
    provider(() => Promise.resolve(stateful.payload)),
  );
  assert(result.status === "grounded");
  assert(result.narration === RESULT.narration);
  assert(result.usage.outputTokens === RESULT.usage.outputTokens);
  assert(!JSON.stringify(result).includes("UNVALIDATED_MUTATION"));
  assert(stateful.reads().narrationReads === 1);
  assert(stateful.reads().outputTokenReads === 1);
});

Deno.test("stored replay output is snapshotted once before validation and delivery", async () => {
  const fingerprint = await requestFingerprint(REQUEST);
  const stateful = statefulPayload();
  const response = {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    requestId: REQUEST.requestId,
    status: "grounded" as const,
    ...stateful.payload,
  };
  const ledger = new Ledger();
  ledger.override = {
    state: "replay",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: fingerprint,
    response,
  };
  const result = await invoke(ledger, provider(() => Promise.resolve(RESULT)));
  assert(result.status === "grounded");
  assert(result.narration === RESULT.narration);
  assert(result.usage.outputTokens === RESULT.usage.outputTokens);
  assert(!JSON.stringify(result).includes("UNVALIDATED_MUTATION"));
  assert(stateful.reads().narrationReads === 1);
  assert(stateful.reads().outputTokenReads === 1);
});

Deno.test("replay fingerprint mismatch fails and replay bypasses circuit admission", async () => {
  const fingerprint = await requestFingerprint(REQUEST);
  const response: AskGatewaySuccess = {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    requestId: REQUEST.requestId,
    status: "grounded",
    ...RESULT,
  };
  const deniedCircuit: AskCircuitBreaker = {
    admit: () => ({ ok: false, retryAfterSeconds: 30 }),
    recordFailure: () => undefined,
    recordSuccess: () => undefined,
  };
  const replayLedger = new Ledger();
  replayLedger.override = {
    state: "replay",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: fingerprint,
    response,
  };
  const replay = await invoke(
    replayLedger,
    provider(() => Promise.resolve(RESULT)),
    deniedCircuit,
  );
  assert(replay.status === "grounded");

  const mismatch = new Ledger();
  mismatch.override = {
    state: "replay",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: "0".repeat(64),
    response,
  };
  const rejected = await invoke(
    mismatch,
    provider(() => Promise.resolve(RESULT)),
    deniedCircuit,
  );
  assert(
    rejected.status === "error" && rejected.error === "gateway_unavailable",
  );
});

Deno.test("circuit admission is exact, bounded, and releases before failing closed", async () => {
  const invalidAdmissions: unknown[] = [
    null,
    { ok: "yes" },
    { ok: true, extra: true },
    { ok: false },
    { ok: false, retryAfterSeconds: "30" },
    { ok: false, retryAfterSeconds: 0 },
    { ok: false, retryAfterSeconds: 1.5 },
    { ok: false, retryAfterSeconds: 3601 },
    { ok: false, retryAfterSeconds: 30, extra: true },
  ];
  for (const admission of invalidAdmissions) {
    const ledger = new Ledger();
    let calls = 0;
    const circuit: AskCircuitBreaker = {
      admit: () => admission as ReturnType<AskCircuitBreaker["admit"]>,
      recordFailure: () => undefined,
      recordSuccess: () => undefined,
    };
    const result = await invoke(
      ledger,
      provider(() => Promise.resolve((calls += 1, RESULT))),
      circuit,
    );
    assert(result.status === "error" && result.error === "gateway_unavailable");
    assert(
      Object.keys(result).sort().join(",") ===
        "error,protocolVersion,retryable,status",
    );
    assert(calls === 0 && !ledger.events.includes("commit"));
    assert(ledger.events.includes("release:provider_failed"));
  }

  const throwingLedger = new Ledger();
  throwingLedger.release = () => {
    throwingLedger.events.push("release:sync-throw");
    throw new Error("private release detail");
  };
  const throwingCircuit: AskCircuitBreaker = {
    admit: () => {
      throw new Error("private circuit detail");
    },
    recordFailure: () => undefined,
    recordSuccess: () => undefined,
  };
  let throwingCalls = 0;
  const thrown = await invoke(
    throwingLedger,
    provider(() => Promise.resolve((throwingCalls += 1, RESULT))),
    throwingCircuit,
  );
  assert(thrown.status === "error" && thrown.error === "gateway_unavailable");
  assert(!JSON.stringify(thrown).includes("private"));
  assert(throwingLedger.events.includes("release:sync-throw"));
  assert(throwingCalls === 0 && !throwingLedger.events.includes("commit"));

  const blockedLedger = new Ledger();
  const blocked = await invoke(
    blockedLedger,
    provider(() => Promise.resolve(RESULT)),
    {
      admit: () => ({ ok: false, retryAfterSeconds: 30 }),
      recordFailure: () => undefined,
      recordSuccess: () => undefined,
    },
  );
  assert(blocked.status === "error" && blocked.error === "circuit_open");
  assert(blockedLedger.events.includes("release:provider_failed"));
});

Deno.test("throwing reservation and replay proxies are redacted before provider", async () => {
  const stateProxy = new Proxy({ state: "busy" }, {
    get(target, property, receiver) {
      if (property === "state") throw new Error("private state getter");
      return Reflect.get(target, property, receiver);
    },
  });
  const stateLedger = new Ledger();
  stateLedger.override = stateProxy as QuotaReservation;
  let calls = 0;
  const stateResult = await invoke(
    stateLedger,
    provider(() => Promise.resolve((calls += 1, RESULT))),
  );
  assert(
    stateResult.status === "error" &&
      stateResult.error === "gateway_unavailable",
  );
  assert(calls === 0 && !JSON.stringify(stateResult).includes("getter"));

  const fingerprint = await requestFingerprint(REQUEST);
  const replayProxy = new Proxy({} as AskGatewaySuccess, {
    ownKeys() {
      throw new Error("private replay keys");
    },
  });
  const replayLedger = new Ledger();
  replayLedger.override = {
    state: "replay",
    ownerId: "owner-a",
    requestId: REQUEST.requestId,
    requestFingerprint: fingerprint,
    response: replayProxy,
  };
  const replayResult = await invoke(
    replayLedger,
    provider(() => Promise.resolve((calls += 1, RESULT))),
  );
  assert(
    replayResult.status === "error" &&
      replayResult.error === "gateway_unavailable",
  );
  assert(calls === 0 && !JSON.stringify(replayResult).includes("replay"));
});

Deno.test("ambiguous timeout receives exactly one provider attempt", async () => {
  const ledger = new Ledger();
  let calls = 0;
  const result = await invoke(
    ledger,
    provider(() => {
      calls += 1;
      return new Promise<ProviderResult>(() => undefined);
    }),
  );
  assert(calls === 1);
  assert(result.status === "error" && result.error === "provider_timeout");
  assert(ledger.events.includes("release:provider_timeout"));
});

Deno.test("rate-limit failures receive exactly one provider attempt", async () => {
  const ledger = new Ledger();
  let calls = 0;
  const result = await invoke(
    ledger,
    provider(() => {
      calls += 1;
      return Promise.reject(new ProviderFailure("rate_limited"));
    }),
  );
  assert(calls === 1);
  assert(result.status === "error" && result.error === "gateway_unavailable");
  assert(!JSON.stringify(result).includes("rate_limited"));
  assert(ledger.events.includes("release:provider_failed"));
});

Deno.test("quota denials, disabled gateway, bounds, and commit failures fail closed", async () => {
  for (
    const reservation of [
      { state: "busy" },
      { state: "quota_exceeded" },
      { state: "cost_ceiling" },
      { state: "unavailable" },
    ] as QuotaReservation[]
  ) {
    const ledger = new Ledger();
    ledger.override = reservation;
    let calls = 0;
    const result = await invoke(
      ledger,
      provider(() => Promise.resolve((calls += 1, RESULT))),
    );
    assert(result.status === "error" && calls === 0);
  }
  for (
    const invalid of [
      { ...RESULT, usage: { ...RESULT.usage, estimatedCostMicros: 101 } },
      { ...RESULT, usage: { ...RESULT.usage, outputTokens: 51 } },
      { ...RESULT, citationCardIds: ["unreviewed-card"] },
      { ...RESULT, narration: "unsafe\u0000control" },
    ]
  ) {
    const result = await invoke(
      new Ledger(),
      provider(() => Promise.resolve(invalid)),
    );
    assert(result.status === "error" && result.error === "gateway_unavailable");
  }
  for (const malformedCommit of [false, "true", {}, null, 1]) {
    const commitLedger = new Ledger();
    commitLedger.commitResult = malformedCommit;
    const failedCommit = await invoke(
      commitLedger,
      provider(() => Promise.resolve(RESULT)),
    );
    assert(
      failedCommit.status === "error" &&
        failedCommit.error === "gateway_unavailable",
      `malformed commit admitted: ${JSON.stringify(malformedCommit)}`,
    );
    assert(commitLedger.events.includes("commit"));
  }

  const throwingCommit = new Ledger();
  throwingCommit.commit = () => {
    throwingCommit.events.push("commit:sync-throw");
    throw new Error("private commit detail");
  };
  const thrownCommit = await invoke(
    throwingCommit,
    provider(() => Promise.resolve(RESULT)),
  );
  assert(
    thrownCommit.status === "error" &&
      thrownCommit.error === "gateway_unavailable",
  );
  assert(!JSON.stringify(thrownCommit).includes("private"));

  const disabledLedger = new Ledger();
  const disabled = await invoke(
    disabledLedger,
    provider(() => Promise.resolve(RESULT)),
    new NonAuthoritativeCircuitBreaker(),
    { ...CONFIG, enabled: false },
  );
  assert(disabled.status === "error" && disabled.error === "gateway_disabled");
  assert(disabledLedger.events.length === 0);
});
