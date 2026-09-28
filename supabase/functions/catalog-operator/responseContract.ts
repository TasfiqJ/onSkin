import type { CatalogOperatorRpcCall } from "./contract.ts";

export type CatalogOperatorResponseResult =
  | Readonly<{
    action: "session";
    operatorSessionId: string;
    expiresAt: string;
    capabilities: readonly string[];
    operatorUserId: string;
    operatorEmail: string;
    environment: "development" | "staging" | "production";
    sourceRevision: string;
    edgeDeploymentId: string;
    admissionState: "open";
    controlGeneration: number;
  }>
  | Readonly<{
    action: "queue";
    items: readonly Readonly<{
      itemKind: string;
      itemId: string;
      itemVersion: number;
      status: string;
      priority: number;
      createdAt: string;
      summary: Readonly<Record<string, unknown>>;
    }>[];
    nextCursor: Readonly<{ createdAt: string; itemId: string }> | null;
  }>
  | Readonly<{
    action: "detail";
    itemKind: string;
    itemId: string;
    itemVersion: number;
    status: string;
    detail: Readonly<Record<string, unknown>>;
  }>
  | Readonly<{
    action: "claim";
    itemKind: string;
    itemId: string;
    itemVersion: number;
    leaseId: string;
    leaseExpiresAt: string;
    status: string;
  }>
  | Readonly<{
    action: "transition";
    itemKind: string;
    itemId: string;
    itemVersion: number;
    status: string;
    holdId: string | null;
    repairReceiptId: string | null;
    eventId: string;
  }>
  | Readonly<{
    action: "release_hold";
    holdId: string;
    itemVersion: number;
    state: string;
    releasedAt: string;
    eventId: string;
  }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_SLUG_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

const itemKinds = new Set([
  "correction_report",
  "catalog_source",
  "import_batch",
  "product_hold",
]);
const operatorCapabilities = new Set([
  "correction_queue_read",
  "source_queue_read",
  "correction_claim",
  "source_claim",
  "catalog_hold_claim",
  "correction_triage",
  "correction_disposition",
  "source_review_record",
  "catalog_repair_attest",
  "catalog_hold_release",
]);

const correctionTypes = new Set([
  "wrong_match",
  "missing_product",
  "ingredient_issue",
  "duplicate",
  "source_issue",
  "expiry_issue",
  "category_issue",
]);
const proposedPayloadKeys = new Set([
  "productName",
  "brand",
  "category",
  "ingredientsText",
  "sourceUrl",
  "sourceName",
  "defaultPaoMonths",
  "qualityIssue",
  "suggestedCorrection",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length &&
    keys.every((key) => expected.includes(key));
}

function uuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function positiveVersion(value: unknown): number | null {
  const parsed = typeof value === "string" && /^[1-9][0-9]{0,9}$/.test(value)
    ? Number(value)
    : value;
  return Number.isSafeInteger(parsed) && (parsed as number) >= 1 &&
      (parsed as number) <= 2_147_483_647
    ? (parsed as number)
    : null;
}

function itemKind(value: unknown): string | null {
  return typeof value === "string" && itemKinds.has(value) ? value : null;
}

function status(value: unknown): string | null {
  return typeof value === "string" && SAFE_SLUG_PATTERN.test(value)
    ? value
    : null;
}

function boundedText(
  value: unknown,
  maxLength: number,
  nullable = false,
): string | null | undefined {
  if (value === null && nullable) return null;
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function nullableUuid(value: unknown): string | null | undefined {
  return value === null ? null : (uuid(value) ?? undefined);
}

function nullableTimestamp(value: unknown): string | null | undefined {
  return value === null ? null : (timestamp(value) ?? undefined);
}

function nonnegativeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 &&
      (value as number) <= 10_000_000
    ? (value as number)
    : null;
}

function sha256(value: unknown, nullable = false): string | null | undefined {
  if (value === null && nullable) return null;
  return typeof value === "string" && SHA256_PATTERN.test(value)
    ? value
    : undefined;
}

function safeUrl(value: unknown, nullable = false): string | null | undefined {
  if (value === null && nullable) return null;
  const text = boundedText(value, 300);
  if (typeof text !== "string") return undefined;
  try {
    const parsed = new URL(text);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        !parsed.username &&
        !parsed.password
      ? text
      : undefined;
  } catch {
    return undefined;
  }
}

function productProjection(value: unknown): Record<string, unknown> | null {
  if (
    !isRecord(value) || !exactKeys(value, ["id", "name", "brand", "category"])
  ) return null;
  const id = uuid(value.id);
  const name = boundedText(value.name, 200);
  const brand = boundedText(value.brand, 200, true);
  const category = boundedText(value.category, 100, true);
  return id && typeof name === "string" && brand !== undefined &&
      category !== undefined
    ? { id, name, brand, category }
    : null;
}

function proposedPayload(value: unknown): Record<string, unknown> | null {
  if (
    !isRecord(value) || Object.keys(value).length > proposedPayloadKeys.size
  ) return null;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!proposedPayloadKeys.has(key)) return null;
    if (raw === null || typeof raw === "boolean") {
      output[key] = raw;
      continue;
    }
    if (typeof raw === "number") {
      if (!Number.isFinite(raw) || Math.abs(raw) > 10_000) return null;
      output[key] = raw;
      continue;
    }
    const maxLength = key === "ingredientsText"
      ? 1_500
      : key === "sourceUrl"
      ? 300
      : 200;
    const normalized = key === "sourceUrl"
      ? safeUrl(raw)
      : boundedText(raw, maxLength);
    if (normalized === undefined || normalized === null) return null;
    output[key] = normalized;
  }
  return new TextEncoder().encode(JSON.stringify(output)).byteLength <= 3_000
    ? output
    : null;
}

