# Account deletion recovery and residual-risk gate

The durable order is `revenuecat -> posthog -> storage -> database -> sessions -> apple -> providers_final -> auth`. The `auth.users` `BEFORE DELETE` guard admits only an unexpired worker lease already at `auth`; every lease grant, renewal, and decision uses PostgreSQL wall-clock `clock_timestamp()` so lock waits cannot retain transaction-start time. Its `AFTER DELETE` trigger atomically converts the row to a content-free completion receipt.

## Normal retry

1. Retry from the same signed-in device session that initiated deletion. The request is durably bound to the verified JWT `session_id`; a different session fails with `ACCOUNT_DELETION_SESSION_MISMATCH`.
2. For an Apple-linked account, obtain a new authorization code for every retry. Never persist, log, or send that code through a support ticket.
3. Before invoking Edge, the mobile client persists a strict-versioned, owner-hashed deletion receipt with a random 256-bit completion capability. That receipt synchronously blocks RevenueCat and PostHog writes across force-quit/relaunch. PostHog queue discard/drain and RevenueCat's ordered native configure fence plus logout are bounded, fail-closed prerequisites; Edge is not invoked if either cannot be verified. The receipt is removed only after terminal backend proof, auth-js local-session invalidation, and the final local account-boundary cleanup all succeed. Edge revokes only the other Supabase sessions, preserving the initiating session and its refresh-token rotation until final auth deletion.
4. The claim re-reads `auth.identities` under the account advisory lock. A durable `apple_required=true` value or a current Apple identity without a fresh code fails before claim/recovery state can advance.
5. After Apple revocation, the worker deletes RevenueCat and PostHog again before the guarded auth delete. Provider failures remain retryable and never skip auth ordering.

If the guarded `auth.users` delete commits but the final Edge response is lost, the device may query `account_deletion_completion_status(text)` with the domain-hashed completion capability. This is the sole anonymous `SECURITY DEFINER` capability RPC: it accepts only a 256-bit digest, returns only an already-terminal content-free receipt, and cannot create, advance, or rebind deletion. The raw capability is device-local, is never logged or exported, and remains persisted until cleanup succeeds. AuthProvider invalidates the restored auth-js session through public local sign-out before direct storage verification, closing an in-flight refresh-token resurrection race.

Do not manually advance `next_step`, clear a lease, null `user_id`, or call `auth.admin.deleteUser` out of order. Those operations either fail closed or destroy the evidence needed for safe recovery.

Disposable live-test users are subject to the same guard. Repository harness cleanup uses the authenticated `account-deletion` path and its configured provider dependencies; do not add a production guard bypass for test metadata. Until that cleanup is proven in disposable staging, a residual fixture that cannot complete the path is an explicit staging-hygiene blocker rather than permission to call `auth.admin.deleteUser` directly.

## Service-role incident procedure

Use service-role access only to inspect `request_id`, `next_step`, lease expiry, completion timestamps, and the stable error code. Never copy provider payloads, access/refresh tokens, Apple codes, raw click tokens, or deleted user content into an incident record.

If the initiating session still exists, have the user retry from that session after the lease expires. If it no longer exists or cannot refresh, stop and escalate to engineering/privacy operations. There is intentionally no shipped endpoint that rebinds a deletion to another session and no general service-role runner that accepts an Apple code: either would create an account-takeover/deletion primitive. Recovery in that condition is an explicitly unsupported residual and must not be improvised with ledger edits. It requires an audited, narrowly scoped incident tool and privacy approval before launch can claim unattended recovery for that case.

## Hosted Supabase compatibility gate

Migration `20260713000043_account_deletion_resumable.sql` places triggers on Supabase-managed `auth.users`, `auth.identities`, `auth.sessions`, and `auth.refresh_tokens`. This is the strongest local boundary because Supabase does not provide a documented pre-identity-link hook, but managed Auth schema/GoTrue behavior is an external compatibility surface.

Before production rollout, apply the migration to a disposable staging project matching production and prove:

- the initiating session can refresh, including refresh-token `INSERT` and `UPDATE` rotation paths;
- another session cannot be created/refreshed and an identity cannot be linked/recreated after claim;
- `signOut(token, 'others')` can delete or revoke every other session/token;
- direct or delayed admin auth deletion fails before `auth` or after lease expiry;
- the ready worker can delete the user and atomically retain the complete receipt;
- a saved pre-delete access JWT cannot insert owner rows or upload a `photos` object after the terminal receipt nulls `user_id`; the retained `user_lookup_hash` tombstone must continue denying writes;
- a lost final Edge response can be reconciled with the anonymous terminal capability without replaying Apple authorization or any deletion action;
- Apple false-current-metadata versus durable-true metadata fails before claim without a fresh code.

Any hosted schema error, GoTrue regression, or inability to run these tests is a release blocker. Revalidate after Supabase Auth upgrades.

## External provider residual

RevenueCat and PostHog do not expose an account-scoped write lock that Layerwell can enforce. Mobile freezes the initiating client, other Supabase sessions are revoked, database webhook/projection paths suppress tombstoned identities, and a final provider delete narrows the race. A provider event accepted independently after that final delete remains an external residual. Production evidence must confirm provider deletion behavior and retention settings; do not describe this as a cryptographic provider-write freeze.
