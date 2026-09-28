import { verifiedCatalogOperatorAuth } from "./verifiedAuth.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ISSUER = "https://example.supabase.co/auth/v1";
const NOW = 1_800_000_000;

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: ISSUER,
    sub: USER_ID,
    session_id: SESSION_ID,
    role: "authenticated",
    aal: "aal2",
    is_anonymous: false,
    aud: "authenticated",
    exp: NOW + 60,
    ...overrides,
  };
}

Deno.test("signed operator claims bind the verified subject to one exact AAL2 Auth session", () => {
  const result = verifiedCatalogOperatorAuth(claims(), ISSUER, USER_ID, NOW);
  assert(result?.userId === USER_ID, "verified Auth subject retained");
  assert(
    result.authSessionId === SESSION_ID,
    "signed Auth session ID retained",
  );
});

Deno.test("operator claim admission rejects AAL1, anonymous, expired, mismatched, and malformed claims", () => {
  for (
    const [candidate, verifiedUserId] of [
      [claims({ aal: "aal1" }), USER_ID],
      [claims({ is_anonymous: true }), USER_ID],
      [claims({ exp: NOW }), USER_ID],
      [claims({ role: "service_role" }), USER_ID],
      [claims({ aud: "service_role" }), USER_ID],
      [claims({ iss: "https://attacker.example/auth/v1" }), USER_ID],
      [claims({ iss: undefined }), USER_ID],
      [claims({ sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), USER_ID],
      [claims({ session_id: "not-a-uuid" }), USER_ID],
      [claims(), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      [{}, USER_ID],
      [null, USER_ID],
    ] as const
  ) {
    assert(
      verifiedCatalogOperatorAuth(candidate, ISSUER, verifiedUserId, NOW) ===
        null,
      "unsafe claims rejected",
    );
  }
});

Deno.test("operator claim admission rejects a missing expected issuer", () => {
  assert(
    verifiedCatalogOperatorAuth(claims(), "", USER_ID, NOW) === null,
    "empty expected issuer rejected",
  );
});
