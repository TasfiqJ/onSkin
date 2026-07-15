import { createAppleAuthWorkerDatabase } from "./database.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("validation completion sends the exact atomic key-rotation RPC payload", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const database = createAppleAuthWorkerDatabase({
    rpc(name, args) {
      calls.push({ name, args });
      return Promise.resolve({ data: true, error: null });
    },
  });

  const completed = await database.complete({
    userId: "00000000-0000-4000-8000-000000000001",
    generation: "7",
    claimToken: "aa".repeat(32),
    appleSubjectHmac: "bb".repeat(32),
    subjectHmacKeyVersion: "subject-v2",
    encryptedRefreshToken: "\\x01020304",
    vaultKeyVersion: "vault-v2",
  });

  assert(completed, "boolean completion result is retained");
  assert(calls.length === 1, "one RPC is dispatched");
  assert(
    JSON.stringify(calls[0]) ===
      JSON.stringify({
        name: "complete_apple_auth_validation",
        args: {
          p_user_id: "00000000-0000-4000-8000-000000000001",
          p_generation: "7",
          p_claim_token: "aa".repeat(32),
          p_apple_subject_hmac: "bb".repeat(32),
          p_subject_hmac_key_version: "subject-v2",
          p_encrypted_refresh_token: "\\x01020304",
          p_vault_key_version: "vault-v2",
        },
      }),
    "claim CAS and all rotated fields share one database call",
  );
});
