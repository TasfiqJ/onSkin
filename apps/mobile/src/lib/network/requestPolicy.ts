import {
  AccountGenerationLeaseError,
  runAccountGenerationOperation,
  type AccountGenerationLease,
} from '@/lib/auth/accountGeneration';

export const REQUEST_ENDPOINTS = [
  'account_deletion',
  'ask_grounded',
  'catalog_lookup',
  'catalog_report',
  'catalog_search',
  'commerce_click_event',
  'commerce_links',
  'completion_sync',
  'consent_exact_proof',
  'consent_ledger',
  'consent_withdrawal',
  'data_export',
  'entitlement_server',
  'onboarding_status',
  'outbox_sync',
  'profile_server',
  'progress_completions',
  'progress_longest_streak',
  'skin_profile_publication',
  'subscription_grants',
  'trend_consent',
  'trend_monk_band',
] as const;

export type RequestEndpoint = (typeof REQUEST_ENDPOINTS)[number];

export type RequestFailureKind =
  | 'authentication'
  | 'cancelled'
  | 'offline'
  | 'owner_changed'
  | 'rate_limit'
  | 'response_too_large'
  | 'server'
  | 'timeout'
  | 'unknown'
  | 'validation';

export type RequestStatusClass = '2xx' | '4xx' | '5xx' | 'cancelled' | 'network' | 'unknown';

export type RequestMetricSample = Readonly<{
  endpoint: RequestEndpoint;
  durationMs: number;
  statusClass: RequestStatusClass;
  attemptCount: number;
}>;

export class RequestPolicyError extends Error {
  readonly endpoint: RequestEndpoint;
  readonly kind: RequestFailureKind;
  readonly attemptCount: number;
  readonly statusClass: RequestStatusClass;
  readonly retryAfterMs: number | null;

  constructor(input: {
    endpoint: RequestEndpoint;
    kind: RequestFailureKind;
    attemptCount: number;
    statusClass: RequestStatusClass;
    retryAfterMs?: number | null;
  }) {
    super(`NETWORK_REQUEST_${input.kind.toUpperCase()}`);
    this.name = 'RequestPolicyError';
    this.endpoint = input.endpoint;
    this.kind = input.kind;
    this.attemptCount = input.attemptCount;
    this.statusClass = input.statusClass;
    this.retryAfterMs = input.retryAfterMs ?? null;
  }
}

export function isRequestCancellation(error: unknown): error is RequestPolicyError {
  return (
    error instanceof RequestPolicyError &&
    (error.kind === 'cancelled' || error.kind === 'owner_changed')
  );
}

export type RequestAttemptContext = Readonly<{
  attempt: number;
  ownerLease: AccountGenerationLease | null;
  signal: AbortSignal;
}>;

type RequestRuntime = Readonly<{
  now?: () => number;
  random?: () => number;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
}>;

export type RequestPolicy = Readonly<{
  endpoint: RequestEndpoint;
  deadlineMs: number;
  idempotent: boolean;
  maxAttempts?: number;
  maxResponseBytes?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  maxRetryAfterMs?: number;
  ownerScoped?: boolean;
  signal?: AbortSignal;
  runtime?: RequestRuntime;
}>;

export type LeasedRequestPolicy = Omit<RequestPolicy, 'ownerScoped'>;

type NormalizedFailure = Readonly<{
  kind: RequestFailureKind;
  retryAfterMs: number | null;
  statusClass: RequestStatusClass;
}>;

type ResponseLike = Readonly<{
  headers?: Readonly<{ get?: (name: string) => string | null }>;
  status?: number;
}>;

const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_BASE_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 4_000;
const DEFAULT_MAX_RETRY_AFTER_MS = 30_000;
const MAX_RETAINED_METRICS = 200;
const requestMetrics: RequestMetricSample[] = [];

const ATTEMPT_ABORTED = Symbol('ATTEMPT_ABORTED');

