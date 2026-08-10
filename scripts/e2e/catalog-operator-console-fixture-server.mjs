import { createServer } from "node:http";

const port = Number(process.env.CATALOG_OPERATOR_FIXTURE_PORT ?? 54329);
const allowedOrigin = process.env.CATALOG_OPERATOR_FIXTURE_ORIGIN ??
  "http://127.0.0.1:4318";
const conflictOnce = process.env.CATALOG_OPERATOR_FIXTURE_CONFLICT_ONCE === "1";
const operatorId = "a352fc55-2f5d-4e99-b163-bce1957e404b";
const authSessionId = "b20fb544-351e-4c70-bb36-f624747bb3ce";
const operatorSessionId = "f1e90bb0-1ca1-4cbf-a469-363b5a814b2c";
const operatorUserId = "274469d4-c6d0-42af-b0db-13441a89d8e3";
const factorId = "fb77592e-894a-4c0a-bb63-f7398de6b2db";
const totpChallengeId = "fc5e2d56-134f-49f6-a611-41ba664596b8";
const correctionId = "7bb4352f-cb78-40cf-8ba5-f5f06a112f66";
const holdId = "9f80328e-2494-433f-bdab-d355d95b7848";
const repairReceiptId = "8ac66978-be1e-4d8c-9ebb-b6d8db7a87cf";
const sourceId = "2524b374-53d9-4a47-b2e9-2bdaefcdad60";
const eventId = "dd68d17b-2e03-4f6c-98b2-76ae629426ec";
let correctionStatus = "open";
let holdStatus = "repair_attested";
let sourceStatus = "open";
let conflictReturned = false;
let emailOtpRequested = false;
let activeAal1Token = null;
let activeAal2Token = null;
let operatorWorkSessionActive = false;
let totpChallengeExpiresAt = 0;
let totpChallengeToken = null;
const activeClaims = new Map();

