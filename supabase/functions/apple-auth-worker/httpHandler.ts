import { contentLengthTooLarge, readLimitedJson } from "../_shared/body.ts";

const WORKER_SECRET_PATTERN = /^[a-f0-9]{64}$/;
const WORKER_BODY_MAX_BYTES = 1_024;

export type AppleAuthWorkerReport = Readonly<{
  blocked: number;
  deferred: number;
  stale: number;
  validated: number;
}>;

export type AppleAuthWorkerHttpDependencies = Readonly<{
  workerSecret: string;
  runWorker: () => Promise<AppleAuthWorkerReport>;
}>;

function constantTimeEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function json(
  body: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function exactReport(value: AppleAuthWorkerReport): boolean {
  return (
    Object.keys(value).sort().join(",") ===
      "blocked,deferred,stale,validated" &&
    isCount(value.blocked) &&
    isCount(value.deferred) &&
    isCount(value.stale) &&
    isCount(value.validated)
  );
}

export function createAppleAuthWorkerHttpHandler(
  dependencies: AppleAuthWorkerHttpDependencies,
): (request: Request) => Promise<Response> {
  if (
    !WORKER_SECRET_PATTERN.test(dependencies.workerSecret) ||
    typeof dependencies.runWorker !== "function"
  ) {
    throw new Error("APPLE_AUTH_WORKER_CONFIGURATION_INVALID");
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
    }
    if (contentLengthTooLarge(request, WORKER_BODY_MAX_BYTES)) {
      return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    }
    const supplied = request.headers.get("x-apple-auth-worker-secret") ?? "";
    if (
      !WORKER_SECRET_PATTERN.test(supplied) ||
      !constantTimeEqual(supplied, dependencies.workerSecret)
    ) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }
    const body = await readLimitedJson(
      request,
      WORKER_BODY_MAX_BYTES,
      (value, status = 400) => json(value, status),
      { error: "BAD_JSON" },
    );
    if (body instanceof Response) return body;
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "action") ||
      (body as Record<string, unknown>).action !== "work"
    ) {
      return json({ error: "BAD_REQUEST" }, 400);
    }
    try {
      const report = await dependencies.runWorker();
      if (!exactReport(report)) {
        return json({ error: "APPLE_AUTH_WORKER_UNAVAILABLE" }, 503, {
          "Retry-After": "60",
        });
      }
      return json({ status: "worked", ...report }, 200);
    } catch {
      return json({ error: "APPLE_AUTH_WORKER_UNAVAILABLE" }, 503, {
        "Retry-After": "60",
      });
    }
  };
}
