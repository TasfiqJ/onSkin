# ASK-02 Gateway Source Checkpoint

Date: 2026-09-26

Status: source checkpoint only; ASK-02 remains incomplete and launch-blocked

## Scope delivered

This checkpoint adds a provider-neutral Supabase Edge boundary for the future
cloud Ask path without enabling that path or selecting/configuring a provider.

- The endpoint requires a valid Supabase user JWT, the current account-access
  generation, active base health processing, and an exact owner-scoped
  `ask_layerwell` consent generation.
- Placeholder or draft Ask consent copy is rejected. More importantly, the
  existing owner-scoped status RPC does not prove that a receipt still binds
  the current approved registry row. Purpose-consent admission therefore
  explicitly returns `ASK_CONSENT_AUTHORITY_UNAVAILABLE` even for a
  syntactically valid active receipt. A new server-side atomic authority is a
  prerequisite to enabling the endpoint.
- The request parser uses an exact English-only allowlist. It accepts the
  unavoidable question text plus the documented coarse context fields and
  at least one reviewed evidence-card identifier. It has no field for photos, exact
  product history, profile free text, age, location, commerce, or arbitrary
  retrieved chunks.
- The provider-neutral core computes a canonical SHA-256 fingerprint over the
  full exact request and passes it into the atomic idempotency/quota
  reservation before any provider invocation. Replays require the same stored
  owner, request ID, and fingerprint and do not invoke the provider again.
  Fingerprint computation is internal-only with no endpoint injection seam;
  failures and throwing request coercions are caught and redacted before quota
  reservation.
- Every quota response variant is runtime-validated as an exact object.
  Reserved leases require an exact bounded token plus matching owner, request
  ID, and fingerprint. Replay envelopes require those same three bindings.
  Unknown, extra, null, malformed, or cross-owner values fail before provider
  work.
- Provider and stored replay payloads require exact keys. Successful responses
  are rebuilt field by field, so runtime extras cannot override or enter the
  public response. Grounded responses require at least one allowed citation.
- Runtime configuration has strict exact-key and numeric bounds before quota
  or provider work. Per-request output and cost ceilings, hard timeout,
  commit-before-delivery, and stable redacted public errors are locally tested.
  Exactly one provider attempt is allowed for every failure class because no
  durable cumulative settlement authority exists yet.
- The process-local circuit object is explicitly non-authoritative and cannot
  block traffic or replay. A durable distributed half-open breaker remains a
  prerequisite to enabling the endpoint. Its runtime admission envelope is
  nevertheless exact: only `{ ok: true }` admits, while only a bounded integer
  retry delay may block. Unknown, extra, throwing, or type-invalid circuit
  adapters fail closed, safely release a valid lease, and never invoke the
  provider. Reservation, replay, circuit, and release adapter boundaries catch
  both synchronous and asynchronous failures without exposing private detail.
- The repository endpoint is literally configured with `enabled: false`, a
  disabled quota ledger, and a disabled provider. No environment flag can turn
  it into a positive cloud path.
- The Edge manifest/config and authenticated account-access coverage include
  the new endpoint. No migration, provider SDK, provider key, production
  secret, mobile route, or feature flag was added.

## Evidence and commands

Focused source verification:

```text
npm run ask02:gateway-source-contract:test
deno fmt --check supabase/functions/ask-layerwell
deno check --no-config --lock=supabase/functions/deno.lock --frozen=true supabase/functions/ask-layerwell/index.ts
npm run phase9:edge-manifest-smoke
npm run phase9:edge-functions-check
npm run phase9:data-export-contract-smoke
```

The source-contract test pins literal disabled admission, authenticated and
purpose-consent fences, adjacent execution-time recheck, quota-before-provider
ordering, canonical request fingerprint and identity binding, exact reservation
variants and outputs, single-attempt provider behavior, strict runtime bounds,
mandatory evidence/citations, the minimized transport shape, redacted failures,
launch verification wiring, manifest/config governance, and the absence of
provider credentials. The source audit parses TypeScript syntax trees so
comments and dead source text cannot satisfy executable disabled/auth/consent
guards. It requires the exact production gateway-call keys plus structurally
exact, control-flow-dominating `if (!userId) return` and `if (!x.ok) return`
guards for user, account, base-health, and purpose consent. Adversarial
mutations cover missing returns, reversed/dead guards, fingerprint injection,
provider imports, credential environment reads, manifest/config/package
injection, and missing launch wiring.

## Explicit non-evidence

This checkpoint does not prove or claim:

- ASK-01 provider/model approval or a signed DPA/ZDR posture;
- a durable hosted quota, idempotency, audit, or cost ledger;
- a provider adapter, model snapshot, prompt, retrieval corpus, or citation
  resolver;
- approved Ask consent/disclosure copy;
- an atomic server-side purpose-consent authority proving the receipt matches
  the current approved registry row;
- semantic claim-safety, citation-faithfulness, prompt-injection, clinical, or
  legal acceptance;
- live staging behavior, latency, cost, deletion, outage, or abuse evidence;
- enabled client behavior, physical-iPhone behavior, or App Review acceptance.

## Residual gates

ASK-02 can be completed only after ASK-01 and ACCT-11 approve the exact
provider/model, contract, retention/residency posture, budget, and accountable
owners. A later reviewed slice must add a durable server-side quota/idempotency
adapter and audit persistence, provider-specific secret storage and adapter,
an authoritative purpose-consent RPC, a durable distributed circuit breaker,
hosted abuse/outage/cost tests, and live evidence. ASK-03 through ASK-05 must
also provide the reviewed corpus, retrieval, privacy, deletion, and complete
safety pipeline before any positive grounded answer can be delivered. ASK-06
owns the enabled mobile states and physical-iPhone E2E.

No credential-inventory row was added because this checkpoint introduces no
new credential. Provider credential names must be recorded only after ACCT-11
selects and approves the exact provider contract.
