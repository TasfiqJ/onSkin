import type { User } from "jsr:@supabase/supabase-js@2";
import type { AppleDeletionNetwork } from "../account-deletion/appleDeletionNetwork.ts";
import { loadAppleLifecycleSecrets } from "../_shared/appleLifecycleSecrets.ts";
import { loadAppleVaultKeyring } from "../_shared/appleVault.ts";
import {
  type AppleAuthLifecycleDatabase,
  AppleAuthLifecycleError,
  captureAppleCredential,
  exactAppleIdentitySubject,
  invalidateAppleCredential,
  parseAppleAuthLifecycleRequest,
} from "./core.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SESSION_ID = "00000000-0000-4000-8000-000000000002";
const OPERATION_ID = "00000000-0000-4000-8000-000000000003";
const APPLE_SUBJECT = "001234.abcdef";
const CLIENT_ID = "com.example.routinekind";
const NONCE = "A".repeat(43);

function user(subject = APPLE_SUBJECT, duplicate = false): User {
  return {
    id: USER_ID,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
    identities: [
      {
        id: "1",
        user_id: USER_ID,
        provider: "apple",
        identity_data: { sub: subject },
        created_at: "",
        updated_at: "",
        last_sign_in_at: "",
      },
      ...(duplicate
        ? [
          {
            id: "2",
            user_id: USER_ID,
            provider: "apple",
            identity_data: { sub: subject },
            created_at: "",
            updated_at: "",
            last_sign_in_at: "",
          },
        ]
        : []),
    ],
  } as unknown as User;
}

async function dependencies(events: string[] = []) {
  const secrets = await loadAppleLifecycleSecrets(
    (name) =>
      ({
        APPLE_SIWA_SUBJECT_HMAC_CURRENT_VERSION: "h1",
        APPLE_SIWA_SUBJECT_HMAC_KEYS: JSON.stringify({ h1: "11".repeat(32) }),
        APPLE_SIWA_CODE_HMAC_KEY_HEX: "22".repeat(32),
        APPLE_SIWA_EVENT_HMAC_KEY_HEX: "33".repeat(32),
      })[name],
  );
  const vault = await loadAppleVaultKeyring(
    (name) =>
      ({
        APPLE_SIWA_VAULT_CURRENT_VERSION: "v1",
        APPLE_SIWA_VAULT_KEYS: JSON.stringify({ v1: "44".repeat(32) }),
      })[name],
  );
  const network: AppleDeletionNetwork = {
    async verifyIdentityToken(_token, subject, nonce) {
      events.push(`verify:${subject}:${nonce}`);
    },
    async exchangeAuthorizationCode(code, subject) {
      events.push(`exchange:${code}:${subject}`);
      return { token: "refresh-token", tokenTypeHint: "refresh_token" };
    },
    async validateRefreshToken() {},
    async revokeToken() {
      return { status: 200, body: "", responseBytes: 0 };
    },
  };
  const database: AppleAuthLifecycleDatabase = {
    async begin(input) {
      events.push(`begin:${input.operationId}:${input.sessionId}`);
      assert(
        input.appleSubject === APPLE_SUBJECT,
        "raw subject only reaches identity-check RPC",
      );
      assert(
        input.appleSubjectHmacs.length === 1,
        "all active aliases reach the fence",
      );
      assert(
        /^[a-f0-9]{64}$/.test(input.appleSubjectHmacs[0]),
        "subject must be keyed",
      );
      assert(
        input.subjectHmacKeyVersions.join(",") === "h1",
        "key versions stay ordered",
      );
      assert(/^[a-f0-9]{64}$/.test(input.codeHmac), "code must be keyed");
      return "reserved";
    },
    async markExchangeStarted() {
      events.push("request_started");
      return true;
    },
    async complete(input) {
      events.push("complete");
      assert(
        input.encryptedRefreshToken.startsWith("\\x"),
        "vault uses canonical bytea",
      );
      assert(
        !input.encryptedRefreshToken.includes("refresh-token"),
        "database never sees plaintext",
      );
      return {
        state: "active",
        generation: 2,
        nextValidationAt: new Date().toISOString(),
      };
    },
    async fail() {
      events.push("fail");
    },
    async invalidate() {
      events.push("invalidate");
      return true;
    },
  };
  return { secrets, vault, network, database };
}

Deno.test("Apple lifecycle request parser accepts only exact bounded shapes", () => {
  const capture = {
    action: "capture",
    appleUser: APPLE_SUBJECT,
    authorizationCode: "one-use-code",
    identityToken: "header.payload.signature",
    nonce: NONCE,
  };
  assert(
    parseAppleAuthLifecycleRequest(capture)?.action === "capture",
    "valid capture",
  );
  assert(
    parseAppleAuthLifecycleRequest({
      action: "credential_invalid",
      appleUser: APPLE_SUBJECT,
      reason: "revoked",
    })?.action === "credential_invalid",
    "valid invalidation",
  );
  for (
    const invalid of [
      { ...capture, extra: true },
      { ...capture, nonce: "short" },
      { ...capture, authorizationCode: "" },
      { ...capture, identityToken: ` ${capture.identityToken}` },
      {
        action: "credential_invalid",
        appleUser: APPLE_SUBJECT,
        reason: "authorized",
      },
    ]
  ) {
    assert(
      parseAppleAuthLifecycleRequest(invalid) === null,
      "invalid shape must fail closed",
    );
  }
});

