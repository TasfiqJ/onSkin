import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  type AccountAccessSnapshot,
  preflightAccountAccess,
} from "../_shared/accountAccess.ts";
import { bearerAuthorizationHeader } from "../_shared/auth.ts";
import {
  contentLengthTooLarge,
  readLimitedJson,
  userEdgeBodyMaxBytes,
} from "../_shared/body.ts";
import {
  healthProcessingCallerHeaders,
  preflightActiveHealthProcessing,
  readHealthProcessingEpochHeader,
} from "../_shared/healthProcessingEpoch.ts";
import { stagingTrafficFreezeResponse } from "../_shared/stagingTrafficFreeze.ts";
import { readSupabasePublishableKey } from "../_shared/supabasePublishableKey.ts";
import { preflightAskConsent } from "./consentAdmission.ts";
import {
  ASK_GATEWAY_PROTOCOL_VERSION,
  type AskGatewayErrorCode,
  parseAskGatewayRequest,
} from "./contract.ts";
import {
  DisabledProvider,
  DisabledQuotaLedger,
  NonAuthoritativeCircuitBreaker,
  runAskGateway,
} from "./gatewayCore.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const publishableKey = readSupabasePublishableKey();
const maxBodyBytes = userEdgeBodyMaxBytes();
const circuit = new NonAuthoritativeCircuitBreaker();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-health-processing-epoch",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function error(error: string, status: number, retryable = false): Response {
  return json({
    protocolVersion: ASK_GATEWAY_PROTOCOL_VERSION,
    status: "error",
    error,
    retryable,
  }, status);
}

function gatewayErrorStatus(code: AskGatewayErrorCode): number {
  if (code === "request_in_progress") return 409;
  if (code === "quota_exceeded" || code === "cost_ceiling") return 429;
  return 503;
}

function askConsentError(
  admission: Awaited<ReturnType<typeof preflightAskConsent>>,
): Response {
  const unavailable = admission.error === "ASK_CONSENT_UNAVAILABLE" ||
    admission.error === "ASK_CONSENT_AUTHORITY_UNAVAILABLE";
  return error(
    unavailable ? "gateway_unavailable" : "consent_required",
    unavailable ? 503 : 409,
    unavailable,
  );
}

type Caller =
  & Parameters<typeof preflightAccountAccess>[0]
  & Parameters<typeof preflightActiveHealthProcessing>[0]
  & Parameters<typeof preflightAskConsent>[0];

async function requireSameAccountAccess(
  caller: Caller,
  userId: string,
  snapshot: AccountAccessSnapshot,
): Promise<Response | null> {
  const result = await preflightAccountAccess(caller, userId, snapshot);
  return result.ok
    ? null
    : error("account_changed", result.status, result.status >= 500);
}

Deno.serve(async (req) => {
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return error("method_not_allowed", 405);
  if (contentLengthTooLarge(req, maxBodyBytes)) {
    return error("payload_too_large", 413);
  }

  const authorization = bearerAuthorizationHeader(req);
  const healthEpoch = readHealthProcessingEpochHeader(req.headers);
  if (!authorization || !healthEpoch) return error("unauthorized", 401);

  const caller = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: healthProcessingCallerHeaders(authorization, healthEpoch),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return error("unauthorized", 401);

  const initialAccountAccess = await preflightAccountAccess(caller, userId);
  if (!initialAccountAccess.ok) {
    return error(
      "unauthorized",
      initialAccountAccess.status,
      initialAccountAccess.status >= 500,
    );
  }
  const healthAdmission = await preflightActiveHealthProcessing(
    caller,
    userId,
    healthEpoch,
  );
  if (!healthAdmission.ok) {
    return error("consent_required", healthAdmission.status);
  }

  const parsed = await readLimitedJson(
    req,
    maxBodyBytes,
    (_body, status = 400) =>
      error(status === 413 ? "payload_too_large" : "bad_request", status),
    null,
  );
  if (parsed instanceof Response) return parsed;
  const request = parseAskGatewayRequest(parsed);
  if (!request) return error("bad_request", 400);

  const askConsent = await preflightAskConsent(
    caller,
    request.consentGeneration,
    healthEpoch,
  );
  if (!askConsent.ok) {
    return askConsentError(askConsent);
  }

  const providerAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (providerAccountError) return providerAccountError;
  const providerHealthError = await preflightActiveHealthProcessing(
    caller,
    userId,
    healthEpoch,
  );
  if (!providerHealthError.ok) {
    return error("consent_required", providerHealthError.status);
  }

  // Keep the purpose-consent authority check immediately adjacent to the
  // execution boundary. It currently fails closed because the deployed RPC
  // cannot prove current approved registry authority.
  const executionConsent = await preflightAskConsent(
    caller,
    request.consentGeneration,
    healthEpoch,
  );
  if (!executionConsent.ok) return askConsentError(executionConsent);

  const gatewayResult = await runAskGateway({
    ownerId: userId,
    request,
    config: {
      // ASK-02 source checkpoint: no environment value can activate delivery.
      enabled: false,
      maximumCostMicros: 1,
      maxOutputTokens: 1,
      timeoutMs: 250,
      maxAttempts: 1,
    },
    quota: new DisabledQuotaLedger(),
    provider: new DisabledProvider(),
    circuit,
  });

  const responseAccountError = await requireSameAccountAccess(
    caller,
    userId,
    initialAccountAccess.snapshot,
  );
  if (responseAccountError) return responseAccountError;
  const responseHealthError = await preflightActiveHealthProcessing(
    caller,
    userId,
    healthEpoch,
  );
  if (!responseHealthError.ok) {
    return error("consent_required", responseHealthError.status);
  }
  const responseConsent = await preflightAskConsent(
    caller,
    request.consentGeneration,
    healthEpoch,
  );
  if (!responseConsent.ok) return askConsentError(responseConsent);

  if (gatewayResult.status === "error") {
    return json(gatewayResult, gatewayErrorStatus(gatewayResult.error));
  }
  return json(gatewayResult);
});
