-- =============================================================================
-- 0025 · "Ask Layerwell" — the evidence-grounded conversational advisor (docs/13).
-- =============================================================================
-- The deferred, chosen-not-lifted feature. The TRUTH SOURCE is the on-device
-- deterministic engine (detectConflicts / generatePlan / recommend, docs/02/03/05/09)
-- + the curated, evidence-graded corpus; the LLM is only a CONSTRAINED narration
-- layer, and SUBSTANTIVE health claims are TEMPLATE-BOUNDED, never free-generated
-- (D-057). The deterministic advisor runs entirely on-device at $0 — nothing below
-- is needed for it to work; these tables are the (B-SUPABASE) metadata/audit scaffold
-- for when the cloud-grounded layer lands (B-AI-ASSISTANT-VENDOR).
--
-- *** NO long-term conversation content server-side (docs/13 §10). *** ask_sessions
-- and ask_turn_audit are CONTENT-FREE (intent + verdicts + cost + version pointers,
-- never the question or answer). The ONLY health-content store is ask_safety_audit:
-- a SHORT, encrypted, access-logged, CONSENTED safety-audit window (D-058) that exists
-- so a shipped claim-safety breach is detectable, a safety appeal is honourable, and an
-- EU-AI-Act / Annex-III audit is satisfiable — you cannot do any of those with zero
-- records. It is excluded from training/backup/sale and auto-purged after the window.
--
-- *** CHURCH AND STATE (docs/09 D-038/D-054). *** No commission/affiliate/rate column
-- exists in any Ask path. *** NO skin-photo analysis or score, ever (doc 12). ***

-- --- consent ledger extension: a NEW, separate, DEFAULT-OFF consent type (D-053) ----
-- The user's question is itself a health disclosure transmitted to the cloud layer
-- (MHMDA / GDPR Art. 9 attaches to the TRANSMISSION, not just storage); distinct from
-- every other consent. The deterministic on-device advisor needs no consent at all.
alter table public.consents
  drop constraint consents_consent_type_check,
  add constraint consents_consent_type_check check (consent_type in (
    'account', 'health_data_collection', 'photo_capture',
    'photo_cloud_backup', 'marketing', 'data_sharing', 'community_participation',
    'photo_trend_insights', 'ask_layerwell'));

-- --- ask_sessions — conversation METADATA only (NEVER the health-adjacent content) ---
create table public.ask_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  started_at    timestamptz not null default now(),
  turn_count    int not null default 0,
  last_intent   text,           -- the AskIntent of the most recent turn (no content)
  grounded_rate numeric,         -- share of turns answered from the corpus (vs refused)
  ended_clean   boolean not null default true,  -- true: no re-engagement was ever attempted
  model_tier    text             -- 'deterministic' | 'small' | 'frontier' (cost monitoring)
  -- *** NO message_text / transcript / health-disclosure column EXISTS, by construction.
  -- *** NO commission/affiliate/rate column EXISTS in any Ask path (D-038 church-and-state).
);
create index ask_sessions_user_idx on public.ask_sessions (user_id, started_at);

-- --- ask_turn_audit — per-turn CONTENT-FREE safety/cost/version ledger (§13) ---------
create table public.ask_turn_audit (
  id                        uuid primary key default gen_random_uuid(),
  session_id                uuid not null references public.ask_sessions (id) on delete cascade,
  intent                    text not null,                 -- the AskIntent (no content)
  answer_kind               text not null,                 -- 'deterministic'|'grounded'|'escalate'|'refuse'
  was_grounded              boolean not null,
  was_refused               boolean not null,
  was_escalated             boolean not null,
  claimsafety_ok            boolean not null,              -- the layered guard verdict (true to have shipped)
  narration_engine_mismatch boolean not null default false, -- §4 precedence-violation counter
  citation_faithful         boolean,                       -- §5 citation-faithfulness verdict (null = no citation)
  model_id_version          text,                          -- exact pinned snapshot (NOT a floating alias) — §7
  system_prompt_hash        text,                          -- reproducibility / regression attribution
  corpus_version            text,                          -- embedding-index / Skin-Notes snapshot grounding this turn
  est_cost_usd              numeric,
  created_at                timestamptz not null default now()
  -- *** still NO message content here — a safety/cost/version ledger, not a transcript.
);
create index ask_turn_audit_session_idx on public.ask_turn_audit (session_id, created_at);

-- --- ask_safety_audit — the SHORT, consented, encrypted breach-detection window (D-058)
-- The ONLY health-content store. Exists ONLY with ask_layerwell consent; excluded from
-- training / cloud backup / sale; auto-purged after expires_at; deleted on consent
-- revocation and account deletion. Resolves the "no transcript" vs "auditable / appealable
-- / EU-AI-Act-compliant" contradiction (docs/13 §7) — one coherent posture, not both.
create table public.ask_safety_audit (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  turn_audit_id uuid not null references public.ask_turn_audit (id) on delete cascade,
  content_enc   bytea not null,                            -- encrypted Q+A sample (breach-detection / appeal / audit ONLY)
  expires_at    timestamptz not null,                      -- a short window; a purge job deletes past this
  accessed_log  jsonb not null default '[]'::jsonb,        -- every read is logged (who / when / why)
  created_at    timestamptz not null default now()
);
create index ask_safety_audit_expiry_idx on public.ask_safety_audit (expires_at);

-- --- Owner-only RLS (docs/01 §3 pattern) on all three. Writes are local-first /
-- best-effort (the D-029 pattern); a server mirror is gated on the ask_layerwell consent.
alter table public.ask_sessions enable row level security;
create policy "ask_sessions_select_own" on public.ask_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ask_sessions_insert_own" on public.ask_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ask_sessions_update_own" on public.ask_sessions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "ask_sessions_delete_own" on public.ask_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.ask_turn_audit enable row level security;
-- turn-audit rows are owned via their session; the join is enforced in the policy.
create policy "ask_turn_audit_select_own" on public.ask_turn_audit
  for select to authenticated using (
    exists (select 1 from public.ask_sessions s
            where s.id = ask_turn_audit.session_id and s.user_id = (select auth.uid())));
create policy "ask_turn_audit_insert_own" on public.ask_turn_audit
  for insert to authenticated with check (
    exists (select 1 from public.ask_sessions s
            where s.id = ask_turn_audit.session_id and s.user_id = (select auth.uid())));
create policy "ask_turn_audit_delete_own" on public.ask_turn_audit
  for delete to authenticated using (
    exists (select 1 from public.ask_sessions s
            where s.id = ask_turn_audit.session_id and s.user_id = (select auth.uid())));

alter table public.ask_safety_audit enable row level security;
create policy "ask_safety_audit_select_own" on public.ask_safety_audit
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ask_safety_audit_insert_own" on public.ask_safety_audit
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ask_safety_audit_delete_own" on public.ask_safety_audit
  for delete to authenticated using ((select auth.uid()) = user_id);

-- NOTE (deletion-on-revocation, docs/13 §7/§10): on ask_layerwell consent withdrawal an
-- Edge Function / local task DELETES the user's ask_safety_audit rows (no retention
-- exception, MHMDA / GDPR Art. 17); account deletion cascades from auth.users. The
-- content-free metadata may be retained for the kill-criteria dashboards. The whole
-- cloud-grounded path is deferred behind B-AI-ASSISTANT-VENDOR / B-AI-ASSISTANT-LEGAL.
