import {
  type AppleLifecycleSecrets,
  loadAppleLifecycleSecrets,
} from "../_shared/appleLifecycleSecrets.ts";
import {
  type AppleAccountEventDatabase,
  parseAppleAccountEventEnvelope,
  persistVerifiedAppleAccountEvent,
} from "./core.ts";
import type { AppleServerEventClaims } from "./verifier.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function secrets(): Promise<AppleLifecycleSecrets> {
  const values: Record<string, string> = {
    APPLE_SIWA_SUBJECT_HMAC_CURRENT_VERSION: "h2",
    APPLE_SIWA_SUBJECT_HMAC_KEYS: JSON.stringify({
      h1: "11".repeat(32),
      h2: "22".repeat(32),
    }),
    APPLE_SIWA_CODE_HMAC_KEY_HEX: "33".repeat(32),
    APPLE_SIWA_EVENT_HMAC_KEY_HEX: "44".repeat(32),
  };
  return await loadAppleLifecycleSecrets((name) => values[name]);
}

function claims(
  overrides: Partial<AppleServerEventClaims> = {},
): AppleServerEventClaims {
  return {
    audience: "com.example.routinekind",
    eventAtSeconds: 1_800_000_000,
    eventType: "email-disabled",
    issuer: "https://appleid.apple.com",
    issuedAtSeconds: 1_800_000_000,
    jti: "jti-1",
    rawEventType: "email-disabled",
    relayEmail: "relay@privaterelay.appleid.com",
    subject: "apple-subject",
    ...overrides,
  };
}

Deno.test("Apple event envelope is exact and bounded", () => {
  assert(
    parseAppleAccountEventEnvelope({ payload: "a.b.c" }) === "a.b.c",
    "valid envelope",
  );
  for (
    const invalid of [
      null,
      {},
      { payload: "" },
      { payload: "a.b.c", extra: true },
      { payload: "a".repeat(32_769) },
    ]
  ) {
    assert(
      parseAppleAccountEventEnvelope(invalid) === null,
      "invalid envelope",
    );
  }
});

Deno.test(
  "verified Apple event derives keyed aliases and minimizes nonterminal identity at the RPC",
  async () => {
    const holder: {
      value: Parameters<AppleAccountEventDatabase["apply"]>[0] | null;
    } = {
      value: null,
    };
    const database: AppleAccountEventDatabase = {
      async apply(input) {
        holder.value = input;
        return {
          resultCode: "applied",
          userId: "user",
          state: "active",
          generation: 2,
        };
      },
    };
    const result = await persistVerifiedAppleAccountEvent({
      compactJws: "header.payload.signature",
      claims: claims(),
      secrets: await secrets(),
      database,
    });
    const observed = holder.value;
    assert(
      result.resultCode === "applied" && observed !== null,
      "event applied",
    );
    assert(
      observed.subjectHmacKeyVersions.join(",") === "h2,h1",
      "current key is tried first",
    );
    assert(
      observed.appleSubjectHmacs.length === 2,
      "previous key supports rotation",
    );
    assert(
      observed.appleSubject === null,
      "nonterminal subject is minimized at the RPC boundary",
    );
    assert(
      observed.clientId === "com.example.routinekind",
      "verified audience is forwarded exactly",
    );
    for (
      const value of [
        observed.jtiHmac,
        observed.payloadHmac,
        observed.relayEmailHmac,
        ...observed.appleSubjectHmacs,
      ]
    ) {
      assert(
        typeof value === "string" && /^[a-f0-9]{64}$/.test(value),
        "keyed digest",
      );
    }
    assert(
      JSON.stringify(observed).includes("relay@") === false,
      "raw relay email not persisted",
    );
  },
);

Deno.test(
  "verified terminal Apple event forwards its exact signed subject for the race bridge",
  async () => {
    const holder: {
      value: Parameters<AppleAccountEventDatabase["apply"]>[0] | null;
    } = { value: null };
    const database: AppleAccountEventDatabase = {
      async apply(input) {
        holder.value = input;
        return {
          resultCode: "applied",
          userId: "user",
          state: "revoked",
          generation: 1,
        };
      },
    };
    await persistVerifiedAppleAccountEvent({
      compactJws: "header.payload.signature",
      claims: claims({ eventType: "consent-revoked", relayEmail: null }),
      secrets: await secrets(),
      database,
    });
    assert(
      holder.value?.appleSubject === "apple-subject",
      "exact terminal subject is forwarded",
    );
  },
);
