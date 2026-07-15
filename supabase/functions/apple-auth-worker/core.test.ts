import type { User } from "jsr:@supabase/supabase-js@2";
import {
  type AppleDeletionNetwork,
  AppleDeletionNetworkError,
} from "../account-deletion/appleDeletionNetwork.ts";
import {
  appleSubjectDigest,
  appleSubjectDigestForVersion,
  loadAppleLifecycleSecrets,
} from "../_shared/appleLifecycleSecrets.ts";
import {
  appleVaultEnvelopeFromBytea,
  appleVaultEnvelopeToBytea,
  loadAppleVaultKeyring,
  openAppleRefreshToken,
  sealAppleRefreshToken,
} from "../_shared/appleVault.ts";
import {
  type AppleAuthWorkerDatabase,
  type AppleValidationClaim,
  processAppleValidationClaim,
  runAppleAuthWorker,
} from "./core.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const USER_ID = "00000000-0000-4000-8000-000000000001";
const APPLE_SUBJECT = "001234.abcdef";
const CLIENT_ID = "com.example.onskin";
const CLAIM_TOKEN = "aa".repeat(32);

function user(subject = APPLE_SUBJECT): User {
  return {
    id: USER_ID,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
    identities: [
      {
        id: "identity",
        user_id: USER_ID,
        provider: "apple",
        identity_data: { sub: subject },
        created_at: "",
        updated_at: "",
        last_sign_in_at: "",
      },
    ],
  } as unknown as User;
}

async function harness() {
  const secrets = await loadAppleLifecycleSecrets(
    (name) =>
      (
        ({
          APPLE_SIWA_SUBJECT_HMAC_CURRENT_VERSION: "h2",
          APPLE_SIWA_SUBJECT_HMAC_KEYS: JSON.stringify({
            h1: "11".repeat(32),
            h2: "12".repeat(32),
          }),
          APPLE_SIWA_CODE_HMAC_KEY_HEX: "22".repeat(32),
          APPLE_SIWA_EVENT_HMAC_KEY_HEX: "33".repeat(32),
        }) as Record<string, string>
      )[name],
  );
  const vault = await loadAppleVaultKeyring(
    (name) =>
      (
        ({
          APPLE_SIWA_VAULT_CURRENT_VERSION: "v2",
          APPLE_SIWA_VAULT_KEYS: JSON.stringify({
            v1: "44".repeat(32),
            v2: "45".repeat(32),
          }),
        }) as Record<string, string>
      )[name],
  );
  const previousVault = await loadAppleVaultKeyring(
    (name) =>
      (
        ({
          APPLE_SIWA_VAULT_CURRENT_VERSION: "v1",
          APPLE_SIWA_VAULT_KEYS: JSON.stringify({
            v1: "44".repeat(32),
            v2: "45".repeat(32),
          }),
        }) as Record<string, string>
      )[name],
  );
  const subjectHmac = await appleSubjectDigestForVersion(
    secrets,
    "h1",
    APPLE_SUBJECT,
  );
  const envelope = await sealAppleRefreshToken({
    keyring: previousVault,
    userId: USER_ID,
    subjectHmac,
    clientId: CLIENT_ID,
    refreshToken: "refresh-token",
  });
  const claim: AppleValidationClaim = {
    userId: USER_ID,
    appleSubjectHmac: subjectHmac,
    subjectHmacKeyVersion: "h1",
    clientId: CLIENT_ID,
    generation: "7",
    encryptedRefreshToken: appleVaultEnvelopeToBytea(envelope),
    vaultKeyVersion: "v1",
    lastValidatedAt: new Date().toISOString(),
  };
  const events: string[] = [];
  const completions: Parameters<AppleAuthWorkerDatabase["complete"]>[0][] = [];
  const database: AppleAuthWorkerDatabase = {
    async claim() {
      events.push("claim");
      return [claim];
    },
    async complete(input) {
      completions.push(input);
      events.push("complete");
      return true;
    },
    async defer(input) {
      events.push(`defer:${input.failureCode}:${input.retryAfterSeconds}`);
      return "deferred";
    },
    async invalidate(input) {
      events.push(`invalidate:${input.failureCode}`);
      return true;
    },
    async purge() {
      events.push("purge");
      return 0;
    },
  };
  const network: AppleDeletionNetwork = {
    async verifyIdentityToken() {},
    async exchangeAuthorizationCode() {
      return { token: "unused", tokenTypeHint: "refresh_token" };
    },
    async validateRefreshToken(token, subject) {
      events.push(`validate:${token}:${subject}`);
    },
    async revokeToken() {
      return { status: 200, body: "", responseBytes: 0 };
    },
  };
  return { claim, completions, database, events, network, secrets, vault };
}

