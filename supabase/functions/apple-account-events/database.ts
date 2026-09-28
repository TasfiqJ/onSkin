import type { AppleAccountEventDatabase } from "./core.ts";

type RpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createAppleAccountEventDatabase(
  client: RpcClient,
): AppleAccountEventDatabase {
  return {
    async apply(input) {
      const { data, error } = await client.rpc(
        "apply_apple_auth_server_event",
        {
          p_jti_hmac: input.jtiHmac,
          p_payload_hmac: input.payloadHmac,
          p_apple_subject_hmacs: input.appleSubjectHmacs,
          p_subject_hmac_key_versions: input.subjectHmacKeyVersions,
          p_apple_subject: input.appleSubject,
          p_client_id: input.clientId,
          p_event_type: input.eventType,
          p_event_at: input.eventAt,
          p_relay_email_hmac: input.relayEmailHmac,
        },
      );
      const row = Array.isArray(data) && data.length === 1 ? data[0] : null;
      if (
        error ||
        !isRecord(row) ||
        !["applied", "duplicate", "ignored_unknown", "stale", "unknown_subject"]
          .includes(
            String(row.result_code),
          ) ||
        !(row.user_id === null || typeof row.user_id === "string") ||
        !(row.state === null || typeof row.state === "string") ||
        !(
          row.generation === null ||
          typeof row.generation === "number" ||
          typeof row.generation === "string"
        )
      ) {
        console.warn("APPLE_ACCOUNT_EVENT_DATABASE_REJECTED");
        throw new Error("APPLE_ACCOUNT_EVENT_DATABASE_REJECTED");
      }
      return {
        resultCode: row.result_code as Awaited<
          ReturnType<AppleAccountEventDatabase["apply"]>
        >["resultCode"],
        userId: row.user_id,
        state: row.state,
        generation: row.generation,
      };
    },
  };
}
