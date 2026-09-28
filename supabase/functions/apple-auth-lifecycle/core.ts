import type { User } from "jsr:@supabase/supabase-js@2";
import {
  type AppleDeletionNetwork,
  AppleDeletionNetworkError,
} from "../account-deletion/appleDeletionNetwork.ts";
import type { AppleTokenExchangeResult } from "../account-deletion/appleDeletionNetwork.ts";
import {
  appleCodeDigest,
  type AppleLifecycleSecrets,
  appleSubjectDigestForVersion,
} from "../_shared/appleLifecycleSecrets.ts";
import {
  appleVaultEnvelopeToBytea,
  type AppleVaultKeyring,
  sealAppleRefreshToken,
} from "../_shared/appleVault.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AppleAuthCapture = Readonly<{
  action: "capture";
  appleUser: string;
  authorizationCode: string;
  identityToken: string;
  nonce: string;
}>;

export type AppleCredentialInvalidation = Readonly<{
  action: "credential_invalid";
  appleUser: string;
  reason: "not_found" | "revoked" | "transferred";
}>;

export type AppleAuthLifecycleRequest =
  | AppleAuthCapture
  | AppleCredentialInvalidation;

export type AppleAuthLifecycleDatabase = {
  begin(input: {
    operationId: string;
    userId: string;
    sessionId: string;
    appleSubject: string;
    appleSubjectHmacs: readonly string[];
    subjectHmacKeyVersions: readonly string[];
    codeHmac: string;
    clientId: string;
  }): Promise<
    | "reserved"
    | "exchange_started"
    | "succeeded"
    | "failed"
    | "expired"
    | "blocked"
  >;
  markExchangeStarted(
    operationId: string,
    userId: string,
    sessionId: string,
  ): Promise<boolean>;
  complete(input: {
    operationId: string;
    userId: string;
    sessionId: string;
    encryptedRefreshToken: string;
    vaultKeyVersion: string;
  }): Promise<
    { state: "active"; generation: number | string; nextValidationAt: string }
  >;
  fail(operationId: string, userId: string, failureCode: string): Promise<void>;
  invalidate(input: {
    userId: string;
    sessionId: string;
    appleSubject: string;
    failureCode:
      | "APPLE_NATIVE_CREDENTIAL_INVALID"
      | "APPLE_NATIVE_CREDENTIAL_TRANSFERRED";
  }): Promise<boolean>;
};

