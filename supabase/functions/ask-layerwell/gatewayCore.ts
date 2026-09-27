import {
  ASK_GATEWAY_PROTOCOL_VERSION,
  type AskGatewayError,
  askGatewayError,
  type AskGatewayRequest,
  type AskGatewaySuccess,
  hasDisallowedControlCharacter,
  parseAskGatewayRequest,
} from "./contract.ts";

export type ProviderResult = {
  narration: string;
  citationCardIds: string[];
  modelSnapshot: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostMicros: number;
  };
};

export type ProviderFailureCode =
  | "invalid_response"
  | "overloaded"
  | "rate_limited"
  | "timeout";

export class ProviderFailure extends Error {
  constructor(readonly code: ProviderFailureCode) {
    super("ASK_PROVIDER_FAILED");
    this.name = "ProviderFailure";
  }
}

export type QuotaLease = Readonly<{
  token: string;
  ownerId: string;
  requestId: string;
  requestFingerprint: string;
}>;

export type QuotaReservation =
  | { state: "reserved"; lease: QuotaLease }
  | {
    state: "replay";
    ownerId: string;
    requestId: string;
    requestFingerprint: string;
    response: AskGatewaySuccess;
  }
  | { state: "busy" }
  | { state: "quota_exceeded" }
  | { state: "cost_ceiling" }
  | { state: "unavailable" };

export interface AskQuotaLedger {
  reserve(input: {
    ownerId: string;
    requestId: string;
    requestFingerprint: string;
    consentGeneration: string;
    maximumCostMicros: number;
  }): Promise<QuotaReservation>;
  commit(lease: QuotaLease, response: AskGatewaySuccess): Promise<boolean>;
  release(
    lease: QuotaLease,
    disposition: "provider_failed" | "provider_timeout",
  ): Promise<void>;
}

export interface AskProvider {
  generate(
    request: AskGatewayRequest,
    options: { signal: AbortSignal; maxOutputTokens: number },
  ): Promise<ProviderResult>;
}

export type AskGatewayConfig = Readonly<{
  enabled: boolean;
  maximumCostMicros: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxAttempts: 1;
}>;

export type CircuitAdmission = { ok: true } | {
  ok: false;
  retryAfterSeconds: number;
};

export interface AskCircuitBreaker {
  admit(): CircuitAdmission;
  recordSuccess(): void;
  recordFailure(): void;
}

/**
 * Source-checkpoint quarantine only. This process-local object is explicitly
 * not an outage authority and cannot block requests or replays. A durable,
 * distributed half-open design is required before the endpoint is enabled.
 */
