import { readLimitedResponseTextWithByteLength } from "../_shared/fetch.ts";

const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const JWT_MAX_BYTES = 32_768;
const JWT_PART_MAX_BYTES = 16_384;
const JWT_SIGNATURE_MAX_BYTES = 1_024;
const JWKS_CACHE_TTL_MS = 300_000;
const EVENT_TYPES = [
  "email-enabled",
  "email-disabled",
  "consent-revoked",
  "account-deleted",
] as const;

export type KnownAppleServerEventType = (typeof EVENT_TYPES)[number];
export type AppleServerEventClaims = Readonly<{
  audience: string;
  eventAtSeconds: number;
  eventType: KnownAppleServerEventType | "unknown";
  issuer: "https://appleid.apple.com";
  issuedAtSeconds: number;
  jti: string;
  rawEventType: string;
  relayEmail: string | null;
  subject: string;
}>;

export type AppleEventFetch = (
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number,
) => Promise<Response>;

export class AppleServerEventVerificationError extends Error {
  constructor() {
    super("APPLE_SERVER_EVENT_REJECTED");
    this.name = "AppleServerEventVerificationError";
  }
}

function reject(): never {
  throw new AppleServerEventVerificationError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function bounded(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function binary(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8_192)));
  }
  return chunks.join("");
}

function base64Url(bytes: Uint8Array): string {
  return btoa(binary(bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(
    /=+$/u,
    "",
  );
}

function decodeBase64Url(
  value: string,
  maximumBytes: number,
): Uint8Array<ArrayBuffer> {
  if (
    value.length === 0 ||
    value.length % 4 === 1 ||
    value.length > maximumBytes * 2 ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    return reject();
  }
  try {
    const standard = value.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(
      standard + "=".repeat((4 - (standard.length % 4)) % 4),
    );
    const bytes = Uint8Array.from(
      decoded,
      (character) => character.charCodeAt(0),
    );
    if (
      bytes.byteLength === 0 || bytes.byteLength > maximumBytes ||
      base64Url(bytes) !== value
    ) {
      return reject();
    }
    return bytes;
  } catch {
    return reject();
  }
}

function jsonPart(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        decodeBase64Url(value, JWT_PART_MAX_BYTES),
      ),
    ) as unknown;
    return isRecord(parsed) ? parsed : reject();
  } catch (error) {
    if (error instanceof AppleServerEventVerificationError) throw error;
    return reject();
  }
}

function verificationJwk(value: unknown, keyId: string): JsonWebKey {
  if (
    !isRecord(value) || !Array.isArray(value.keys) || value.keys.length > 64
  ) return reject();
  const matches = value.keys.filter((candidate) =>
    isRecord(candidate) && candidate.kid === keyId
  );
  if (matches.length !== 1) return reject();
  const key = matches[0];
  if (
    key.kty !== "RSA" ||
    key.alg !== "RS256" ||
    key.use !== "sig" ||
    !bounded(key.n, 4_096) ||
    !bounded(key.e, 128) ||
    !/^[A-Za-z0-9_-]+$/u.test(key.n) ||
    !/^[A-Za-z0-9_-]+$/u.test(key.e)
  ) {
    return reject();
  }
  return {
    kty: "RSA",
    alg: "RS256",
    use: "sig",
    n: key.n,
    e: key.e,
    ext: true,
  };
}

function parseClaims(
  value: Record<string, unknown>,
  clientId: string,
  nowSeconds: number,
): AppleServerEventClaims {
  if (!exactKeys(value, ["iss", "aud", "iat", "jti", "events"])) {
    return reject();
  }
  const events = value.events;
  if (
    value.iss !== "https://appleid.apple.com" ||
    value.aud !== clientId ||
    typeof value.iat !== "number" ||
    !Number.isSafeInteger(value.iat) ||
    value.iat > nowSeconds + 300 ||
    value.iat < nowSeconds - 86_400 ||
    !bounded(value.jti, 512) ||
    !isRecord(events) ||
    !bounded(events.type, 64) ||
    !/^[a-z0-9-]+$/u.test(events.type) ||
    !bounded(events.sub, 512) ||
    typeof events.event_time !== "number" ||
    !Number.isSafeInteger(events.event_time) ||
    events.event_time > nowSeconds + 300 ||
    events.event_time < nowSeconds - 2_592_000
  ) {
    return reject();
  }
  const known = EVENT_TYPES.includes(events.type as KnownAppleServerEventType);
  let relayEmail: string | null = null;
  if (events.type === "email-enabled" || events.type === "email-disabled") {
    if (
      !exactKeys(events, [
        "type",
        "sub",
        "email",
        "is_private_email",
        "event_time",
      ]) ||
      !bounded(events.email, 320) ||
      !events.email.includes("@") ||
      (events.is_private_email !== "true" &&
        events.is_private_email !== "false")
    ) {
      return reject();
    }
    relayEmail = events.email;
  } else if (known) {
    if (!exactKeys(events, ["type", "sub", "event_time"])) return reject();
  } else {
    // Forward-compatible unknown events are quarantined after signature and
    // base-claim validation. Bound the flat extension surface; never interpret
    // it as activation or account state.
    if (
      Object.keys(events).length > 8 ||
      Object.values(events).some(
        (candidate) =>
          !(
            candidate === null ||
            typeof candidate === "string" ||
            typeof candidate === "number" ||
            typeof candidate === "boolean"
          ),
      )
    ) {
      return reject();
    }
  }
  return Object.freeze({
    audience: clientId,
    eventAtSeconds: events.event_time,
    eventType: known ? (events.type as KnownAppleServerEventType) : "unknown",
    issuer: "https://appleid.apple.com",
    issuedAtSeconds: value.iat,
    jti: value.jti,
    rawEventType: events.type,
    relayEmail,
    subject: events.sub,
  });
}

