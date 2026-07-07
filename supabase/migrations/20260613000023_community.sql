-- =============================================================================
-- 0023 · community layer ("Skin Notes") — docs/11. Segregated, consent-scoped, PHOTO-FREE.
-- =============================================================================
-- An expert-anchored, claim-safe, evidence-graded "myth vs evidence" trust layer —
-- NOT an open social feed. The forbidden patterns (open/algorithmic feed, follower
-- graph, DMs, likes/leaderboards, public before/after photo galleries) are barred at
-- the ARCHITECTURE level (schema + RLS), not just the UI (D-064), so a future growth
-- pressure cannot quietly re-enable them.
--
-- *** PHOTOS CAN NEVER ENTER COMMUNITY (D-064). *** There is deliberately NO image /
-- photo / storage_path / local_uri column anywhere below. Progress photos stay
-- local-only (docs/06, D-039), enforced at the table layer.
--
-- *** CHURCH AND STATE, EXTENDED (D-063). *** The community module is walled off from
-- the recommendation path (docs/09) and the commerce path (docs/10): no commission /
-- affiliate / rate column here; community signal reaches the recommendation engine
-- only as aggregated, anonymised "people like you" inputs, never free-text health.
--
-- Reuses the docs/01 conventions: (select auth.uid()), TO authenticated, WITH CHECK,
-- indexed policy columns, owns_* security-definer helpers (REVOKE'd), the immutable
-- consent ledger (docs/01 §3). Phase 1 ships expert content (read-mostly); the peer
-- tables land now for the architecture-level guarantees but peer POSTING is deferred
-- behind B-COMMUNITY-MOD / B-COMMUNITY-LEGAL / B-EXPERT-NETWORK (D-067).

-- --- consent ledger extension: a NEW, separate, unbundled consent type (D-066) -----
-- A user posting skin/health-adjacent info to others is a new MHMDA/GDPR-Art.9
-- collection+sharing event; the photo / data_sharing consents do NOT cover it.
alter table public.consents
  drop constraint consents_consent_type_check,
  add constraint consents_consent_type_check check (consent_type in (
    'account', 'health_data_collection', 'photo_capture',
    'photo_cloud_backup', 'marketing', 'data_sharing', 'community_participation'));

-- Ownership helper: the referenced consent is the user's, is a CURRENT (latest,
-- un-revoked) community_participation grant. The consents ledger is append-only, so
-- "current" = the latest community_participation row for the user is this one + granted.
create or replace function public.owns_consent(p_consent_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.consents c
    where c.id = p_consent_id
      and c.user_id = (select auth.uid())
      and c.consent_type = 'community_participation'
      and c.granted = true
      and c.granted_at = (
        select max(c2.granted_at) from public.consents c2
        where c2.user_id = (select auth.uid()) and c2.consent_type = 'community_participation'
      )
  );
$$;
revoke all on function public.owns_consent(uuid) from public, anon;
grant execute on function public.owns_consent(uuid) to authenticated;

-- --- 1. community_topics (structured catalog; the docs/02 §3 catalog pattern, D-016) ---
create table public.community_topics (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,           -- 'ingredient-myths' | 'sunscreen' | 'sensitive-skin' | 'retinoids'
  title       text not null,
  description text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);
alter table public.community_topics enable row level security;
create policy "community_topics_select_active" on public.community_topics
  for select to authenticated using (is_active);

