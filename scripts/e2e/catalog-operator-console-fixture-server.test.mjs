import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const fixturePath = fileURLToPath(
  new URL("./catalog-operator-console-fixture-server.mjs", import.meta.url),
);
const port = 54339;
const fixtureOrigin = `http://127.0.0.1:${port}`;
const browserOrigin = "http://127.0.0.1:4319";
const factorId = "fb77592e-894a-4c0a-bb63-f7398de6b2db";
const correctionId = "7bb4352f-cb78-40cf-8ba5-f5f06a112f66";
const holdId = "9f80328e-2494-433f-bdab-d355d95b7848";
const repairReceiptId = "8ac66978-be1e-4d8c-9ebb-b6d8db7a87cf";
const sourceId = "2524b374-53d9-4a47-b2e9-2bdaefcdad60";
let fixture;

function waitForFixture(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("fixture start timed out")),
      5_000,
    );
    const onData = (chunk) => {
      if (!String(chunk).includes(`listening on ${fixtureOrigin}`)) return;
      clearTimeout(timeout);
      child.stdout.off("data", onData);
      resolve();
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`fixture exited before start with code ${code}`));
    });
  });
}

async function request(path, { body, token, method = "POST" } = {}) {
  const headers = {
    Accept: "application/json",
    Origin: browserOrigin,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${fixtureOrigin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function operationId() {
  return crypto.randomUUID();
}

before(async () => {
  fixture = spawn(process.execPath, [fixturePath], {
    env: {
      ...process.env,
      CATALOG_OPERATOR_FIXTURE_CONFLICT_ONCE: "0",
      CATALOG_OPERATOR_FIXTURE_ORIGIN: browserOrigin,
      CATALOG_OPERATOR_FIXTURE_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  await waitForFixture(fixture);
});

after(async () => {
  if (!fixture || fixture.exitCode !== null) return;
  fixture.kill();
  await Promise.race([
    once(fixture, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
});

test("synthetic fixture enforces auth order, live AAL2, claims, and logout", async () => {
  const verifyBeforeRequest = await request("/auth/v1/verify", {
    body: { email: "operator@example.test", token: "123456", type: "email" },
  });
  assert.equal(verifyBeforeRequest.status, 422);

  const otp = await request("/auth/v1/otp", {
    body: { email: "operator@example.test", create_user: false },
  });
  assert.equal(otp.status, 200);

  const emailVerification = await request("/auth/v1/verify", {
    body: { email: "operator@example.test", token: "123456", type: "email" },
  });
  assert.equal(emailVerification.status, 200);
  const aal1Token = emailVerification.body.access_token;
  assert.equal(typeof aal1Token, "string");

  assert.equal((await request("/auth/v1/user", { method: "GET" })).status, 401);
  assert.equal(
    (
      await request(`/auth/v1/factors/${factorId}/challenge`, {
        body: { factorId },
      })
    ).status,
    401,
  );

  const firstChallenge = await request(
    `/auth/v1/factors/${factorId}/challenge`,
    {
      token: aal1Token,
      body: { factorId },
    },
  );
  assert.equal(firstChallenge.status, 200);

  const unboundVerification = await request(
    `/auth/v1/factors/${factorId}/verify`,
    {
      body: {
        challenge_id: firstChallenge.body.id,
        code: "123456",
      },
    },
  );
  assert.equal(unboundVerification.status, 422);

  const secondChallenge = await request(
    `/auth/v1/factors/${factorId}/challenge`,
    {
      token: aal1Token,
      body: { factorId },
    },
  );
  assert.equal(secondChallenge.status, 200);

  const mfaVerification = await request(`/auth/v1/factors/${factorId}/verify`, {
    token: aal1Token,
    body: {
      challenge_id: secondChallenge.body.id,
      code: "123456",
    },
  });
  assert.equal(mfaVerification.status, 200);
  const aal2Token = mfaVerification.body.access_token;
  assert.equal(typeof aal2Token, "string");
  assert.notEqual(aal2Token, aal1Token);

  const malformedSession = await request("/functions/v1/catalog-operator", {
    token: "ey-not-a-real-jwt",
    body: { action: "session" },
  });
  assert.equal(malformedSession.status, 401);

  const operatorSession = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: { action: "session" },
  });
  assert.equal(operatorSession.status, 200);

  const claimlessTransition = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "transition",
      itemKind: "correction_report",
      itemId: correctionId,
      leaseId: crypto.randomUUID(),
      expectedVersion: 1,
      operationId: operationId(),
      decision: "triage",
      reasonCode: "wrong_match_confirmed",
    },
  });
  assert.equal(claimlessTransition.status, 409);

  const correctionClaim = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "claim",
      itemKind: "correction_report",
      itemId: correctionId,
      expectedVersion: 1,
      operationId: operationId(),
    },
  });
  assert.equal(correctionClaim.status, 200);
  const correctionLease = correctionClaim.body.result.leaseId;

  const correctionDetail = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "detail",
      itemKind: "correction_report",
      itemId: correctionId,
      leaseId: correctionLease,
      expectedVersion: 1,
    },
  });
  assert.equal(correctionDetail.status, 200);

  const wrongLeaseTransition = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "transition",
      itemKind: "correction_report",
      itemId: correctionId,
      leaseId: crypto.randomUUID(),
      expectedVersion: 1,
      operationId: operationId(),
      decision: "triage",
      reasonCode: "wrong_match_confirmed",
    },
  });
  assert.equal(wrongLeaseTransition.status, 409);

  const correctionTransition = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "transition",
      itemKind: "correction_report",
      itemId: correctionId,
      leaseId: correctionLease,
      expectedVersion: 1,
      operationId: operationId(),
      decision: "triage",
      reasonCode: "wrong_match_confirmed",
    },
  });
  assert.equal(correctionTransition.status, 200);
  assert.equal(correctionTransition.body.result.status, "triaged");

  const claimlessRelease = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "release_hold",
      holdId,
      leaseId: crypto.randomUUID(),
      expectedVersion: 3,
      operationId: operationId(),
      repairReceiptId,
      reasonCode: "repair_verified_current",
    },
  });
  assert.equal(claimlessRelease.status, 409);

  const holdClaim = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "claim",
      itemKind: "product_hold",
      itemId: holdId,
      expectedVersion: 3,
      operationId: operationId(),
    },
  });
  assert.equal(holdClaim.status, 200);
  const holdLease = holdClaim.body.result.leaseId;

  const wrongReceiptRelease = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "release_hold",
      holdId,
      leaseId: holdLease,
      expectedVersion: 3,
      operationId: operationId(),
      repairReceiptId: crypto.randomUUID(),
      reasonCode: "repair_verified_current",
    },
  });
  assert.equal(wrongReceiptRelease.status, 400);

  const holdRelease = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "release_hold",
      holdId,
      leaseId: holdLease,
      expectedVersion: 3,
      operationId: operationId(),
      repairReceiptId,
      reasonCode: "repair_verified_current",
    },
  });
  assert.equal(holdRelease.status, 200);
  assert.equal(holdRelease.body.result.state, "released");

  const sourceClaim = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "claim",
      itemKind: "catalog_source",
      itemId: sourceId,
      expectedVersion: 1,
      operationId: operationId(),
    },
  });
  assert.equal(sourceClaim.status, 200);

  const sourceTransition = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: {
      action: "transition",
      itemKind: "catalog_source",
      itemId: sourceId,
      leaseId: sourceClaim.body.result.leaseId,
      expectedVersion: 1,
      operationId: operationId(),
      decision: "request_changes",
      reasonCode: "rights_gap",
    },
  });
  assert.equal(sourceTransition.status, 200);
  assert.equal(sourceTransition.body.result.status, "changes_requested");

  const sourceQueue = await request("/functions/v1/catalog-operator", {
    token: aal2Token,
    body: { action: "queue", queueKind: "source_import" },
  });
  assert.equal(sourceQueue.status, 200);
  assert.deepEqual(sourceQueue.body.result.items, []);

  const logout = await request("/auth/v1/logout?scope=local", {
    token: aal2Token,
    body: {},
  });
  assert.equal(logout.status, 200);
  assert.equal(
    (await request("/auth/v1/user", { token: aal2Token, method: "GET" }))
      .status,
    401,
  );
  assert.equal(
    (
      await request("/functions/v1/catalog-operator", {
        token: aal2Token,
        body: { action: "session" },
      })
    ).status,
    401,
  );
});