export class NonAuthoritativeCircuitBreaker implements AskCircuitBreaker {
  admit(): CircuitAdmission {
    return { ok: true };
  }
  recordSuccess(): void {}
  recordFailure(): void {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return isRecord(value) &&
    Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

function parseConfig(value: unknown): AskGatewayConfig | null {
  if (
    !exactKeys(value, [
      "enabled",
      "maximumCostMicros",
      "maxOutputTokens",
      "timeoutMs",
      "maxAttempts",
    ])
  ) return null;
  const config = value as Record<string, unknown>;
  if (
    !(typeof config.enabled === "boolean" &&
      Number.isSafeInteger(config.maximumCostMicros) &&
      Number(config.maximumCostMicros) >= 1 &&
      Number(config.maximumCostMicros) <= 10_000_000 &&
      Number.isSafeInteger(config.maxOutputTokens) &&
      Number(config.maxOutputTokens) >= 1 &&
      Number(config.maxOutputTokens) <= 1024 &&
      Number.isSafeInteger(config.timeoutMs) &&
      Number(config.timeoutMs) >= 250 &&
      Number(config.timeoutMs) <= 30_000 && config.maxAttempts === 1)
  ) return null;
  return {
    enabled: config.enabled,
    maximumCostMicros: Number(config.maximumCostMicros),
    maxOutputTokens: Number(config.maxOutputTokens),
    timeoutMs: Number(config.timeoutMs),
    maxAttempts: 1,
  };
}

const SHA256 = /^[a-f0-9]{64}$/;
const LEASE_TOKEN = /^[a-zA-Z0-9._:-]{1,256}$/;

function parseReservation(
  value: unknown,
  binding: { ownerId: string; requestId: string; requestFingerprint: string },
): QuotaReservation | null {
  if (!isRecord(value) || typeof value.state !== "string") return null;
  if (
    ["busy", "quota_exceeded", "cost_ceiling", "unavailable"].includes(
      value.state,
    )
  ) {
    return exactKeys(value, ["state"])
      ? { state: value.state } as QuotaReservation
      : null;
  }
  if (value.state === "reserved") {
    if (
      !exactKeys(value, ["state", "lease"]) ||
      !exactKeys(value.lease, [
        "token",
        "ownerId",
        "requestId",
        "requestFingerprint",
      ])
    ) {
      return null;
    }
    const lease = value.lease as Record<string, unknown>;
    if (
      !(typeof lease.token === "string" && LEASE_TOKEN.test(lease.token) &&
        lease.ownerId === binding.ownerId &&
        lease.requestId === binding.requestId &&
        lease.requestFingerprint === binding.requestFingerprint &&
        typeof lease.requestFingerprint === "string" &&
        SHA256.test(lease.requestFingerprint))
    ) return null;
    return {
      state: "reserved",
      lease: {
        token: lease.token,
        ownerId: binding.ownerId,
        requestId: binding.requestId,
        requestFingerprint: binding.requestFingerprint,
      },
    };
  }
  if (value.state === "replay") {
    if (
      !(exactKeys(value, [
        "state",
        "ownerId",
        "requestId",
        "requestFingerprint",
        "response",
      ]) && value.ownerId === binding.ownerId &&
        value.requestId === binding.requestId &&
        value.requestFingerprint === binding.requestFingerprint &&
        typeof value.requestFingerprint === "string" &&
        SHA256.test(value.requestFingerprint))
    ) return null;
    return {
      state: "replay",
      ownerId: binding.ownerId,
      requestId: binding.requestId,
      requestFingerprint: binding.requestFingerprint,
      response: value.response as AskGatewaySuccess,
    };
  }
  return null;
}

function parseCircuitAdmission(value: unknown): CircuitAdmission | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;
  if (value.ok === true) {
    return exactKeys(value, ["ok"]) ? { ok: true } : null;
  }
  if (
    !exactKeys(value, ["ok", "retryAfterSeconds"]) ||
    !Number.isSafeInteger(value.retryAfterSeconds) ||
    Number(value.retryAfterSeconds) < 1 ||
    Number(value.retryAfterSeconds) > 3600
  ) {
    return null;
  }
  return { ok: false, retryAfterSeconds: Number(value.retryAfterSeconds) };
}

function canonicalRequestJson(request: AskGatewayRequest): string {
  return JSON.stringify({
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
}

async function fingerprintAskGatewayRequest(
  request: AskGatewayRequest,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalRequestJson(request)),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseProviderResult(
  result: unknown,
  config: AskGatewayConfig,
  request: AskGatewayRequest,
): ProviderResult | null {
  if (
    !exactKeys(result, [
      "narration",
      "citationCardIds",
      "modelSnapshot",
      "usage",
    ])
  ) {
    return null;
  }
  const candidate = result as Record<string, unknown>;
  const narration = candidate.narration;
  const rawCitations = candidate.citationCardIds;
  const modelSnapshot = candidate.modelSnapshot;
  const rawUsage = candidate.usage;
  if (
    !exactKeys(rawUsage, [
      "inputTokens",
      "outputTokens",
      "estimatedCostMicros",
    ])
  ) {
    return null;
  }
  if (!Array.isArray(rawCitations)) return null;
  const citations = [...rawCitations] as unknown[];
  const usage = rawUsage as Record<string, unknown>;
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const estimatedCostMicros = usage.estimatedCostMicros;
  const allowedCitations = new Set(request.grounding.evidenceCardIds);
  if (
    !(typeof narration === "string" && narration.length > 0 &&
      narration.length <= 4000 && !hasDisallowedControlCharacter(narration) &&
      citations.length >= 1 &&
      citations.length <= 12 &&
      citations.every((id) =>
        typeof id === "string" && id.length > 0 && id.length <= 128 &&
        allowedCitations.has(id)
      ) && new Set(citations).size === citations.length &&
      typeof modelSnapshot === "string" && modelSnapshot.length > 0 &&
      modelSnapshot.length <= 128 &&
      modelSnapshot.normalize("NFKC") === modelSnapshot &&
      !hasDisallowedControlCharacter(modelSnapshot) &&
      Number.isSafeInteger(inputTokens) && Number(inputTokens) >= 0 &&
      Number.isSafeInteger(outputTokens) && Number(outputTokens) >= 0 &&
      Number(outputTokens) <= config.maxOutputTokens &&
      Number.isSafeInteger(estimatedCostMicros) &&
      Number(estimatedCostMicros) >= 0 &&
      Number(estimatedCostMicros) <= config.maximumCostMicros)
  ) return null;
  return Object.freeze({
    narration,
    citationCardIds: Object.freeze([...citations]) as unknown as string[],
    modelSnapshot,
    usage: Object.freeze({
      inputTokens: Number(inputTokens),
      outputTokens: Number(outputTokens),
      estimatedCostMicros: Number(estimatedCostMicros),
    }),
  });
}

function canonicalSuccess(
  requestId: string,
  result: ProviderResult,
): AskGatewaySuccess {
  return {
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    requestId,
    status: "grounded",
    narration: result.narration,
    citationCardIds: [...result.citationCardIds],
    modelSnapshot: result.modelSnapshot,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostMicros: result.usage.estimatedCostMicros,
    },
  };
}

function parseReplay(
  response: unknown,
  config: AskGatewayConfig,
  request: AskGatewayRequest,
): AskGatewaySuccess | null {
  if (
    !exactKeys(response, [
      "protocolVersion",
      "requestId",
      "status",
      "narration",
      "citationCardIds",
      "modelSnapshot",
      "usage",
    ])
  ) return null;
  const stored = response as Record<string, unknown>;
  const protocolVersion = stored.protocolVersion;
  const requestId = stored.requestId;
  const status = stored.status;
  const providerResult = parseProviderResult(
    {
      narration: stored.narration,
      citationCardIds: stored.citationCardIds,
      modelSnapshot: stored.modelSnapshot,
      usage: stored.usage,
    },
    config,
    request,
  );
  if (
    protocolVersion !== ASK_GATEWAY_PROTOCOL_VERSION ||
    requestId !== request.requestId || status !== "grounded" || !providerResult
  ) return null;
  return canonicalSuccess(request.requestId, providerResult);
}

async function safeRelease(
  quota: AskQuotaLedger,
  lease: QuotaLease,
  disposition: "provider_failed" | "provider_timeout",
): Promise<void> {
  try {
    await quota.release(lease, disposition);
  } catch {
    // Stable redaction boundary for synchronous and asynchronous adapters.
  }
}

function safeCircuitRecord(
  circuit: AskCircuitBreaker,
  outcome: "success" | "failure",
): void {
  try {
    if (outcome === "success") circuit.recordSuccess();
    else circuit.recordFailure();
  } catch {
    // The disabled checkpoint does not treat process-local telemetry as authority.
  }
}

async function invokeWithTimeout(
  provider: AskProvider,
  request: AskGatewayRequest,
  config: AskGatewayConfig,
): Promise<ProviderResult> {
  const controller = new AbortController();
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new ProviderFailure("timeout"));
    }, config.timeoutMs);
  });
  try {
    return await Promise.race([
      provider.generate(request, {
        signal: controller.signal,
        maxOutputTokens: config.maxOutputTokens,
      }),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function providerError(error: unknown): ProviderFailure {
  return error instanceof ProviderFailure
    ? error
    : new ProviderFailure("invalid_response");
}

export async function runAskGateway(input: {
  ownerId: string;
  request: AskGatewayRequest;
  config: AskGatewayConfig;
  quota: AskQuotaLedger;
  provider: AskProvider;
  circuit: AskCircuitBreaker;
}): Promise<AskGatewaySuccess | AskGatewayError> {
  let config: AskGatewayConfig;
  let request: AskGatewayRequest;
  let ownerId: string;
  let quota: AskQuotaLedger;
  let provider: AskProvider;
  let circuit: AskCircuitBreaker;
  try {
    const parsedConfig = parseConfig(input.config);
    const parsedRequest = parseAskGatewayRequest(input.request);
    if (
      !parsedConfig || !parsedRequest || typeof input.ownerId !== "string" ||
      input.ownerId.length < 1 || input.ownerId.length > 128 ||
      input.ownerId.trim() !== input.ownerId
    ) {
      return askGatewayError("gateway_unavailable");
    }
    quota = input.quota;
    provider = input.provider;
    circuit = input.circuit;
    if (
      typeof quota.reserve !== "function" ||
      typeof quota.commit !== "function" ||
      typeof quota.release !== "function" ||
      typeof provider.generate !== "function" ||
      typeof circuit.admit !== "function" ||
      typeof circuit.recordSuccess !== "function" ||
      typeof circuit.recordFailure !== "function"
    ) {
      return askGatewayError("gateway_unavailable");
    }
    config = parsedConfig;
    request = parsedRequest;
    ownerId = input.ownerId;
  } catch {
    return askGatewayError("gateway_unavailable");
  }
  if (!config.enabled) return askGatewayError("gateway_disabled");

  let requestFingerprint: string;
  try {
    requestFingerprint = await fingerprintAskGatewayRequest(request);
  } catch {
    return askGatewayError("gateway_unavailable", true);
  }
  if (!SHA256.test(requestFingerprint)) {
    return askGatewayError("gateway_unavailable", true);
  }
  let reservation: QuotaReservation;
  try {
    const rawReservation: unknown = await quota.reserve({
      ownerId,
      requestId: request.requestId,
      requestFingerprint,
      consentGeneration: request.consentGeneration,
      maximumCostMicros: config.maximumCostMicros,
    });
    const parsedReservation = parseReservation(rawReservation, {
      ownerId,
      requestId: request.requestId,
      requestFingerprint,
    });
    if (!parsedReservation) return askGatewayError("gateway_unavailable", true);
    reservation = parsedReservation;
  } catch {
    return askGatewayError("gateway_unavailable", true);
  }

  if (reservation.state === "replay") {
    try {
      const replay = parseReplay(reservation.response, config, request);
      if (!replay) return askGatewayError("gateway_unavailable", true);
      return replay;
    } catch {
      return askGatewayError("gateway_unavailable", true);
    }
  }
  if (reservation.state === "busy") {
    return askGatewayError("request_in_progress", true);
  }
  if (reservation.state === "quota_exceeded") {
    return askGatewayError("quota_exceeded");
  }
  if (reservation.state === "cost_ceiling") {
    return askGatewayError("cost_ceiling");
  }
  if (reservation.state === "unavailable") {
    return askGatewayError("gateway_unavailable", true);
  }
  let circuitAdmission: CircuitAdmission | null;
  try {
    circuitAdmission = parseCircuitAdmission(circuit.admit());
  } catch {
    circuitAdmission = null;
  }
  if (!circuitAdmission) {
    await safeRelease(quota, reservation.lease, "provider_failed");
    return askGatewayError("gateway_unavailable");
  }
  if (!circuitAdmission.ok) {
    await safeRelease(quota, reservation.lease, "provider_failed");
    return askGatewayError("circuit_open", true);
  }

  let response: AskGatewaySuccess;
  try {
    const result = await invokeWithTimeout(
      provider,
      request,
      config,
    );
    const parsedResult = parseProviderResult(result, config, request);
    if (!parsedResult) {
      throw new ProviderFailure("invalid_response");
    }
    response = canonicalSuccess(request.requestId, parsedResult);
  } catch (error) {
    // Exactly one provider attempt is allowed until durable cumulative
    // provider settlement makes retry safety provable.
    const failure = providerError(error);
    safeCircuitRecord(circuit, "failure");
    await safeRelease(
      quota,
      reservation.lease,
      failure.code === "timeout" ? "provider_timeout" : "provider_failed",
    );
    return failure.code === "timeout"
      ? askGatewayError("provider_timeout")
      : askGatewayError("gateway_unavailable", false);
  }

  let committed: unknown;
  try {
    committed = await quota.commit(reservation.lease, response);
  } catch {
    safeCircuitRecord(circuit, "failure");
    return askGatewayError("gateway_unavailable");
  }
  if (committed !== true) {
    safeCircuitRecord(circuit, "failure");
    return askGatewayError("gateway_unavailable");
  }
  safeCircuitRecord(circuit, "success");
  return response;
}

export class DisabledQuotaLedger implements AskQuotaLedger {
  reserve(): Promise<QuotaReservation> {
    return Promise.resolve({ state: "unavailable" });
  }
  commit(): Promise<boolean> {
    return Promise.resolve(false);
  }
  release(): Promise<void> {
    return Promise.resolve();
  }
}

export class DisabledProvider implements AskProvider {
  generate(): Promise<ProviderResult> {
    return Promise.reject(new ProviderFailure("overloaded"));
  }
}