export async function createAppleServerEventVerifier(options: {
  clientId: string;
  fetcher: AppleEventFetch;
  now: () => number;
  timeoutMs: number;
  maxResponseBytes: number;
}): Promise<(compactJws: string) => Promise<AppleServerEventClaims>> {
  if (
    !bounded(options.clientId, 255) ||
    typeof options.fetcher !== "function" ||
    typeof options.now !== "function" ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 100 ||
    options.timeoutMs > 30_000 ||
    !Number.isSafeInteger(options.maxResponseBytes) ||
    options.maxResponseBytes < 1_024 ||
    options.maxResponseBytes > 32_768
  ) {
    return reject();
  }
  type JwksSnapshot = Readonly<{
    body: unknown;
    imported: Map<string, Promise<CryptoKey>>;
  }>;
  let snapshotPromise: Promise<JwksSnapshot> | null = null;
  let snapshotExpiresAtMs = 0;

  function snapshot(nowMs: number): Promise<JwksSnapshot> {
    if (snapshotPromise !== null && nowMs < snapshotExpiresAtMs) {
      return snapshotPromise;
    }
    let pending: Promise<JwksSnapshot>;
    pending = (async () => {
      let response: Response;
      try {
        response = await options.fetcher(
          APPLE_KEYS_URL,
          {
            method: "GET",
            redirect: "error",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-store",
            },
          },
          options.timeoutMs,
        );
      } catch {
        return reject();
      }
      const boundedBody = await readLimitedResponseTextWithByteLength(
        response,
        options.maxResponseBytes,
      );
      if (response.status !== 200 || boundedBody === null) return reject();
      let body: unknown;
      try {
        body = JSON.parse(boundedBody.text) as unknown;
      } catch {
        return reject();
      }
      if (
        !isRecord(body) || !Array.isArray(body.keys) || body.keys.length === 0
      ) return reject();
      return Object.freeze({
        body,
        imported: new Map<string, Promise<CryptoKey>>(),
      });
    })().catch((error: unknown) => {
      if (snapshotPromise === pending) {
        snapshotPromise = null;
        snapshotExpiresAtMs = 0;
      }
      throw error;
    });
    snapshotPromise = pending;
    snapshotExpiresAtMs = nowMs + JWKS_CACHE_TTL_MS;
    return pending;
  }

  async function keyFor(keyId: string, nowMs: number): Promise<CryptoKey> {
    const current = await snapshot(nowMs);
    const cached = current.imported.get(keyId);
    if (cached) return await cached;
    const pending = (async () => {
      try {
        return await crypto.subtle.importKey(
          "jwk",
          verificationJwk(current.body, keyId),
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          false,
          ["verify"],
        );
      } catch (error) {
        if (error instanceof AppleServerEventVerificationError) throw error;
        return reject();
      }
    })();
    current.imported.set(keyId, pending);
    return await pending;
  }

  return async (compactJws) => {
    const nowMs = options.now();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return reject();
    if (
      typeof compactJws !== "string" ||
      compactJws.length === 0 ||
      compactJws.length > JWT_MAX_BYTES ||
      compactJws !== compactJws.trim()
    ) {
      return reject();
    }
    const parts = compactJws.split(".");
    if (parts.length !== 3) return reject();
    const header = jsonPart(parts[0]);
    if (
      !(exactKeys(header, ["alg", "kid"]) ||
        exactKeys(header, ["alg", "kid", "typ"])) ||
      header.alg !== "RS256" ||
      !bounded(header.kid, 255) ||
      (Object.hasOwn(header, "typ") && header.typ !== "JWT")
    ) {
      return reject();
    }
    const claims = parseClaims(
      jsonPart(parts[1]),
      options.clientId,
      Math.floor(nowMs / 1_000),
    );
    const signature = decodeBase64Url(parts[2], JWT_SIGNATURE_MAX_BYTES);
    let verified = false;
    try {
      verified = await crypto.subtle.verify(
        { name: "RSASSA-PKCS1-v1_5" },
        await keyFor(header.kid, nowMs),
        signature,
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
      );
    } catch {
      return reject();
    }
    return verified ? claims : reject();
  };
}