Deno.test("daily Apple validation rotates subject and vault keys before CAS completion", async () => {
  const h = await harness();
  const disposition = await processAppleValidationClaim({
    claim: h.claim,
    claimToken: CLAIM_TOKEN,
    secrets: h.secrets,
    vault: h.vault,
    network: h.network,
    database: h.database,
    loadUser: async () => user(),
  });
  assert(disposition === "validated", "valid token is extended");
  assert(
    h.events.join(",") === `validate:refresh-token:${APPLE_SUBJECT},complete`,
    "plaintext exists only for the exact Apple validation call",
  );
  const completion = h.completions[0];
  assert(completion !== undefined, "rotation completion is captured");
  assert(completion.userId === USER_ID, "rotation is owner-bound");
  assert(
    completion.generation === "7",
    "rotation retains the claimed generation",
  );
  assert(
    completion.claimToken === CLAIM_TOKEN,
    "rotation retains the claim capability",
  );
  assert(
    completion.subjectHmacKeyVersion === "h2",
    "current subject key version is stored",
  );
  assert(
    completion.vaultKeyVersion === "v2",
    "current vault key version is stored",
  );
  assert(
    completion.appleSubjectHmac ===
      await appleSubjectDigest(h.secrets, APPLE_SUBJECT),
    "subject is re-digested with the current key",
  );
  assert(
    completion.encryptedRefreshToken !== h.claim.encryptedRefreshToken,
    "the old envelope is never written back",
  );
  assert(
    await openAppleRefreshToken({
      keyring: h.vault,
      userId: USER_ID,
      subjectHmac: completion.appleSubjectHmac,
      clientId: CLIENT_ID,
      envelope: appleVaultEnvelopeFromBytea(completion.encryptedRefreshToken),
    }) === "refresh-token",
    "the resealed envelope opens only in the current owner and subject context",
  );
});

Deno.test("daily Apple validation always reseals an already-current envelope", async () => {
  const h = await harness();
  await processAppleValidationClaim({
    claim: h.claim,
    claimToken: CLAIM_TOKEN,
    secrets: h.secrets,
    vault: h.vault,
    network: h.network,
    database: h.database,
    loadUser: async () => user(),
  });
  const first = h.completions[0];
  assert(first !== undefined, "first completion exists");

  const disposition = await processAppleValidationClaim({
    claim: {
      ...h.claim,
      appleSubjectHmac: first.appleSubjectHmac,
      subjectHmacKeyVersion: first.subjectHmacKeyVersion,
      encryptedRefreshToken: first.encryptedRefreshToken,
      vaultKeyVersion: first.vaultKeyVersion,
    },
    claimToken: CLAIM_TOKEN,
    secrets: h.secrets,
    vault: h.vault,
    network: h.network,
    database: h.database,
    loadUser: async () => user(),
  });
  const second = h.completions[1];
  assert(
    disposition === "validated" && second !== undefined,
    "current envelope validates",
  );
  assert(
    second.encryptedRefreshToken !== first.encryptedRefreshToken,
    "every successful validation gets a fresh AES-GCM envelope",
  );
  assert(
    second.appleSubjectHmac === first.appleSubjectHmac &&
      second.subjectHmacKeyVersion === first.subjectHmacKeyVersion &&
      second.vaultKeyVersion === first.vaultKeyVersion,
    "already-current key metadata remains exact",
  );
});

