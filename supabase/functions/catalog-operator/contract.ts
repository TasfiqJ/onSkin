export const CATALOG_OPERATOR_RPCS = {
  session: "catalog_operator_session",
  queue: "catalog_operator_queue",
  detail: "catalog_operator_detail",
  claim: "catalog_operator_claim",
  transition: "catalog_operator_transition",
  releaseHold: "catalog_operator_release_hold",
} as const;

export const CATALOG_OPERATOR_DEFAULT_QUEUE_LIMIT = 25;
export const CATALOG_OPERATOR_MAX_QUEUE_LIMIT = 50;

export type CatalogOperatorQueueKind = "correction" | "source_import";
export type CatalogOperatorItemKind =
  | "correction_report"
  | "catalog_source"
  | "import_batch"
  | "product_hold";

export type CatalogOperatorRpcCall = Readonly<{
  action: keyof typeof CATALOG_OPERATOR_RPCS;
  rpcName: (typeof CATALOG_OPERATOR_RPCS)[keyof typeof CATALOG_OPERATOR_RPCS];
  args: Readonly<Record<string, unknown>>;
}>;

export type CatalogOperatorParseResult =
  | Readonly<{ ok: true; call: CatalogOperatorRpcCall }>
  | Readonly<{ ok: false; error: "invalid_request" }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RANDOM_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const correctionTriageReasons = new Set([
  "wrong_match_confirmed",
  "ingredient_risk_confirmed",
  "source_defect_confirmed",
  "expiry_defect_confirmed",
  "category_defect_confirmed",
  "duplicate_confirmed",
  "missing_product_confirmed",
]);
const correctionRejectReasons = new Set([
  "not_reproducible",
  "report_incorrect",
  "insufficient_evidence",
]);
const sourceImportChangeReasons = new Set([
  "rights_gap",
  "attribution_gap",
  "artifact_gap",
  "quality_gap",
  "provenance_gap",
]);
const sourceImportEscalationReasons = new Set([
  "legal_review_required",
  "security_review_required",
  "source_withdrawal_risk",
]);
const importBatchRollbackReasons = new Set([
  "integrity_failure",
  "source_withdrawn",
  "quality_regression",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[],
): boolean {
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key));
}

function queueKind(value: unknown): CatalogOperatorQueueKind | null {
  return value === "correction" || value === "source_import" ? value : null;
}

function itemKind(value: unknown): CatalogOperatorItemKind | null {
  return value === "correction_report" ||
      value === "catalog_source" ||
      value === "import_batch" ||
      value === "product_hold"
    ? value
    : null;
}

function uuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function operationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return RANDOM_UUID_PATTERN.test(normalized) ? normalized : null;
}

function positiveVersion(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 1 &&
      (value as number) <= 2_147_483_647
    ? (value as number)
    : null;
}

function sha256(value: unknown): string | null {
  return typeof value === "string" && SHA256_PATTERN.test(value) ? value : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 20 || value.length > 35) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const canonical = parsed.toISOString();
  return value === canonical ? canonical : null;
}

function invalid(): CatalogOperatorParseResult {
  return { ok: false, error: "invalid_request" };
}

function call(
  action: keyof typeof CATALOG_OPERATOR_RPCS,
  args: Readonly<Record<string, unknown>>,
): CatalogOperatorParseResult {
  return {
    ok: true,
    call: { action, rpcName: CATALOG_OPERATOR_RPCS[action], args },
  };
}

function parseSession(
  body: Record<string, unknown>,
): CatalogOperatorParseResult {
  if (!hasExactKeys(body, ["action"], [])) return invalid();
  return call("session", {});
}

function parseQueue(body: Record<string, unknown>): CatalogOperatorParseResult {
  if (!hasExactKeys(body, ["action", "queueKind"], ["cursor", "limit"])) {
    return invalid();
  }
  const kind = queueKind(body.queueKind);
  if (!kind) return invalid();

  let afterCreatedAt: string | null = null;
  let afterId: string | null = null;
  if (body.cursor !== undefined && body.cursor !== null) {
    if (
      !isRecord(body.cursor) ||
      !hasExactKeys(body.cursor, ["createdAt", "itemId"], [])
    ) {
      return invalid();
    }
    afterCreatedAt = timestamp(body.cursor.createdAt);
    afterId = uuid(body.cursor.itemId);
    if (!afterCreatedAt || !afterId) return invalid();
  }

  let limit = CATALOG_OPERATOR_DEFAULT_QUEUE_LIMIT;
  if (body.limit !== undefined) {
    if (
      !Number.isSafeInteger(body.limit) ||
      (body.limit as number) < 1 ||
      (body.limit as number) > CATALOG_OPERATOR_MAX_QUEUE_LIMIT
    ) {
      return invalid();
    }
    limit = body.limit as number;
  }

  return call("queue", {
    p_queue_kind: kind,
    p_after_created_at: afterCreatedAt,
    p_after_id: afterId,
    p_limit: limit,
  });
}

function parseDetail(
  body: Record<string, unknown>,
): CatalogOperatorParseResult {
  if (
    !hasExactKeys(
      body,
      ["action", "itemKind", "itemId", "leaseId", "expectedVersion"],
      [],
    )
  ) {
    return invalid();
  }
  const kind = itemKind(body.itemKind);
  const itemId = uuid(body.itemId);
  const leaseId = uuid(body.leaseId);
  const version = positiveVersion(body.expectedVersion);
  return kind && itemId && leaseId && version
    ? call("detail", {
      p_item_kind: kind,
      p_item_id: itemId,
      p_lease_id: leaseId,
      p_expected_version: version,
    })
    : invalid();
}