function queueSummary(
  kind: string,
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (kind === "correction_report") {
    if (
      !exactKeys(value, ["correctionType", "productId", "hasBarcode", "status"])
    ) return null;
    const productId = nullableUuid(value.productId);
    return typeof value.correctionType === "string" &&
        correctionTypes.has(value.correctionType) &&
        productId !== undefined &&
        typeof value.hasBarcode === "boolean" &&
        status(value.status)
      ? {
        correctionType: value.correctionType,
        productId,
        hasBarcode: value.hasBarcode,
        status: value.status,
      }
      : null;
  }
  if (kind === "product_hold") {
    if (
      !exactKeys(value, [
        "productId",
        "reasonCode",
        "state",
        "openedAt",
        "repairReceiptReady",
      ])
    ) {
      return null;
    }
    const productId = uuid(value.productId);
    const reasonCode = status(value.reasonCode);
    const state = status(value.state);
    const openedAt = timestamp(value.openedAt);
    return productId && reasonCode && state && openedAt &&
        typeof value.repairReceiptReady === "boolean"
      ? {
        productId,
        reasonCode,
        state,
        openedAt,
        repairReceiptReady: value.repairReceiptReady,
      }
      : null;
  }
  if (kind === "catalog_source") {
    if (
      !exactKeys(value, [
        "sourceKey",
        "displayName",
        "reviewStatus",
        "productionApproved",
      ])
    ) {
      return null;
    }
    const sourceKey = boundedText(value.sourceKey, 80);
    const displayName = boundedText(value.displayName, 200);
    const reviewStatus = status(value.reviewStatus);
    return typeof sourceKey === "string" &&
        typeof displayName === "string" &&
        reviewStatus &&
        typeof value.productionApproved === "boolean"
      ? {
        sourceKey,
        displayName,
        reviewStatus,
        productionApproved: value.productionApproved,
      }
      : null;
  }
  if (kind === "import_batch") {
    if (
      !exactKeys(value, [
        "sourceKey",
        "status",
        "artifactKind",
        "snapshotDate",
        "qaBlockerCount",
        "qaWarningCount",
      ])
    ) {
      return null;
    }
    const sourceKey = boundedText(value.sourceKey, 80);
    const normalizedStatus = status(value.status);
    const artifactKind = boundedText(value.artifactKind, 80);
    const snapshotDate = typeof value.snapshotDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value.snapshotDate)
      ? value.snapshotDate
      : null;
    const blockers = nonnegativeInteger(value.qaBlockerCount);
    const warnings = nonnegativeInteger(value.qaWarningCount);
    return typeof sourceKey === "string" &&
        normalizedStatus &&
        typeof artifactKind === "string" &&
        snapshotDate &&
        blockers !== null &&
        warnings !== null
      ? {
        sourceKey,
        status: normalizedStatus,
        artifactKind,
        snapshotDate,
        qaBlockerCount: blockers,
        qaWarningCount: warnings,
      }
      : null;
  }
  return null;
}

