import { parseCatalogOperatorAction } from "./contract.ts";
import { normalizeCatalogOperatorResponse } from "./responseContract.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const LEASE_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const RECEIPT_ID = "55555555-5555-4555-8555-555555555555";
const HASH = "a".repeat(64);
const SESSION_AUTHORITY = Object.freeze({
  operator_email: "operator@example.test",
  edge_environment: "production",
  source_revision: "b".repeat(40),
  edge_deployment_id: "project_function_42",
  admission_state: "open",
  control_generation: 7,
});

function call(body: unknown) {
  const parsed = parseCatalogOperatorAction(body);
  assert(parsed.ok, "test request must parse");
  return parsed.call;
}

Deno.test("session response accepts only the exact bounded receipt", () => {
  const session = call({ action: "session" });
  const result = normalizeCatalogOperatorResponse(session, [
    {
      operator_session_id: ITEM_ID,
      expires_at: "2026-07-22T12:10:00+00:00",
      capabilities: ["correction_triage", "source_review_record"],
      operator_user_id: LEASE_ID,
      ...SESSION_AUTHORITY,
    },
  ]);
  assert(result?.action === "session", "session response is discriminated");
  assert(result.operatorSessionId === ITEM_ID, "session id mapped");
  assert(result.operatorUserId === LEASE_ID, "derived operator id mapped");
  assert(
    result.operatorEmail === "operator@example.test",
    "only the confirmed normalized operator email is mapped",
  );
  assert(result.environment === "production", "server environment mapped");
  assert(
    result.sourceRevision === "b".repeat(40),
    "full source revision mapped",
  );
  assert(
    result.edgeDeploymentId === "project_function_42",
    "deployment mapped",
  );
  assert(result.admissionState === "open", "open admission mapped");
  assert(result.controlGeneration === 7, "control generation mapped");
  assert(
    result.expiresAt === "2026-07-22T12:10:00.000Z",
    "session time normalized",
  );
  assert(
    Array.isArray(result.capabilities) && result.capabilities.length === 2,
    "capabilities remain bounded",
  );
  assert(
    normalizeCatalogOperatorResponse(session, [
      {
        operator_session_id: ITEM_ID,
        expires_at: "2026-07-22T12:10:00+00:00",
        capabilities: ["source_review_record", "source_review_record"],
        operator_user_id: LEASE_ID,
        ...SESSION_AUTHORITY,
      },
    ]) === null,
    "duplicate capabilities fail closed",
  );
  assert(
    normalizeCatalogOperatorResponse(session, [
      {
        operator_session_id: ITEM_ID,
        expires_at: "2026-07-22T12:10:00+00:00",
        capabilities: ["catalog_root_admin"],
        operator_user_id: LEASE_ID,
        ...SESSION_AUTHORITY,
      },
    ]) === null,
    "unknown capabilities fail closed",
  );
  assert(
    normalizeCatalogOperatorResponse(session, [
      {
        operator_session_id: ITEM_ID,
        expires_at: "2026-07-22T12:10:00+00:00",
        capabilities: ["source_review_record"],
        operator_user_id: LEASE_ID,
        ...SESSION_AUTHORITY,
        operator_email: "Other@Example.test",
      },
    ]) === null,
    "unnormalized email fails closed",
  );
  assert(
    normalizeCatalogOperatorResponse(session, [
      {
        operator_session_id: ITEM_ID,
        expires_at: "2026-07-22T12:10:00+00:00",
        capabilities: ["source_review_record"],
        operator_user_id: LEASE_ID,
        ...SESSION_AUTHORITY,
        auth_metadata: { provider: "email" },
      },
    ]) === null,
    "unexpected Auth metadata is never forwarded",
  );
});

Deno.test("queue response derives its cursor from the last strictly bounded row", () => {
  const queue = call({ action: "queue", queueKind: "correction", limit: 2 });
  const result = normalizeCatalogOperatorResponse(queue, [
    {
      item_kind: "correction_report",
      item_id: ITEM_ID,
      item_version: 1,
      status: "open",
      priority: 90,
      created_at: "2026-07-22T11:00:00+00:00",
      summary: {
        correctionType: "wrong_match",
        productId: ITEM_ID,
        hasBarcode: true,
        status: "open",
      },
    },
    {
      item_kind: "product_hold",
      item_id: LEASE_ID,
      item_version: "2",
      status: "open",
      priority: 80,
      created_at: "2026-07-22T10:00:00+00:00",
      summary: {
        productId: ITEM_ID,
        reasonCode: "wrong_match_confirmed",
        state: "open",
        openedAt: "2026-07-22T09:00:00+00:00",
        repairReceiptReady: false,
      },
    },
  ]);
  assert(result?.action === "queue", "queue response is discriminated");
  assert(result.items.length === 2, "two rows mapped");
  assert(
    result.nextCursor?.itemId === LEASE_ID,
    "cursor is exact last item",
  );
  assert(
    normalizeCatalogOperatorResponse(queue, new Array(3).fill({})) === null,
    "database cannot exceed requested page size",
  );
});

