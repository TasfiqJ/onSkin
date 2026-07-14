-- Phase 8 growth loop tables. These tables intentionally store only contact-free
-- growth attribution and waitlist contact submitted directly by the user.

-- Supabase provisions the `extensions` schema in a fresh project, but citext is
-- opt-in. Keep this dependency next to its first use so full source replay is
-- deterministic; no hosted migration history is inferred from this repair.
create extension if not exists citext with schema extensions;

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  source text not null default 'unknown',
  attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  event text not null check (
    event in (
      'landing_viewed',
      'store_click',
      'install',
      'onboarding_started',
      'first_product_added',
      'first_reviewed_insight_viewed',
      'trial_started',
      'paid_started'
    )
  ),
  source text,
  medium text,
  campaign text,
  content text,
  term text,
  creative_variant text,
  landing_variant text,
  platform text,
  app_version text,
  build_number text,
  store text,
  share_id text,
  created_at timestamptz not null default now()
);

alter table public.growth_events enable row level security;

create index if not exists growth_events_event_created_idx
  on public.growth_events (event, created_at desc);

create index if not exists growth_events_share_id_idx
  on public.growth_events (share_id)
  where share_id is not null;