function correctionDetail(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  if (
    !exactKeys(value, [
      "correctionType",
      "productId",
      "barcode",
      "description",
      "proposedPayload",
      "createdAt",
      "status",
      "product",
    ])
  ) {
    return null;
  }
  const productId = nullableUuid(value.productId);
  const barcode = value.barcode === null
    ? null
    : typeof value.barcode === "string" && /^\d{8,14}$/.test(value.barcode)
    ? value.barcode
    : undefined;
  const description = boundedText(value.description, 500, true);
  const payload = proposedPayload(value.proposedPayload);
  const createdAt = timestamp(value.createdAt);
  const normalizedStatus = status(value.status);
  const product = value.product === null
    ? null
    : productProjection(value.product);
  return typeof value.correctionType === "string" &&
      correctionTypes.has(value.correctionType) &&
      productId !== undefined &&
      barcode !== undefined &&
      description !== undefined &&
      payload &&
      createdAt &&
      normalizedStatus &&
      (value.product === null || product)
    ? {
      correctionType: value.correctionType,
      productId,
      barcode,
      description,
      proposedPayload: payload,
      createdAt,
      status: normalizedStatus,
      product,
    }
    : null;
}

function productHoldDetail(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  if (
    !exactKeys(value, [
      "productId",
      "reasonCode",
      "state",
      "openedAt",
      "acceptedAt",
      "disposition",
      "dispositionAt",
      "repairReceiptId",
      "repairAttestedAt",
      "releasedAt",
      "product",
    ])
  ) {
    return null;
  }
  const productId = uuid(value.productId);
  const reasonCode = status(value.reasonCode);
  const state = status(value.state);
  const openedAt = timestamp(value.openedAt);
  const acceptedAt = nullableTimestamp(value.acceptedAt);
  const disposition = value.disposition === null ||
      value.disposition === "accepted" ||
      value.disposition === "rejected"
    ? value.disposition
    : undefined;
  const dispositionAt = nullableTimestamp(value.dispositionAt);
  const repairReceiptId = nullableUuid(value.repairReceiptId);
  const repairAttestedAt = nullableTimestamp(value.repairAttestedAt);
  const releasedAt = nullableTimestamp(value.releasedAt);
  const product = productProjection(value.product);
  return productId &&
      reasonCode &&
      state &&
      openedAt &&
      acceptedAt !== undefined &&
      disposition !== undefined &&
      dispositionAt !== undefined &&
      repairReceiptId !== undefined &&
      repairAttestedAt !== undefined &&
      releasedAt !== undefined &&
      product
    ? {
      productId,
      reasonCode,
      state,
      openedAt,
      acceptedAt,
      disposition,
      dispositionAt,
      repairReceiptId,
      repairAttestedAt,
      releasedAt,
      product,
    }
    : null;
}

function catalogSourceDetail(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  if (
    !exactKeys(value, [
      "sourceKey",
      "displayName",
      "sourceUrl",
      "licenseName",
      "licenseUrl",
      "requiresAttribution",
      "requiresShareAlike",
      "allowsImages",
      "productionApproved",
      "reviewStatus",
      "reviewedAt",
    ])
  ) {
    return null;
  }
  const sourceKey = boundedText(value.sourceKey, 80);
  const displayName = boundedText(value.displayName, 200);
  const sourceUrl = safeUrl(value.sourceUrl, true);
  const licenseName = boundedText(value.licenseName, 200, true);
  const licenseUrl = safeUrl(value.licenseUrl, true);
  const reviewStatus = status(value.reviewStatus);
  const reviewedAt = nullableTimestamp(value.reviewedAt);
  return typeof sourceKey === "string" &&
      typeof displayName === "string" &&
      sourceUrl !== undefined &&
      licenseName !== undefined &&
      licenseUrl !== undefined &&
      typeof value.requiresAttribution === "boolean" &&
      typeof value.requiresShareAlike === "boolean" &&
      typeof value.allowsImages === "boolean" &&
      typeof value.productionApproved === "boolean" &&
      reviewStatus &&
      reviewedAt !== undefined
    ? {
      sourceKey,
      displayName,
      sourceUrl,
      licenseName,
      licenseUrl,
      requiresAttribution: value.requiresAttribution,
      requiresShareAlike: value.requiresShareAlike,
      allowsImages: value.allowsImages,
      productionApproved: value.productionApproved,
      reviewStatus,
      reviewedAt,
    }
    : null;
}

