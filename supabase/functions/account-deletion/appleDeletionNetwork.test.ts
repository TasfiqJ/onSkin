import {
  AppleDeletionNetworkError,
  createAppleDeletionNetwork,
} from "./appleDeletionNetwork.ts";
import type { AppleRevocationConfiguration } from "./providerDeletion.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/g,
    "",
  );
}

function base64UrlJson(value: string): Record<string, unknown> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function base64UrlText(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

type AppleIdentitySigner = {
  keyId: string;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
};

async function identitySigner(
  keyId = "APPLE_KEY",
): Promise<AppleIdentitySigner> {
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
  const exported = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    keyId,
    privateKey: pair.privateKey,
    publicJwk: {
      ...exported,
      alg: "RS256",
      use: "sig",
    },
  };
}

async function appleIdToken(options: {
  subject: string;
  audience: string;
  now: number;
  signer: AppleIdentitySigner;
  keyId?: string;
  nonce?: string;
}): Promise<string> {
  const header = base64UrlText({
    alg: "RS256",
    kid: options.keyId ?? options.signer.keyId,
  });
  const claims = base64UrlText({
    iss: "https://appleid.apple.com",
    aud: options.audience,
    sub: options.subject,
    iat: Math.floor(options.now / 1_000),
    exp: Math.floor(options.now / 1_000) + 600,
    ...(options.nonce === undefined ? {} : { nonce: options.nonce }),
  });
  const signingInput = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    options.signer.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

function appleKeysResponse(signer: AppleIdentitySigner): Response {
  return new Response(
    JSON.stringify({
      keys: [{ ...signer.publicJwk, kid: signer.keyId }],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function configuration(): Promise<AppleRevocationConfiguration> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    [
      "sign",
      "verify",
    ],
  );
  const exported = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  const encoded = base64(exported)
    .match(/.{1,64}/g)
    ?.join("\n") ?? "";
  return {
    teamId: "TEAM123456",
    keyId: "KEY123456",
    clientId: "com.example.routinekind",
    privateKey:
      `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`,
  };
}

Deno.test("Apple network verifies the exchanged identity token before revocation", async () => {
  const requests: Array<{
    url: string;
    method: string;
    params: URLSearchParams | null;
  }> = [];
  const now = Date.parse("2026-07-13T12:00:00.000Z");
  const config = await configuration();
  const signer = await identitySigner();
  const idToken = await appleIdToken({
    subject: "expected-apple-subject",
    audience: config.clientId,
    now,
    signer,
  });
  const network = await createAppleDeletionNetwork({
    config,
    now: () => now,
    timeoutMs: 5_000,
    maxResponseBytes: 16_384,
    fetcher(input, init) {
      const url = String(input);
      const params = init.body instanceof URLSearchParams ? init.body : null;
      requests.push({ url, method: init.method ?? "GET", params });
      if (url.endsWith("/auth/token")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              refresh_token: "persist-me",
              id_token: idToken,
            }),
            { status: 200 },
          ),
        );
      }
      if (url.endsWith("/auth/keys")) {
        return Promise.resolve(appleKeysResponse(signer));
      }
      return Promise.resolve(new Response("", { status: 200 }));
    },
  });
  const exchanged = await network.exchangeAuthorizationCode(
    "one-time-code",
    "expected-apple-subject",
  );
  assert(exchanged.token === "persist-me", "token parsed");
  assert(exchanged.tokenTypeHint === "refresh_token", "token type bound");
  const revocation = await network.revokeToken(
    exchanged.token,
    exchanged.tokenTypeHint,
  );
  assert(revocation.status === 200, "revocation status retained");
  assert(revocation.body === "", "zero-byte revocation body retained");
  assert(
    revocation.responseBytes === 0,
    "zero-byte revocation length retained",
  );
  assert(requests[0]?.url.endsWith("/auth/token"), "token endpoint");
  assert(requests[1]?.url.endsWith("/auth/keys"), "Apple JWK endpoint");
  assert(requests[1]?.method === "GET", "JWK request is read-only");
  assert(requests[2]?.url.endsWith("/auth/revoke"), "revoke endpoint");
  assert(requests[0]?.params?.get("code") === "one-time-code", "exact code");
  assert(requests[2]?.params?.get("token") === "persist-me", "exact token");

  const secret = requests[0]?.params?.get("client_secret") ?? "";
  const parts = secret.split(".");
  assert(parts.length === 3, "ES256 JWS");
  const payload = base64UrlJson(parts[1]);
  assert(payload.sub === config.clientId, "client bound");
  assert(payload.aud === "https://appleid.apple.com", "audience bound");
  assert(payload.exp === Math.floor(now / 1_000) + 600, "short-lived secret");
});