function parseClaim(body: Record<string, unknown>): CatalogOperatorParseResult {
  if (
    !hasExactKeys(
      body,
      ["action", "itemKind", "itemId", "expectedVersion", "operationId"],
      [],
    )
  ) {
    return invalid();
  }
  const kind = itemKind(body.itemKind);
  const itemId = uuid(body.itemId);
  const version = positiveVersion(body.expectedVersion);
  const idempotencyId = operationId(body.operationId);
  return kind && itemId && version && idempotencyId
    ? call("claim", {
      p_item_kind: kind,
      p_item_id: itemId,
      p_expected_version: version,
      p_operation_id: idempotencyId,
    })
    : invalid();
}

function correctionTransitionIsValid(
  decision: unknown,
  reason: unknown,
): boolean {
  if (typeof reason !== "string") return false;
  if (decision === "triage") return correctionTriageReasons.has(reason);
  if (decision === "accept") return reason === "repair_required";
  if (decision === "reject") return correctionRejectReasons.has(reason);
  return false;
}

function sourceImportTransitionIsValid(
  kind: "catalog_source" | "import_batch",
  decision: unknown,
  reason: unknown,
): boolean {
  if (typeof reason !== "string") return false;
  if (decision === "acknowledge") return reason === "reviewed_no_change";
  if (decision === "request_changes") {
    return sourceImportChangeReasons.has(reason);
  }
  if (decision === "escalate") return sourceImportEscalationReasons.has(reason);
  if (kind === "import_batch" && decision === "recommend_promotion") {
    return reason === "evidence_complete";
  }
  if (kind === "import_batch" && decision === "recommend_rollback") {
    return importBatchRollbackReasons.has(reason);
  }
  return false;
}

function parseTransition(
  body: Record<string, unknown>,
): CatalogOperatorParseResult {
  if (
    !hasExactKeys(
      body,
      [
        "action",
        "itemKind",
        "itemId",
        "leaseId",
        "expectedVersion",
        "operationId",
        "decision",
        "reasonCode",
      ],
      ["evidenceSha256"],
    )
  ) {
    return invalid();
  }
  const kind = itemKind(body.itemKind);
  const itemId = uuid(body.itemId);
  const leaseId = uuid(body.leaseId);
  const version = positiveVersion(body.expectedVersion);
  const idempotencyId = operationId(body.operationId);
  if (!kind || !itemId || !leaseId || !version || !idempotencyId) {
    return invalid();
  }

  let evidence: string | null = null;

  if (kind === "correction_report") {
    if (Object.hasOwn(body, "evidenceSha256")) return invalid();
    if (!correctionTransitionIsValid(body.decision, body.reasonCode)) {
      return invalid();
    }
  } else if (kind === "catalog_source" || kind === "import_batch") {
    if (Object.hasOwn(body, "evidenceSha256")) return invalid();
    if (!sourceImportTransitionIsValid(kind, body.decision, body.reasonCode)) {
      return invalid();
    }
  } else if (kind === "product_hold") {
    evidence = sha256(body.evidenceSha256);
    if (!evidence) return invalid();
    if (
      body.decision !== "attest_repair" ||
      body.reasonCode !== "cat02_cat03_repair_verified"
    ) {
      return invalid();
    }
  } else {
    return invalid();
  }

  return call("transition", {
    p_item_kind: kind,
    p_item_id: itemId,
    p_lease_id: leaseId,
    p_expected_version: version,
    p_operation_id: idempotencyId,
    p_decision: body.decision,
    p_reason_code: body.reasonCode,
    p_evidence_sha256: evidence,
  });
}

function parseReleaseHold(
  body: Record<string, unknown>,
): CatalogOperatorParseResult {
  if (
    !hasExactKeys(
      body,
      [
        "action",
        "holdId",
        "leaseId",
        "expectedVersion",
        "operationId",
        "repairReceiptId",
        "reasonCode",
      ],
      [],
    )
  ) {
    return invalid();
  }
  const holdId = uuid(body.holdId);
  const leaseId = uuid(body.leaseId);
  const version = positiveVersion(body.expectedVersion);
  const idempotencyId = operationId(body.operationId);
  const repairReceiptId = uuid(body.repairReceiptId);
  const reasonCode = body.reasonCode === "repair_verified_current"
    ? body.reasonCode
    : null;
  return holdId && leaseId && version && idempotencyId && repairReceiptId &&
      reasonCode
    ? call("releaseHold", {
      p_hold_id: holdId,
      p_lease_id: leaseId,
      p_expected_version: version,
      p_operation_id: idempotencyId,
      p_repair_receipt_id: repairReceiptId,
      p_reason_code: reasonCode,
    })
    : invalid();
}

export function parseCatalogOperatorAction(
  value: unknown,
): CatalogOperatorParseResult {
  if (!isRecord(value) || typeof value.action !== "string") return invalid();
  switch (value.action) {
    case "session":
      return parseSession(value);
    case "queue":
      return parseQueue(value);
    case "detail":
      return parseDetail(value);
    case "claim":
      return parseClaim(value);
    case "transition":
      return parseTransition(value);
    case "release_hold":
      return parseReleaseHold(value);
    default:
      return invalid();
  }
}