function monotonicNow(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function roundedDuration(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function appendMetric(sample: RequestMetricSample): void {
  requestMetrics.push(sample);
  if (requestMetrics.length > MAX_RETAINED_METRICS) {
    requestMetrics.splice(0, requestMetrics.length - MAX_RETAINED_METRICS);
  }
}

export function readRequestMetricSamples(): readonly RequestMetricSample[] {
  return requestMetrics.map((sample) => ({ ...sample }));
}

export function resetRequestMetricSamplesForTests(): void {
  requestMetrics.splice(0, requestMetrics.length);
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function finiteNonNegative(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function errorCandidates(error: unknown): readonly unknown[] {
  const candidates: unknown[] = [error];
  for (let index = 0; index < candidates.length && index < 4; index += 1) {
    const candidate = candidates[index];
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    for (const field of ['context', 'cause', 'response'] as const) {
      const nested = record[field];
      if (nested && !candidates.includes(nested)) candidates.push(nested);
    }
  }
  return candidates.slice(0, 8);
}

function statusFromUnknown(error: unknown): number | null {
  for (const candidate of errorCandidates(error)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const status = (candidate as { status?: unknown }).status;
    if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
      return status;
    }
  }
  return null;
}

function responseFromUnknown(error: unknown): ResponseLike | null {
  for (const candidate of errorCandidates(error)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const response = candidate as ResponseLike;
    if (typeof response.status === 'number' || typeof response.headers?.get === 'function') {
      return response;
    }
  }
  return null;
}

function parseRetryAfter(error: unknown, nowMs: number): number | null {
  const raw = responseFromUnknown(error)?.headers?.get?.('Retry-After')?.trim();
  if (!raw) return null;

  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);

  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - nowMs) : null;
}

function errorFields(error: unknown, field: 'code' | 'message' | 'name'): readonly string[] {
  return errorCandidates(error).flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const value = (candidate as Record<string, unknown>)[field];
    return typeof value === 'string' ? [value] : [];
  });
}

function isOfflineError(error: unknown): boolean {
  const navigatorOnline =
    typeof globalThis.navigator === 'object' &&
    globalThis.navigator !== null &&
    'onLine' in globalThis.navigator
      ? globalThis.navigator.onLine
      : undefined;
  if (navigatorOnline === false) return true;

  const codes = errorFields(error, 'code').map((code) => code.toUpperCase());
  if (
    codes.some((code) =>
      ['ECONNRESET', 'ENETDOWN', 'ENETUNREACH', 'NETWORK_ERROR', 'ERR_NETWORK'].includes(code),
    )
  ) {
    return true;
  }
  const names = errorFields(error, 'name');
  if (names.includes('FunctionsFetchError')) return true;
  const messages = errorFields(error, 'message');
  return (
    names.includes('TypeError') &&
    messages.some((message) => /(fetch|network|load failed)/i.test(message))
  );
}

function isTimeoutError(error: unknown): boolean {
  const codes = errorFields(error, 'code').map((code) => code.toUpperCase());
  const names = errorFields(error, 'name');
  return (
    codes.includes('ETIMEDOUT') ||
    codes.includes('TIMEOUT') ||
    names.includes('TimeoutError') ||
    errorFields(error, 'message').some((message) => /timed?\s*out/i.test(message))
  );
}

function isAbortError(error: unknown): boolean {
  const names = errorFields(error, 'name');
  const codes = errorFields(error, 'code').map((code) => code.toUpperCase());
  return names.includes('AbortError') || codes.includes('ABORT_ERR');
}

/** Preserve HTTP status and transport shape without retaining private request
 * inputs in the public error. PostgREST reports some offline failures as a
 * status-zero wrapper whose message embeds the underlying TypeError. */
export function supabaseRequestFailure(
  error: unknown,
  status: number | undefined,
): Readonly<{ cause: unknown; status?: number }> {
  if (status === 0 && error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (
      typeof message === 'string' &&
      /^(?:FetchError|TypeError):/i.test(message) &&
      /(?:fetch|load failed|network)/i.test(message)
    ) {
      return Object.freeze({
        cause: Object.freeze({ cause: error, message, name: 'TypeError' }),
        status,
      });
    }
  }
  return Object.freeze(status === undefined ? { cause: error } : { cause: error, status });
}

function statusClassForStatus(status: number | null): RequestStatusClass {
  if (status !== null && status >= 400 && status < 500) return '4xx';
  if (status !== null && status >= 500) return '5xx';
  return 'unknown';
}