Deno.test("definitive Apple invalid_grant blocks access and does not defer", async () => {
  const h = await harness();
  h.network.validateRefreshToken = async () => {
    throw new AppleDeletionNetworkError("APPLE_INVALID_GRANT");
  };
  const disposition = await processAppleValidationClaim({
    claim: h.claim,
    claimToken: CLAIM_TOKEN,
    secrets: h.secrets,
    vault: h.vault,
    network: h.network,
    database: h.database,
    loadUser: async () => user(),
  });
  assert(disposition === "blocked", "invalid grant blocks");
  assert(
    h.events.join(",") === "invalidate:APPLE_INVALID_GRANT",
    h.events.join(","),
  );
});

Deno.test("ambiguous Apple validation is deferred by one full rolling day", async () => {
  for (const code of ["APPLE_NETWORK_FAILED", "APPLE_RATE_LIMITED"] as const) {
    const h = await harness();
    h.network.validateRefreshToken = async () => {
      throw new AppleDeletionNetworkError(code);
    };
    const disposition = await processAppleValidationClaim({
      claim: h.claim,
      claimToken: CLAIM_TOKEN,
      secrets: h.secrets,
      vault: h.vault,
      network: h.network,
      database: h.database,
      loadUser: async () => user(),
    });
    assert(disposition === "deferred", "transient failure defers");
    assert(
      h.events[0]?.endsWith(":86400"),
      "Apple is not called again inside 24 hours",
    );
  }
});

Deno.test("subject mismatch and vault tampering fail closed before Apple network", async () => {
  const mismatch = await harness();
  const mismatchResult = await processAppleValidationClaim({
    claim: mismatch.claim,
    claimToken: CLAIM_TOKEN,
    secrets: mismatch.secrets,
    vault: mismatch.vault,
    network: mismatch.network,
    database: mismatch.database,
    loadUser: async () => user("foreign-subject"),
  });
  assert(mismatchResult === "blocked", "subject mismatch blocks");
  assert(
    mismatch.events.join(",") === "invalidate:APPLE_SUBJECT_MISMATCH",
    mismatch.events.join(","),
  );

  const tampered = await harness();
  const bytes = tampered.claim.encryptedRefreshToken;
  const broken = `${bytes.slice(0, -4)}0000`;
  const vaultResult = await processAppleValidationClaim({
    claim: { ...tampered.claim, encryptedRefreshToken: broken },
    claimToken: CLAIM_TOKEN,
    secrets: tampered.secrets,
    vault: tampered.vault,
    network: tampered.network,
    database: tampered.database,
    loadUser: async () => user(),
  });
  assert(vaultResult === "blocked", "tampered vault blocks");
  assert(
    tampered.events.join(",") === "invalidate:APPLE_VAULT_INVALID",
    tampered.events.join(","),
  );
});

Deno.test("worker summarizes bounded claims and purges finite artifacts", async () => {
  const h = await harness();
  const result = await runAppleAuthWorker({
    claimToken: CLAIM_TOKEN,
    limit: 10,
    secrets: h.secrets,
    vault: h.vault,
    network: h.network,
    database: h.database,
    loadUser: async () => user(),
  });
  assert(result.validated === 1 && result.blocked === 0, "summary");
  assert(h.events.at(-1) === "purge", "finite artifacts purged after work");
});

Deno.test("worker processes claims with bounded five-request concurrency", async () => {
  const h = await harness();
  h.database.claim = async () => Array.from({ length: 12 }, () => h.claim);
  let active = 0;
  let maximum = 0;
  let releaseFirstWave = () => {};
  const firstWave = new Promise<void>((resolve) => {
    releaseFirstWave = resolve;
  });
  h.network.validateRefreshToken = async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    if (maximum === 5) releaseFirstWave();
    await firstWave;
    active -= 1;
  };

  const result = await runAppleAuthWorker({
    claimToken: CLAIM_TOKEN,
    limit: 12,
    secrets: h.secrets,
    vault: h.vault,
    network: h.network,
    database: h.database,
    loadUser: async () => user(),
  });

  assert(result.validated === 12, "every bounded claim is processed");
  assert(
    maximum === 5,
    `expected five concurrent provider calls, received ${maximum}`,
  );
  assert(active === 0, "no provider call remains in flight");
});
