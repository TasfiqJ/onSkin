# Supabase — schema, RLS, and Edge Functions

Source of truth: **docs/01 §3 (data model + RLS)** and **§4 (consent)**.

## Migrations (`migrations/`)

| File | Contents |
| --- | --- |
| `…0001_extensions_and_helpers` | pgcrypto, `set_updated_at()` |
| `…0002_profiles` | `profiles` + defensive `handle_new_user()` signup trigger |
| `…0003_catalog` | docs/02 §3 catalog: `ingredients` (+synonyms/tags), `products`, `product_ingredients`, tag-based `conflict_rules`, `ingredient_pao_defaults` (read-only reference; data BLOCKED: B-CATALOG-SEED + B-DERM-REVIEW) |
| `…0004_skin_profiles` | quiz results (health-inference data) |
| `…0005_user_products` | the shelf, with generated `expiry_computed` (PAO/expiry) |
| `…0006_routines` | `routines`, `routine_steps`, `owns_routine()` helper |
| `…0007_routine_completions` | append-only log, 48h backfill cap, computed streaks |
| `…0008_photos` | photo metadata + **private** Storage bucket + anon cloud-backup block |
| `…0009_entitlements` | RevenueCat mirror + raw `subscriptions_events` log |
| `…0010_consents` | MHMDA/GDPR **immutable** consent ledger |
| `…0011_notification_preferences` | reminder prefs |
| `…0012_routine_conflicts` | per-user conflict cache (owner RLS + `owns_user_product()`) |
| `…0013_seed_intelligence` | starter conflict matrix + PAO defaults (all `reviewed_by` NULL — B-DERM-REVIEW) |

### RLS invariants (enforced everywhere)
- RLS enabled on every `public` table.
- Every policy wraps `auth.uid()` as `(select auth.uid())` and is scoped `to authenticated`.
- Every INSERT/UPDATE policy has `WITH CHECK`.
- Cross-table checks go through `SECURITY DEFINER` helpers with `search_path = ''`.
- All `SECURITY DEFINER` functions are `REVOKE`d from clients (only `owns_routine`
  stays executable by `authenticated`, since RLS policies call it).
- Append-only: `routine_completions` (no UPDATE/DELETE policy) and `consents`
  (no UPDATE/DELETE policy **plus** a `BEFORE UPDATE` block trigger).

## Applying (once the project exists — BLOCKED: B-SUPABASE)

```bash
supabase link --project-ref <ref>
supabase db push                 # applies migrations/
supabase gen types typescript --project-id <ref> \
  > packages/types/src/database.types.ts   # regenerate the typed client
```

### Launch gate (docs/01 §3)
Run the **Security & Performance Advisors** before every release and treat any
`rls_disabled_in_public` (0013) as a launch blocker. Also check
`auth_rls_initplan` (0003) and `rls_enabled_no_policy` (0008).

## Edge Functions (`functions/`)
`revenuecat-webhook`, `account-deletion`, `data-export` — service-role, built in
the auth slice. External provider calls are stubbed (BLOCKED: B-REVENUECAT,
B-APPLE, B-POSTHOG).

> These migrations were authored without a live database in this environment and
> adversarially reviewed by 4 independent agents (RLS-bypass, SQL-executability,
> spec-fidelity, advisor-lints). Re-run the Advisors after the first `db push`.
