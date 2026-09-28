import {
  CATALOG_OPERATOR_DEFAULT_QUEUE_LIMIT,
  CATALOG_OPERATOR_RPCS,
  parseCatalogOperatorAction,
} from "./contract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const LEASE_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const RECEIPT_ID = "44444444-4444-4444-8444-444444444444";
const HASH = "a".repeat(64);

function parsed(body: unknown) {
  const result = parseCatalogOperatorAction(body);
  assert(result.ok, `expected a valid action: ${JSON.stringify(body)}`);
  return result.call;
}

function rejected(body: unknown): void {
  assert(
    !parseCatalogOperatorAction(body).ok,
    `expected rejection: ${JSON.stringify(body)}`,
  );
}

Deno.test("operator session accepts only the exact empty action envelope", () => {
  const call = parsed({ action: "session" });
  assert(
    call.rpcName === CATALOG_OPERATOR_RPCS.session,
    "session RPC is exact",
  );
  assert(
    Object.keys(call.args).length === 0,
    "session derives every identity from the JWT",
  );
  rejected({ action: "session", userId: ITEM_ID });
  rejected({ action: "session", capability: "admin" });
});

Deno.test("operator queue maps a bounded composite cursor to the exact SQL arguments", () => {
  const initial = parsed({ action: "queue", queueKind: "correction" });
  assert(initial.rpcName === CATALOG_OPERATOR_RPCS.queue, "queue RPC is exact");
  assert(initial.args.p_queue_kind === "correction", "queue kind is preserved");
  assert(
    initial.args.p_after_created_at === null,
    "initial timestamp cursor is null",
  );
  assert(initial.args.p_after_id === null, "initial id cursor is null");
  assert(
    initial.args.p_limit === CATALOG_OPERATOR_DEFAULT_QUEUE_LIMIT,
    "queue limit defaults",
  );

  const paged = parsed({
    action: "queue",
    queueKind: "source_import",
    cursor: { createdAt: "2026-07-22T12:34:56.000Z", itemId: ITEM_ID },
    limit: 50,
  });
  assert(
    paged.args.p_after_created_at === "2026-07-22T12:34:56.000Z",
    "timestamp cursor",
  );
  assert(paged.args.p_after_id === ITEM_ID, "id cursor");
  assert(paged.args.p_limit === 50, "maximum reviewed page size accepted");
});

Deno.test("operator queue rejects loose, partial, noncanonical, and oversized cursors", () => {
  rejected({ action: "queue", queueKind: "all" });
  rejected({ action: "queue", queueKind: "correction", status: "open" });
  rejected({
    action: "queue",
    queueKind: "correction",
    cursor: { createdAt: "2026-07-22T12:34:56Z", itemId: ITEM_ID },
  });
  rejected({
    action: "queue",
    queueKind: "correction",
    cursor: { createdAt: "2026-07-22T12:34:56.000Z" },
  });
  rejected({ action: "queue", queueKind: "correction", limit: 51 });
  rejected({ action: "queue", queueKind: "correction", limit: "25" });
});

Deno.test("operator detail and claim use item authority plus CAS and UUIDv4 idempotency", () => {
  const detail = parsed({
    action: "detail",
    itemKind: "product_hold",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 7,
  });
  assert(detail.args.p_item_kind === "product_hold", "detail item kind");
  assert(detail.args.p_item_id === ITEM_ID, "detail item id");
  assert(detail.args.p_lease_id === LEASE_ID, "detail lease mapped");
  assert(detail.args.p_expected_version === 7, "detail CAS version mapped");
  rejected({
    action: "detail",
    itemKind: "product_hold",
    itemId: ITEM_ID,
    expectedVersion: 7,
  });
  rejected({
    action: "detail",
    itemKind: "product_hold",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 0,
  });

  const claim = parsed({
    action: "claim",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    expectedVersion: 7,
    operationId: OPERATION_ID,
  });
  assert(claim.rpcName === CATALOG_OPERATOR_RPCS.claim, "claim RPC is exact");
  assert(
    claim.args.p_operation_id === OPERATION_ID,
    "idempotency identity mapped",
  );
  assert(
    claim.args.p_item_kind === "correction_report",
    "claim item kind mapped",
  );
  assert(claim.args.p_item_id === ITEM_ID, "claim item id mapped");
  assert(claim.args.p_expected_version === 7, "claim CAS version mapped");
  assert(
    !Object.hasOwn(claim.args, "p_queue_kind"),
    "no nonexistent queue argument is emitted",
  );

  rejected({
    action: "claim",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    expectedVersion: 0,
    operationId: OPERATION_ID,
  });
  rejected({
    action: "claim",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    expectedVersion: 1,
    operationId: "11111111-1111-1111-8111-111111111111",
  });
});

