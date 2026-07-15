import {
  appleEventJtiDigest,
  appleEventPayloadDigest,
  type AppleLifecycleSecrets,
  appleRelayEmailDigest,
  appleSubjectDigestForVersion,
} from "../_shared/appleLifecycleSecrets.ts";
import type { AppleServerEventClaims } from "./verifier.ts";

export type AppleAccountEventDatabase = {
  apply(input: {
    jtiHmac: string;
    payloadHmac: string;
    appleSubjectHmacs: readonly string[];
    subjectHmacKeyVersions: readonly string[];
    appleSubject: string | null;
    clientId: string;
    eventType: AppleServerEventClaims["eventType"];
    eventAt: string;
    relayEmailHmac: string | null;
  }): Promise<{
    resultCode:
      | "applied"
      | "duplicate"
      | "ignored_unknown"
      | "stale"
      | "unknown_subject";
    userId: string | null;
    state: string | null;
    generation: number | string | null;
  }>;
};

export function parseAppleAccountEventEnvelope(value: unknown): string | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "payload")
  ) {
    return null;
  }
  const payload = (value as { payload?: unknown }).payload;
  return typeof payload === "string" && payload.length > 0 &&
      payload.length <= 32_768
    ? payload
    : null;
}

export async function persistVerifiedAppleAccountEvent(options: {
  compactJws: string;
  claims: AppleServerEventClaims;
  secrets: AppleLifecycleSecrets;
  database: AppleAccountEventDatabase;
}) {
  const versions = [
    options.secrets.subjectKeyVersion,
    ...[...options.secrets.subjectKeys.keys()].filter(
      (version) => version !== options.secrets.subjectKeyVersion,
    ),
  ];
  const [jtiHmac, payloadHmac, relayEmailHmac, ...appleSubjectHmacs] =
    await Promise.all([
      appleEventJtiDigest(options.secrets, options.claims.jti),
      appleEventPayloadDigest(options.secrets, options.compactJws),
      options.claims.relayEmail
        ? appleRelayEmailDigest(options.secrets, options.claims.relayEmail)
        : Promise.resolve(null),
      ...versions.map((version) =>
        appleSubjectDigestForVersion(
          options.secrets,
          version,
          options.claims.subject,
        )
      ),
    ]);
  return await options.database.apply({
    jtiHmac,
    payloadHmac,
    appleSubjectHmacs,
    subjectHmacKeyVersions: versions,
    appleSubject: options.claims.eventType === "consent-revoked" ||
        options.claims.eventType === "account-deleted"
      ? options.claims.subject
      : null,
    clientId: options.claims.audience,
    eventType: options.claims.eventType,
    eventAt: new Date(options.claims.eventAtSeconds * 1_000).toISOString(),
    relayEmailHmac,
  });
}
