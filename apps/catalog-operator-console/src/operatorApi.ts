import type { OperatorConsoleEnvironment } from './env';

export type QueueKind = 'correction' | 'source_import';
export type ItemKind =
  | 'correction_report'
  | 'catalog_source'
  | 'import_batch'
  | 'product_hold';

export interface QueueCursor {
  readonly createdAt: string;
  readonly itemId: string;
}

export interface OperatorSession {
  readonly operatorSessionId: string;
  readonly operatorUserId: string;
  readonly operatorEmail: string;
  readonly expiresAt: string;
  readonly capabilities: readonly string[];
  readonly environment: 'development' | 'staging' | 'production';
  readonly sourceRevision: string;
  readonly edgeDeploymentId: string;
  readonly admissionState: 'open';
  readonly controlGeneration: number;
}

export interface PresentationRecord {
  readonly [key: string]: PresentationValue;
}

export type PresentationValue = string | number | boolean | null | PresentationRecord;

export interface QueueItem {
  readonly itemKind: ItemKind;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly status: string;
  readonly priority: number;
  readonly createdAt: string;
  readonly summary: PresentationRecord;
}

export interface QueuePage {
  readonly items: readonly QueueItem[];
  readonly nextCursor: QueueCursor | null;
}

export interface ItemDetail {
  readonly itemKind: ItemKind;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly status: string;
  readonly detail: PresentationRecord;
}

export interface ItemClaim {
  readonly itemKind: ItemKind;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly leaseId: string;
  readonly leaseExpiresAt: string;
  readonly status: string;
}

export interface ItemTransition {
  readonly itemKind: ItemKind;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly status: string;
  readonly holdId: string | null;
  readonly repairReceiptId: string | null;
  readonly eventId: string;
}

export interface HoldRelease {
  readonly holdId: string;
  readonly itemVersion: number;
  readonly state: string;
  readonly releasedAt: string;
  readonly eventId: string;
}

export type OperatorRequest =
  | Readonly<{ action: 'session' }>
  | Readonly<{
      action: 'queue';
      queueKind: QueueKind;
      cursor?: QueueCursor;
      limit?: number;
    }>
  | Readonly<{
      action: 'detail';
      itemKind: ItemKind;
      itemId: string;
      leaseId: string;
      expectedVersion: number;
    }>
  | Readonly<{
      action: 'claim';
      itemKind: ItemKind;
      itemId: string;
      expectedVersion: number;
      operationId: string;
    }>
  | Readonly<{
      action: 'transition';
      itemKind: Exclude<ItemKind, 'product_hold'>;
      itemId: string;
      leaseId: string;
      expectedVersion: number;
      operationId: string;
      decision: string;
      reasonCode: string;
    }>
  | Readonly<{
      action: 'transition';
      itemKind: 'product_hold';
      itemId: string;
      leaseId: string;
      expectedVersion: number;
      operationId: string;
      decision: 'attest_repair';
      reasonCode: 'cat02_cat03_repair_verified';
      evidenceSha256: string;
    }>
  | Readonly<{
      action: 'release_hold';
      holdId: string;
      leaseId: string;
      expectedVersion: number;
      operationId: string;
      repairReceiptId: string;
      reasonCode: 'repair_verified_current';
    }>;

export type OperatorResponse<T extends OperatorRequest> = T extends Readonly<{
  action: 'session';
}>
  ? OperatorSession
  : T extends Readonly<{ action: 'queue' }>
    ? QueuePage
    : T extends Readonly<{ action: 'detail' }>
      ? ItemDetail
      : T extends Readonly<{ action: 'claim' }>
        ? ItemClaim
        : T extends Readonly<{ action: 'transition' }>
          ? ItemTransition
          : HoldRelease;

export type OperatorErrorCode =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'operator_unavailable'
  | 'request_failed';

