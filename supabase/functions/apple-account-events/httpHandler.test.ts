import { createAppleAccountEventHttpHandler } from "./httpHandler.ts";
import {
  type AppleServerEventClaims,
  AppleServerEventVerificationError,
} from "./verifier.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const URL = "https://example.invalid/functions/v1/apple-account-events";
const PAYLOAD = "a.b.c";
const CLAIMS: AppleServerEventClaims = Object.freeze({
  audience: "com.example.layerwell",
  eventAtSeconds: 1_750_000_000,
  eventType: "consent-revoked",
  issuer: "https://appleid.apple.com",
  issuedAtSeconds: 1_750_000_001,
  jti: "event-id",
  rawEventType: "consent-revoked",
  relayEmail: null,
  subject: "apple-subject",
});

function request(
  body = JSON.stringify({ payload: PAYLOAD }),
  contentType = "application/json; charset=utf-8",
  method = "POST",
  headers: HeadersInit = {},
): Request {
  return new Request(URL, {
    method,
    headers: { "Content-Type": contentType, ...headers },
    ...(method === "POST" ? { body } : {}),
  });
}

Deno.test("Apple event HTTP boundary persists only verified exact envelopes", async () => {
  const calls: string[] = [];
  const handler = createAppleAccountEventHttpHandler({
    maxBodyBytes: 40_000,
    async verify(compactJws) {
      calls.push(`verify:${compactJws}`);
      return CLAIMS;
    },
    async persist(compactJws, claims) {
      calls.push(`persist:${compactJws}:${claims.subject}`);
      return { resultCode: "applied" };
    },
  });

  const response = await handler(request());
  assert(response.status === 200, "verified event accepted");
  assert(
    JSON.stringify(await response.json()) ===
      JSON.stringify({ status: "accepted", disposition: "applied" }),
    "only the bounded disposition is returned",
  );
  assert(
    calls.join(",") === `verify:${PAYLOAD},persist:${PAYLOAD}:apple-subject`,
    "verification precedes persistence",
  );
  assert(
    response.headers.get("Cache-Control")?.includes("no-store"),
    "response is not cached",
  );
});

Deno.test("Apple event HTTP boundary rejects method, media, size, and shape before verification", async () => {
  let verifies = 0;
  const handler = createAppleAccountEventHttpHandler({
    maxBodyBytes: 1_024,
    async verify() {
      verifies += 1;
      return CLAIMS;
    },
    async persist() {
      return { resultCode: "applied" };
    },
  });

  const method = await handler(request("", "application/json", "GET"));
  assert(
    method.status === 405 && method.headers.get("Allow") === "POST",
    "POST only",
  );
  assert(
    (await handler(request("{}", "text/plain"))).status === 415,
    "JSON only",
  );
  assert(
    (await handler(request("{}", "application/jsonp"))).status === 415,
    "JSON prefix confusion rejected",
  );
  assert(
    (
      await handler(
        request('{"payload":"a.b.c"}', "application/json", "POST", {
          "Content-Length": "1025",
        }),
      )
    ).status === 413,
    "declared oversized body rejected",
  );
  assert((await handler(request("{"))).status === 400, "bad JSON rejected");
  for (
    const body of [
      "{}",
      '{"payload":""}',
      '{"payload":"a.b.c","extra":true}',
      '{"payload":7}',
    ]
  ) {
    assert(
      (await handler(request(body))).status === 400,
      "noncanonical envelope rejected",
    );
  }
  assert(
    verifies === 0,
    "invalid transport never reaches signature verification",
  );
});

Deno.test("Apple event HTTP boundary distinguishes invalid signatures from retryable service failure", async () => {
  const invalid = createAppleAccountEventHttpHandler({
    maxBodyBytes: 1_024,
    async verify() {
      throw new AppleServerEventVerificationError();
    },
    async persist() {
      throw new Error("unreachable");
    },
  });
  const invalidResponse = await invalid(request());
  assert(
    invalidResponse.status === 401,
    "invalid Apple signature is unauthorized",
  );
  assert(
    JSON.stringify(await invalidResponse.json()) ===
      JSON.stringify({ error: "INVALID_NOTIFICATION" }),
    "signature details are redacted",
  );

  let unavailableSignals = 0;
  const unavailable = createAppleAccountEventHttpHandler({
    maxBodyBytes: 1_024,
    async verify() {
      return CLAIMS;
    },
    async persist() {
      throw new Error("sensitive database detail");
    },
    onUnavailable() {
      unavailableSignals += 1;
    },
  });
  const unavailableResponse = await unavailable(request());
  assert(
    unavailableResponse.status === 503,
    "service failure requests provider retry",
  );
  assert(
    unavailableResponse.headers.get("Retry-After") === "60",
    "retry hint is bounded",
  );
  assert(unavailableSignals === 1, "redacted operator signal emitted once");
});

Deno.test("Apple event HTTP boundary rejects unsafe configuration", () => {
  for (const maxBodyBytes of [0, 1_023, 40_001, 1.5]) {
    let rejected = false;
    try {
      createAppleAccountEventHttpHandler({
        maxBodyBytes,
        async verify() {
          return CLAIMS;
        },
        async persist() {
          return { resultCode: "applied" };
        },
      });
    } catch (error) {
      rejected = (error as Error).message ===
        "APPLE_ACCOUNT_EVENT_CONFIGURATION_INVALID";
    }
    assert(rejected, `configuration ${maxBodyBytes} rejected`);
  }
});