function importBatchDetail(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  const keys = [
    "sourceKey",
    "batchType",
    "snapshotDate",
    "artifactKind",
    "territory",
    "status",
    "artifactSha256",
    "manifestSha256",
    "sourcePolicySha256",
    "sourceApprovalSha256",
    "qaReportSha256",
    "qaBlockerCount",
    "qaWarningCount",
    "expectedRecordCount",
    "stagedRecordCount",
    "acceptedRecordCount",
    "conflictRecordCount",
    "verificationEvidenceSha256",
    "reviewEvidenceSha256",
    "createdAt",
  ] as const;
  if (!exactKeys(value, keys)) return null;
  const textFields = [
    "sourceKey",
    "batchType",
    "artifactKind",
    "territory",
  ] as const;
  const hashFields = [
    "artifactSha256",
    "manifestSha256",
    "sourcePolicySha256",
    "sourceApprovalSha256",
    "qaReportSha256",
    "verificationEvidenceSha256",
    "reviewEvidenceSha256",
  ] as const;
  const countFields = [
    "qaBlockerCount",
    "qaWarningCount",
    "expectedRecordCount",
    "stagedRecordCount",
    "acceptedRecordCount",
    "conflictRecordCount",
  ] as const;
  const output: Record<string, unknown> = {};
  for (const key of textFields) {
    const normalized = boundedText(value[key], 100);
    if (typeof normalized !== "string") return null;
    output[key] = normalized;
  }
  for (const key of hashFields) {
    const normalized = sha256(value[key], true);
    if (normalized === undefined) return null;
    output[key] = normalized;
  }
  for (const key of countFields) {
    const normalized = nonnegativeInteger(value[key]);
    if (normalized === null) return null;
    output[key] = normalized;
  }
  const snapshotDate = typeof value.snapshotDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.snapshotDate)
    ? value.snapshotDate
    : null;
  const normalizedStatus = status(value.status);
  const createdAt = timestamp(value.createdAt);
  return snapshotDate && normalizedStatus && createdAt
    ? { ...output, snapshotDate, status: normalizedStatus, createdAt }
    : null;
}

function detailProjection(
  kind: string,
  value: unknown,
): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    new TextEncoder().encode(JSON.stringify(value)).byteLength > 16_384
  ) return null;
  if (kind === "correction_report") return correctionDetail(value);
  if (kind === "product_hold") return productHoldDetail(value);
  if (kind === "catalog_source") return catalogSourceDetail(value);
  if (kind === "import_batch") return importBatchDetail(value);
  return null;
}

function singleRow(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return null;
  }
  return exactKeys(value[0], expectedKeys) ? value[0] : null;
}

