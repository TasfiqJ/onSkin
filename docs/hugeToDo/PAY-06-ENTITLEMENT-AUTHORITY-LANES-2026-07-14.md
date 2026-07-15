# PAY-06 — Entitlement authority lanes

Date: 2026-07-14
Status: implemented and locally verified; hosted RevenueCat/Supabase and native store lifecycle evidence remains a launch gate.

## Outcome

The one-row collision is removed without inventing provider order:

- `public.entitlements` is the RevenueCat store projection only.
- `public.reverse_trial_grants` is the independent, one-time app-grant authority.
- `read_entitlement_projections()` returns both lanes for `auth.uid()` in one schema-versioned JSON object and accepts no arguments.
- A local grant never inserts, updates, expires, or revokes the RevenueCat row.
- A RevenueCat webhook or snapshot never consumes or deletes the local grant.
- Historical store rows without a complete provider cursor are `legacy_unknown` and fail closed until a fresh, server-fetched RevenueCat CustomerInfo snapshot initializes a provider watermark.

This fixes an authorization/data-model defect. It does not by itself prove App Review acceptance, legal clearance, production RevenueCat configuration, or native purchase/restore correctness.

## Root cause

`entitlements.user_id` is the primary key. The former reverse-trial RPC upserted an app-granted row into the same key used by the RevenueCat webhook. Whichever writer ran last could replace the other authority. The expiry path then updated that shared row, so local trial maintenance could also revoke a store purchase.

Treating processing time, `updated_at`, verification time, or migration time as an old RevenueCat event cursor would have hidden the collision while creating a false order. That option was rejected.

## Read contract

The authenticated client calls `read_entitlement_projections()` with no arguments. The function is `SECURITY DEFINER`, pins an empty `search_path`, derives only `auth.uid()`, and is executable by `authenticated` but not `anon` or `service_role`.

```json
{
  "schema_version": 1,
  "store_projection": {
    "state": "active | inactive | legacy_unknown | absent",
    "row": "normalized row or null"
  },
  "app_grant_projection": {
    "state": "active | inactive | absent",
    "row": "normalized row or null"
  }
}
```

Every normalized row has exactly:

`tier`, `is_active`, `product_id`, `expires_at`, `store`, `period_type`, `will_renew`, `granted_at`, `source`, `environment`, `management_url`, `verified_at`, `offering_id`, `package_id`, and `cursor`.

Coherence rules:

- `absent` has `row: null`.
- `legacy_unknown` has a non-null store row, forced `is_active: false`, `source: revenuecat`, and `cursor: null`.
- An active/inactive store row has `source: revenuecat` and either an `rc_webhook` cursor (`at`, `priority`, `event_id`) or `rc_snapshot` cursor (`at`, `fingerprint`).
- An active/inactive app row has `source/store: app_granted`, `period_type: reverse_trial`, non-null grant/expiry timestamps, and a null cursor and provider-only identifiers.

The mobile cache remains a cache. Effective access is the union of the two verified lanes, while `legacy_unknown` never grants access.

## Migration and ordering behavior

Migration `20260714000053_entitlement_authority_lanes.sql` is forward-only:

1. Recover identifiable historical local reverse trials into `reverse_trial_grants`.
2. Whitelist recovered metadata to `action` and `environment`; RevenueCat/store identifiers are discarded.
3. Delete those local rows from `entitlements` so that table becomes the store lane.
4. Recover a missing event time/priority only from the exact matching `subscriptions_events.rc_event_id`. No processing or migration clock is promoted to provider evidence.
5. Mark a complete tuple `ordered`; otherwise mark the row `legacy_unknown`.
6. Preserve the exact RevenueCat comparison: provider event time, lifecycle priority, then bytewise UTF-8 event ID.
7. Treat events at or before a trusted snapshot watermark as stale. A strictly later event resumes tuple ordering.
8. Reject an incoming snapshot at the exact timestamp of an ordered event as `REVENUECAT_SNAPSHOT_CURSOR_CONFLICT`; neither authority wins an unknowable same-time contradiction.

The cursor trigger includes one narrow compatibility path for migration 0051 privacy scrubs: `store_user_id` may only become null and `raw_status` may only become `{}`, while every projection and cursor field remains unchanged. Rehearsal covers ordered, snapshot, and `legacy_unknown` rows.

## Operational legacy exit

`subscription-reconciliation` is a deployed-by-default, authenticated Edge Function with `verify_jwt=true`.

It:

- rejects every request field, including a subject or timestamp;
- validates the bearer token and uses that user ID in the provider URL;
- applies a per-owner database rate limit;
- performs a bounded, no-redirect RevenueCat v1 `GET /subscribers/{app_user_id}` using the server-only secret key;
- accepts RevenueCat's documented get-or-create success statuses (`200` or `201`);
- bounds fetch time and response bytes and requests no-cache/no-store behavior;
- requires the snake-case provider `request_date` to be recent (default maximum age 120 seconds, configurable only from 15–300 seconds);
- verifies `request_date_ms` when present;
- never treats client data, local time, HTTP `Date`, camel-case `requestDate`, or v2 `observedAt` as the watermark;
- maps RevenueCat `PROMOTIONAL` to the provider `promotional` store, never the local `app_granted` lane;
- invokes `reconcile_revenuecat_entitlement_snapshot(...)`, which is executable only by `service_role`.