function normalizeFailure(
  error: unknown,
  input: {
    deadlineExpired: boolean;
    externalAborted: boolean;
    nowMs: number;
    ownerChanged: boolean;
  },
): NormalizedFailure {
  if (input.ownerChanged || error instanceof AccountGenerationLeaseError) {
    return { kind: 'owner_changed', retryAfterMs: null, statusClass: 'cancelled' };
  }
  if (input.deadlineExpired || isTimeoutError(error)) {
    return { kind: 'timeout', retryAfterMs: null, statusClass: 'network' };
  }
  if (input.externalAborted || isAbortError(error)) {
    return { kind: 'cancelled', retryAfterMs: null, statusClass: 'cancelled' };
  }
  const status = statusFromUnknown(error);
  if (status === 401 || status === 403) {
    return { kind: 'authentication', retryAfterMs: null, statusClass: '4xx' };
  }
  if (status === 408) {
    return { kind: 'timeout', retryAfterMs: null, statusClass: '4xx' };
  }
  if (status === 429) {
    return {
      kind: 'rate_limit',
      retryAfterMs: parseRetryAfter(error, input.nowMs),
      statusClass: '4xx',
    };
  }
  if (status !== null && status >= 400 && status < 500) {
    return { kind: 'validation', retryAfterMs: null, statusClass: '4xx' };
  }
  if (status !== null && status >= 500) {
    return { kind: 'server', retryAfterMs: null, statusClass: '5xx' };
  }
  if (errorFields(error, 'name').includes('FunctionsRelayError')) {
    return { kind: 'server', retryAfterMs: null, statusClass: '5xx' };
  }
  if (isOfflineError(error)) {
    return { kind: 'offline', retryAfterMs: null, statusClass: 'network' };
  }
  return { kind: 'unknown', retryAfterMs: null, statusClass: statusClassForStatus(status) };
}

function shouldRetry(kind: RequestFailureKind): boolean {
  return kind === 'offline' || kind === 'rate_limit' || kind === 'server' || kind === 'timeout';
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function responseByteLength(value: unknown): number {
  if (value === undefined) return 0;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return 0;
  return utf8ByteLength(serialized);
}

function createLinkedAbort(sourceSignals: readonly (AbortSignal | undefined)[]): Readonly<{
  cleanup: () => void;
  signal: AbortSignal;
}> {
  const controller = new AbortController();
  const removers: (() => void)[] = [];
  const abort = () => controller.abort();

  for (const signal of sourceSignals) {
    if (!signal) continue;
    if (signal.aborted) abort();
    else {
      signal.addEventListener('abort', abort, { once: true });
      removers.push(() => signal.removeEventListener('abort', abort));
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const remove of removers) remove();
    },
  };
}

function createRequestAbort(
  sourceSignals: readonly (AbortSignal | undefined)[],
  deadlineMs: number,
): Readonly<{
  cleanup: () => void;
  deadlineExpired: () => boolean;
  signal: AbortSignal;
}> {
  let expired = false;
  const deadlineController = new AbortController();
  const timeout = setTimeout(() => {
    expired = true;
    deadlineController.abort();
  }, deadlineMs);
  const combined = createLinkedAbort([...sourceSignals, deadlineController.signal]);

  return {
    signal: combined.signal,
    deadlineExpired: () => expired,
    cleanup: () => {
      clearTimeout(timeout);
      combined.cleanup();
    },
  };
}

async function raceWithAbort<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw ATTEMPT_ABORTED;

  let removeListener: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    const onAbort = () => reject(ATTEMPT_ABORTED);
    signal.addEventListener('abort', onAbort, { once: true });
    removeListener = () => signal.removeEventListener('abort', onAbort);
  });
  try {
    const guardedOperation = Promise.resolve().then(() => {
      if (signal.aborted) throw ATTEMPT_ABORTED;
      return operation();
    });
    return await Promise.race([guardedOperation, aborted]);
  } finally {
    removeListener();
  }
}

function defaultSleep(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(ATTEMPT_ABORTED);
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', cancel);
      resolve();
    };
    const cancel = () => {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      reject(ATTEMPT_ABORTED);
    };
    const timeout = setTimeout(finish, delayMs);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

function ownerChanged(lease: AccountGenerationLease | null): boolean {
  if (!lease) return false;
  try {
    lease.assertCurrent();
    return false;
  } catch {
    return true;
  }
}