Deno.test("queue and detail reject raw or unknown nested projections", () => {
  const queue = call({ action: "queue", queueKind: "source_import", limit: 1 });
  assert(
    normalizeCatalogOperatorResponse(queue, [
      {
        item_kind: "catalog_source",
        item_id: ITEM_ID,
        item_version: 1,
        status: "open",
        priority: 10,
        created_at: "2026-07-22T11:00:00+00:00",
        summary: { source_payload: { email: "reporter@example.test" } },
      },
    ]) === null,
    "raw source payload rejected",
  );

  const detail = call({
    action: "detail",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 2,
  });
  const safe = normalizeCatalogOperatorResponse(detail, [
    {
      item_kind: "correction_report",
      item_id: ITEM_ID,
      item_version: 2,
      status: "triaged",
      detail: {
        correctionType: "ingredient_issue",
        productId: LEASE_ID,
        barcode: null,
        description: "Ingredient list differs from the reviewed package label.",
        proposedPayload: { qualityIssue: "ingredient_mismatch" },
        createdAt: "2026-07-22T10:00:00+00:00",
        status: "triaged",
        product: {
          id: LEASE_ID,
          name: "Example Cleanser",
          brand: "Example Brand",
          category: "cleanser",
        },
      },
    },
  ]);
  assert(safe?.action === "detail", "detail response is discriminated");
  assert(safe.itemId === ITEM_ID, "safe correction projection accepted");
  assert(
    normalizeCatalogOperatorResponse(detail, [
      {
        item_kind: "correction_report",
        item_id: ITEM_ID,
        item_version: 2,
        status: "triaged",
        detail: { description: "private health narrative" },
      },
    ]) === null,
    "noncanonical raw detail rejected",
  );
});

Deno.test("product hold detail exposes the current repair receipt only through the bounded projection", () => {
  const detail = call({
    action: "detail",
    itemKind: "product_hold",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 4,
  });
  const result = normalizeCatalogOperatorResponse(detail, [
    {
      item_kind: "product_hold",
      item_id: ITEM_ID,
      item_version: 4,
      status: "repair_attested",
      detail: {
        productId: LEASE_ID,
        reasonCode: "repair_required",
        state: "repair_attested",
        openedAt: "2026-07-22T09:00:00+00:00",
        acceptedAt: "2026-07-22T09:30:00+00:00",
        disposition: "accepted",
        dispositionAt: "2026-07-22T09:30:00+00:00",
        repairReceiptId: RECEIPT_ID,
        repairAttestedAt: "2026-07-22T11:00:00+00:00",
        releasedAt: null,
        product: {
          id: LEASE_ID,
          name: "Example Cleanser",
          brand: "Example Brand",
          category: "cleanser",
        },
      },
    },
  ]);
  assert(
    result !== null &&
      "detail" in result &&
      (result.detail as Record<string, unknown>).repairReceiptId === RECEIPT_ID,
    "distinct release operator can obtain the current content-free receipt",
  );
});

Deno.test("source detail is limited to public rights and review metadata", () => {
  const detail = call({
    action: "detail",
    itemKind: "catalog_source",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 1,
  });
  const result = normalizeCatalogOperatorResponse(detail, [{
    item_kind: "catalog_source",
    item_id: ITEM_ID,
    item_version: 1,
    status: "open",
    detail: {
      sourceKey: "open_beauty_facts",
      displayName: "Open Beauty Facts",
      sourceUrl: "https://world.openbeautyfacts.org",
      licenseName: "ODbL 1.0",
      licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
      requiresAttribution: true,
      requiresShareAlike: true,
      allowsImages: false,
      productionApproved: false,
      reviewStatus: "pending",
      reviewedAt: null,
    },
  }]);
  assert(result?.action === "detail", "source detail accepted");
  assert(
    result.detail.productionApproved === false &&
      result.detail.reviewedAt === null,
    "rights and review metadata preserved",
  );
  assert(
    !Object.hasOwn(result.detail, "notes"),
    "internal notes are not an output field",
  );
});

Deno.test("import detail accepts only content-addressed aggregate evidence", () => {
  const detail = call({
    action: "detail",
    itemKind: "import_batch",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 2,
  });
  const result = normalizeCatalogOperatorResponse(detail, [{
    item_kind: "import_batch",
    item_id: ITEM_ID,
    item_version: 2,
    status: "verified",
    detail: {
      sourceKey: "cosing",
      batchType: "cosing_dictionary",
      snapshotDate: "2026-07-22",
      artifactKind: "exact_source_artifact",
      territory: "US",
      status: "verified",
      artifactSha256: HASH,
      manifestSha256: HASH,
      sourcePolicySha256: HASH,
      sourceApprovalSha256: HASH,
      qaReportSha256: HASH,
      qaBlockerCount: 0,
      qaWarningCount: 0,
      expectedRecordCount: 2000,
      stagedRecordCount: 2000,
      acceptedRecordCount: 1990,
      conflictRecordCount: 10,
      verificationEvidenceSha256: HASH,
      reviewEvidenceSha256: null,
      createdAt: "2026-07-22T08:00:00+00:00",
    },
  }]);
  assert(result?.action === "detail", "import detail accepted");
  assert(result.detail.artifactSha256 === HASH, "content address retained");
  assert(
    result.detail.expectedRecordCount === 2000,
    "aggregate count retained",
  );
  assert(
    !Object.hasOwn(result.detail, "sourcePayload"),
    "source rows are never projected",
  );
});