RevenueCat documents the v1 endpoint as returning the latest Customer Info and defines `request_date` as the request date in ISO 8601; it also says secret API keys must stay out of client-accessible areas. [RevenueCat API v1](https://www.revenuecat.com/docs/api-v1)

## Security, privacy, and App Store posture

- Caller ownership is derived, not supplied. Supabase recommends using `auth.uid()` for ownership checks and explicitly controlling function/table privileges. [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
- The app-grant record is data-minimized and contains no RevenueCat event, transaction, store-user, product, offering, package, or cursor ID.
- Account deletion/export coverage is preserved because both existing tables were already in those registries; no new user-data table was introduced.
- RevenueCat webhook delivery can duplicate events, so audit claim/idempotency and exact ordering remain intact. [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
- PostgreSQL documents that a row-level `BEFORE` trigger returning null skips that row operation, and `INSERT ... RETURNING` reports rows actually inserted/updated; the rehearsal asserts the resulting stale-event behavior rather than assuming it. [PostgreSQL trigger behavior](https://www.postgresql.org/docs/current/trigger-definition.html), [PostgreSQL INSERT](https://www.postgresql.org/docs/17/sql-insert.html)
- Apple's current rules require In-App Purchase for paid digital feature unlocks and a restore mechanism for restorable purchases. The free, non-transactional app grant does not replace or route around StoreKit; purchased access stays RevenueCat/StoreKit authority. Native purchase, restore, sandbox, TestFlight, disclosure, and review evidence still must pass. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Apple In-App Purchase](https://developer.apple.com/in-app-purchase/)

This is engineering evidence, not legal advice or an Apple approval guarantee.

## Compatibility and rollout

Safe prelaunch order:

1. Apply migration 0053.
2. Deploy `subscription-reconciliation` and the updated `subscription-grants` function.
3. Deploy a mobile reader that uses the no-argument projection RPC and, only for `legacy_unknown`, invokes reconciliation once and re-reads once.
4. Run hosted provider, sandbox/TestFlight, deletion-race, and lifecycle evidence before launch.

The three-argument grant RPC and deprecated four-argument overload remain service-only. The overload ignores the product argument. Both return the historical entitlement row shape, but persist only the app lane. The old expiry RPC remains a safe no-op during a rolling Edge deployment.

Important: a previously installed binary that still selects `entitlements` directly will not see a separated app grant after relaunch. Do not apply this migration to an installed production cohort until the new reader is deployed/enforced (or a mandatory-version fence is active). Reintroducing an app row into `entitlements` for old clients would recreate the defect and is not an acceptable compatibility fix.

## Rollback and incident response

Do not down-migrate or restore the shared-row model. Recovery deliberately removes provider-only identifiers from historical local-grant records, so a reverse migration cannot truthfully reconstruct them.

If the provider caller is unhealthy:

- disable or roll forward the Edge Function;
- retain `legacy_unknown` fail-closed behavior and existing mobile cache;
- do not manufacture a snapshot clock;
- deploy a corrective forward migration/function;
- reconcile affected users only from a fresh RevenueCat provider response.

If the projection reader is unhealthy, clients must keep last verified cache rather than clear access from an absent/error response. Purchased access remains recoverable through RevenueCat/StoreKit restore and the provider reconciliation path.

## Executable evidence

Local results on 2026-07-14:

- PostgreSQL 15 Alpine: `ENTITLEMENT_AUTHORITY_LANES_POSTGRES_REHEARSAL_PASS`.
- PostgreSQL 17 Alpine: `ENTITLEMENT_AUTHORITY_LANES_POSTGRES_REHEARSAL_PASS`.
- Reconciliation/grant Deno contracts: the dedicated reconciliation gate passes 20/20, including the full reserve/activate/renew/release publication-lease lifecycle.
- Edge Function entrypoint/type graph: passed.
- Edge manifest, staging deploy manifest, Supabase policy lint, local DB structural contract, data-rights code gate, and release-smoke code gate: passed.

The rehearsal covers recovery/minimization, owner isolation, anonymous denial, lane coexistence, no provider IDs in app grants, active-store and legacy grant conflicts, no-cursor fail-closed handling, fresh snapshot exit, delayed expiration, exact time/priority/bytewise-ID ordering, duplicate/conflicting snapshots, null active tier rejection, `app_granted` snapshot rejection, equal ordered/snapshot conflict, and migration-0051 privacy scrub compatibility for all three cursor states.

## Remaining launch gates

- Hosted Supabase migration/reset evidence and deployed function smoke.
- Live RevenueCat v1 response and rate-limit/error telemetry without payload/identity leakage.
- RevenueCat sandbox/TestFlight purchase, renewal, cancellation, refund, grace, restore, promotional, and account-alias lifecycle.
- Updated mobile reader and mandatory-version/zero-installed-cohort proof for the incompatible old direct-table reader.
- Physical iPhone purchase/restore/offline/relaunch QA and App Review metadata.
- Legal/privacy/payment review and named approval. No source change can guarantee acceptance by Apple or every jurisdiction.