function sessionResult(value: unknown): CatalogOperatorResponseResult | null {
  const row = singleRow(value, [
    "operator_session_id",
    "expires_at",
    "capabilities",
    "operator_user_id",
    "operator_email",
    "edge_environment",
    "source_revision",
    "edge_deployment_id",
    "admission_state",
    "control_generation",
  ]);
  if (!row) return null;
  const sessionId = uuid(row.operator_session_id);
  const operatorUserId = uuid(row.operator_user_id);
  const expiresAt = timestamp(row.expires_at);
  const operatorEmail = typeof row.operator_email === "string"
    ? row.operator_email
    : "";
  if (
    !sessionId ||
    !operatorUserId ||
    !expiresAt ||
    operatorEmail.length < 3 ||
    operatorEmail.length > 254 ||
    operatorEmail !== operatorEmail.trim().toLowerCase() ||
    !operatorEmail.includes("@") ||
    /[\u0000-\u001f\u007f]/.test(operatorEmail) ||
    !["development", "staging", "production"].includes(
      String(row.edge_environment),
    ) ||
    typeof row.source_revision !== "string" ||
    !/^[a-f0-9]{40}$/.test(row.source_revision) ||
    typeof row.edge_deployment_id !== "string" ||
    row.edge_deployment_id.length < 1 ||
    row.edge_deployment_id.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(row.edge_deployment_id) ||
    row.admission_state !== "open" ||
    !Number.isSafeInteger(row.control_generation) ||
    (row.control_generation as number) < 1 ||
    !Array.isArray(row.capabilities) ||
    row.capabilities.length < 1 ||
    row.capabilities.length > 16 ||
    !row.capabilities.every(
      (capability) =>
        typeof capability === "string" &&
        operatorCapabilities.has(capability),
    ) ||
    new Set(row.capabilities).size !== row.capabilities.length
  ) {
    return null;
  }
  return {
    action: "session",
    operatorSessionId: sessionId,
    expiresAt,
    capabilities: row.capabilities,
    operatorUserId,
    operatorEmail,
    environment: row.edge_environment as
      | "development"
      | "staging"
      | "production",
    sourceRevision: row.source_revision,
    edgeDeploymentId: row.edge_deployment_id,
    admissionState: "open",
    controlGeneration: row.control_generation as number,
  };
}

function queueResult(
  value: unknown,
  limit: unknown,
  requestedQueueKind: unknown,
): CatalogOperatorResponseResult | null {
  if (
    !Array.isArray(value) || !Number.isSafeInteger(limit) ||
    value.length > (limit as number)
  ) {
    return null;
  }
  const items: Array<{
    itemKind: string;
    itemId: string;
    itemVersion: number;
    status: string;
    priority: number;
    createdAt: string;
    summary: Record<string, unknown>;
  }> = [];
  for (const raw of value) {
    if (
      !isRecord(raw) ||
      !exactKeys(raw, [
        "item_kind",
        "item_id",
        "item_version",
        "status",
        "priority",
        "created_at",
        "summary",
      ])
    ) {
      return null;
    }
    const normalizedKind = itemKind(raw.item_kind);
    const id = uuid(raw.item_id);
    const version = positiveVersion(raw.item_version);
    const normalizedStatus = status(raw.status);
    const createdAt = timestamp(raw.created_at);
    const summary = normalizedKind
      ? queueSummary(normalizedKind, raw.summary)
      : null;
    const kindMatchesQueue = requestedQueueKind === "correction"
      ? normalizedKind === "correction_report" ||
        normalizedKind === "product_hold"
      : requestedQueueKind === "source_import"
      ? normalizedKind === "catalog_source" || normalizedKind === "import_batch"
      : false;
    if (
      !normalizedKind ||
      !kindMatchesQueue ||
      !id ||
      !version ||
      !normalizedStatus ||
      !Number.isSafeInteger(raw.priority) ||
      (raw.priority as number) < 0 ||
      (raw.priority as number) > 100 ||
      !createdAt ||
      !summary
    ) {
      return null;
    }
    items.push({
      itemKind: normalizedKind,
      itemId: id,
      itemVersion: version,
      status: normalizedStatus,
      priority: raw.priority as number,
      createdAt,
      summary,
    });
  }
  const last = items.at(-1);
  return {
    action: "queue",
    items,
    nextCursor: last
      ? { createdAt: last.createdAt as string, itemId: last.itemId as string }
      : null,
  };
}

function detailResult(
  value: unknown,
  requestedKind: unknown,
  requestedId: unknown,
  requestedVersion: unknown,
): CatalogOperatorResponseResult | null {
  const row = singleRow(value, [
    "item_kind",
    "item_id",
    "item_version",
    "status",
    "detail",
  ]);
  if (!row) return null;
  const normalizedKind = itemKind(row.item_kind);
  const id = uuid(row.item_id);
  const version = positiveVersion(row.item_version);
  const normalizedStatus = status(row.status);
  const detail = normalizedKind
    ? detailProjection(normalizedKind, row.detail)
    : null;
  return normalizedKind && id && normalizedKind === requestedKind &&
      id === requestedId && version && version === requestedVersion &&
      normalizedStatus && detail
    ? {
      action: "detail",
      itemKind: normalizedKind,
      itemId: id,
      itemVersion: version,
      status: normalizedStatus,
      detail,
    }
    : null;
}