export class OperatorApiError extends Error {
  readonly code: OperatorErrorCode;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: OperatorErrorCode,
    options: {
      readonly status?: number;
      readonly requestId?: string | null;
      readonly retryAfterSeconds?: number | null;
    } = {},
  ) {
    super(operatorErrorMessage(code));
    this.name = 'OperatorApiError';
    this.code = code;
    this.status = options.status ?? null;
    this.requestId = options.requestId ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

const RESPONSE_MAX_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATUS_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ITEM_KINDS = new Set<ItemKind>([
  'correction_report',
  'catalog_source',
  'import_batch',
  'product_hold',
]);
const OPERATOR_CAPABILITIES = new Set([
  'correction_queue_read',
  'source_queue_read',
  'correction_claim',
  'source_claim',
  'catalog_hold_claim',
  'correction_triage',
  'correction_disposition',
  'source_review_record',
  'catalog_repair_attest',
  'catalog_hold_release',
]);
const API_ERROR_CODES = new Set<Exclude<OperatorErrorCode, 'request_failed'>>([
  'invalid_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'operator_unavailable',
]);
const SAFE_PROJECTION_KEYS = new Set([
  'acceptedAt',
  'artifactSha256',
  'artifactKind',
  'acceptedRecordCount',
  'allowsImages',
  'barcode',
  'batchType',
  'brand',
  'category',
  'conflictRecordCount',
  'correctionType',
  'createdAt',
  'defaultPaoMonths',
  'description',
  'displayName',
  'disposition',
  'dispositionAt',
  'expectedRecordCount',
  'hasBarcode',
  'holdId',
  'id',
  'ingredientsText',
  'licenseName',
  'licenseUrl',
  'manifestSha256',
  'name',
  'openedAt',
  'product',
  'productId',
  'productName',
  'productionApproved',
  'proposedPayload',
  'qaBlockerCount',
  'qaReportSha256',
  'qaWarningCount',
  'qualityIssue',
  'qualityIssueCode',
  'repairReceiptId',
  'repairReceiptReady',
  'repairAttestedAt',
  'releasedAt',
  'reasonCode',
  'requiresAttribution',
  'requiresShareAlike',
  'reviewEvidenceSha256',
  'reviewedAt',
  'reviewStatus',
  'snapshotDate',
  'sourceApprovalSha256',
  'sourceKey',
  'sourceName',
  'sourcePolicySha256',
  'sourceUrl',
  'stagedRecordCount',
  'state',
  'status',
  'suggestedCorrection',
  'territory',
  'verificationEvidenceSha256',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function normalizedUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizedTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 20 || value.length > 40) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function positiveVersion(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 2_147_483_647
    ? (value as number)
    : null;
}

function normalizedStatus(value: unknown): string | null {
  return typeof value === 'string' && STATUS_PATTERN.test(value) ? value : null;
}

function normalizedItemKind(value: unknown): ItemKind | null {
  return typeof value === 'string' && ITEM_KINDS.has(value as ItemKind)
    ? (value as ItemKind)
    : null;
}

function safeProjection(
  value: unknown,
  depth = 0,
): PresentationRecord | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length > 24 ||
    new TextEncoder().encode(JSON.stringify(value)).byteLength > 16_384
  ) {
    return null;
  }
  const result: Record<string, PresentationValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!SAFE_PROJECTION_KEYS.has(key)) return null;
    if (raw === null || typeof raw === 'boolean') {
      result[key] = raw;
      continue;
    }
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw) || Math.abs(raw) > 10_000_000) return null;
      result[key] = raw;
      continue;
    }
    if (isRecord(raw)) {
      if (depth >= 1 || (key !== 'product' && key !== 'proposedPayload')) return null;
      const nested = safeProjection(raw, depth + 1);
      if (!nested) return null;
      result[key] = nested;
      continue;
    }
    const maxLength = key === 'ingredientsText' ? 1_500 : key === 'description' ? 500 : key.endsWith('Url') ? 300 : 256;
    if (
      typeof raw !== 'string' ||
      raw.length === 0 ||
      raw.length > maxLength ||
      /[\u0000-\u001f\u007f]/.test(raw)
    ) {
      return null;
    }
    if ((key.endsWith('Id') || key === 'id') && !normalizedUuid(raw)) return null;
    if (key.endsWith('Sha256') && !SHA256_PATTERN.test(raw)) return null;
    if (key.endsWith('At') && !normalizedTimestamp(raw)) return null;
    if (key === 'snapshotDate' && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    if (key === 'barcode' && !/^\d{8,14}$/.test(raw)) return null;
    if (key.endsWith('Url')) {
      try {
        const url = new URL(raw);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
      } catch {
        return null;
      }
    }
    result[key] = raw;
  }
  return result;
}