export class AppleAuthLifecycleError extends Error {
  constructor(
    readonly code:
      | "APPLE_AUTH_CAPTURE_AMBIGUOUS"
      | "APPLE_AUTH_CAPTURE_INVALID"
      | "APPLE_AUTH_CAPTURE_REJECTED"
      | "APPLE_AUTH_IDENTITY_REJECTED"
      | "APPLE_AUTH_PROVIDER_FAILED"
      | "APPLE_AUTH_VAULT_FAILED",
    readonly status: 400 | 409 | 502 | 503,
  ) {
    super(code);
    this.name = "AppleAuthLifecycleError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
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

export function parseAppleAuthLifecycleRequest(
  value: unknown,
): AppleAuthLifecycleRequest | null {
  if (!isRecord(value) || typeof value.action !== "string") return null;
  if (value.action === "capture") {
    if (
      !exactKeys(value, [
        "action",
        "appleUser",
        "authorizationCode",
        "identityToken",
        "nonce",
      ]) ||
      !bounded(value.appleUser, 512) ||
      !bounded(value.authorizationCode, 4_096) ||
      !bounded(value.identityToken, 16_384) ||
      typeof value.nonce !== "string" ||
      !NONCE_PATTERN.test(value.nonce)
    ) {
      return null;
    }
    return value as unknown as AppleAuthCapture;
  }
  if (
    value.action === "credential_invalid" &&
    exactKeys(value, ["action", "appleUser", "reason"]) &&
    bounded(value.appleUser, 512) &&
    (value.reason === "not_found" || value.reason === "revoked" ||
      value.reason === "transferred")
  ) {
    return value as unknown as AppleCredentialInvalidation;
  }
  return null;
}

export function exactAppleIdentitySubject(
  user: User,
  expectedSubject: string,
): string | null {
  const subjects = (user.identities ?? [])
    .filter((identity) => identity.provider === "apple")
    .map((identity) => {
      const data = isRecord(identity.identity_data)
        ? identity.identity_data
        : {};
      return bounded(data.sub, 512) ? data.sub : null;
    })
    .filter((subject): subject is string => subject !== null);
  return subjects.length === 1 && subjects[0] === expectedSubject
    ? subjects[0]
    : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function providerFailure(error: unknown): AppleAuthLifecycleError {
  if (error instanceof AppleDeletionNetworkError) {
    return new AppleAuthLifecycleError("APPLE_AUTH_PROVIDER_FAILED", 502);
  }
  return new AppleAuthLifecycleError("APPLE_AUTH_CAPTURE_AMBIGUOUS", 503);
}

function requireRefreshToken(exchange: AppleTokenExchangeResult): string {
  if (
    exchange.tokenTypeHint !== "refresh_token" ||
    !bounded(exchange.token, 4_096)
  ) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_PROVIDER_FAILED", 502);
  }
  return exchange.token;
}

export async function captureAppleCredential(options: {
  request: AppleAuthCapture;
  user: User;
  sessionId: string;
  clientId: string;
  secrets: AppleLifecycleSecrets;
  vault: AppleVaultKeyring;
  network: AppleDeletionNetwork;
  database: AppleAuthLifecycleDatabase;
  operationId?: string;
}): Promise<
  { status: "active"; generation: number | string; nextValidationAt: string }
> {
  if (
    !UUID_PATTERN.test(options.user.id) || !UUID_PATTERN.test(options.sessionId)
  ) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_CAPTURE_REJECTED", 409);
  }
  const subject = exactAppleIdentitySubject(
    options.user,
    options.request.appleUser,
  );
  if (subject === null) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_IDENTITY_REJECTED", 409);
  }
  const operationId = options.operationId ?? crypto.randomUUID();
  if (!UUID_PATTERN.test(operationId)) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_CAPTURE_INVALID", 400);
  }
  const expectedNonce = await sha256Hex(options.request.nonce);
  try {
    await options.network.verifyIdentityToken(
      options.request.identityToken,
      subject,
      expectedNonce,
    );
  } catch (error) {
    throw providerFailure(error);
  }

  const subjectHmacKeyVersions = [
    options.secrets.subjectKeyVersion,
    ...[...options.secrets.subjectKeys.keys()].filter(
      (version) => version !== options.secrets.subjectKeyVersion,
    ),
  ];
  const [subjectHmacs, codeHmac] = await Promise.all([
    Promise.all(
      subjectHmacKeyVersions.map((version) =>
        appleSubjectDigestForVersion(options.secrets, version, subject)
      ),
    ),
    appleCodeDigest(options.secrets, options.request.authorizationCode),
  ]);
  const subjectHmac = subjectHmacs[0];
  const beginState = await options.database.begin({
    operationId,
    userId: options.user.id,
    sessionId: options.sessionId,
    appleSubject: subject,
    appleSubjectHmacs: subjectHmacs,
    subjectHmacKeyVersions,
    codeHmac,
    clientId: options.clientId,
  });
  if (beginState !== "reserved") {
    throw new AppleAuthLifecycleError("APPLE_AUTH_CAPTURE_REJECTED", 409);
  }
  if (
    !(await options.database.markExchangeStarted(
      operationId,
      options.user.id,
      options.sessionId,
    ))
  ) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_CAPTURE_REJECTED", 409);
  }

  let refreshToken = "";
  try {
    refreshToken = requireRefreshToken(
      await options.network.exchangeAuthorizationCode(
        options.request.authorizationCode,
        subject,
      ),
    );
    const envelope = await sealAppleRefreshToken({
      keyring: options.vault,
      userId: options.user.id,
      subjectHmac,
      clientId: options.clientId,
      refreshToken,
    });
    const completed = await options.database.complete({
      operationId,
      userId: options.user.id,
      sessionId: options.sessionId,
      encryptedRefreshToken: appleVaultEnvelopeToBytea(envelope),
      vaultKeyVersion: options.vault.currentVersion,
    });
    return {
      status: "active",
      generation: completed.generation,
      nextValidationAt: completed.nextValidationAt,
    };
  } catch (error) {
    await options.database
      .fail(operationId, options.user.id, "APPLE_AUTH_CAPTURE_AMBIGUOUS")
      .catch(() => undefined);
    if (error instanceof AppleAuthLifecycleError) throw error;
    throw providerFailure(error);
  } finally {
    refreshToken = "";
  }
}

export async function invalidateAppleCredential(options: {
  request: AppleCredentialInvalidation;
  user: User;
  sessionId: string;
  database: AppleAuthLifecycleDatabase;
}): Promise<{ status: "blocked" }> {
  const subject = exactAppleIdentitySubject(
    options.user,
    options.request.appleUser,
  );
  if (subject === null) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_IDENTITY_REJECTED", 409);
  }
  const failureCode = options.request.reason === "transferred"
    ? "APPLE_NATIVE_CREDENTIAL_TRANSFERRED"
    : "APPLE_NATIVE_CREDENTIAL_INVALID";
  if (
    !(await options.database.invalidate({
      userId: options.user.id,
      sessionId: options.sessionId,
      appleSubject: subject,
      failureCode,
    }))
  ) {
    throw new AppleAuthLifecycleError("APPLE_AUTH_CAPTURE_REJECTED", 409);
  }
  return { status: "blocked" };
}
