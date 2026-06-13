-- =============================================================================
-- 0021 · personalized recommendations (docs/09 §9) — owner-only, NO commercial fields
-- =============================================================================
-- The independent, needs-based recommendation engine. Two light tables:
--   1. recommendation_preferences — the user's values / format / budget filters
--      (§8), which HARD-CONSTRAIN the candidate set client-side.
--   2. recommendations — an OPTIONAL cache of the current suggestions, recomputed
--      on profile/shelf/routine/conflict/preference change. It is NEVER the source
--      of truth (the pure engine recomputes live; docs/09 §5/§12) and never
--      commercially weighted.
--
-- *** CHURCH AND STATE (docs/09 §3, D-054) ***
-- There is deliberately NO commission / affiliate / partnership / brand-deal column
-- anywhere in this migration. The ranking path contains no commercial field, so a
-- product's purchasability can never raise its rank. The commerce layer (doc #10,
-- not built) only ever READS the already-ranked output and may attach a disclosed
-- affiliate link AFTER ranking — it can never reorder, reweight, or pad it.
--
-- Both tables are owner-only RLS per docs/01 §3 — the same posture as skin_profiles
-- and routine_conflicts. No RLS is weakened anywhere.

-- --- 1. recommendation_preferences (the values/format/budget filters, §8) -------
create table public.recommendation_preferences (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  -- 'fragrance_free' | 'vegan' | 'cruelty_free' | 'non_comedogenic' | 'sustainable'
  values_filters text[] not null default '{}',
  -- 'drugstore' | 'mid' | 'premium' | null (no preference)
  budget_band    text check (budget_band in ('drugstore', 'mid', 'premium')),
  -- 'gel' | 'cream' | 'fluid' | 'balm' | ...
  format_prefs   text[] not null default '{}',
  updated_at     timestamptz not null default now()
);

alter table public.recommendation_preferences enable row level security;

create policy "recommendation_preferences_select_own" on public.recommendation_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recommendation_preferences_insert_own" on public.recommendation_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recommendation_preferences_update_own" on public.recommendation_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "recommendation_preferences_delete_own" on public.recommendation_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger trg_recommendation_preferences_updated_at
  before update on public.recommendation_preferences
  for each row execute function public.set_updated_at();

-- --- 2. recommendations cache (recomputed; never authoritative, §5/§9) ----------
create table public.recommendations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  -- 'gap' | 'replacement' | 'conflict' | 'better_fit' | 'goal' | 'routine_completion'
  trigger            text not null
    check (trigger in ('gap', 'replacement', 'conflict', 'better_fit', 'goal', 'routine_completion')),
  product_type       text not null,                                   -- the recommended type (type-first)
  catalog_product_id uuid references public.products (id),            -- optional specific product (B-CATALOG-SEED)
  fit_rationale      text not null,                                   -- the 'why' + 'how' — explainability is MANDATORY (§6)
  evidence_grade     text,                                            -- consumer evidence label, from docs/02 (nullable)
  status             text not null default 'active'
    check (status in ('active', 'dismissed', 'accepted')),
  created_at         timestamptz not null default now(),
  -- one live suggestion per (trigger, type) per user; a recompute upserts.
  unique (user_id, trigger, product_type)
);
create index recommendations_user_status_idx on public.recommendations (user_id, status);

alter table public.recommendations enable row level security;

create policy "recommendations_select_own" on public.recommendations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "recommendations_insert_own" on public.recommendations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "recommendations_update_own" on public.recommendations
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "recommendations_delete_own" on public.recommendations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- NOTE (church and state, D-054): the only catalog reference here is
-- catalog_product_id → public.products (a merit datum). Commerce metadata
-- (commission, affiliate, partnership) lives ENTIRELY in doc #10's layer and is
-- JOINed only AFTER ranking, never before — there is no path by which it can enter
-- this table or influence ordering. Recommendations are ranked purely by fit,
-- evidence, and need.
