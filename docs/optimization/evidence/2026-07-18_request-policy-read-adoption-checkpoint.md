# Request-Policy Read-Adoption Checkpoint

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Checkpoint parent: `a85f79e96a7b60661760c2049aa350fbe2a03ee6`

Item: `OPT-118`

## Outcome

The shared request policy now covers every direct read-only PostgREST operation
in the mobile production source. Nine reads across eight files use one captured
account-generation lease, an endpoint-specific absolute deadline, linked abort
signal, bounded idempotent retry with full jitter and `Retry-After`, response
size ceiling, typed failure taxonomy, and fixed content-free metrics.

This completes the locally safe read-adoption slice of `OPT-118`. The item
remains `investigating` because direct writes need a stronger contract than
reads: a timeout can race a committed mutation, and a retry can duplicate an
operation without a durable identity or transactional outbox receipt.

## Covered Request Surface

The fixed endpoint registry contains 17 content-free names:

- Seven centralized authenticated Edge Function policies.
- One bounded Ask grounded-provider operation.
- Nine direct PostgREST reads for Commerce links, the consent ledger,
  onboarding status, profile fallback, Progress completions and longest streak,
  server entitlement, trend consent, and Monk band.

The eight direct-read source files are:

1. `features/commerce/useCommerce.ts`
2. `features/onboarding/onboardingStatusQuery.ts`
3. `features/routine/useProgress.ts`
4. `features/scheduler/profile.ts`
5. `features/subscription/store.ts`
6. `features/trend/consent.ts`
7. `features/trend/useTrend.ts`
8. `lib/consent/consent.ts`

Where to Buy now uses the owner-generation query namespace. A delayed account-A
Commerce response therefore cannot populate or reuse account B's query cache.

## Failure And Privacy Contract

- Offline, timeout, cancellation, owner change, authentication, rate limit,
  server, validation, oversized response, and unknown failures remain distinct.
- Only idempotent transient failures can retry, with at most four attempts and
  one absolute deadline across all attempts and delays.
- `Retry-After` is honored only inside the remaining absolute budget and is
  capped by policy.
- PostgREST status-zero transport wrappers normalize without placing their
  original message or private request input into the public error or metrics.
- Metrics retain only endpoint, rounded duration, status class, and attempt
  count, with a 200-sample in-memory ceiling.
- Owner change or caller cancellation suppresses later retries and publication.
- Oversized responses fail without retaining the payload.

The exact production inventory also proves that raw Edge Function invocation is
contained to `lib/network/edgeFunctions.ts`. The only raw `fetch` is the existing
development/staging diagnostics HEAD probe, which sends no token, account,
search, barcode, or product data and has its own abort deadline.
The sole direct RPC is the capability-only anonymous account-deletion completion
lookup; it already runs through `runRequest` with a deadline, response ceiling,
abort signal, and no persisted session.

## Mutation Boundary

Eleven production files still perform direct PostgREST mutations. The new source
inventory freezes this list and requires every current exception to remain
inside an account-generation or owner-query operation with an abort signal.

No retry or detached timeout race was added to those writes. Before they can use
the common request policy safely, each mutation needs an exact operation
identity, documented commit-response-loss behavior, terminal reconciliation,
and—where required—the encrypted transactional outbox tracked by `OPT-010` and
`PERF-P0-007`.

## Deterministic Verification

```text
npm.cmd --workspace apps/mobile test -- [request/read-adoption matrix]
12 files / 248 tests PASS

npm.cmd test
332 files / 3,981 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

The focused matrix covers hard deadlines against signal-ignoring work, one
absolute retry budget, full jitter, capped `Retry-After`, HTTP and Supabase
transport classification, cancellation, owner switching, oversized responses,
bounded diagnostics, all Edge policies, all read-only source adoption, Commerce
owner keys, and late account-A response containment.

Machine-readable coverage is recorded in
`docs/optimization/reports/2026-07-18_request-policy-read-adoption-report.json`.

## Remaining Proof

- Transactional/idempotent semantics for the 11 inventoried direct mutation
  files before common deadlines or retries are enabled for them.
- Physical supported-iOS offline, DNS/TLS failure, timeout, cancellation,
  `Retry-After`, rate-limit, captive-portal, VPN, and poor-network scenarios.
- Native duration/attempt distributions for representative empty, median, and
  stress responses from signed builds.
- Approved endpoint thresholds, alert ownership, and production aggregate
  transport evidence.

No native latency, reliability, energy, or production-backend claim is inferred
from deterministic source tests.
