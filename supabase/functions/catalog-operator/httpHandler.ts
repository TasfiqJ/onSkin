import { bearerAuthorizationHeader } from "../_shared/auth.ts";
import { contentLengthTooLarge, readLimitedJson } from "../_shared/body.ts";
import {
  CATALOG_OPERATOR_RPCS,
  type CatalogOperatorRpcCall,
  parseCatalogOperatorAction,
} from "./contract.ts";
import { normalizeCatalogOperatorResponse } from "./responseContract.ts";

const USER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BEARER_HEADER_CHARS = 16_391;
const PREFLIGHT_ALLOWED_HEADERS = new Set([
  "accept",
  "authorization",
  "apikey",
  "cache-control",
  "content-type",
  "x-client-info",
  "x-request-id",
]);

export const CATALOG_OPERATOR_DEFAULT_BODY_MAX_BYTES = 8_192;
export const CATALOG_OPERATOR_MAX_BODY_MAX_BYTES = 16_384;

export type CatalogOperatorDatabaseResult = Readonly<{
  data: unknown;
  error: unknown;
}>;

export type VerifiedCatalogOperatorAuth = Readonly<{
  userId: string;
  authSessionId: string;
}>;

export type CatalogOperatorClient = Readonly<{
  verifiedAuth: () => Promise<VerifiedCatalogOperatorAuth | null>;
  rpc: (
    name: (typeof CATALOG_OPERATOR_RPCS)[keyof typeof CATALOG_OPERATOR_RPCS],
    args: Readonly<Record<string, unknown>>,
  ) => PromiseLike<CatalogOperatorDatabaseResult>;
}>;