function parseSession(value: unknown): OperatorSession | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'action',
      'operatorSessionId',
      'operatorUserId',
      'operatorEmail',
      'expiresAt',
      'capabilities',
      'environment',
      'sourceRevision',
      'edgeDeploymentId',
      'admissionState',
      'controlGeneration',
    ]) ||
    value.action !== 'session'
  ) {
    return null;
  }
  const operatorSessionId = normalizedUuid(value.operatorSessionId);
  const operatorUserId = normalizedUuid(value.operatorUserId);
  const operatorEmail =
    typeof value.operatorEmail === 'string' &&
      value.operatorEmail === value.operatorEmail.trim().toLowerCase() &&
      value.operatorEmail.length >= 3 &&
      value.operatorEmail.length <= 254 &&
      value.operatorEmail.includes('@') &&
      !/[\u0000-\u001f\u007f]/.test(value.operatorEmail)
      ? value.operatorEmail
      : null;
  const expiresAt = normalizedTimestamp(value.expiresAt);
  if (
    !operatorSessionId ||
    !operatorUserId ||
    !operatorEmail ||
    !expiresAt ||
    !Array.isArray(value.capabilities) ||
    value.capabilities.length < 1 ||
    value.capabilities.length > 16 ||
    !value.capabilities.every(
      (capability) => typeof capability === 'string' && OPERATOR_CAPABILITIES.has(capability),
    ) ||
    new Set(value.capabilities).size !== value.capabilities.length ||
    JSON.stringify(value.capabilities) !==
      JSON.stringify([...value.capabilities].sort()) ||
    !['development', 'staging', 'production'].includes(String(value.environment)) ||
    typeof value.sourceRevision !== 'string' ||
    !/^[a-f0-9]{40}$/.test(value.sourceRevision) ||
    typeof value.edgeDeploymentId !== 'string' ||
    value.edgeDeploymentId.length < 1 ||
    value.edgeDeploymentId.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(value.edgeDeploymentId) ||
    value.admissionState !== 'open' ||
    !Number.isSafeInteger(value.controlGeneration) ||
    (value.controlGeneration as number) < 1
  ) {
    return null;
  }
  return {
    operatorSessionId,
    operatorUserId,
    operatorEmail,
    expiresAt,
    capabilities: value.capabilities as string[],
    environment: value.environment as 'development' | 'staging' | 'production',
    sourceRevision: value.sourceRevision,
    edgeDeploymentId: value.edgeDeploymentId,
    admissionState: 'open',
    controlGeneration: value.controlGeneration as number,
  };
}

function parseQueueItem(value: unknown): QueueItem | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'itemKind',
      'itemId',
      'itemVersion',
      'status',
      'priority',
      'createdAt',
      'summary',
    ])
  ) {
    return null;
  }
  const itemKind = normalizedItemKind(value.itemKind);
  const itemId = normalizedUuid(value.itemId);
  const itemVersion = positiveVersion(value.itemVersion);
  const status = normalizedStatus(value.status);
  const createdAt = normalizedTimestamp(value.createdAt);
  const summary = safeProjection(value.summary);
  if (
    !itemKind ||
    !itemId ||
    !itemVersion ||
    !status ||
    !Number.isSafeInteger(value.priority) ||
    (value.priority as number) < 0 ||
    (value.priority as number) > 100 ||
    !createdAt ||
    !summary
  ) {
    return null;
  }
  return {
    itemKind,
    itemId,
    itemVersion,
    status,
    priority: value.priority as number,
    createdAt,
    summary,
  };
}

function parseQueue(value: unknown): QueuePage | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['action', 'items', 'nextCursor']) ||
    value.action !== 'queue' ||
    !Array.isArray(value.items)
  ) {
    return null;
  }
  if (value.items.length > 50) return null;
  const items = value.items.map(parseQueueItem);
  if (items.some((item) => item === null)) return null;
  let nextCursor: QueueCursor | null = null;
  if (value.nextCursor !== null) {
    if (!isRecord(value.nextCursor) || !exactKeys(value.nextCursor, ['createdAt', 'itemId'])) {
      return null;
    }
    const createdAt = normalizedTimestamp(value.nextCursor.createdAt);
    const itemId = normalizedUuid(value.nextCursor.itemId);
    if (!createdAt || !itemId) return null;
    nextCursor = { createdAt, itemId };
  }
  return { items: items as QueueItem[], nextCursor };
}

