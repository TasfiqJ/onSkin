import type { AppleAuthWorkerDatabase, AppleValidationClaim } from "./core.ts";

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(): Error {
  console.warn("APPLE_AUTH_WORKER_DATABASE_REJECTED");
  return new Error("APPLE_AUTH_WORKER_DATABASE_REJECTED");
}

function claimRow(value: unknown): AppleValidationClaim | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.user_id !== "string" ||
    typeof value.apple_subject_hmac !== "string" ||
    typeof value.subject_hmac_key_version !== "string" ||
    typeof value.client_id !== "string" ||
    !(typeof value.generation === "string" ||
      typeof value.generation === "number") ||
    typeof value.encrypted_refresh_token !== "string" ||
    typeof value.vault_key_version !== "string" ||
    typeof value.last_validated_at !== "string"
  ) {
    return null;
  }
  return {
    userId: value.user_id,
    appleSubjectHmac: value.apple_subject_hmac,
    subjectHmacKeyVersion: value.subject_hmac_key_version,
    clientId: value.client_id,
    generation: value.generation,
    encryptedRefreshToken: value.encrypted_refresh_token,
    vaultKeyVersion: value.vault_key_version,
    lastValidatedAt: value.last_validated_at,
  };
}

export function createAppleAuthWorkerDatabase(
  client: RpcClient,
): AppleAuthWorkerDatabase {
  return {
    async claim(claimToken, limit) {
      const { data, error } = await client.rpc(
        "claim_due_apple_auth_validations",
        {
          p_claim_token: claimToken,
          p_limit: limit,
        },
      );
      if (error || !Array.isArray(data)) throw failure();
      const claims = data.map(claimRow);
      if (claims.some((claim) => claim === null)) throw failure();
      return claims as AppleValidationClaim[];
    },
    async complete(input) {
      const { data, error } = await client.rpc(
        "complete_apple_auth_validation",
        {
          p_user_id: input.userId,
          p_generation: input.generation,
          p_claim_token: input.claimToken,
          p_apple_subject_hmac: input.appleSubjectHmac,
          p_subject_hmac_key_version: input.subjectHmacKeyVersion,
          p_encrypted_refresh_token: input.encryptedRefreshToken,
          p_vault_key_version: input.vaultKeyVersion,
        },
      );
      if (error || typeof data !== "boolean") throw failure();
      return data;
    },
    async defer(input) {
      const { data, error } = await client.rpc("defer_apple_auth_validation", {
        p_user_id: input.userId,
        p_generation: input.generation,
        p_claim_token: input.claimToken,
        p_failure_code: input.failureCode,
        p_retry_after_seconds: input.retryAfterSeconds,
      });
      if (error || !["blocked", "deferred", "stale"].includes(String(data))) {
        throw failure();
      }
      return data as "blocked" | "deferred" | "stale";
    },
    async invalidate(input) {
      const { data, error } = await client.rpc(
        "invalidate_apple_auth_lifecycle",
        {
          p_user_id: input.userId,
          p_generation: input.generation,
          p_claim_token: input.claimToken,
          p_failure_code: input.failureCode,
        },
      );
      if (error || typeof data !== "boolean") throw failure();
      return data;
    },
    async purge(limit) {
      const { data, error } = await client.rpc(
        "purge_expired_apple_auth_artifacts",
        {
          p_limit: limit,
        },
      );
      if (
        error || typeof data !== "number" || !Number.isSafeInteger(data) ||
        data < 0
      ) {
        throw failure();
      }
      return data;
    },
  };
}