function claimResult(
  value: unknown,
  requestedKind: unknown,
  requestedId: unknown,
): CatalogOperatorResponseResult | null {
  const row = singleRow(value, [
    "item_kind",
    "item_id",
    "item_version",
    "lease_id",
    "lease_expires_at",
    "status",
  ]);
  if (!row) return null;
  const normalizedKind = itemKind(row.item_kind);
  const id = uuid(row.item_id);
  const version = positiveVersion(row.item_version);
  const leaseId = uuid(row.lease_id);
  const leaseExpiresAt = timestamp(row.lease_expires_at);
  const normalizedStatus = status(row.status);
  return normalizedKind && id && normalizedKind === requestedKind &&
      id === requestedId && version && leaseId && leaseExpiresAt &&
      normalizedStatus
    ? {
      action: "claim",
      itemKind: normalizedKind,
      itemId: id,
      itemVersion: version,
      leaseId,
      leaseExpiresAt,
      status: normalizedStatus,
    }
    : null;
}

function transitionResult(
  value: unknown,
  requestedKind: unknown,
  requestedId: unknown,
): CatalogOperatorResponseResult | null {
  const row = singleRow(value, [
    "item_kind",
    "item_id",
    "item_version",
    "status",
    "hold_id",
    "repair_receipt_id",
    "event_id",
  ]);
  if (!row) return null;
  const normalizedKind = itemKind(row.item_kind);
  const id = uuid(row.item_id);
  const version = positiveVersion(row.item_version);
  const normalizedStatus = status(row.status);
  const holdId = row.hold_id === null ? null : uuid(row.hold_id);
  const repairReceiptId = row.repair_receipt_id === null
    ? null
    : uuid(row.repair_receipt_id);
  const eventId = uuid(row.event_id);
  return normalizedKind && id && normalizedKind === requestedKind &&
      id === requestedId && version && normalizedStatus && eventId &&
      (row.hold_id === null || holdId) &&
      (row.repair_receipt_id === null || repairReceiptId)
    ? {
      action: "transition",
      itemKind: normalizedKind,
      itemId: id,
      itemVersion: version,
      status: normalizedStatus,
      holdId,
      repairReceiptId,
      eventId,
    }
    : null;
}

function releaseHoldResult(
  value: unknown,
  requestedHoldId: unknown,
): CatalogOperatorResponseResult | null {
  const row = singleRow(value, [
    "hold_id",
    "item_version",
    "state",
    "released_at",
    "event_id",
  ]);
  if (!row) return null;
  const holdId = uuid(row.hold_id);
  const version = positiveVersion(row.item_version);
  const state = status(row.state);
  const releasedAt = timestamp(row.released_at);
  const eventId = uuid(row.event_id);
  return holdId && holdId === requestedHoldId && version && state &&
      releasedAt &&
      eventId
    ? {
      action: "release_hold",
      holdId,
      itemVersion: version,
      state,
      releasedAt,
      eventId,
    }
    : null;
}

export function normalizeCatalogOperatorResponse(
  call: CatalogOperatorRpcCall,
  value: unknown,
): CatalogOperatorResponseResult | null {
  switch (call.action) {
    case "session":
      return sessionResult(value);
    case "queue":
      return queueResult(value, call.args.p_limit, call.args.p_queue_kind);
    case "detail":
      return detailResult(
        value,
        call.args.p_item_kind,
        call.args.p_item_id,
        call.args.p_expected_version,
      );
    case "claim":
      return claimResult(value, call.args.p_item_kind, call.args.p_item_id);
    case "transition":
      return transitionResult(
        value,
        call.args.p_item_kind,
        call.args.p_item_id,
      );
    case "releaseHold":
      return releaseHoldResult(value, call.args.p_hold_id);
  }
}