function parseDetail(value: unknown): ItemDetail | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['action', 'itemKind', 'itemId', 'itemVersion', 'status', 'detail']) ||
    value.action !== 'detail'
  ) {
    return null;
  }
  const itemKind = normalizedItemKind(value.itemKind);
  const itemId = normalizedUuid(value.itemId);
  const itemVersion = positiveVersion(value.itemVersion);
  const status = normalizedStatus(value.status);
  const detail = safeProjection(value.detail);
  return itemKind && itemId && itemVersion && status && detail
    ? { itemKind, itemId, itemVersion, status, detail }
    : null;
}

function parseClaim(value: unknown): ItemClaim | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'action',
      'itemKind',
      'itemId',
      'itemVersion',
      'leaseId',
      'leaseExpiresAt',
      'status',
    ])
  ) {
    return null;
  }
  if (value.action !== 'claim') return null;
  const itemKind = normalizedItemKind(value.itemKind);
  const itemId = normalizedUuid(value.itemId);
  const itemVersion = positiveVersion(value.itemVersion);
  const leaseId = normalizedUuid(value.leaseId);
  const leaseExpiresAt = normalizedTimestamp(value.leaseExpiresAt);
  const status = normalizedStatus(value.status);
  return itemKind && itemId && itemVersion && leaseId && leaseExpiresAt && status
    ? { itemKind, itemId, itemVersion, leaseId, leaseExpiresAt, status }
    : null;
}

function parseTransition(value: unknown): ItemTransition | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'action',
      'itemKind',
      'itemId',
      'itemVersion',
      'status',
      'holdId',
      'repairReceiptId',
      'eventId',
    ])
  ) {
    return null;
  }
  if (value.action !== 'transition') return null;
  const itemKind = normalizedItemKind(value.itemKind);
  const itemId = normalizedUuid(value.itemId);
  const itemVersion = positiveVersion(value.itemVersion);
  const status = normalizedStatus(value.status);
  const holdId = value.holdId === null ? null : normalizedUuid(value.holdId);
  const repairReceiptId =
    value.repairReceiptId === null ? null : normalizedUuid(value.repairReceiptId);
  const eventId = normalizedUuid(value.eventId);
  if (
    !itemKind ||
    !itemId ||
    !itemVersion ||
    !status ||
    !eventId ||
    (value.holdId !== null && !holdId) ||
    (value.repairReceiptId !== null && !repairReceiptId)
  ) {
    return null;
  }
  return { itemKind, itemId, itemVersion, status, holdId, repairReceiptId, eventId };
}

function parseRelease(value: unknown): HoldRelease | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['action', 'holdId', 'itemVersion', 'state', 'releasedAt', 'eventId']) ||
    value.action !== 'release_hold'
  ) {
    return null;
  }
  const holdId = normalizedUuid(value.holdId);
  const itemVersion = positiveVersion(value.itemVersion);
  const state = normalizedStatus(value.state);
  const releasedAt = normalizedTimestamp(value.releasedAt);
  const eventId = normalizedUuid(value.eventId);
  return holdId && itemVersion && state && releasedAt && eventId
    ? { holdId, itemVersion, state, releasedAt, eventId }
    : null;
}

function parseResult(request: OperatorRequest, value: unknown): unknown | null {
  switch (request.action) {
    case 'session':
      return parseSession(value);
    case 'queue':
      return parseQueue(value);
    case 'detail':
      return parseDetail(value);
    case 'claim':
      return parseClaim(value);
    case 'transition':
      return parseTransition(value);
    case 'release_hold':
      return parseRelease(value);
  }
}

function resultMatchesRequest(request: OperatorRequest, result: unknown): boolean {
  if (!isRecord(result)) return false;
  if (request.action === 'queue') {
    const page = result as unknown as QueuePage;
    const withinRequestedLimit = page.items.length <= (request.limit ?? 25);
    const kindMatches = page.items.every((item) =>
      request.queueKind === 'correction'
        ? item.itemKind === 'correction_report' || item.itemKind === 'product_hold'
        : item.itemKind === 'catalog_source' || item.itemKind === 'import_batch',
    );
    return withinRequestedLimit && kindMatches;
  }
  if (request.action === 'detail' || request.action === 'claim') {
    return (
      result.itemKind === request.itemKind &&
      result.itemId === request.itemId &&
      result.itemVersion === request.expectedVersion
    );
  }
  if (request.action === 'transition') {
    return result.itemKind === request.itemKind && result.itemId === request.itemId;
  }
  if (request.action === 'release_hold') return result.holdId === request.holdId;
  return request.action === 'session';
}

