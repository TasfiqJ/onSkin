import { CATALOG_OPERATOR_RPCS } from "./contract.ts";
import { createCatalogOperatorDatabaseGateway } from "./databaseGateway.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ID = "11111111-1111-4111-8111-111111111111";
const authority = {
  p_auth_session_id: ID,
  p_edge_environment: "production",
  p_source_revision: "a".repeat(40),
  p_edge_deployment_id: "project_function_42",
  p_control_generation: 7,
};

Deno.test("database gateway commits a global attempt preflight before every action", async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = async (
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ) => {
    calls.push({ text: strings.join("$"), values });
    return [];
  };
  const gateway = createCatalogOperatorDatabaseGateway(database);
  const cases = [
    { rpcName: CATALOG_OPERATOR_RPCS.session, args: {} },
    {
      rpcName: CATALOG_OPERATOR_RPCS.queue,
      args: {
        p_queue_kind: "correction",
        p_after_created_at: null,
        p_after_id: null,
        p_limit: 25,
      },
    },
    {
      rpcName: CATALOG_OPERATOR_RPCS.detail,
      args: {
        p_item_kind: "correction_report",
        p_item_id: ID,
        p_lease_id: ID,
        p_expected_version: 1,
      },
    },
    {
      rpcName: CATALOG_OPERATOR_RPCS.claim,
      args: {
        p_operation_id: ID,
        p_item_kind: "correction_report",
        p_item_id: ID,
        p_expected_version: 1,
      },
    },
    {
      rpcName: CATALOG_OPERATOR_RPCS.transition,
      args: {
        p_operation_id: ID,
        p_item_kind: "correction_report",
        p_item_id: ID,
        p_lease_id: ID,
        p_expected_version: 1,
        p_decision: "triage",
        p_reason_code: "wrong_match_confirmed",
        p_evidence_sha256: null,
      },
    },
    {
      rpcName: CATALOG_OPERATOR_RPCS.releaseHold,
      args: {
        p_operation_id: ID,
        p_hold_id: ID,
        p_lease_id: ID,
        p_expected_version: 1,
        p_repair_receipt_id: ID,
        p_reason_code: "repair_verified_current",
      },
    },
  ];

  for (const call of cases) {
    const result = await gateway(call.rpcName, call.args, authority);
    assert(result.error === null, "bounded gateway call succeeds");
  }

  assert(
    calls.length === 12,
    "six preflight-and-action pairs dispatched",
  );
  for (const call of calls) {
    assert(
      call.text.includes("catalog_operator_gateway.catalog_operator_"),
      "statement is gateway-schema-qualified",
    );
    assert(
      !call.text.includes("public.catalog_operator_"),
      "public RPC surface is absent",
    );
    assert(
      call.values.slice(0, 5).join("|") ===
        [
          ID,
          "production",
          "a".repeat(40),
          "project_function_42",
          7,
        ].join("|"),
      "server authority is the exact leading argument set",
    );
  }
  const preflights = calls.filter((call) =>
    call.text.includes(
      "catalog_operator_gateway.catalog_operator_session(",
    ) && call.values.at(-1) === "preflight"
  );
  assert(preflights.length === 6, "every action has a preflight");
  assert(
    calls.filter((call) => call.values.at(-1) === "session").length === 1,
    "the session action spends the session budget",
  );
});

Deno.test("database gateway rejects missing server authority before issuing SQL", async () => {
  let calls = 0;
  const gateway = createCatalogOperatorDatabaseGateway(async () => {
    calls += 1;
    return [];
  });
  const result = await gateway(
    CATALOG_OPERATOR_RPCS.session,
    {},
    {},
  );
  assert(result.error instanceof Error, "missing authority rejected");
  assert(calls === 0, "no SQL issued");
});

Deno.test("database gateway never runs an action after its committed preflight rejects", async () => {
  let calls = 0;
  const gateway = createCatalogOperatorDatabaseGateway(() => {
    calls += 1;
    throw new Error("CATALOG_OPERATOR_RATE_LIMITED");
  });
  const result = await gateway(
    CATALOG_OPERATOR_RPCS.queue,
    {
      p_queue_kind: "correction",
      p_after_created_at: null,
      p_after_id: null,
      p_limit: 25,
    },
    authority,
  );
  assert(result.error instanceof Error, "preflight denial returned");
  assert(calls === 1, "action statement is not issued after denial");
});
