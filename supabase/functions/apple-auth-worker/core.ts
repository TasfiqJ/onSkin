import type { User } from "jsr:@supabase/supabase-js@2";
import {
  type AppleDeletionNetwork,
  AppleDeletionNetworkError,
} from "../account-deletion/appleDeletionNetwork.ts";
import {
  AppleLifecycleSecretError,
  type AppleLifecycleSecrets,
  appleSubjectDigest,
  appleSubjectDigestForVersion,
} from "../_shared/appleLifecycleSecrets.ts";
import {
  appleVaultEnvelopeFromBytea,
  appleVaultEnvelopeToBytea,
  AppleVaultError,
  type AppleVaultKeyring,
  openAppleRefreshToken,
  sealAppleRefreshToken,
} from "../_shared/appleVault.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HMAC_PATTERN = /^[a-f0-9]{64}$/;
const APPLE_AUTH_WORKER_CONCURRENCY = 5;

export type AppleValidationClaim = Readonly<{
  userId: string;
  appleSubjectHmac: string;
  subjectHmacKeyVersion: string;
  clientId: string;
  generation: number | string;
  encryptedRefreshToken: string;
  vaultKeyVersion: string;
  lastValidatedAt: string;
}>;

export type AppleAuthWorkerDatabase = {
  claim(
    claimToken: string,
    limit: number,
  ): Promise<readonly AppleValidationClaim[]>;
  complete(input: {
    userId: string;
    generation: number | string;
    claimToken: string;
    appleSubjectHmac: string;
    subjectHmacKeyVersion: string;
    encryptedRefreshToken: string;
    vaultKeyVersion: string;
  }): Promise<boolean>;
  defer(input: {
    userId: string;
    generation: number | string;
    claimToken: string;
    failureCode:
      | "APPLE_VALIDATION_NETWORK_FAILED"
      | "APPLE_VALIDATION_RATE_LIMITED";
    retryAfterSeconds: number;
  }): Promise<"blocked" | "deferred" | "stale">;
  invalidate(input: {
    userId: string;
    generation: number | string;
    claimToken: string;
    failureCode:
      | "APPLE_INVALID_GRANT"
      | "APPLE_SUBJECT_MISMATCH"
      | "APPLE_TOKEN_RESPONSE_INVALID"
      | "APPLE_VAULT_INVALID";
  }): Promise<boolean>;
  purge(limit: number): Promise<number>;
};

export type AppleAuthUserLoader = (userId: string) => Promise<User | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function appleSubject(user: User): string | null {
  const subjects = (user.identities ?? [])
    .filter((identity) => identity.provider === "apple")
    .map((identity) => {
      const data = isRecord(identity.identity_data)
        ? identity.identity_data
        : {};
      return bounded(data.sub, 512) ? data.sub : null;
    })
    .filter((subject): subject is string => subject !== null);
  return subjects.length === 1 ? subjects[0] : null;
}

function validClaim(claim: AppleValidationClaim): boolean {
  return (
    UUID_PATTERN.test(claim.userId) &&
    HMAC_PATTERN.test(claim.appleSubjectHmac) &&
    bounded(claim.subjectHmacKeyVersion, 64) &&
    bounded(claim.clientId, 255) &&
    (typeof claim.generation === "string" ||
      Number.isSafeInteger(claim.generation)) &&
    bounded(claim.encryptedRefreshToken, 16_386) &&
    bounded(claim.vaultKeyVersion, 64) &&
    !Number.isNaN(Date.parse(claim.lastValidatedAt))
  );
}

