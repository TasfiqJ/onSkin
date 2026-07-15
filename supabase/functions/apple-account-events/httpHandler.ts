import { contentLengthTooLarge, readLimitedJson } from "../_shared/body.ts";
import { parseAppleAccountEventEnvelope } from "./core.ts";
import {
  type AppleServerEventClaims,
  AppleServerEventVerificationError,
} from "./verifier.ts";

export type AppleAccountEventDisposition = Readonly<{
  resultCode:
    | "applied"
    | "duplicate"
    | "ignored_unknown"
    | "stale"
    | "unknown_subject";
}>;

export type AppleAccountEventHttpDependencies = Readonly<{
  maxBodyBytes: number;
  verify: (compactJws: string) => Promise<AppleServerEventClaims>;
  persist: (
    compactJws: string,
    claims: AppleServerEventClaims,
  ) => Promise<AppleAccountEventDisposition>;
  onUnavailable?: () => void;
}>;

function json(
  body: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function isJsonContentType(value: string | null): boolean {
  return value !== null && /^application\/json(?:\s*;|$)/iu.test(value);
}

export function createAppleAccountEventHttpHandler(
  dependencies: AppleAccountEventHttpDependencies,
): (request: Request) => Promise<Response> {
  if (
    !Number.isSafeInteger(dependencies.maxBodyBytes) ||
    dependencies.maxBodyBytes < 1_024 ||
    dependencies.maxBodyBytes > 40_000 ||
    typeof dependencies.verify !== "function" ||
    typeof dependencies.persist !== "function" ||
    (dependencies.onUnavailable !== undefined &&
      typeof dependencies.onUnavailable !== "function")
  ) {
    throw new Error("APPLE_ACCOUNT_EVENT_CONFIGURATION_INVALID");
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }
    if (!isJsonContentType(request.headers.get("Content-Type"))) {
      return json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
    }
    if (contentLengthTooLarge(request, dependencies.maxBodyBytes)) {
      return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
    const body = await readLimitedJson(
      request,
      dependencies.maxBodyBytes,
      (value, status = 400) => json(value, status),
      { error: "BAD_JSON" },
    );
    if (body instanceof Response) return body;
    const compactJws = parseAppleAccountEventEnvelope(body);
    if (compactJws === null) return json({ error: "INVALID_REQUEST" }, 400);

    try {
      const claims = await dependencies.verify(compactJws);
      const result = await dependencies.persist(compactJws, claims);
      return json({ status: "accepted", disposition: result.resultCode }, 200);
    } catch (error) {
      if (error instanceof AppleServerEventVerificationError) {
        return json({ error: "INVALID_NOTIFICATION" }, 401);
      }
      dependencies.onUnavailable?.();
      return json({ error: "APPLE_ACCOUNT_EVENT_UNAVAILABLE" }, 503, {
        "Retry-After": "60",
      });
    }
  };
}
