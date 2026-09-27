import { preflightAskConsent } from "./consentAdmission.ts";

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function client(data: unknown, error: unknown = null) {
  return { rpc: () => Promise.resolve({ data, error }) };
}

const ACTIVE = {
  consent_type: "ask_layerwell",
  state: "active",
  generation: 4,
  health_epoch: 7,
  version: "ask-reviewed-v1",
  consent_text_hash: "a".repeat(64),
};

Deno.test("purpose consent requires exact owner-scoped generation and base-health epoch", async () => {
  const current = await preflightAskConsent(client([ACTIVE]), "4", "7");
  assert(
    !current.ok && current.error === "ASK_CONSENT_AUTHORITY_UNAVAILABLE",
    "syntactic receipt data cannot prove current approved registry authority",
  );
  for (
    const [generation, epoch] of [
      ["3", "7"],
      ["4", "8"],
    ]
  ) {
    const result = await preflightAskConsent(
      client([ACTIVE]),
      generation,
      epoch,
    );
    assert(!result.ok && result.error === "ASK_CONSENT_STALE");
  }
});

Deno.test("purpose consent rejects missing, withdrawn, placeholder, malformed, and unavailable receipts", async () => {
  for (
    const data of [
      [],
      [{ ...ACTIVE, state: "withdrawn" }],
      [{ ...ACTIVE, version: "ask-advisor-placeholder" }],
      [{ ...ACTIVE, consent_text_hash: "not-a-hash" }],
      [{ ...ACTIVE, user_id: "unexpected" }],
    ]
  ) {
    const result = await preflightAskConsent(client(data), "4", "7");
    assert(!result.ok);
  }
  const unavailable = await preflightAskConsent(
    client([ACTIVE], { message: "private detail" }),
    "4",
    "7",
  );
  assert(!unavailable.ok && unavailable.error === "ASK_CONSENT_UNAVAILABLE");
});
