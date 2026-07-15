import { createAppleAuthWorkerHttpHandler } from "./httpHandler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SECRET = "ab".repeat(32);
const URL = "https://example.invalid/functions/v1/apple-auth-worker";

function request(
  body = '{"action":"work"}',
  secret = SECRET,
  method = "POST",
  headers: HeadersInit = {},
): Request {
  return new Request(URL, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-apple-auth-worker-secret": secret,
      ...headers,
    },
    ...(method === "POST" ? { body } : {}),
  });
}

Deno.test("Apple auth worker requires an exact dedicated scheduler capability", async () => {
  let calls = 0;
  const handler = createAppleAuthWorkerHttpHandler({
    workerSecret: SECRET,
    async runWorker() {
      calls += 1;
      return { blocked: 0, deferred: 0, stale: 0, validated: 1 };
    },
  });
  for (
    const supplied of [
      "",
      `${SECRET.slice(0, -1)}c`,
      SECRET.toUpperCase(),
      `${SECRET}00`,
    ]
  ) {
    const response = await handler(request('{"action":"work"}', supplied));
    assert(response.status === 401, `rejected capability: ${supplied.length}`);
  }
  assert(calls === 0, "unauthorized requests do not execute service work");

  const accepted = await handler(request());
  assert(accepted.status === 200, "exact capability accepted");
  assert(
    JSON.stringify(await accepted.json()) ===
      JSON.stringify({
        status: "worked",
        blocked: 0,
        deferred: 0,
        stale: 0,
        validated: 1,
      }),
    "response is exact and bounded",
  );
  assert(Number(calls) === 1, "service work runs once");
});

Deno.test("Apple auth worker rejects method, size, syntax, and shape before work", async () => {
  let calls = 0;
  const handler = createAppleAuthWorkerHttpHandler({
    workerSecret: SECRET,
    async runWorker() {
      calls += 1;
      return { blocked: 0, deferred: 0, stale: 0, validated: 0 };
    },
  });

  const method = await handler(request("", SECRET, "GET"));
  assert(
    method.status === 405 && method.headers.get("Allow") === "POST",
    "POST only",
  );
  const oversized = await handler(
    request('{"action":"work"}', SECRET, "POST", { "Content-Length": "1025" }),
  );
  assert(oversized.status === 413, "declared oversized body rejected");
  assert(
    (await handler(request("{"))).status === 400,
    "malformed JSON rejected",
  );
  assert(
    (await handler(request("{}"))).status === 400,
    "missing action rejected",
  );
  assert(
    (await handler(request('{"action":"work","extra":true}'))).status === 400,
    "extra key rejected",
  );
  assert(
    (await handler(request('{"action":"run"}'))).status === 400,
    "wrong action rejected",
  );
  assert(calls === 0, "invalid requests do not execute work");
});

Deno.test("Apple auth worker fails closed on runtime and malformed reports", async () => {
  const failed = createAppleAuthWorkerHttpHandler({
    workerSecret: SECRET,
    async runWorker() {
      throw new Error("sensitive provider detail");
    },
  });
  const failedResponse = await failed(request());
  assert(failedResponse.status === 503, "runtime failure is unavailable");
  assert(
    JSON.stringify(await failedResponse.json()) ===
      JSON.stringify({ error: "APPLE_AUTH_WORKER_UNAVAILABLE" }),
    "runtime failure is redacted",
  );
  assert(
    failedResponse.headers.get("Retry-After") === "60",
    "retry is bounded",
  );

  const malformed = createAppleAuthWorkerHttpHandler({
    workerSecret: SECRET,
    async runWorker() {
      return { blocked: -1, deferred: 0, stale: 0, validated: 0 };
    },
  });
  assert(
    (await malformed(request())).status === 503,
    "malformed report fails closed",
  );
});

Deno.test("Apple auth worker rejects weak or malformed configuration", () => {
  for (
    const workerSecret of ["", "a".repeat(64), ` ${SECRET}`, `${SECRET}\n`]
  ) {
    let rejected = false;
    try {
      createAppleAuthWorkerHttpHandler({
        workerSecret,
        async runWorker() {
          return { blocked: 0, deferred: 0, stale: 0, validated: 0 };
        },
      });
    } catch (error) {
      rejected =
        (error as Error).message === "APPLE_AUTH_WORKER_CONFIGURATION_INVALID";
    }
    // A syntactically valid all-`a` value is allowed; entropy is an operator
    // generation requirement and cannot be inferred from one presented value.
    if (workerSecret === "a".repeat(64)) {
      assert(
        !rejected,
        "valid exact shape accepted",
      );
    } else assert(rejected, "invalid configuration rejected");
  }
});
