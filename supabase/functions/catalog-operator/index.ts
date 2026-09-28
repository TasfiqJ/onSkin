import { createClient } from "jsr:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.7";
import {
  type AccountAccessSnapshot,
  preflightAccountAccess,
} from "../_shared/accountAccess.ts";
import { readEdgeAppEnvironment } from "../_shared/env.ts";
import { stagingTrafficFreezeResponse } from "../_shared/stagingTrafficFreeze.ts";
import { readSupabasePublishableKey } from "../_shared/supabasePublishableKey.ts";
import { createCatalogOperatorDatabaseGateway } from "./databaseGateway.ts";
import { readCatalogOperatorDatabaseUrl } from "./databaseUrl.ts";
import {
  CATALOG_OPERATOR_DEFAULT_BODY_MAX_BYTES,
  CATALOG_OPERATOR_MAX_BODY_MAX_BYTES,
  createCatalogOperatorHttpHandler,
  parseCatalogOperatorAllowedOrigins,
  parseCatalogOperatorSupabaseUrl,
} from "./httpHandler.ts";
import { readCatalogOperatorRuntimeContext } from "./runtimeContext.ts";
import { verifiedCatalogOperatorAuth } from "./verifiedAuth.ts";

function bodyLimit(): number {
  const configured = Number(Deno.env.get("CATALOG_OPERATOR_BODY_MAX_BYTES"));
  return Number.isSafeInteger(configured) &&
      configured >= 1_024 &&
      configured <= CATALOG_OPERATOR_MAX_BODY_MAX_BYTES
    ? configured
    : CATALOG_OPERATOR_DEFAULT_BODY_MAX_BYTES;
}

const appEnvironment = readEdgeAppEnvironment();
const supabaseUrl = parseCatalogOperatorSupabaseUrl(
  Deno.env.get("SUPABASE_URL") ?? "",
  appEnvironment,
);
const publishableKey = readSupabasePublishableKey();
const runtimeContext = readCatalogOperatorRuntimeContext(appEnvironment);
const operatorDatabase = postgres(
  readCatalogOperatorDatabaseUrl(appEnvironment, supabaseUrl),
  {
    prepare: false,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    max_lifetime: 60,
    ssl: appEnvironment === "development" ? false : "verify-full",
  },
);
const operatorGateway = createCatalogOperatorDatabaseGateway(
  operatorDatabase,
);
const databaseAuthority = Object.freeze({
  p_edge_environment: runtimeContext.environment,
  p_source_revision: runtimeContext.sourceRevision,
  p_edge_deployment_id: runtimeContext.edgeDeploymentId,
  p_control_generation: runtimeContext.controlGeneration,
});
const allowedOrigins = parseCatalogOperatorAllowedOrigins(
  Deno.env.get("CATALOG_OPERATOR_ALLOWED_ORIGINS") ?? "",
  appEnvironment,
);

type AccountAccessPreflightClient = Parameters<
  typeof preflightAccountAccess
>[0];

async function requireSameAccountAccess(
  caller: AccountAccessPreflightClient,
  userId: string,
  snapshot: AccountAccessSnapshot,
): Promise<boolean> {
  return (await preflightAccountAccess(caller, userId, snapshot)).ok;
}

const handler = createCatalogOperatorHttpHandler({
  allowedOrigins,
  maxBodyBytes: bodyLimit(),
  requestId: () => crypto.randomUUID(),
  createClient(authorization) {
    const presentedToken = authorization.slice("Bearer ".length);
    const caller = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const accountAccessClient =
      caller as unknown as AccountAccessPreflightClient;
    let verifiedAuth: ReturnType<typeof verifiedCatalogOperatorAuth> = null;
    let accountAccessSnapshot: AccountAccessSnapshot | null = null;
    return {
      async verifiedAuth() {
        const [userResult, claimsResult] = await Promise.all([
          caller.auth.getUser(presentedToken),
          caller.auth.getClaims(presentedToken),
        ]);
        const userId = userResult.error
          ? null
          : (userResult.data.user?.id ?? null);
        if (claimsResult.error || !userId) return null;
        const auth = verifiedCatalogOperatorAuth(
          claimsResult.data?.claims,
          `${supabaseUrl}/auth/v1`,
          userId,
        );
        if (!auth) return null;
        const initialAccountAccess = await preflightAccountAccess(
          accountAccessClient,
          userId,
        );
        if (!initialAccountAccess.ok) return null;
        verifiedAuth = auth;
        accountAccessSnapshot = initialAccountAccess.snapshot;
        return auth;
      },
      async rpc(name, args) {
        if (
          !verifiedAuth ||
          !accountAccessSnapshot ||
          !await requireSameAccountAccess(
            accountAccessClient,
            verifiedAuth.userId,
            accountAccessSnapshot,
          )
        ) {
          return {
            data: null,
            error: { message: "CATALOG_OPERATOR_AUTH_SESSION_NOT_LIVE" },
          };
        }
        const rpcResult = await operatorGateway(
          name,
          args,
          databaseAuthority,
        );
        if (
          !await requireSameAccountAccess(
            accountAccessClient,
            verifiedAuth.userId,
            accountAccessSnapshot,
          )
        ) {
          return {
            data: null,
            error: { message: "CATALOG_OPERATOR_AUTH_SESSION_NOT_LIVE" },
          };
        }
        const { data, error } = rpcResult;
        return { data, error };
      },
    };
  },
});

Deno.serve((request) => stagingTrafficFreezeResponse() ?? handler(request));