Deno.test("Apple network preserves exact nonempty revocation response bodies", async () => {
  const config = await configuration();
  for (const body of ["unexpected", " "]) {
    const network = await createAppleDeletionNetwork({
      config,
      now: () => Date.parse("2026-07-13T12:00:00.000Z"),
      timeoutMs: 5_000,
      maxResponseBytes: 16_384,
      fetcher() {
        return Promise.resolve(new Response(body, { status: 200 }));
      },
    });
    const revocation = await network.revokeToken("token", "refresh_token");
    assert(revocation.status === 200, "status retained");
    assert(revocation.body === body, "body retained without normalization");
    assert(
      revocation.responseBytes === new TextEncoder().encode(body).byteLength,
      "raw body length retained",
    );
  }
});

Deno.test("Apple network preserves raw BOM bytes when decoded response text is empty", async () => {
  const config = await configuration();
  const utf8Bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const network = await createAppleDeletionNetwork({
    config,
    now: () => Date.parse("2026-07-13T12:00:00.000Z"),
    timeoutMs: 5_000,
    maxResponseBytes: 16_384,
    fetcher() {
      return Promise.resolve(new Response(utf8Bom, { status: 200 }));
    },
  });
  const revocation = await network.revokeToken("token", "refresh_token");
  assert(revocation.status === 200, "status retained");
  assert(revocation.body === "", "TextDecoder strips the UTF-8 BOM");
  assert(
    revocation.responseBytes === 3,
    "raw BOM byte count remains available to attestation",
  );
});

Deno.test("Apple network rejects unsigned, misbound, and malformed exchange evidence", async () => {
  const config = await configuration();
  const now = Date.parse("2026-07-13T12:00:00.000Z");
  const appleSigner = await identitySigner();
  const attackerSigner = await identitySigner();
  const signed = async (subject: string, audience: string) =>
    await appleIdToken({
      subject,
      audience,
      now,
      signer: appleSigner,
    });
  const forged = await appleIdToken({
    subject: "expected-subject",
    audience: config.clientId,
    now,
    signer: attackerSigner,
    keyId: appleSigner.keyId,
  });
  const responses = [
    new Response("not-json", { status: 200 }),
    new Response("x".repeat(1_025), { status: 200 }),
    new Response('{"error":"invalid_grant"}', { status: 400 }),
    new Response(
      JSON.stringify({
        refresh_token: "wrong-account-token",
        id_token: await signed("different-subject", config.clientId),
      }),
      { status: 200 },
    ),
    new Response(
      JSON.stringify({
        refresh_token: "wrong-audience-token",
        id_token: await signed("expected-subject", "other.client"),
      }),
      { status: 200 },
    ),
    new Response(
      JSON.stringify({
        refresh_token: "forged-token",
        id_token: forged,
      }),
      { status: 200 },
    ),
  ];
  for (const tokenResponse of responses) {
    const network = await createAppleDeletionNetwork({
      config,
      now: () => now,
      timeoutMs: 5_000,
      maxResponseBytes: 1_024,
      fetcher(input) {
        return Promise.resolve(
          String(input).endsWith("/auth/keys")
            ? appleKeysResponse(appleSigner)
            : tokenResponse.clone(),
        );
      },
    });
    let failed = false;
    try {
      await network.exchangeAuthorizationCode("code", "expected-subject");
    } catch (error) {
      failed = error instanceof Error &&
        error.message === "APPLE_NETWORK_FAILED";
    }
    assert(failed, "stable failure only");
  }
});