function itemKey(itemKind, itemId) {
  return `${itemKind}:${itemId}`;
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function accessToken(assuranceLevel = "aal1") {
  const now = Math.floor(Date.now() / 1_000);
  const amr = [{ method: "otp", timestamp: now }];
  if (assuranceLevel === "aal2") {
    amr.push({ method: "totp", timestamp: now });
  }
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${
    base64url({
      aud: "authenticated",
      exp: now + 3_600,
      iat: now,
      sub: operatorId,
      email: "operator@example.test",
      role: "authenticated",
      aal: assuranceLevel,
      amr,
      session_id: authSessionId,
      is_anonymous: false,
    })
  }.synthetic-signature`;
}

function bearerToken(request) {
  const authorization = request.headers.authorization ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

function tokenIsActive(token, assuranceLevel = null) {
  if (!token) return false;
  if (assuranceLevel === "aal1") return token === activeAal1Token;
  if (assuranceLevel === "aal2") return token === activeAal2Token;
  return token === activeAal1Token || token === activeAal2Token;
}

function invalidateAuthSession() {
  emailOtpRequested = false;
  activeAal1Token = null;
  activeAal2Token = null;
  operatorWorkSessionActive = false;
  totpChallengeExpiresAt = 0;
  totpChallengeToken = null;
  activeClaims.clear();
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-request-id, x-supabase-api-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Expose-Headers": "x-request-id, retry-after",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function send(response, status, value, extraHeaders = {}) {
  const body = value === null ? "" : JSON.stringify(value);
  response.writeHead(status, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16_384) throw new Error("fixture request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function user() {
  const now = new Date().toISOString();
  return {
    id: operatorId,
    aud: "authenticated",
    role: "authenticated",
    email: "operator@example.test",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
    factors: [
      {
        id: factorId,
        factor_type: "totp",
        status: "verified",
        friendly_name: "Synthetic authenticator",
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

function issueAuthSession(assuranceLevel = "aal1") {
  const session = {
    access_token: accessToken(assuranceLevel),
    token_type: "bearer",
    expires_in: 3_600,
    expires_at: Math.floor(Date.now() / 1_000) + 3_600,
    refresh_token: "synthetic-refresh-token-never-leaves-local-fixture",
    user: user(),
  };
  if (assuranceLevel === "aal1") {
    activeAal1Token = session.access_token;
    activeAal2Token = null;
  } else {
    activeAal1Token = null;
    activeAal2Token = session.access_token;
  }
  operatorWorkSessionActive = false;
  activeClaims.clear();
  return session;
}

function queueResult(queueKind) {
  const createdAt = "2026-07-22T16:00:00.000Z";
  if (queueKind === "source_import") {
    if (sourceStatus !== "open") {
      return { items: [], nextCursor: null };
    }
    return {
      items: [
        {
          itemKind: "catalog_source",
          itemId: sourceId,
          itemVersion: 1,
          status: sourceStatus,
          priority: 40,
          createdAt,
          summary: {
            sourceKey: "synthetic_source",
            displayName: "Synthetic source review",
            reviewStatus: "pending",
            productionApproved: false,
          },
        },
      ],
      nextCursor: { createdAt, itemId: sourceId },
    };
  }
  const items = [];
  if (correctionStatus === "open") {
    items.push({
      itemKind: "correction_report",
      itemId: correctionId,
      itemVersion: 1,
      status: correctionStatus,
      priority: 90,
      createdAt,
      summary: {
        correctionType: "wrong_match",
        productId: "dd30b420-2c1d-4f17-99c2-c31058e79917",
        hasBarcode: true,
        status: correctionStatus,
      },
    });
  }
  if (holdStatus !== "released") {
    items.push({
      itemKind: "product_hold",
      itemId: holdId,
      itemVersion: 3,
      status: holdStatus,
      priority: 100,
      createdAt,
      summary: {
        productId: "dd30b420-2c1d-4f17-99c2-c31058e79917",
        reasonCode: "wrong_match_confirmed",
        state: holdStatus,
        openedAt: "2026-07-22T16:00:00.000Z",
        repairReceiptReady: true,
      },
    });
  }
  return {
    items,
    nextCursor: items.length > 0
      ? { createdAt: items.at(-1).createdAt, itemId: items.at(-1).itemId }
      : null,
  };
}

function detailResult(itemKind, itemId) {
  if (itemKind === "correction_report" && itemId === correctionId) {
    return {
      itemKind,
      itemId,
      itemVersion: 1,
      status: correctionStatus,
      detail: {
        correctionType: "wrong_match",
        productId: "dd30b420-2c1d-4f17-99c2-c31058e79917",
        barcode: "12345670",
        description: "Wrong match from product detail",
        proposedPayload: { productName: "Synthetic Barrier Cream" },
        createdAt: "2026-07-22T16:00:00.000Z",
        status: correctionStatus,
        product: {
          id: "dd30b420-2c1d-4f17-99c2-c31058e79917",
          name: "Synthetic Barrier Cream",
          brand: "Layerwell test fixture",
          category: "moisturizer",
        },
      },
    };
  }
  if (itemKind === "product_hold" && itemId === holdId) {
    return {
      itemKind,
      itemId,
      itemVersion: 3,
      status: holdStatus,
      detail: {
        productId: "dd30b420-2c1d-4f17-99c2-c31058e79917",
        reasonCode: "wrong_match_confirmed",
        state: holdStatus,
        openedAt: "2026-07-22T16:00:00.000Z",
        acceptedAt: "2026-07-22T16:10:00.000Z",
        disposition: "accepted",
        dispositionAt: "2026-07-22T16:10:00.000Z",
        repairReceiptId,
        repairAttestedAt: "2026-07-22T16:20:00.000Z",
        releasedAt: null,
        product: {
          id: "dd30b420-2c1d-4f17-99c2-c31058e79917",
          name: "Synthetic Held Serum",
          brand: "Layerwell test fixture",
          category: "serum",
        },
      },
    };
  }
  if (itemKind === "catalog_source" && itemId === sourceId) {
    return {
      itemKind,
      itemId,
      itemVersion: 1,
      status: sourceStatus,
      detail: {
        sourceKey: "synthetic_source",
        displayName: "Synthetic source review",
        sourceUrl: "https://example.test/source",
        licenseName: "Synthetic fixture license",
        licenseUrl: "https://example.test/license",
        requiresAttribution: true,
        requiresShareAlike: false,
        allowsImages: false,
        productionApproved: false,
        reviewStatus: sourceStatus === "open" ? "pending" : sourceStatus,
        reviewedAt: null,
      },
    };
  }
  return null;
}

function currentItem(itemKind, itemId) {
  if (
    itemKind === "correction_report" && itemId === correctionId &&
    correctionStatus === "open"
  ) {
    return { version: 1, status: correctionStatus };
  }
  if (
    itemKind === "product_hold" && itemId === holdId &&
    holdStatus !== "released"
  ) {
    return { version: 3, status: holdStatus };
  }
  if (
    itemKind === "catalog_source" && itemId === sourceId &&
    sourceStatus === "open"
  ) {
    return { version: 1, status: sourceStatus };
  }
  return null;
}

function claimMatches(input, key = itemKey(input.itemKind, input.itemId)) {
  const activeClaim = activeClaims.get(key);
  return Boolean(
    activeClaim &&
      input.leaseId === activeClaim.leaseId &&
      input.expectedVersion === activeClaim.itemVersion &&
      activeClaim.expiresAt > Date.now(),
  );
}

function transitionIsAllowed(input) {
  if (input.itemKind === "correction_report") {
    return input.decision === "triage" &&
      input.reasonCode === "wrong_match_confirmed";
  }
  if (input.itemKind === "catalog_source") {
    return (
      (input.decision === "acknowledge" &&
        input.reasonCode === "reviewed_no_change") ||
      (input.decision === "request_changes" &&
        [
          "rights_gap",
          "attribution_gap",
          "artifact_gap",
          "quality_gap",
          "provenance_gap",
        ].includes(input.reasonCode)) ||
      (input.decision === "escalate" &&
        [
          "legal_review_required",
          "security_review_required",
          "source_withdrawal_risk",
        ].includes(
          input.reasonCode,
        ))
    );
  }
  return false;
}

async function operatorResponse(request, response) {
  if (!tokenIsActive(bearerToken(request), "aal2")) {
    send(response, 401, { error: "unauthorized" });
    return;
  }
  const input = await readJson(request);
  const requestId = request.headers["x-request-id"];
  const headers = typeof requestId === "string"
    ? { "X-Request-Id": requestId }
    : {};
  if (input.action === "session") {
    operatorWorkSessionActive = true;
    send(
      response,
      200,
      {
        result: {
          action: "session",
          operatorSessionId,
          operatorUserId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
          capabilities: [
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
          ],
        },
      },
      headers,
    );
    return;
  }
  if (!operatorWorkSessionActive) {
    send(response, 401, { error: "unauthorized" }, headers);
    return;
  }
  if (input.action === "queue") {
    send(response, 200, {
      result: { action: "queue", ...queueResult(input.queueKind) },
    }, headers);
    return;
  }
  if (input.action === "detail") {
    const activeClaim = activeClaims.get(itemKey(input.itemKind, input.itemId));
    if (
      !activeClaim ||
      input.leaseId !== activeClaim.leaseId ||
      input.expectedVersion !== activeClaim.itemVersion ||
      activeClaim.expiresAt <= Date.now()
    ) {
      send(response, 409, { error: "conflict" }, headers);
      return;
    }
    const result = detailResult(input.itemKind, input.itemId);
    send(
      response,
      result ? 200 : 404,
      result
        ? { result: { action: "detail", ...result } }
        : { error: "not_found" },
      headers,
    );
    return;
  }
  if (input.action === "claim") {
    const current = currentItem(input.itemKind, input.itemId);
    if (!current || input.expectedVersion !== current.version) {
      send(response, 409, { error: "conflict" }, headers);
      return;
    }
    const leaseId = crypto.randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1_000;
    activeClaims.set(itemKey(input.itemKind, input.itemId), {
      leaseId,
      itemVersion: input.expectedVersion,
      expiresAt,
    });
    send(
      response,
      200,
      {
        result: {
          action: "claim",
          itemKind: input.itemKind,
          itemId: input.itemId,
          itemVersion: input.expectedVersion,
          leaseId,
          leaseExpiresAt: new Date(expiresAt).toISOString(),
          status: current.status,
        },
      },
      headers,
    );
    return;
  }
  if (input.action === "transition") {
    const key = itemKey(input.itemKind, input.itemId);
    if (!claimMatches(input, key)) {
      send(response, 409, { error: "conflict" }, headers);
      return;
    }
    if (!transitionIsAllowed(input)) {
      send(response, 400, { error: "invalid_request" }, headers);
      return;
    }
    if (conflictOnce && !conflictReturned) {
      conflictReturned = true;
      activeClaims.delete(key);
      send(response, 409, { error: "conflict" }, headers);
      return;
    }
    if (input.itemKind === "correction_report" && input.decision === "triage") {
      correctionStatus = "triaged";
    } else if (input.itemKind === "catalog_source") {
      sourceStatus = input.decision === "acknowledge"
        ? "acknowledged"
        : input.decision === "request_changes"
        ? "changes_requested"
        : "escalated";
    }
    activeClaims.delete(key);
    send(
      response,
      200,
      {
        result: {
          action: "transition",
          itemKind: input.itemKind,
          itemId: input.itemId,
          itemVersion: input.expectedVersion + 1,
          status: input.itemKind === "correction_report"
            ? correctionStatus
            : sourceStatus,
          holdId: input.itemKind === "correction_report" ? holdId : null,
          repairReceiptId: null,
          eventId,
        },
      },
      headers,
    );
    return;
  }
  if (input.action === "release_hold") {
    const claimInput = {
      itemKind: "product_hold",
      itemId: input.holdId,
      leaseId: input.leaseId,
      expectedVersion: input.expectedVersion,
    };
    if (!claimMatches(claimInput)) {
      send(response, 409, { error: "conflict" }, headers);
      return;
    }
    if (
      input.holdId !== holdId ||
      input.repairReceiptId !== repairReceiptId ||
      input.reasonCode !== "repair_verified_current"
    ) {
      send(response, 400, { error: "invalid_request" }, headers);
      return;
    }
    holdStatus = "released";
    activeClaims.delete(itemKey("product_hold", input.holdId));
    send(
      response,
      200,
      {
        result: {
          action: "release_hold",
          holdId,
          itemVersion: input.expectedVersion + 1,
          state: holdStatus,
          releasedAt: new Date().toISOString(),
          eventId,
        },
      },
      headers,
    );
    return;
  }
  send(response, 400, { error: "invalid_request" }, headers);
}

const server = createServer(async (request, response) => {
  try {
    if (request.headers.origin && request.headers.origin !== allowedOrigin) {
      send(response, 403, { error: "forbidden" });
      return;
    }
    if (request.method === "OPTIONS") {
      console.log(
        `CAT08 fixture preflight ${request.url ?? "/"} headers=${
          request.headers["access-control-request-headers"] ?? ""
        }`,
      );
      response.writeHead(204, corsHeaders());
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (request.method === "POST" && url.pathname === "/auth/v1/otp") {
      const input = await readJson(request);
      if (input.email !== "operator@example.test") {
        send(response, 400, {
          code: "invalid_credentials",
          message: "Unknown synthetic account.",
        });
        return;
      }
      invalidateAuthSession();
      emailOtpRequested = true;
      send(response, 200, {});
      return;
    }
    if (request.method === "POST" && url.pathname === "/auth/v1/verify") {
      const input = await readJson(request);
      if (
        !emailOtpRequested ||
        input.email !== "operator@example.test" ||
        input.token !== "123456" ||
        input.type !== "email"
      ) {
        send(response, 422, {
          code: "otp_expired",
          message: "Synthetic email code is invalid or expired.",
        });
        return;
      }
      emailOtpRequested = false;
      send(response, 200, issueAuthSession("aal1"));
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === `/auth/v1/factors/${factorId}/challenge`
    ) {
      const token = bearerToken(request);
      if (!tokenIsActive(token, "aal1")) {
        send(response, 401, {
          code: "unauthorized",
          message: "A live AAL1 session is required.",
        });
        return;
      }
      await readJson(request);
      totpChallengeExpiresAt = Math.floor(Date.now() / 1_000) + 300;
      totpChallengeToken = token;
      send(response, 200, {
        id: totpChallengeId,
        type: "totp",
        expires_at: totpChallengeExpiresAt,
      });
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === `/auth/v1/factors/${factorId}/verify`
    ) {
      const token = bearerToken(request);
      const input = await readJson(request);
      const challengeIsValid = tokenIsActive(token, "aal1") &&
        token === totpChallengeToken &&
        input.challenge_id === totpChallengeId &&
        totpChallengeExpiresAt > Math.floor(Date.now() / 1_000);
      const codeIsValid = input.code === "123456";
      totpChallengeExpiresAt = 0;
      totpChallengeToken = null;
      if (!challengeIsValid || !codeIsValid) {
        send(response, 422, {
          code: "mfa_verification_failed",
          message: "Synthetic authenticator code is invalid or expired.",
        });
        return;
      }
      send(response, 200, issueAuthSession("aal2"));
      return;
    }
    if (request.method === "POST" && url.pathname === "/auth/v1/logout") {
      if (!tokenIsActive(bearerToken(request))) {
        send(response, 401, {
          code: "unauthorized",
          message: "No live synthetic session.",
        });
        return;
      }
      invalidateAuthSession();
      send(response, 200, {});
      return;
    }
    if (request.method === "GET" && url.pathname === "/auth/v1/user") {
      if (!tokenIsActive(bearerToken(request))) {
        send(response, 401, {
          code: "unauthorized",
          message: "No live synthetic session.",
        });
        return;
      }
      send(response, 200, user());
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/functions/v1/catalog-operator"
    ) {
      await operatorResponse(request, response);
      return;
    }
    send(response, 404, { error: "not_found" });
  } catch {
    send(response, 500, { error: "fixture_failure" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    `CAT08 synthetic Supabase fixture listening on http://127.0.0.1:${port}`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
