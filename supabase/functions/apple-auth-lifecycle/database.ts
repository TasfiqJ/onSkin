import type { AppleAuthLifecycleDatabase } from "./core.ts";

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rpcError(error: unknown): Error {
  console.warn("APPLE_AUTH_LIFECYCLE_DATABASE_REJECTED");
  return new Error(
    error
      ? "APPLE_AUTH_LIFECYCLE_DATABASE_REJECTED"
      : "APPLE_AUTH_LIFECYCLE_DATA_INVALID",
  );
}

export function createAppleAuthLifecycleDatabase(
  client: RpcClient,
): AppleAuthLifecycleDatabase {
  return {
    async begin(input) {
      const { data, error } = await client.rpc("begin_apple_auth_capture", {
        p_operation_id: input.operationId,
        p_user_id: input.userId,
        p_session_id: input.sessionId,
        p_apple_subject: input.appleSubject,
        p_apple_subject_hmacs: input.appleSubjectHmacs,
        p_subject_hmac_key_versions: input.subjectHmacKeyVersions,
        p_code_hmac: input.codeHmac,
        p_client_id: input.clientId,
      });
      if (
        error ||
        ![
          "reserved",
          "exchange_started",
          "succeeded",
          "failed",
          "expired",
          "blocked",
        ].includes(
          String(data),
        )
      ) {
        throw rpcError(error);
      }
      return data as Awaited<ReturnType<AppleAuthLifecycleDatabase["begin"]>>;
    },
    async markExchangeStarted(operationId, userId, sessionId) {
      const { data, error } = await client.rpc(
        "mark_apple_auth_capture_exchange_started",
        {
          p_operation_id: operationId,
          p_user_id: userId,
          p_session_id: sessionId,
        },
      );
      if (error || typeof data !== "boolean") throw rpcError(error);
      return data;
    },
    async complete(input) {
      const { data, error } = await client.rpc("complete_apple_auth_capture", {
        p_operation_id: input.operationId,
        p_user_id: input.userId,
        p_session_id: input.sessionId,
        p_encrypted_refresh_token: input.encryptedRefreshToken,
        p_vault_key_version: input.vaultKeyVersion,
      });
      const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
      if (
        error ||
        !isRecord(row) ||
        row.state !== "active" ||
        !(typeof row.generation === "number" ||
          typeof row.generation === "string") ||
        typeof row.next_validation_at !== "string"
      ) {
        throw rpcError(error);
      }
      return {
        state: "active",
        generation: row.generation,
        nextValidationAt: row.next_validation_at,
      };
    },
    async fail(operationId, userId, failureCode) {
      const { data, error } = await client.rpc("fail_apple_auth_capture", {
        p_operation_id: operationId,
        p_user_id: userId,
        p_failure_code: failureCode,
      });
      if (error || typeof data !== "boolean") throw rpcError(error);
    },
    async invalidate(input) {
      const { data, error } = await client.rpc(
        "invalidate_apple_auth_for_session",
        {
          p_user_id: input.userId,
          p_session_id: input.sessionId,
          p_apple_subject: input.appleSubject,
          p_failure_code: input.failureCode,
        },
      );
      if (error || typeof data !== "boolean") throw rpcError(error);
      return data;
    },
  };
}