function operatorErrorMessage(code: OperatorErrorCode): string {
  switch (code) {
    case 'invalid_request':
      return 'The request was rejected before any change was applied. Reload the item and try again.';
    case 'unauthorized':
      return 'The sign-in session expired. Sign in again.';
    case 'forbidden':
      return 'This account does not have current authority for that operation.';
    case 'not_found':
      return 'The selected item no longer exists.';
    case 'conflict':
      return 'The item changed or its claim expired. Reload it before continuing.';
    case 'rate_limited':
      return 'Too many requests were made. Wait briefly, then try again.';
    case 'operator_unavailable':
    case 'request_failed':
      return 'The operator service is unavailable. No change was applied.';
  }
}

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get('retry-after');
  if (!raw || !/^\d{1,4}$/.test(raw)) return null;
  return Math.min(Number(raw), 3_600);
}

async function readBoundedText(response: Response): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > RESPONSE_MAX_BYTES) {
    throw new OperatorApiError('request_failed', { status: response.status });
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > RESPONSE_MAX_BYTES) {
        await reader.cancel();
        throw new OperatorApiError('request_failed', { status: response.status });
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } catch (error) {
    if (error instanceof OperatorApiError) throw error;
    throw new OperatorApiError('request_failed', { status: response.status });
  } finally {
    reader.releaseLock();
  }
}

function parseResponseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new OperatorApiError('request_failed');
  }
}

export type AccessTokenProvider = () => Promise<string>;
export type OperatorFetch = typeof fetch;

export class OperatorApi {
  readonly #endpoint: string;
  readonly #publishableKey: string;
  readonly #accessToken: AccessTokenProvider;
  readonly #fetch: OperatorFetch;

  constructor(
    environment: OperatorConsoleEnvironment,
    accessToken: AccessTokenProvider,
    fetchImplementation: OperatorFetch = fetch,
  ) {
    this.#endpoint = environment.operatorApiUrl;
    this.#publishableKey = environment.publishableKey;
    this.#accessToken = accessToken;
    this.#fetch = fetchImplementation;
  }

  async call<T extends OperatorRequest>(request: T): Promise<OperatorResponse<T>> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    let responseText: string;
    let accessToken: string;
    try {
      accessToken = await this.#accessToken();
    } catch {
      globalThis.clearTimeout(timeout);
      throw new OperatorApiError('unauthorized');
    }
    try {
      response = await this.#fetch.call(globalThis, this.#endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          apikey: this.#publishableKey,
          'X-Request-Id': crypto.randomUUID(),
        },
        body: JSON.stringify(request),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
      if (contentType !== 'application/json') {
        throw new OperatorApiError('request_failed', { status: response.status });
      }
      responseText = await readBoundedText(response);
    } catch (error) {
      if (error instanceof OperatorApiError) throw error;
      throw new OperatorApiError('request_failed');
    } finally {
      globalThis.clearTimeout(timeout);
    }

    const requestId = normalizedUuid(response.headers.get('x-request-id'));
    const parsed = parseResponseJson(responseText);
    if (!response.ok) {
      const code =
        isRecord(parsed) &&
        exactKeys(parsed, ['error']) &&
        typeof parsed.error === 'string' &&
        API_ERROR_CODES.has(parsed.error as Exclude<OperatorErrorCode, 'request_failed'>)
          ? (parsed.error as Exclude<OperatorErrorCode, 'request_failed'>)
          : 'request_failed';
      throw new OperatorApiError(code, {
        status: response.status,
        requestId,
        retryAfterSeconds: retryAfterSeconds(response),
      });
    }
    if (!isRecord(parsed) || !exactKeys(parsed, ['result'])) {
      throw new OperatorApiError('request_failed', { status: response.status, requestId });
    }
    const result = parseResult(request, parsed.result);
    if (!result || !resultMatchesRequest(request, result)) {
      throw new OperatorApiError('request_failed', { status: response.status, requestId });
    }
    return result as OperatorResponse<T>;
  }
}