-- --- 2. community_notes (expert-seeded EDITORIAL content; NOT peer UGC) -------------
create table public.community_notes (
  id                uuid primary key default gen_random_uuid(),
  topic_id          uuid not null references public.community_topics (id),
  kind              text not null check (kind in ('myth_vs_evidence', 'expert_answer', 'explainer')),
  title             text not null,
  body              text not null,            -- claim-safe; cosmetic verbs only
  evidence_grade    text,                     -- SORT A/B/C (docs/02); NULL = refuted myth ('—', D-019)
  evidence_label    text,                     -- 'established'|'plausible'|'contested'|'refuted' (docs/02 vocab)
  provenance        text not null default 'expert' check (provenance in ('expert', 'editorial')),
  author_credential text,                     -- 'Board-certified dermatologist' | 'Cosmetic chemist'
  source_url        text,                     -- honest citation
  claim_safety_ok   boolean not null default false,  -- the claim-safety guard verdict (must pass to publish)
  reviewed_by       uuid,                     -- B-DERM-REVIEW gate: NULL = not cleared -> withheld in production
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index community_notes_topic_idx on public.community_notes (topic_id);
alter table public.community_notes enable row level security;
-- Production gate (mirrors shippableRules / D-032): only clinically-reviewed AND
-- claim-safe notes are ever visible; writes are service-role / expert-console only.
create policy "community_notes_select_published" on public.community_notes
  for select to authenticated using (reviewed_by is not null and claim_safety_ok);
create trigger trg_community_notes_updated_at
  before update on public.community_notes
  for each row execute function public.set_updated_at();

-- --- 3. community_blocks (Apple 1.2 floor: block an anonymous handle) ----------------
-- Defined BEFORE community_questions because the approved-read policy below references
-- it in a NOT EXISTS subquery, and CREATE POLICY resolves referenced relations at
-- creation time (the policy expression is not a deferred SECURITY DEFINER body).
create table public.community_blocks (
  user_id        uuid not null references auth.users (id) on delete cascade,
  blocked_handle text not null,               -- block an anon handle; never exposes a real identity
  created_at     timestamptz not null default now(),
  primary key (user_id, blocked_handle)
);
alter table public.community_blocks enable row level security;

-- --- 4. community_questions (Phase 2+; the NEW consumer-health-data class) ----------
-- Owner-write (consent-scoped, 16+, NON-anonymous), MODERATED read. NO photo column.
create table public.community_questions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  topic_id          uuid not null references public.community_topics (id),
  body              text not null,            -- free-text MINIMISED; structured contributions preferred
  anon_handle       text not null,            -- assigned pseudonym; NEVER profiles.display_name
  moderation_state  text not null default 'pending' check (moderation_state in ('pending', 'approved', 'rejected')),
  claim_safety_flag boolean,                  -- auto-scan FLAG only (human pre-mod is authoritative)
  rejected_reason   text,                     -- DSA Art. 17 statement of reasons
  consent_grant_id  uuid not null references public.consents (id),  -- the community_participation grant
  created_at        timestamptz not null default now()
  -- *** NO image / photo / storage_path / local_uri column — by design (D-064). ***
);
create index community_questions_topic_state_idx on public.community_questions (topic_id, moderation_state);
create index community_questions_user_idx on public.community_questions (user_id);
alter table public.community_questions enable row level security;

-- The author sees their own rows (any state); everyone else sees only APPROVED rows,
-- minus any anon_handle they've blocked.
create policy "community_questions_select_own" on public.community_questions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "community_questions_select_approved" on public.community_questions
  for select to authenticated using (
    moderation_state = 'approved'
    and not exists (
      select 1 from public.community_blocks b
      where b.user_id = (select auth.uid()) and b.blocked_handle = community_questions.anon_handle
    )
  );
-- *** Anonymous (is_anonymous JWT) users are LOCKED OUT of posting (D-066, restrictive)
-- — closing exactly the gap docs/01 §1 named. ***
create policy "community_questions_block_anon" on public.community_questions
  as restrictive for insert to authenticated
  with check (((select auth.jwt() ->> 'is_anonymous'))::boolean is not true);
-- Owner insert requires: ownership, a PENDING start, AND a current community_participation consent.
create policy "community_questions_insert_own" on public.community_questions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and moderation_state = 'pending'
    and public.owns_consent(consent_grant_id)
  );
-- No author UPDATE after submission (moderation is service-role). The author may DELETE
-- their own row (withdrawal); consent-withdrawal deletion is the account/Edge path.
create policy "community_questions_delete_own" on public.community_questions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- --- 5. community_reactions (structured, anonymised → the docs/09 flywheel) ---------
create table public.community_reactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  note_id    uuid references public.community_notes (id),
  reaction   text not null check (reaction in ('helped', 'use_this')),  -- closed vocabulary, NEVER free text
  created_at timestamptz not null default now(),
  unique (user_id, note_id, reaction)
);
create index community_reactions_user_idx on public.community_reactions (user_id);
alter table public.community_reactions enable row level security;
create policy "community_reactions_select_own" on public.community_reactions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "community_reactions_insert_own" on public.community_reactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "community_reactions_delete_own" on public.community_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- --- 6. community_moderation_events (append-only audit; service-role only) ----------
create table public.community_moderation_events (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid references public.community_questions (id) on delete cascade,
  action      text not null check (action in ('approved', 'rejected', 'removed_after_report')),
  reason      text,
  acted_at    timestamptz not null default now()
);
alter table public.community_moderation_events enable row level security;
-- (no client policies — moderation audit is service-role only.)

-- --- 7. community_reports (Apple Guideline 1.2 mandatory floor: in-app report) ------
create table public.community_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.community_questions (id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index community_reports_question_idx on public.community_reports (question_id);
alter table public.community_reports enable row level security;
create policy "community_reports_select_own" on public.community_reports
  for select to authenticated using ((select auth.uid()) = reporter_id);
create policy "community_reports_insert_own" on public.community_reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);

-- --- community_blocks policies (the table itself is created earlier, in section 3,
-- so the community_questions approved-read policy can reference it) ------------------
create policy "community_blocks_select_own" on public.community_blocks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "community_blocks_insert_own" on public.community_blocks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "community_blocks_delete_own" on public.community_blocks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- NOTE (data-subject rights, docs/11 §7): account deletion cascades from auth.users;
-- community_participation consent withdrawal triggers an Edge Function that deletes the
-- user's questions + reactions (MHMDA/GDPR Art. 17 — no retention exception). Expert
-- community_notes persist (RoutineKind's content, not the user's). Deferred with the peer
-- phase (B-COMMUNITY-MOD).