Deno.test("Apple subject binding requires exactly one matching Supabase Apple identity", () => {
  assert(
    exactAppleIdentitySubject(user(), APPLE_SUBJECT) === APPLE_SUBJECT,
    "exact identity",
  );
  assert(
    exactAppleIdentitySubject(user("other"), APPLE_SUBJECT) === null,
    "foreign subject",
  );
  assert(
    exactAppleIdentitySubject(user(APPLE_SUBJECT, true), APPLE_SUBJECT) ===
      null,
    "duplicate",
  );
});

Deno.test("Apple capture commits request_started before the one-use code exchange", async () => {
  const events: string[] = [];
  const deps = await dependencies(events);
  const result = await captureAppleCredential({
    request: {
      action: "capture",
      appleUser: APPLE_SUBJECT,
      authorizationCode: "one-use-code",
      identityToken: "header.payload.signature",
      nonce: NONCE,
    },
    user: user(),
    sessionId: SESSION_ID,
    clientId: CLIENT_ID,
    operationId: OPERATION_ID,
    ...deps,
  });
  assert(
    result.status === "active" && result.generation === 2,
    "capture activates exact generation",
  );
  const verify = events.findIndex((entry) => entry.startsWith("verify:"));
  const begin = events.findIndex((entry) => entry.startsWith("begin:"));
  const started = events.indexOf("request_started");
  const exchange = events.findIndex((entry) => entry.startsWith("exchange:"));
  const complete = events.indexOf("complete");
  assert(
    verify < begin && begin < started && started < exchange &&
      exchange < complete,
    events.join(","),
  );
  assert(
    /verify:[^:]+:[a-f0-9]{64}$/.test(events[verify]),
    "server verifies SHA-256(raw nonce)",
  );
});

Deno.test("capture-time terminal reconciliation blocks before one-use code dispatch", async () => {
  const events: string[] = [];
  const deps = await dependencies(events);
  deps.database.begin = async () => {
    events.push("begin:blocked");
    return "blocked";
  };
  try {
    await captureAppleCredential({
      request: {
        action: "capture",
        appleUser: APPLE_SUBJECT,
        authorizationCode: "one-use-code",
        identityToken: "header.payload.signature",
        nonce: NONCE,
      },
      user: user(),
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
      operationId: OPERATION_ID,
      ...deps,
    });
    throw new Error("expected reconciled capture to block");
  } catch (error) {
    assert(error instanceof AppleAuthLifecycleError, "stable lifecycle error");
    assert(
      error.code === "APPLE_AUTH_CAPTURE_REJECTED" && error.status === 409,
      "stable block",
    );
  }
  assert(
    events.includes("begin:blocked"),
    "database committed terminal reconciliation",
  );
  assert(
    !events.includes("request_started"),
    "exchange-start marker was not written",
  );
  assert(
    !events.some((event) => event.startsWith("exchange:")),
    "authorization code was not sent",
  );
});

Deno.test("Apple capture never replays after exchange dispatch becomes ambiguous", async () => {
  const events: string[] = [];
  const deps = await dependencies(events);
  deps.network.exchangeAuthorizationCode = async () => {
    events.push("exchange");
    throw new Error("response lost");
  };
  try {
    await captureAppleCredential({
      request: {
        action: "capture",
        appleUser: APPLE_SUBJECT,
        authorizationCode: "one-use-code",
        identityToken: "header.payload.signature",
        nonce: NONCE,
      },
      user: user(),
      sessionId: SESSION_ID,
      clientId: CLIENT_ID,
      operationId: OPERATION_ID,
      ...deps,
    });
    throw new Error("expected ambiguous capture");
  } catch (error) {
    assert(error instanceof AppleAuthLifecycleError, "stable lifecycle error");
    assert(
      error.code === "APPLE_AUTH_CAPTURE_AMBIGUOUS",
      "ambiguous provider result",
    );
  }
  assert(
    events.filter((event) => event === "exchange").length === 1,
    "one dispatch only",
  );
  assert(events.at(-1) === "fail", "durable operation is terminally failed");
});

Deno.test("native invalidation fences exact identity and maps transferred separately", async () => {
  for (const reason of ["revoked", "not_found", "transferred"] as const) {
    const events: string[] = [];
    const deps = await dependencies(events);
    let observedCode = "";
    deps.database.invalidate = async (input) => {
      observedCode = input.failureCode;
      return true;
    };
    const result = await invalidateAppleCredential({
      request: {
        action: "credential_invalid",
        appleUser: APPLE_SUBJECT,
        reason,
      },
      user: user(),
      sessionId: SESSION_ID,
      database: deps.database,
    });
    assert(result.status === "blocked", "invalidation blocks access");
    assert(
      observedCode ===
        (reason === "transferred"
          ? "APPLE_NATIVE_CREDENTIAL_TRANSFERRED"
          : "APPLE_NATIVE_CREDENTIAL_INVALID"),
      "reason maps to bounded database code",
    );
  }
});