Deno.test("Apple network rejects duplicate or unknown verification keys", async () => {
  const config = await configuration();
  const now = Date.parse("2026-07-13T12:00:00.000Z");
  const signer = await identitySigner();
  const tokenResponse = new Response(
    JSON.stringify({
      refresh_token: "must-not-be-accepted",
      id_token: await appleIdToken({
        subject: "expected-subject",
        audience: config.clientId,
        now,
        signer,
      }),
    }),
    { status: 200 },
  );
  const duplicate = { ...signer.publicJwk, kid: signer.keyId };
  for (const keys of [[], [duplicate, duplicate]]) {
    const network = await createAppleDeletionNetwork({
      config,
      now: () => now,
      timeoutMs: 5_000,
      maxResponseBytes: 16_384,
      fetcher(input) {
        return Promise.resolve(
          String(input).endsWith("/auth/keys")
            ? new Response(JSON.stringify({ keys }), { status: 200 })
            : tokenResponse.clone(),
        );
      },
    });
    let failed = false;
    try {
      await network.exchangeAuthorizationCode("code", "expected-subject");
    } catch (error) {
      failed = error instanceof Error &&
        error.message === "APPLE_NETWORK_FAILED";
    }
    assert(failed, "ambiguous key sets fail closed");
  }
});

Deno.test(
  "Apple network evicts failed JWKS loads so a later fresh authorization can recover",
  async () => {
    const config = await configuration();
    const now = Date.parse("2026-07-13T12:00:00.000Z");
    const signer = await identitySigner();
    const idToken = await appleIdToken({
      subject: "expected-subject",
      audience: config.clientId,
      now,
      signer,
    });
    const firstKeyLoadFailures: Array<() => Promise<Response>> = [
      () => Promise.reject(new Error("transient fetch failure")),
      () => Promise.resolve(new Response("not-json", { status: 200 })),
    ];

    for (const firstKeyLoadFailure of firstKeyLoadFailures) {
      let keyRequests = 0;
      let tokenRequests = 0;
      const network = await createAppleDeletionNetwork({
        config,
        now: () => now,
        timeoutMs: 5_000,
        maxResponseBytes: 16_384,
        fetcher(input) {
          if (String(input).endsWith("/auth/keys")) {
            keyRequests += 1;
            return keyRequests === 1
              ? firstKeyLoadFailure()
              : Promise.resolve(appleKeysResponse(signer));
          }
          tokenRequests += 1;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                refresh_token: `refresh-token-${tokenRequests}`,
                id_token: idToken,
              }),
              { status: 200 },
            ),
          );
        },
      });

      let firstFailed = false;
      try {
        await network.exchangeAuthorizationCode(
          "first-consumed-code",
          "expected-subject",
        );
      } catch (error) {
        firstFailed = error instanceof Error &&
          error.message === "APPLE_NETWORK_FAILED";
      }
      assert(firstFailed, "the first JWKS load must fail closed");

      const recovered = await network.exchangeAuthorizationCode(
        "fresh-authorization-code",
        "expected-subject",
      );
      assert(
        recovered.token === "refresh-token-2",
        "fresh authorization recovers after refetch",
      );
      assert(
        keyRequests === 2,
        "a rejected JWKS promise is refetched exactly once by the next request",
      );

      const cached = await network.exchangeAuthorizationCode(
        "another-fresh-authorization-code",
        "expected-subject",
      );
      assert(
        cached.token === "refresh-token-3",
        "the recovered key remains usable",
      );
      assert(keyRequests === 2, "a successful JWKS import remains cached");
      assert(
        tokenRequests === 3,
        "each exchange still requires its own fresh Apple authorization",
      );
    }
  },
);

Deno.test("Apple network caches one JWKS snapshot across attacker-controlled unknown kids", async () => {
  const config = await configuration();
  let now = Date.parse("2026-07-13T12:00:00.000Z");
  const signer = await identitySigner();
  let keyRequests = 0;
  const network = await createAppleDeletionNetwork({
    config,
    now: () => now,
    timeoutMs: 5_000,
    maxResponseBytes: 16_384,
    fetcher(input) {
      assert(
        String(input).endsWith("/auth/keys"),
        "only fixed Apple JWKS origin is used",
      );
      keyRequests += 1;
      return Promise.resolve(appleKeysResponse(signer));
    },
  });

  for (let index = 0; index < 12; index += 1) {
    const token = await appleIdToken({
      subject: "expected-subject",
      audience: config.clientId,
      now,
      signer,
      keyId: `ATTACKER_KEY_${index}`,
      nonce: "ab".repeat(32),
    });
    let rejected = false;
    try {
      await network.verifyIdentityToken(
        token,
        "expected-subject",
        "ab".repeat(32),
      );
    } catch (error) {
      rejected = error instanceof AppleDeletionNetworkError;
    }
    assert(rejected, "unknown key id fails closed");
  }
  assert(
    keyRequests === 1,
    "unknown key ids cannot amplify Apple JWKS requests",
  );

  now += 300_001;
  const exact = await appleIdToken({
    subject: "expected-subject",
    audience: config.clientId,
    now,
    signer,
    nonce: "ab".repeat(32),
  });
  await network.verifyIdentityToken(exact, "expected-subject", "ab".repeat(32));
  assert(
    Number(keyRequests) === 2,
    "snapshot refreshes after the bounded five-minute TTL",
  );
});

