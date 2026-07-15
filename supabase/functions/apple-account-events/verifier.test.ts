import {
  type AppleEventFetch,
  AppleServerEventVerificationError,
  createAppleServerEventVerifier,
} from "./verifier.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const NOW_SECONDS = 1_800_000_000;
const CLIENT_ID = "com.example.routinekind";
const KEY_ID = "apple-key-1";

function binary(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function encode(value: unknown): string {
  return btoa(binary(new TextEncoder().encode(JSON.stringify(value))))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function signature(bytes: ArrayBuffer): string {
  return btoa(binary(new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function signer() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  async function sign(
    payload: Record<string, unknown>,
    header: Record<string, unknown> = { alg: "RS256", kid: KEY_ID },
  ) {
    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signed = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      pair.privateKey,
      new TextEncoder().encode(signingInput),
    );
    return `${signingInput}.${signature(signed)}`;
  }
  return { jwk: { ...jwk, alg: "RS256", use: "sig", kid: KEY_ID }, sign };
}

function payload(
  events: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    iss: "https://appleid.apple.com",
    aud: CLIENT_ID,
    iat: NOW_SECONDS,
    jti: "event-jti-1",
    events,
    ...overrides,
  };
}

async function verifier() {
  const signing = await signer();
  let fetches = 0;
  const fetcher: AppleEventFetch = async () => {
    fetches += 1;
    return new Response(JSON.stringify({ keys: [signing.jwk] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const verify = await createAppleServerEventVerifier({
    clientId: CLIENT_ID,
    fetcher,
    now: () => NOW_SECONDS * 1_000,
    timeoutMs: 1_000,
    maxResponseBytes: 16_384,
  });
  return { ...signing, verify, fetches: () => fetches };
}

async function rejected(operation: () => Promise<unknown>) {
  try {
    await operation();
    throw new Error("expected rejection");
  } catch (error) {
    assert(
      error instanceof AppleServerEventVerificationError,
      "stable verification rejection",
    );
  }
}

Deno.test(
  "Apple event verifier accepts all four current signed schemas and caches JWKS",
  async () => {
    const h = await verifier();
    const cases = [
      {
        type: "email-enabled",
        sub: "apple-subject",
        email: "relay@privaterelay.appleid.com",
        is_private_email: "true",
        event_time: NOW_SECONDS,
      },
      {
        type: "email-disabled",
        sub: "apple-subject",
        email: "relay@privaterelay.appleid.com",
        is_private_email: "true",
        event_time: NOW_SECONDS,
      },
      {
        type: "consent-revoked",
        sub: "apple-subject",
        event_time: NOW_SECONDS,
      },
      {
        type: "account-deleted",
        sub: "apple-subject",
        event_time: NOW_SECONDS,
      },
    ];
    for (const [index, event] of cases.entries()) {
      const claims = await h.verify(
        await h.sign(payload(event, { jti: `jti-${index}` })),
      );
      assert(claims.eventType === event.type, `expected ${event.type}`);
      assert(claims.subject === "apple-subject", "subject");
    }
    assert(h.fetches() === 1, "successful Apple key is cached");
  },
);

Deno.test("Apple event verifier quarantines signed unknown flat events", async () => {
  const h = await verifier();
  const claims = await h.verify(
    await h.sign(
      payload({
        type: "future-event",
        sub: "apple-subject",
        event_time: NOW_SECONDS,
        flag: true,
      }),
    ),
  );
  assert(
    claims.eventType === "unknown" && claims.rawEventType === "future-event",
    "unknown event",
  );
});

Deno.test(
  "Apple event verifier rejects signature, algorithm, issuer, audience, time, and schema substitution",
  async () => {
    const h = await verifier();
    const event = {
      type: "consent-revoked",
      sub: "apple-subject",
      event_time: NOW_SECONDS,
    };
    const invalidTokens = [
      await h.sign(payload(event), { alg: "HS256", kid: KEY_ID }),
      await h.sign(payload(event, { iss: "https://attacker.invalid" })),
      await h.sign(payload(event, { aud: "com.example.other" })),
      await h.sign(payload(event, { iat: NOW_SECONDS + 301 })),
      await h.sign(payload({ ...event, event_time: NOW_SECONDS + 301 })),
      await h.sign(payload({ ...event, extra: true })),
    ];
    const valid = await h.sign(payload(event));
    invalidTokens.push(`${valid.slice(0, -2)}aa`);
    for (const token of invalidTokens) await rejected(() => h.verify(token));
  },
);

Deno.test("failed Apple JWKS loads are evicted for a later signed retry", async () => {
  const signing = await signer();
  let attempts = 0;
  const verify = await createAppleServerEventVerifier({
    clientId: CLIENT_ID,
    fetcher: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary network failure");
      return new Response(JSON.stringify({ keys: [signing.jwk] }), {
        status: 200,
      });
    },
    now: () => NOW_SECONDS * 1_000,
    timeoutMs: 1_000,
    maxResponseBytes: 16_384,
  });
  const token = await signing.sign(
    payload({
      type: "account-deleted",
      sub: "apple-subject",
      event_time: NOW_SECONDS,
    }),
  );
  await rejected(() => verify(token));
  assert(
    (await verify(token)).eventType === "account-deleted",
    "fresh retry recovers",
  );
  assert(attempts === 2, "one failed and one successful JWKS fetch");
});

Deno.test("unknown signed key ids cannot amplify Apple JWKS fetches inside the cache window", async () => {
  const signing = await signer();
  let fetches = 0;
  const verify = await createAppleServerEventVerifier({
    clientId: CLIENT_ID,
    fetcher: async () => {
      fetches += 1;
      return new Response(JSON.stringify({ keys: [signing.jwk] }), {
        status: 200,
      });
    },
    now: () => NOW_SECONDS * 1_000,
    timeoutMs: 1_000,
    maxResponseBytes: 16_384,
  });
  for (const kid of ["unknown-1", "unknown-2", "unknown-3"]) {
    const token = await signing.sign(
      payload({
        type: "consent-revoked",
        sub: "apple-subject",
        event_time: NOW_SECONDS,
      }),
      { alg: "RS256", kid },
    );
    await rejected(() => verify(token));
  }
  assert(fetches === 1, "one bounded JWKS snapshot serves every unknown kid");
});

Deno.test("non-finite verifier clocks fail closed before network access", async () => {
  const signing = await signer();
  let fetches = 0;
  const verify = await createAppleServerEventVerifier({
    clientId: CLIENT_ID,
    fetcher: async () => {
      fetches += 1;
      return new Response(JSON.stringify({ keys: [signing.jwk] }), {
        status: 200,
      });
    },
    now: () => Number.NaN,
    timeoutMs: 1_000,
    maxResponseBytes: 16_384,
  });
  const token = await signing.sign(
    payload({
      type: "account-deleted",
      sub: "apple-subject",
      event_time: NOW_SECONDS,
    }),
  );
  await rejected(() => verify(token));
  assert(fetches === 0, "invalid clock never reaches Apple");
});