async function executeWithLease<T>(
  policy: RequestPolicy,
  operation: (context: RequestAttemptContext) => Promise<T>,
  lease: AccountGenerationLease | null,
): Promise<T> {
  const now = policy.runtime?.now ?? monotonicNow;
  const random = policy.runtime?.random ?? Math.random;
  const sleep = policy.runtime?.sleep ?? defaultSleep;
  const startedAt = now();
  const deadlineMs = positiveInteger(policy.deadlineMs, 1);
  const maxResponseBytes = positiveInteger(policy.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES);
  const requestedAttempts = positiveInteger(policy.maxAttempts, policy.idempotent ? 2 : 1);
  const maxAttempts = policy.idempotent ? Math.min(requestedAttempts, 4) : 1;
  const baseRetryDelayMs = finiteNonNegative(policy.baseRetryDelayMs, DEFAULT_BASE_RETRY_DELAY_MS);
  const maxRetryDelayMs = finiteNonNegative(policy.maxRetryDelayMs, DEFAULT_MAX_RETRY_DELAY_MS);
  const maxRetryAfterMs = finiteNonNegative(policy.maxRetryAfterMs, DEFAULT_MAX_RETRY_AFTER_MS);
  const deadlineAtMs = Date.now() + deadlineMs;
  const requestAbort = createRequestAbort([policy.signal, lease?.signal], deadlineMs);
  let attempt = 0;

  const fail = (failure: NormalizedFailure | { kind: 'response_too_large' }): never => {
    const statusClass = failure.kind === 'response_too_large' ? 'unknown' : failure.statusClass;
    const error = new RequestPolicyError({
      endpoint: policy.endpoint,
      kind: failure.kind,
      attemptCount: attempt,
      statusClass,
      retryAfterMs:
        failure.kind === 'response_too_large'
          ? null
          : failure.retryAfterMs === null
            ? null
            : Math.min(failure.retryAfterMs, maxRetryAfterMs),
    });
    appendMetric({
      endpoint: policy.endpoint,
      durationMs: roundedDuration(now() - startedAt),
      statusClass: error.statusClass,
      attemptCount: attempt,
    });
    throw error;
  };

  try {
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        lease?.assertCurrent();
        const result = await raceWithAbort(
          () => operation({ attempt, ownerLease: lease, signal: requestAbort.signal }),
          requestAbort.signal,
        );
        lease?.assertCurrent();
        if (responseByteLength(result) > maxResponseBytes) {
          fail({ kind: 'response_too_large' });
        }
        appendMetric({
          endpoint: policy.endpoint,
          durationMs: roundedDuration(now() - startedAt),
          statusClass: '2xx',
          attemptCount: attempt,
        });
        return result;
      } catch (error) {
        if (error instanceof RequestPolicyError) throw error;
        const normalized = normalizeFailure(error, {
          deadlineExpired: requestAbort.deadlineExpired(),
          externalAborted: policy.signal?.aborted === true,
          nowMs: Date.now(),
          ownerChanged: ownerChanged(lease),
        });
        const canRetry = policy.idempotent && attempt < maxAttempts && shouldRetry(normalized.kind);
        if (!canRetry) fail(normalized);

        const exponentialCap = Math.min(
          maxRetryDelayMs,
          baseRetryDelayMs * 2 ** Math.max(0, attempt - 1),
        );
        const jitterDelay = Math.floor(Math.max(0, Math.min(1, random())) * exponentialCap);
        const retryDelay =
          normalized.retryAfterMs === null
            ? jitterDelay
            : Math.min(normalized.retryAfterMs, maxRetryAfterMs);
        const remainingMs = Math.max(0, deadlineAtMs - Date.now());
        if (requestAbort.signal.aborted || retryDelay >= remainingMs) {
          fail({ kind: 'timeout', retryAfterMs: null, statusClass: 'network' });
        }

        try {
          await sleep(retryDelay, requestAbort.signal);
          lease?.assertCurrent();
          if (requestAbort.signal.aborted) throw ATTEMPT_ABORTED;
        } catch (sleepError) {
          const sleepFailure = normalizeFailure(sleepError, {
            deadlineExpired: requestAbort.deadlineExpired(),
            externalAborted: policy.signal?.aborted === true,
            nowMs: Date.now(),
            ownerChanged: ownerChanged(lease),
          });
          fail(sleepFailure);
        }
      }
    }

    return fail({ kind: 'unknown', retryAfterMs: null, statusClass: 'unknown' });
  } finally {
    requestAbort.cleanup();
  }
}

/**
 * Runs a request with a bounded, privacy-safe policy. Owner scoping defaults to
 * on. Every authenticated Edge Function keeps owner scoping enabled.
 */
export function runRequest<T>(
  policy: RequestPolicy,
  operation: (context: RequestAttemptContext) => Promise<T>,
): Promise<T> {
  if (policy.ownerScoped === false) return executeWithLease(policy, operation, null);
  return runAccountGenerationOperation((lease) => executeWithLease(policy, operation, lease));
}

/** Reuse an already-captured owner lease instead of nesting another generation
 * operation. The request still gets the shared deadline, abort race, retry
 * taxonomy, response bound, and content-free metric handling. */
export function runRequestWithLease<T>(
  lease: AccountGenerationLease,
  policy: LeasedRequestPolicy,
  operation: (context: RequestAttemptContext) => Promise<T>,
): Promise<T> {
  return executeWithLease(policy, operation, lease);
}