Deno.test("Apple network verifies the native identity token subject and nonce", async () => {
  const config = await configuration();
  const now = Date.parse("2026-07-13T12:00:00.000Z");
  const signer = await identitySigner();
  const expectedNonce = "ab".repeat(32);
  const exact = await appleIdToken({
    subject: "expected-subject",
    audience: config.clientId,
    now,
    signer,
    nonce: expectedNonce,
  });
  let keyRequests = 0;
  const network = await createAppleDeletionNetwork({
    config,
    now: () => now,
    timeoutMs: 5_000,
    maxResponseBytes: 16_384,
    fetcher(input) {
      assert(
        String(input) === "https://appleid.apple.com/auth/keys",
        "fixed Apple JWKS origin",
      );
      keyRequests += 1;
      return Promise.resolve(appleKeysResponse(signer));
    },
  });
  await network.verifyIdentityToken(exact, "expected-subject", expectedNonce);
  for (
    const [subject, nonce] of [
      ["different-subject", expectedNonce],
      ["expected-subject", "cd".repeat(32)],
    ]
  ) {
    let rejected = false;
    try {
      await network.verifyIdentityToken(exact, subject, nonce);
    } catch (error) {
      rejected = error instanceof AppleDeletionNetworkError;
    }
    assert(rejected, "misbound native identity evidence fails closed");
  }
  assert(
    keyRequests === 1,
    "successful per-kid verification key remains cached",
  );
});

Deno.test("Apple refresh validation attests exact token evidence and classifies failures", async () => {
  const config = await configuration();
  const now = Date.parse("2026-07-13T12:00:00.000Z");
  const signer = await identitySigner();
  const idToken = await appleIdToken({
    subject: "expected-subject",
    audience: config.clientId,
    now,
    signer,
  });

  let observedParams: URLSearchParams | null = null;
  const valid = await createAppleDeletionNetwork({
    config,
    now: () => now,
    timeoutMs: 5_000,
    maxResponseBytes: 16_384,
    fetcher(input, init) {
      if (String(input).endsWith("/auth/keys")) {
        return Promise.resolve(appleKeysResponse(signer));
      }
      observedParams = init.body instanceof URLSearchParams ? init.body : null;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "bounded-access-token",
            id_token: idToken,
            token_type: "Bearer",
            expires_in: 3_600,
          }),
          { status: 200 },
        ),
      );
    },
  });
  await valid.validateRefreshToken(
    "retained-refresh-token",
    "expected-subject",
  );
  const submitted = observedParams as URLSearchParams | null;
  assert(submitted !== null, "refresh request body captured");
  assert(
    submitted.get("grant_type") === "refresh_token",
    "refresh grant is exact",
  );
  assert(
    submitted.get("refresh_token") === "retained-refresh-token" &&
      !submitted.has("code"),
    "only the retained refresh credential is submitted",
  );

  for (
    const [response, expectedCode] of [
      [
        new Response('{"error":"invalid_grant"}', { status: 400 }),
        "APPLE_INVALID_GRANT",
      ],
      [new Response("rate limited", { status: 429 }), "APPLE_RATE_LIMITED"],
      [
        new Response("upstream unavailable", { status: 503 }),
        "APPLE_NETWORK_FAILED",
      ],
      [
        new Response('{"access_token":"missing-evidence"}', { status: 200 }),
        "APPLE_TOKEN_RESPONSE_INVALID",
      ],
    ] as const
  ) {
    const network = await createAppleDeletionNetwork({
      config,
      now: () => now,
      timeoutMs: 5_000,
      maxResponseBytes: 16_384,
      fetcher() {
        return Promise.resolve(response.clone());
      },
    });
    let actualCode = "";
    try {
      await network.validateRefreshToken(
        "retained-refresh-token",
        "expected-subject",
      );
    } catch (error) {
      actualCode = error instanceof AppleDeletionNetworkError
        ? error.code
        : "unexpected";
    }
    assert(
      actualCode === expectedCode,
      `${expectedCode} remains distinguishable`,
    );
  }
});
