import { fetchWithTimeout, readLimitedResponseText } from '../_shared/fetch.ts';
import type {
  PostHogDeletionNetwork,
  PostHogDeletionNetworkResponse,
} from './postHogDeletionExecutor.ts';
import type {
  RevenueCatV2ExecutorNetwork,
  RevenueCatV2NetworkResponse,
} from './revenueCatV2DeletionExecutor.ts';

export type DeletionProviderFetch = (
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
) => Promise<Response>;

export type DeletionProviderJsonNetwork = RevenueCatV2ExecutorNetwork & PostHogDeletionNetwork;

export class DeletionProviderNetworkError extends Error {
  constructor(public readonly code: 'DELETION_PROVIDER_NETWORK_FAILED') {
    super(code);
    this.name = 'DeletionProviderNetworkError';
  }
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
): Promise<{ status: number; body: unknown; responseBytes: number }> {
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
      return { status: response.status, body: response.body };
    },
    async sendJson(request, context): Promise<PostHogDeletionNetworkResponse> {
      return await execute(request, context, resolved);
    },
  };
}