export async function processAppleValidationClaim(options: {
  claim: AppleValidationClaim;
  claimToken: string;
  secrets: AppleLifecycleSecrets;
  vault: AppleVaultKeyring;
  network: AppleDeletionNetwork;
  database: AppleAuthWorkerDatabase;
  loadUser: AppleAuthUserLoader;
}): Promise<"blocked" | "deferred" | "stale" | "validated"> {
  if (!validClaim(options.claim)) return "stale";
  const user = await options.loadUser(options.claim.userId).catch(() => null);
  const subject = user ? appleSubject(user) : null;
  if (subject === null) {
    const invalidated = await options.database.invalidate({
      userId: options.claim.userId,
      generation: options.claim.generation,
      claimToken: options.claimToken,
      failureCode: "APPLE_SUBJECT_MISMATCH",
    });
    return invalidated ? "blocked" : "stale";
  }
  let expectedSubjectHmac: string;
  try {
    expectedSubjectHmac = await appleSubjectDigestForVersion(
      options.secrets,
      options.claim.subjectHmacKeyVersion,
      subject,
    );
  } catch {
    const invalidated = await options.database.invalidate({
      userId: options.claim.userId,
      generation: options.claim.generation,
      claimToken: options.claimToken,
      failureCode: "APPLE_VAULT_INVALID",
    });
    return invalidated ? "blocked" : "stale";
  }
  if (expectedSubjectHmac !== options.claim.appleSubjectHmac) {
    const invalidated = await options.database.invalidate({
      userId: options.claim.userId,
      generation: options.claim.generation,
      claimToken: options.claimToken,
      failureCode: "APPLE_SUBJECT_MISMATCH",
    });
    return invalidated ? "blocked" : "stale";
  }

  let refreshToken = "";
  try {
    refreshToken = await openAppleRefreshToken({
      keyring: options.vault,
      userId: options.claim.userId,
      subjectHmac: options.claim.appleSubjectHmac,
      clientId: options.claim.clientId,
      envelope: appleVaultEnvelopeFromBytea(
        options.claim.encryptedRefreshToken,
      ),
    });
  } catch (error) {
    if (!(error instanceof AppleVaultError)) throw error;
    const invalidated = await options.database.invalidate({
      userId: options.claim.userId,
      generation: options.claim.generation,
      claimToken: options.claimToken,
      failureCode: "APPLE_VAULT_INVALID",
    });
    return invalidated ? "blocked" : "stale";
  }

  try {
    await options.network.validateRefreshToken(refreshToken, subject);
    try {
      // Re-derive and re-seal on every successful validation, even when both
      // stored versions are already current. One uniform completion payload
      // avoids a metadata-only fast path and gives every vault a fresh nonce.
      const currentSubjectHmac = await appleSubjectDigest(
        options.secrets,
        subject,
      );
      const currentEnvelope = await sealAppleRefreshToken({
        keyring: options.vault,
        userId: options.claim.userId,
        subjectHmac: currentSubjectHmac,
        clientId: options.claim.clientId,
        refreshToken,
      });
      return (await options.database.complete({
          userId: options.claim.userId,
          generation: options.claim.generation,
          claimToken: options.claimToken,
          appleSubjectHmac: currentSubjectHmac,
          subjectHmacKeyVersion: options.secrets.subjectKeyVersion,
          encryptedRefreshToken: appleVaultEnvelopeToBytea(currentEnvelope),
          vaultKeyVersion: options.vault.currentVersion,
        }))
        ? "validated"
        : "stale";
    } catch (error) {
      if (
        !(error instanceof AppleVaultError) &&
        !(error instanceof AppleLifecycleSecretError)
      ) {
        throw error;
      }
      const invalidated = await options.database.invalidate({
        userId: options.claim.userId,
        generation: options.claim.generation,
        claimToken: options.claimToken,
        failureCode: "APPLE_VAULT_INVALID",
      });
      return invalidated ? "blocked" : "stale";
    }
  } catch (error) {
    if (error instanceof AppleDeletionNetworkError) {
      if (error.code === "APPLE_INVALID_GRANT") {
        return (await options.database.invalidate({
            userId: options.claim.userId,
            generation: options.claim.generation,
            claimToken: options.claimToken,
            failureCode: "APPLE_INVALID_GRANT",
          }))
          ? "blocked"
          : "stale";
      }
      if (error.code === "APPLE_TOKEN_RESPONSE_INVALID") {
        return (await options.database.invalidate({
            userId: options.claim.userId,
            generation: options.claim.generation,
            claimToken: options.claimToken,
            failureCode: "APPLE_TOKEN_RESPONSE_INVALID",
          }))
          ? "blocked"
          : "stale";
      }
      return await options.database.defer({
        userId: options.claim.userId,
        generation: options.claim.generation,
        claimToken: options.claimToken,
        failureCode: error.code === "APPLE_RATE_LIMITED"
          ? "APPLE_VALIDATION_RATE_LIMITED"
          : "APPLE_VALIDATION_NETWORK_FAILED",
        // An ambiguous Apple response is never retried inside the same rolling
        // day. Access remains bounded by the database's 72-hour ceiling.
        retryAfterSeconds: 86_400,
      });
    }
    return await options.database.defer({
      userId: options.claim.userId,
      generation: options.claim.generation,
      claimToken: options.claimToken,
      failureCode: "APPLE_VALIDATION_NETWORK_FAILED",
      retryAfterSeconds: 86_400,
    });
  } finally {
    refreshToken = "";
  }
}

export async function runAppleAuthWorker(options: {
  claimToken: string;
  limit: number;
  secrets: AppleLifecycleSecrets;
  vault: AppleVaultKeyring;
  network: AppleDeletionNetwork;
  database: AppleAuthWorkerDatabase;
  loadUser: AppleAuthUserLoader;
}): Promise<
  { blocked: number; deferred: number; stale: number; validated: number }
> {
  const result = { blocked: 0, deferred: 0, stale: 0, validated: 0 };
  const claims = await options.database.claim(
    options.claimToken,
    options.limit,
  );
  for (
    let offset = 0;
    offset < claims.length;
    offset += APPLE_AUTH_WORKER_CONCURRENCY
  ) {
    const dispositions = await Promise.all(
      claims
        .slice(offset, offset + APPLE_AUTH_WORKER_CONCURRENCY)
        .map((claim) => processAppleValidationClaim({ ...options, claim })),
    );
    for (const disposition of dispositions) result[disposition] += 1;
  }
  await options.database.purge(100);
  return result;
}