Deno.test("claim response requires a generated bounded lease and no extra columns", () => {
  const claim = call({
    action: "claim",
    itemKind: "import_batch",
    itemId: ITEM_ID,
    expectedVersion: 2,
    operationId: OPERATION_ID,
  });
  const result = normalizeCatalogOperatorResponse(claim, [
    {
      item_kind: "import_batch",
      item_id: ITEM_ID,
      item_version: 3,
      lease_id: LEASE_ID,
      lease_expires_at: "2026-07-22T12:05:00+00:00",
      status: "claimed",
    },
  ]);
  assert(result?.action === "claim", "claim response is discriminated");
  assert(result.leaseId === LEASE_ID, "database-generated lease returned");
  assert(result.itemVersion === 3, "post-claim CAS version returned");
  assert(
    normalizeCatalogOperatorResponse(claim, [
      {
        item_kind: "import_batch",
        item_id: ITEM_ID,
        item_version: 3,
        lease_id: LEASE_ID,
        lease_expires_at: "2026-07-22T12:05:00+00:00",
        status: "claimed",
        operator_user_id: RECEIPT_ID,
      },
    ]) === null,
    "operator identity column is not forwarded",
  );
});

Deno.test("transition response exposes content-free receipts but no audit payload", () => {
  const transition = call({
    action: "transition",
    itemKind: "correction_report",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 2,
    operationId: OPERATION_ID,
    decision: "accept",
    reasonCode: "repair_required",
  });
  const result = normalizeCatalogOperatorResponse(transition, [
    {
      item_kind: "correction_report",
      item_id: ITEM_ID,
      item_version: 3,
      status: "accepted",
      hold_id: LEASE_ID,
      repair_receipt_id: null,
      event_id: EVENT_ID,
    },
  ]);
  assert(
    result?.action === "transition",
    "transition response is discriminated",
  );
  assert(
    result.holdId === LEASE_ID && result.eventId === EVENT_ID,
    "receipt ids returned",
  );
  assert(result.repairReceiptId === null, "absent repair receipt remains null");
});

Deno.test("release response is an exact closed hold receipt", () => {
  const release = call({
    action: "release_hold",
    holdId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 4,
    operationId: OPERATION_ID,
    repairReceiptId: RECEIPT_ID,
    reasonCode: "repair_verified_current",
  });
  const result = normalizeCatalogOperatorResponse(release, [
    {
      hold_id: ITEM_ID,
      item_version: 5,
      state: "released",
      released_at: "2026-07-22T12:30:00+00:00",
      event_id: EVENT_ID,
    },
  ]);
  assert(
    result?.action === "release_hold",
    "release response is discriminated",
  );
  assert(result.holdId === ITEM_ID, "hold id returned");
  assert(result.state === "released", "release state returned");
  assert(
    result.releasedAt === "2026-07-22T12:30:00.000Z",
    "release time normalized",
  );
});

Deno.test("response identities and item kinds stay bound to the exact request", () => {
  const queue = call({ action: "queue", queueKind: "correction", limit: 1 });
  assert(
    normalizeCatalogOperatorResponse(queue, [{
      item_kind: "catalog_source",
      item_id: ITEM_ID,
      item_version: 1,
      status: "open",
      priority: 20,
      created_at: "2026-07-22T09:00:00+00:00",
      summary: {
        sourceKey: "cosing",
        displayName: "CosIng",
        reviewStatus: "pending",
        productionApproved: false,
      },
    }]) === null,
    "correction queue cannot return a source item",
  );

  const detail = call({
    action: "detail",
    itemKind: "catalog_source",
    itemId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 1,
  });
  assert(
    normalizeCatalogOperatorResponse(detail, [{
      item_kind: "catalog_source",
      item_id: LEASE_ID,
      item_version: 1,
      status: "open",
      detail: {
        sourceKey: "cosing",
        displayName: "CosIng",
        sourceUrl: null,
        licenseName: null,
        licenseUrl: null,
        requiresAttribution: false,
        requiresShareAlike: false,
        allowsImages: false,
        productionApproved: false,
        reviewStatus: "pending",
        reviewedAt: null,
      },
    }]) === null,
    "detail cannot substitute another item id",
  );

  const release = call({
    action: "release_hold",
    holdId: ITEM_ID,
    leaseId: LEASE_ID,
    expectedVersion: 4,
    operationId: OPERATION_ID,
    repairReceiptId: RECEIPT_ID,
    reasonCode: "repair_verified_current",
  });
  assert(
    normalizeCatalogOperatorResponse(release, [{
      hold_id: LEASE_ID,
      item_version: 5,
      state: "released",
      released_at: "2026-07-22T12:30:00+00:00",
      event_id: EVENT_ID,
    }]) === null,
    "release cannot substitute another hold receipt",
  );
});
