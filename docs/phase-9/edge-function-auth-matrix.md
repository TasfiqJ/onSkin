# Phase 9 Edge Function Auth Matrix

| Function | Mode | Required proof |
| --- | --- | --- |
| `account-deletion` | Mixed boundary; POST only; gateway JWT off | `begin` and `preflight` verify an exact Supabase bearer/session and derive the owner from Auth; `status` requires an opaque 256-bit capability; `work` requires the independent constant-time `x-account-deletion-worker-secret`. Gateway JWT is off only because one handler serves these four lanes. Apple revocation may reuse only the owner/session-bound encrypted lifecycle vault. The one-minute Vault-backed worker is authoritative; `waitUntil` is an accelerator. |
| `apple-account-events` | Apple-signed public ingress; POST only; gateway JWT off | Apple cannot present a Supabase JWT. Accept only `application/json` with exact `{payload:"<compact JWS>"}`; verify Apple's RS256 signature against bounded cached JWKS, exact issuer and `APPLE_SIWA_CLIENT_ID` audience, clocks, JTI, event schema, and subject. Persist keyed digests, verified client ID, and bounded disposition metadata, never the raw JWS or raw subject. A terminal event may transiently exact-match one Apple Auth identity and create a no-vault terminal lifecycle/deletion graph. If the identity is absent, retain only keyed `unknown_subject` evidence for capture-time reconciliation. Live proof must include primary-App-ID endpoint registration, genuine Apple delivery, invalid-signature rejection, replay/staleness handling, and terminal-event deletion behavior. |
| `apple-auth-lifecycle` | User JWT required; POST only | Gateway and handler verify the bearer; the handler re-fetches the user and validates exact JWT subject/session claims. `capture` accepts only the bounded subject, ID token, one-use code, and 43-character raw nonce from the composite mobile permit; it verifies nonce/identity and submits current plus retained subject aliases. Before marking or exchanging the code, it reconciles matching audience-bound terminal `unknown_subject` evidence under the owner lock and returns committed `blocked`; otherwise it reserves the code digest once, exchanges server-side, and seals the refresh token before exact active status. `credential_invalid` requires the current session/subject and returns exact blocked status after lifecycle/session invalidation. |
| `apple-auth-worker` | Scheduled private service; POST only; gateway JWT off | Accept exactly `{action:"work"}` plus the independent constant-time `x-apple-auth-worker-secret`. The one-minute Vault-backed lane is authoritative. Claims are capped at 25 and processed five-wide; the worker rechecks Auth identity/HMAC/vault context, validates at most daily, defers ambiguous network/rate-limit outcomes, and invalidates terminal token/subject/vault failures. Responses and logs expose bounded aggregate counts and stable codes only. |
| `data-export` | User JWT required; POST only | Verify exact account access before and after assembly, rate-limit before reads or URL generation, scope every row/object to the caller, and reject malformed/cross-owner photo paths. Photo signed URLs default to and are capped at 60 seconds. Live evidence must prove download before expiry and denial after expiry. |
| `consent-withdrawal` | User JWT required; POST only | Reject oversized input before parsing, require exact account access, and scope ledger/cleanup work to the caller. Health withdrawal requires the expected processing epoch and generation and creates service-only durable cleanup. |
| `health-consent-worker` | Scheduled private service; POST only; gateway JWT off | Accept exactly `{action:"work"}` and the independent constant-time `x-health-consent-worker-secret`. Re-attest operation/user/epoch across claim, prepare, Storage listing/deletion, and completion; return bounded aggregate results only. |
| `subscription-grants` | User JWT required; POST only | Reject oversized input before parsing, require exact account access, and derive the grant owner only from the verified caller. |
| `subscription-reconciliation` | User JWT required; POST only | Require exact account access at both boundaries, derive the owner from Auth, use the fresh provider `request_date` watermark, and never accept caller-selected provider order. |
| `catalog-search` | User JWT required; POST only | Reject oversized input before parsing, require exact account access, and apply endpoint and shared identity/IP rate limits before catalog reads. |
| `catalog-lookup` | User JWT required; POST only | Reject oversized input before parsing, require exact account access, and apply endpoint and shared identity/IP rate limits before catalog reads. Request-time Open Beauty Facts access remains disabled. |
| `catalog-report` | User JWT required; POST only | Reject oversized input before parsing, require exact account access, and limit writes to the authenticated caller. |
| `revenuecat-webhook` | External provider webhook; POST only | Gateway JWT is off only to allow RevenueCat authentication. Verify the configured shared authorization/HMAC boundary, reject wrong/missing credentials, preserve event ordering, and apply deletion tombstones before projection. |
| `order-report-poll` | Publicly reachable literal-zero endpoint; POST only | Gateway JWT is off, so treat the URL as public. It returns the exact COM-01A closed-admission result without reading provider, scheduler, Supabase, or activation credentials; creates no client, external request, or database write; and cannot be activated by runtime configuration. Migration 0072 separately rejects stale attribution inserts and permits only exact detach/delete privacy cleanup. |
| `growth-event` | Public rate-limited endpoint | Allowlist event/props, reject contact/health/product/barcode payloads, validate origin, and rate-limit before writes. Public routing is not permission to accept arbitrary data. |
| `waitlist` | Public rate-limited endpoint | Validate and normalize email, allowlist attribution, require production Turnstile and origin checks, reject oversized input, and rate-limit by normalized identity/IP digests. |

## Shared Apple Account-Access Fence

Migration 0055 adds one exact-session account-access decision. Catalog
lookup/search/report, consent withdrawal, data export, subscription grants, and
subscription reconciliation check it before privileged work and again before a
successful response. The database applies the same decision through
restrictive owner-table and photo-Storage read policies, write fences,
entitlement/health/ownership helper RPCs, and exact `auth.sessions` membership.

Apple bootstrap, credential invalidation, account deletion, and recovery remain
narrow special lanes because they must be reachable while ordinary account
access is closed. Source coverage does not replace hosted stale-JWT, RLS,
Storage, Edge, and direct-RPC evidence.

Already issued signed URLs cannot be revoked; the 60-second data-export URL
ceiling bounds new residual exposure. The generated live evidence must be
regenerated against the deployed candidate rather than hand-edited.

Strict Phase 9 signoff requires `phase9:live-edge-auth:strict` evidence for
missing/invalid user JWTs, valid-JWT non-POST rejection across user-JWT
functions, body limits before privileged work, provider/scheduler negative-auth
probes, and public endpoint origin/Turnstile/rate-limit behavior. Apple-specific
hosted and device requirements are in
`docs/phase-9/apple-auth-lifecycle-operations-runbook.md`.