export type CatalogOperatorHttpDependencies = Readonly<{
  allowedOrigins: ReadonlySet<string>;
  maxBodyBytes: number;
  createClient: (authorization: string) => CatalogOperatorClient;
  requestId: () => string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactDatabaseError(error: unknown): string | null {
  if (!isRecord(error)) return null;
  for (const candidate of [error.message, error.details, error.hint]) {
    if (
      typeof candidate === "string" &&
      /^CATALOG_OPERATOR_[A-Z0-9_]{1,80}$/.test(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

function databaseErrorResponse(error: unknown): Readonly<{
  body: Readonly<{ error: string }>;
  status: number;
  headers?: HeadersInit;
}> {
  const code = exactDatabaseError(error);
  if (
    code === "CATALOG_OPERATOR_AUTHORITY_INVALID" ||
    code === "CATALOG_OPERATOR_AAL2_SESSION_REQUIRED" ||
    code === "CATALOG_OPERATOR_NONANONYMOUS_REQUIRED" ||
    code === "CATALOG_OPERATOR_AUTH_SESSION_NOT_LIVE" ||
    code === "CATALOG_OPERATOR_ACCOUNT_ACCESS_DENIED" ||
    code === "CATALOG_OPERATOR_VERIFIED_MFA_REQUIRED" ||
    code === "CATALOG_OPERATOR_VERIFIED_TOTP_SESSION_REQUIRED" ||
    code === "CATALOG_OPERATOR_MFA_REQUIRED" ||
    code === "CATALOG_OPERATOR_SESSION_REQUIRED" ||
    code === "CATALOG_OPERATOR_SESSION_EXPIRED" ||
    code === "CATALOG_OPERATOR_GRANT_REQUIRED" ||
    code === "CATALOG_OPERATOR_CAPABILITY_DENIED" ||
    code === "CATALOG_OPERATOR_SECOND_PERSON_REQUIRED" ||
    code === "CATALOG_OPERATOR_REPAIR_ATTESTATION_SEPARATION_REQUIRED" ||
    code === "CATALOG_OPERATOR_REPAIR_ARTIFACT_AUTHOR_SEPARATION_REQUIRED" ||
    code === "CATALOG_OPERATOR_THIRD_PERSON_RELEASE_REQUIRED"
  ) {
    return { body: { error: "forbidden" }, status: 403 };
  }
  if (
    code === "CATALOG_OPERATOR_NOT_FOUND" ||
    code === "CATALOG_OPERATOR_ITEM_NOT_FOUND" ||
    code === "CATALOG_OPERATOR_HOLD_NOT_FOUND" ||
    code === "CATALOG_OPERATOR_PRODUCT_NOT_FOUND"
  ) {
    return { body: { error: "not_found" }, status: 404 };
  }
  if (
    code === "CATALOG_OPERATOR_CAPABILITY_INVALID" ||
    code === "CATALOG_OPERATOR_ITEM_KIND_INVALID" ||
    code === "CATALOG_OPERATOR_QUEUE_INPUT_INVALID" ||
    code === "CATALOG_OPERATOR_DETAIL_INPUT_INVALID" ||
    code === "CATALOG_OPERATOR_CLAIM_INPUT_INVALID" ||
    code === "CATALOG_OPERATOR_TRANSITION_INPUT_INVALID" ||
    code === "CATALOG_OPERATOR_TRANSITION_NOT_ALLOWED" ||
    code === "CATALOG_OPERATOR_CORRECTION_REASON_MISMATCH" ||
    code === "CATALOG_OPERATOR_HOLD_MUTATION_INPUT_INVALID" ||
    code === "CATALOG_OPERATOR_RELEASE_INPUT_INVALID"
  ) {
    return { body: { error: "invalid_request" }, status: 400 };
  }
  if (
    code === "CATALOG_OPERATOR_VERSION_CONFLICT" ||
    code === "CATALOG_OPERATOR_LEASE_CONFLICT" ||
    code === "CATALOG_OPERATOR_IDEMPOTENCY_CONFLICT" ||
    code === "CATALOG_OPERATOR_TRANSITION_INVALID" ||
    code === "CATALOG_OPERATOR_REPAIR_INVALID" ||
    code === "CATALOG_OPERATOR_OPERATION_CONFLICT" ||
    code === "CATALOG_OPERATOR_ITEM_ALREADY_CLAIMED" ||
    code === "CATALOG_OPERATOR_LEASE_INVALID" ||
    code === "CATALOG_OPERATOR_TRANSITION_STATE_INVALID" ||
    code === "CATALOG_OPERATOR_HOLD_STATE_CHANGED" ||
    code === "CATALOG_OPERATOR_BLOCKING_REPORTS_REMAIN" ||
    code === "CATALOG_OPERATOR_REPAIR_PROJECTION_UNCHANGED" ||
    code === "CATALOG_OPERATOR_PROMOTION_RECOMMENDATION_NOT_READY" ||
    code === "CATALOG_OPERATOR_ROLLBACK_RECOMMENDATION_NOT_READY" ||
    code === "CATALOG_OPERATOR_CURRENT_CAT02_CAT03_REPAIR_PROOF_REQUIRED" ||
    code === "CATALOG_OPERATOR_NAMED_REPAIR_AUTHORITY_REQUIRED" ||
    code === "CATALOG_OPERATOR_DETAIL_UNAVAILABLE" ||
    code === "CATALOG_OPERATOR_REPAIR_RECEIPT_STALE"
  ) {
    return { body: { error: "conflict" }, status: 409 };
  }
  if (code === "CATALOG_OPERATOR_RATE_LIMITED") {
    return {
      body: { error: "rate_limited" },
      status: 429,
      headers: { "Retry-After": "900" },
    };
  }
  return {
    body: { error: "operator_unavailable" },
    status: 503,
    headers: { "Retry-After": "30" },
  };
}

function originHeaders(origin: string | null): HeadersInit {
  return origin
    ? {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    }
    : {};
}

function responseHeaders(
  origin: string | null,
  requestId: string | null,
): HeadersInit {
  return {
    ...originHeaders(origin),
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy":
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    ...(requestId ? { "X-Request-Id": requestId } : {}),
  };
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
  requestId: string | null,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...responseHeaders(origin, requestId),
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function normalizedOrigin(
  request: Request,
  allowedOrigins: ReadonlySet<string>,
): string | null | false {
  const origin = request.headers.get("origin");
  if (origin === null) return null;
  return allowedOrigins.has(origin) ? origin : false;
}

function validPreflight(request: Request): boolean {
  if (request.headers.get("access-control-request-method") !== "POST") {
    return false;
  }
  const requested = request.headers.get("access-control-request-headers");
  if (!requested) return true;
  const names = requested
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return names.length <= PREFLIGHT_ALLOWED_HEADERS.size &&
    new Set(names).size === names.length &&
    names.every((name) => PREFLIGHT_ALLOWED_HEADERS.has(name));
}

function requestId(request: Request, create: () => string): string | null {
  const supplied = request.headers.get("x-request-id");
  const candidate = supplied ?? create();
  if (
    candidate !== candidate.toLowerCase() || !REQUEST_ID_PATTERN.test(candidate)
  ) return null;
  return candidate;
}

function isJsonContentType(request: Request): boolean {
  const header = request.headers.get("content-type");
  if (!header) return false;
  const parts = header.split(";").map((part) => part.trim());
  return parts[0]?.toLowerCase() === "application/json" &&
    parts.length <= 2 &&
    (parts.length === 1 || /^charset\s*=\s*utf-8$/i.test(parts[1] ?? ""));
}

function validDependencies(
  dependencies: CatalogOperatorHttpDependencies,
): boolean {
  return dependencies.allowedOrigins.size >= 1 &&
    dependencies.allowedOrigins.size <= 8 &&
    [...dependencies.allowedOrigins].every((origin) => {
      try {
        const parsed = new URL(origin);
        const localHttp = parsed.protocol === "http:" &&
          (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" ||
            parsed.hostname === "[::1]");
        return (parsed.protocol === "https:" || localHttp) &&
          !parsed.username &&
          !parsed.password &&
          parsed.pathname === "/" &&
          !parsed.search &&
          !parsed.hash &&
          parsed.origin === origin;
      } catch {
        return false;
      }
    }) &&
    Number.isSafeInteger(dependencies.maxBodyBytes) &&
    dependencies.maxBodyBytes >= 1_024 &&
    dependencies.maxBodyBytes <= CATALOG_OPERATOR_MAX_BODY_MAX_BYTES &&
    typeof dependencies.createClient === "function" &&
    typeof dependencies.requestId === "function";
}

export function parseCatalogOperatorAllowedOrigins(
  raw: string,
  appEnvironment: string,
): ReadonlySet<string> {
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    values.length < 1 || values.length > 8 ||
    new Set(values).size !== values.length
  ) {
    throw new Error("CATALOG_OPERATOR_ORIGIN_CONFIGURATION_INVALID");
  }
  const localEnvironment = new Set(["local", "development", "test"]).has(
    appEnvironment,
  );
  for (const value of values) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("CATALOG_OPERATOR_ORIGIN_CONFIGURATION_INVALID");
    }
    const isLocalHttp = localEnvironment &&
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]");
    if (
      (parsed.protocol !== "https:" && !isLocalHttp) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.origin !== value
    ) {
      throw new Error("CATALOG_OPERATOR_ORIGIN_CONFIGURATION_INVALID");
    }
  }
  return new Set(values);
}

export function parseCatalogOperatorSupabaseUrl(
  raw: string,
  appEnvironment: string,
): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("CATALOG_OPERATOR_SUPABASE_URL_INVALID");
  }
  const localDevelopment = appEnvironment === "development" &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]");
  if (
    (parsed.protocol !== "https:" && !localDevelopment) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.origin !== raw
  ) {
    throw new Error("CATALOG_OPERATOR_SUPABASE_URL_INVALID");
  }
  return parsed.origin;
}

