import { fetchWithTimeout, readLimitedResponseText } from '../_shared/fetch.ts';
import type {
  PostHogDeletionNetwork,
  PostHogDeletionNetworkResponse,
} from './postHogDeletionExecutor.ts';
import type { RevenueCatV2NetworkResponse } from './revenueCatV2DeletionExecutor.ts';

export type DeletionProviderFetch = (
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
) => Promise<Response>;

export type DeletionProviderJsonNetwork = PostHogDeletionNetwork & {
  execute: (
    request: { url: string; init: RequestInit },
    context: { deadlineAtMs: number },
  ) => Promise<RevenueCatV2NetworkResponse>;
};

export class DeletionProviderNetworkError extends Error {
  constructor(public readonly code: 'DELETION_PROVIDER_NETWORK_FAILED') {
    super(code);
    this.name = 'DeletionProviderNetworkError';
  }
}

const MAX_PROVIDER_RETRY_AFTER_MS = 7 * 86_400_000;

function retryAfterMs(response: Response, nowMs: number): number | null {
  const raw = response.headers.get('retry-after')?.trim();
  if (!raw) return null;
  if (/^[0-9]+$/.test(raw)) {
    const seconds = Number(raw);
    if (!Number.isSafeInteger(seconds)) return null;
    return seconds >= MAX_PROVIDER_RETRY_AFTER_MS / 1_000
      ? MAX_PROVIDER_RETRY_AFTER_MS
      : seconds * 1_000;
  }
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return null;
  return Math.min(Math.max(0, at - nowMs), MAX_PROVIDER_RETRY_AFTER_MS);
}

function boundedTimeout(deadlineAtMs: number, now: () => number, maxTimeoutMs: number): number {
  const current = now();
  const remaining = deadlineAtMs - current;
  if (
    !Number.isSafeInteger(deadlineAtMs) ||
    deadlineAtMs < 0 ||
    !Number.isSafeInteger(current) ||
    current < 0 ||
    remaining < 1
  ) {
    throw new DeletionProviderNetworkError('DELETION_PROVIDER_NETWORK_FAILED');
  }
  return Math.max(1, Math.min(maxTimeoutMs, remaining));
}

async function execute(
  request: { url: string; init: RequestInit },
  context: { deadlineAtMs: number },
  options: {
    fetcher: DeletionProviderFetch;
    now: () => number;
    maxResponseBytes: number;
    maxTimeoutMs: number;
  },
): Promise<{ status: number; body: unknown; responseBytes: number; retryAfterMs: number | null }> {
  if (
    request === null ||
    typeof request !== 'object' ||
    typeof request.url !== 'string' ||
    request.url.length === 0 ||
    request.init === null ||
    typeof request.init !== 'object'
  ) {
    throw new DeletionProviderNetworkError('DELETION_PROVIDER_NETWORK_FAILED');
  }
  let response: Response;
  try {
    response = await options.fetcher(
      request.url,
      request.init,
      boundedTimeout(context.deadlineAtMs, options.now, options.maxTimeoutMs),
    );
  } catch {
    throw new DeletionProviderNetworkError('DELETION_PROVIDER_NETWORK_FAILED');
  }
  const text = await readLimitedResponseText(response, options.maxResponseBytes);
  if (text === null) {
    throw new DeletionProviderNetworkError('DELETION_PROVIDER_NETWORK_FAILED');
  }
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }
  return {
    status: response.status,
    body,
    responseBytes: new TextEncoder().encode(text).byteLength,
    retryAfterMs: retryAfterMs(response, options.now()),
  };
}

export function createDeletionProviderJsonNetwork(options: {
  maxResponseBytes: number;
  maxTimeoutMs: number;
  now?: () => number;
  fetcher?: DeletionProviderFetch;
}): DeletionProviderJsonNetwork {
  if (
    options === null ||
    typeof options !== 'object' ||
    !Number.isSafeInteger(options.maxResponseBytes) ||
    options.maxResponseBytes < 1_024 ||
    options.maxResponseBytes > 32_768 ||
    !Number.isSafeInteger(options.maxTimeoutMs) ||
    options.maxTimeoutMs < 100 ||
    options.maxTimeoutMs > 30_000 ||
    !(options.now === undefined || typeof options.now === 'function') ||
    !(options.fetcher === undefined || typeof options.fetcher === 'function')
  ) {
    throw new DeletionProviderNetworkError('DELETION_PROVIDER_NETWORK_FAILED');
  }
  const resolved = {
    maxResponseBytes: options.maxResponseBytes,
    maxTimeoutMs: options.maxTimeoutMs,
    now: options.now ?? (() => Date.now()),
    fetcher: options.fetcher ?? fetchWithTimeout,
  };
  return {
    async execute(request, context): Promise<RevenueCatV2NetworkResponse> {
      const response = await execute(request, context, resolved);
      return {
        status: response.status,
        body: response.body,
        retryAfterMs: response.retryAfterMs,
      };
    },
    async sendJson(request, context): Promise<PostHogDeletionNetworkResponse> {
      const response = await execute(request, context, resolved);
      return {
        status: response.status,
        body: response.body,
        responseBytes: response.responseBytes,
      };
    },
  };
}
