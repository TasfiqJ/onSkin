import type { HealthConsentWorkerReport } from './workerCore.ts';
import { contentLengthTooLarge, readLimitedJson } from '../_shared/body.ts';

const WORKER_SECRET_PATTERN = /^[a-f0-9]{64}$/;
const WORKER_BODY_MAX_BYTES = 1_024;

export type HealthConsentWorkerHttpDependencies = {
  workerSecret: string;
  runWorker: () => Promise<HealthConsentWorkerReport>;
};

function constantTimeEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export function createHealthConsentWorkerHttpHandler(
  dependencies: HealthConsentWorkerHttpDependencies,
): (request: Request) => Promise<Response> {
  if (
    !WORKER_SECRET_PATTERN.test(dependencies.workerSecret) ||
    typeof dependencies.runWorker !== 'function'
  ) {
    throw new Error('HEALTH_WORKER_CONFIGURATION_INVALID');
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST' });
    }
    if (contentLengthTooLarge(request, WORKER_BODY_MAX_BYTES)) {
      return json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    const supplied = request.headers.get('x-health-consent-worker-secret') ?? '';
    if (
      !WORKER_SECRET_PATTERN.test(supplied) ||
      !constantTimeEqual(supplied, dependencies.workerSecret)
    ) {
      return json({ error: 'UNAUTHORIZED' }, 401);
    }
    const body = await readLimitedJson(
      request,
      WORKER_BODY_MAX_BYTES,
      (value, status = 400) => json(value, status),
      { error: 'BAD_JSON' },
    );
    if (body instanceof Response) return body;
    if (
      body === null ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, 'action') ||
      (body as Record<string, unknown>).action !== 'work'
    ) {
      return json({ error: 'BAD_REQUEST' }, 400);
    }
    try {
      const report = await dependencies.runWorker();
      if (report.partialFailure) {
        const failedLanes = (report.failedLanes ?? []).filter(
          (lane) => lane === 'base' || lane === 'dependent',
        );
        if (failedLanes.length === 0) {
          return json({ error: 'HEALTH_CONSENT_WORKER_UNAVAILABLE' }, 503);
        }
        return json(
          {
            status: 'partial',
            error: 'HEALTH_CONSENT_WORKER_PARTIAL_FAILURE',
            claimed: report.claimed,
            completed: report.completed,
            deferred: report.deferred,
            actionRequired: report.actionRequired,
            deadlineReached: report.deadlineReached,
            failedLanes,
          },
          503,
          { 'Retry-After': '60' },
        );
      }
      return json({ status: 'worked', ...report }, 200);
    } catch {
      return json({ error: 'HEALTH_CONSENT_WORKER_UNAVAILABLE' }, 503);
    }
  };
}