async function invoke(
  client: CatalogOperatorClient,
  call: CatalogOperatorRpcCall,
  auth: VerifiedCatalogOperatorAuth,
): Promise<CatalogOperatorDatabaseResult> {
  if (Object.hasOwn(call.args, "p_auth_session_id")) {
    throw new Error("CATALOG_OPERATOR_AUTH_ARGUMENT_COLLISION");
  }
  return await client.rpc(call.rpcName, {
    ...call.args,
    p_auth_session_id: auth.authSessionId,
  });
}

export function createCatalogOperatorHttpHandler(
  dependencies: CatalogOperatorHttpDependencies,
): (request: Request) => Promise<Response> {
  if (!validDependencies(dependencies)) {
    throw new Error("CATALOG_OPERATOR_HTTP_CONFIGURATION_INVALID");
  }

  return async (request: Request): Promise<Response> => {
    const origin = normalizedOrigin(request, dependencies.allowedOrigins);
    if (origin === false) {
      return json({ error: "forbidden" }, 403, null, null);
    }
    if (request.method === "OPTIONS") {
      if (origin === null || !validPreflight(request)) {
        return json({ error: "forbidden" }, 403, origin, null);
      }
      return new Response(null, {
        status: 204,
        headers: {
          ...responseHeaders(origin, null),
          "Access-Control-Allow-Headers": [...PREFLIGHT_ALLOWED_HEADERS].join(
            ", ",
          ),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "300",
        },
      });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, origin, null, {
        Allow: "POST, OPTIONS",
      });
    }
    if (!isJsonContentType(request)) {
      return json({ error: "unsupported_media_type" }, 415, origin, null);
    }
    if (contentLengthTooLarge(request, dependencies.maxBodyBytes)) {
      return json({ error: "payload_too_large" }, 413, origin, null);
    }
    const correlationId = requestId(request, dependencies.requestId);
    if (!correlationId) {
      return json({ error: "invalid_request" }, 400, origin, null);
    }
    const authorization = bearerAuthorizationHeader(request);
    if (!authorization || authorization.length > MAX_BEARER_HEADER_CHARS) {
      return json({ error: "unauthorized" }, 401, origin, correlationId);
    }

    const body = await readLimitedJson(
      request,
      dependencies.maxBodyBytes,
      (value, status = 400) => json(value, status, origin, correlationId),
      { error: "invalid_request" },
    );
    if (body instanceof Response) return body;
    const parsed = parseCatalogOperatorAction(body);
    if (!parsed.ok) {
      return json({ error: parsed.error }, 400, origin, correlationId);
    }

    let client: CatalogOperatorClient;
    let verifiedAuth: VerifiedCatalogOperatorAuth;
    try {
      client = dependencies.createClient(authorization);
      const candidate = await client.verifiedAuth();
      if (
        !candidate ||
        !USER_UUID_PATTERN.test(candidate.userId.toLowerCase()) ||
        !USER_UUID_PATTERN.test(candidate.authSessionId.toLowerCase())
      ) {
        return json({ error: "unauthorized" }, 401, origin, correlationId);
      }
      verifiedAuth = {
        userId: candidate.userId.toLowerCase(),
        authSessionId: candidate.authSessionId.toLowerCase(),
      };
    } catch {
      return json({ error: "unauthorized" }, 401, origin, correlationId);
    }

    let databaseResult: CatalogOperatorDatabaseResult;
    try {
      databaseResult = await invoke(client, parsed.call, verifiedAuth);
    } catch {
      return json(
        { error: "operator_unavailable" },
        503,
        origin,
        correlationId,
        { "Retry-After": "30" },
      );
    }
    if (databaseResult.error) {
      const mapped = databaseErrorResponse(databaseResult.error);
      return json(
        mapped.body,
        mapped.status,
        origin,
        correlationId,
        mapped.headers,
      );
    }
    const result = normalizeCatalogOperatorResponse(
      parsed.call,
      databaseResult.data,
    );
    if (!result) {
      return json(
        { error: "operator_unavailable" },
        503,
        origin,
        correlationId,
        { "Retry-After": "30" },
      );
    }
    return json({ result }, 200, origin, correlationId);
  };
}