Deno.test("correction transitions accept only reviewed decision and reason pairs", () => {
  for (
    const [decision, reasonCode] of [
      ["triage", "wrong_match_confirmed"],
      ["triage", "missing_product_confirmed"],
      ["accept", "repair_required"],
      ["reject", "not_reproducible"],
      ["reject", "insufficient_evidence"],
    ]
  ) {
    const call = parsed({
      action: "transition",
      itemKind: "correction_report",
      itemId: ITEM_ID,
      leaseId: LEASE_ID,
      expectedVersion: 2,
      operationId: OPERATION_ID,
      decision,
      reasonCode,
    });
    assert(
      call.rpcName === CATALOG_OPERATOR_RPCS.transition,
      "transition RPC is exact",
    );
    assert(
      call.args.p_evidence_sha256 === null,
      "correction decisions cannot attach raw evidence",
    );
  }
  rejected({
    action: "transition",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 2,
    operationId: OPERATION_ID,
    decision: "accept",
    reasonCode: "insufficient_evidence",
  });
  rejected({
    action: "transition",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 2,
    operationId: OPERATION_ID,
    decision: "triage",
    reasonCode: "wrong_match_confirmed",
    note: "arbitrary reporter or health text is not an API field",
  });
});

Deno.test("source and import transitions record recommendations without granting release authority", () => {
  for (
    const request of [
      {
        itemKind: "catalog_source",
        decision: "acknowledge",
        reasonCode: "reviewed_no_change",
      },
      {
        itemKind: "catalog_source",
        decision: "request_changes",
        reasonCode: "rights_gap",
      },
      {
        itemKind: "catalog_source",
        decision: "escalate",
        reasonCode: "legal_review_required",
      },
      {
        itemKind: "import_batch",
        decision: "recommend_promotion",
        reasonCode: "evidence_complete",
      },
      {
        itemKind: "import_batch",
        decision: "recommend_rollback",
        reasonCode: "integrity_failure",
      },
    ]
  ) {
    parsed({
      action: "transition",
      itemId: ITEM_ID,
      leaseId: LEASE_ID,
      expectedVersion: 3,
      operationId: OPERATION_ID,
      ...request,
    });
  }
  rejected({
    action: "transition",
    itemKind: "catalog_source",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 3,
    operationId: OPERATION_ID,
    decision: "recommend_promotion",
    reasonCode: "evidence_complete",
  });
  rejected({
    action: "transition",
    itemKind: "import_batch",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 3,
    operationId: OPERATION_ID,
    decision: "promote",
    reasonCode: "evidence_complete",
  });
});

Deno.test("hold attestation and release remain separate evidence-bound actions", () => {
  parsed({
    action: "transition",
    itemKind: "product_hold",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 4,
    operationId: OPERATION_ID,
    decision: "attest_repair",
    reasonCode: "cat02_cat03_repair_verified",
    evidenceSha256: HASH,
  });
  const release = parsed({
    action: "release_hold",
    holdId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 5,
    operationId: OPERATION_ID,
    repairReceiptId: RECEIPT_ID,
    reasonCode: "repair_verified_current",
  });
  assert(
    release.rpcName === CATALOG_OPERATOR_RPCS.releaseHold,
    "release RPC is exact",
  );
  assert(release.args.p_hold_id === ITEM_ID, "hold identity mapped");
  assert(
    release.args.p_repair_receipt_id === RECEIPT_ID,
    "repair receipt mapped",
  );
  assert(
    release.args.p_reason_code === "repair_verified_current",
    "release reason is fixed",
  );
  rejected({
    action: "release_hold",
    holdId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 5,
    operationId: OPERATION_ID,
    repairReceiptId: RECEIPT_ID,
    reasonCode: "manual_override",
  });
});

Deno.test("transition evidence is forbidden outside hold attestation and exact for the hold", () => {
  const base = {
    action: "transition",
    itemKind: "catalog_source",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 1,
    operationId: OPERATION_ID,
    decision: "acknowledge",
    reasonCode: "reviewed_no_change",
  };
  const sourceCall = parsed(base);
  assert(
    sourceCall.args.p_evidence_sha256 === null,
    "source recommendation emits SQL NULL evidence",
  );
  rejected({ ...base, evidenceSha256: HASH });
  rejected({ ...base, evidenceSha256: null });

  const holdBase = {
    action: "transition",
    itemKind: "product_hold",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 1,
    operationId: OPERATION_ID,
    decision: "attest_repair",
    reasonCode: "cat02_cat03_repair_verified",
  };
  rejected(holdBase);
  rejected({ ...holdBase, evidenceSha256: HASH.toUpperCase() });
  rejected({ ...holdBase, evidenceSha256: HASH.slice(1) });
  rejected({ ...holdBase, evidenceSha256: null });
});
