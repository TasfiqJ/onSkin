const POSITIVE_DECIMAL = /^[1-9][0-9]{0,18}$/;
const SHA256 = /^[a-f0-9]{64}$/;

type DependentConsentClient = {
  rpc(
    functionName: "get_health_dependent_consent_status",
    args: { p_consent_type: "ask_layerwell" },
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

export type AskConsentAdmission = {
  ok: false;
  error:
    | "ASK_CONSENT_AUTHORITY_UNAVAILABLE"
    | "ASK_CONSENT_REQUIRED"
    | "ASK_CONSENT_STALE"
    | "ASK_CONSENT_UNAVAILABLE";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Exact owner-scoped purpose-consent receipt preflight.
 *
 * The deployed status RPC does not prove that the receipt still points at the
 * current approved registry row. Until a server-side RPC returns that
 * authority atomically, even a syntactically valid active row fails closed.
 */
export async function preflightAskConsent(
  client: DependentConsentClient,
  expectedGeneration: string,
  expectedHealthEpoch: string,
): Promise<AskConsentAdmission> {
  let result: { data: unknown; error: unknown };
  try {
    result = await client.rpc("get_health_dependent_consent_status", {
      p_consent_type: "ask_layerwell",
    });
  } catch {
    return { ok: false, error: "ASK_CONSENT_UNAVAILABLE" };
  }
  if (result.error || !Array.isArray(result.data) || result.data.length !== 1) {
    return { ok: false, error: "ASK_CONSENT_UNAVAILABLE" };
  }
  const row = result.data[0];
  if (
    !isRecord(row) ||
    Object.keys(row).sort().join(",") !==
      "consent_text_hash,consent_type,generation,health_epoch,state,version" ||
    row.consent_type !== "ask_layerwell" ||
    row.state !== "active"
  ) {
    return { ok: false, error: "ASK_CONSENT_REQUIRED" };
  }
  const generation = String(row.generation);
  const healthEpoch = String(row.health_epoch);
  if (
    !POSITIVE_DECIMAL.test(generation) ||
    !POSITIVE_DECIMAL.test(healthEpoch) ||
    generation !== expectedGeneration ||
    healthEpoch !== expectedHealthEpoch
  ) {
    return { ok: false, error: "ASK_CONSENT_STALE" };
  }
  if (
    typeof row.version !== "string" ||
    row.version.length === 0 ||
    /placeholder|draft/i.test(row.version) ||
    typeof row.consent_text_hash !== "string" ||
    !SHA256.test(row.consent_text_hash)
  ) {
    return { ok: false, error: "ASK_CONSENT_REQUIRED" };
  }
  return { ok: false, error: "ASK_CONSENT_AUTHORITY_UNAVAILABLE" };
}
