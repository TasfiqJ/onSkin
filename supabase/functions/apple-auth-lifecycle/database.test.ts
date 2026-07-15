import { createAppleAuthLifecycleDatabase } from "./database.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Apple capture begin sends every active subject alias and accepts committed block", async () => {
  let observedName = "";
  let observedArgs: Record<string, unknown> | null = null;
  const database = createAppleAuthLifecycleDatabase({
    async rpc(name, args) {
      observedName = name;
      observedArgs = args;
      return { data: "blocked", error: null };
    },
  });
  const result = await database.begin({
    operationId: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    sessionId: "00000000-0000-4000-8000-000000000003",
    appleSubject: "apple.subject",
    appleSubjectHmacs: ["a".repeat(64), "b".repeat(64)],
    subjectHmacKeyVersions: ["h2", "h1"],
    codeHmac: "c".repeat(64),
    clientId: "com.example.onskin",
  });
  assert(
    result === "blocked",
    "committed terminal reconciliation is a valid begin result",
  );
  assert(observedName === "begin_apple_auth_capture", "exact RPC selected");
  assert(
    JSON.stringify(observedArgs) ===
      JSON.stringify({
        p_operation_id: "00000000-0000-4000-8000-000000000001",
        p_user_id: "00000000-0000-4000-8000-000000000002",
        p_session_id: "00000000-0000-4000-8000-000000000003",
        p_apple_subject: "apple.subject",
        p_apple_subject_hmacs: ["a".repeat(64), "b".repeat(64)],
        p_subject_hmac_key_versions: ["h2", "h1"],
        p_code_hmac: "c".repeat(64),
        p_client_id: "com.example.onskin",
      }),
    "RPC argument names and alias ordering are exact",
  );
});
