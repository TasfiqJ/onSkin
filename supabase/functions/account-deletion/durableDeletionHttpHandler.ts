import { bearerToken } from '../_shared/auth.ts';
import { contentLengthTooLarge, readLimitedJson } from '../_shared/body.ts';
import { mapPublicDeletionStatus, type PublicDeletionStatusLookup } from './durableDeletionCore.ts';
import {
  type AccountDeletionBeginRequest,
  constantTimeEqual,
  parseAccountDeletionRequest,
} from './durableDeletionRuntimeCore.ts';
import type { AccountDeletionWorkerReport } from './durableDeletionWorker.ts';

const WORKER_SECRET_PATTERN = /^[a-f0-9]{64}$/;
const AUTH_USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type DeletionAuthenticatedUser = {
  id: string;
  appleLinked: boolean;
  appleSubject: string | null;
};

export type DurableDeletionHttpDependencies = {
  workerSecret: string;
  maxBodyBytes: number;
  authenticate: (bearer: string) => Promise<DeletionAuthenticatedUser | null>;
  consumeIntakeRateLimit: (userId: string) => Promise<boolean>;
  consumeStatusRateLimit: (capability: string) => Promise<boolean>;
  barrierState: (userId: string) => Promise<'clear' | 'active'>;
  begin: (
    user: DeletionAuthenticatedUser,
    request: AccountDeletionBeginRequest,
  ) => Promise<{
    operationId: string;
    operationState: string;
    created: boolean;
  }>;
  status: (capability: string) => Promise<PublicDeletionStatusLookup>;
  accelerate: (operationId: string, userId: string) => Promise<void>;
  runWorker: () => Promise<AccountDeletionWorkerReport>;
  schedule: (work: Promise<void>) => void;
};

export class DurableDeletionHttpHandlerError extends Error {
  constructor(public readonly code: 'DELETION_HTTP_CONFIGURATION_INVALID') {
    super(code);
    this.name = 'DurableDeletionHttpHandlerError';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-account-deletion-worker-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validDependencies(value: DurableDeletionHttpDependencies): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    WORKER_SECRET_PATTERN.test(value.workerSecret) &&
    Number.isSafeInteger(value.maxBodyBytes) &&
    value.maxBodyBytes >= 1_024 &&
    value.maxBodyBytes <= 65_536 &&
    typeof value.authenticate === 'function' &&
    typeof value.consumeIntakeRateLimit === 'function' &&
    typeof value.consumeStatusRateLimit === 'function' &&
    typeof value.barrierState === 'function' &&
    typeof value.begin === 'function' &&
    typeof value.status === 'function' &&
    typeof value.accelerate === 'function' &&
    typeof value.runWorker === 'function' &&
    typeof value.schedule === 'function'
  );
}

function scheduleAcceleration(
  dependencies: DurableDeletionHttpDependencies,
  operationId: string,
  userId: string,
): void {
  try {
    const work = dependencies.accelerate(operationId, userId).then(
      () => undefined,
      () => undefined,
    );
    dependencies.schedule(work);
  } catch {
    // The durable Cron lane remains authoritative. Intake must not be rolled
    // back merely because this best-effort accelerator could not be attached.
  }
}

export function createDurableDeletionHttpHandler(
  dependencies: DurableDeletionHttpDependencies,
): (request: Request) => Promise<Response> {
  if (!validDependencies(dependencies)) {
    throw new DurableDeletionHttpHandlerError('DELETION_HTTP_CONFIGURATION_INVALID');
  }

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { status: 200, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    }
    if (contentLengthTooLarge(request, dependencies.maxBodyBytes)) {
      return json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
    }

    const body = await readLimitedJson(
      request,
      dependencies.maxBodyBytes,
      (value, status = 400) => json(value, status),
      { error: 'BAD_JSON' },
    );
    if (body instanceof Response) return body;

    let parsed;
    try {
      parsed = parseAccountDeletionRequest(body);
    } catch {
      return json({ error: 'BAD_REQUEST' }, 400);
    }

    if (parsed.action === 'work') {
      const supplied = request.headers.get('x-account-deletion-worker-secret') ?? '';
      if (!constantTimeEqual(supplied, dependencies.workerSecret)) {
        return json({ error: 'UNAUTHORIZED' }, 401);
      }
      try {
        const report = await dependencies.runWorker();
        return json(
          {
            status: 'worked',
            claimsProcessed: report.claimsProcessed,
            finalized: report.finalized,
            deadlineReached: report.deadlineReached,
          },
          200,
        );
      } catch {
        return json({ error: 'ACCOUNT_DELETION_UNAVAILABLE' }, 503);
      }
    }

    if (parsed.action === 'status') {
      try {
        // Probe the capability before creating a per-capability rate-limit row.
        // A public caller can mint unlimited random 256-bit strings, so writing a
        // limiter row for every miss would turn the read-only status endpoint
        // into an unauthenticated database write-amplification primitive.
        const lookup = await dependencies.status(parsed.capability);
        if (
          lookup.kind !== 'not_found' &&
          lookup.kind !== 'expired' &&
          !(await dependencies.consumeStatusRateLimit(parsed.capability))
        ) {
          return json({ error: 'RATE_LIMITED' }, 429);
        }
        const mapped = mapPublicDeletionStatus(lookup);
        return json(mapped.body, mapped.httpStatus);
      } catch {
        return json({ error: 'ACCOUNT_DELETION_UNAVAILABLE' }, 503);
      }
    }

    const token = bearerToken(request);
    if (token === null) {
      return json(
        {
          error:
            parsed.action === 'preflight' ? 'ACCOUNT_DELETION_SESSION_REJECTED' : 'UNAUTHORIZED',
        },
        401,
      );
    }
    let user: DeletionAuthenticatedUser | null;
    try {
      user = await dependencies.authenticate(token);
    } catch {
      return json({ error: 'ACCOUNT_DELETION_UNAVAILABLE' }, 503);
    }
    if (user === null) {
      return json(
        {
          error:
            parsed.action === 'preflight' ? 'ACCOUNT_DELETION_SESSION_REJECTED' : 'UNAUTHORIZED',
        },
        401,
      );
    }

    if (parsed.action === 'preflight') {
      try {
        // The same authenticated subject binds every successful admission
        // response. Validate it before the service lookup so neither `clear`
        // nor `active` can authorize a mutable/corrupt client session object.
        if (!AUTH_USER_ID_PATTERN.test(user.id)) {
          throw new Error('invalid authenticated subject');
        }
        const status = await dependencies.barrierState(user.id);
        return json({ status, ownerSubject: user.id }, 200);
      } catch {
        return json({ error: 'ACCOUNT_DELETION_UNAVAILABLE' }, 503);
      }
    }

    try {
      if (!(await dependencies.consumeIntakeRateLimit(user.id))) {
        return json({ error: 'RATE_LIMITED' }, 429);
      }
      const result = await dependencies.begin(user, parsed);
      if (result.created) {
        scheduleAcceleration(dependencies, result.operationId, user.id);
      }
      return json(
        {
          status: 'accepted',
          phase: result.operationState === 'action_required' ? 'delayed' : 'queued',
          nextPollAfterSeconds: result.operationState === 'action_required' ? 60 : 2,
        },
        202,
      );
    } catch {
      return json({ error: 'ACCOUNT_DELETION_UNAVAILABLE' }, 503);
    }
  };
}
