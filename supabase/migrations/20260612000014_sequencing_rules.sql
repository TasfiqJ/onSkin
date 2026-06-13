-- =============================================================================
-- 0014 · sequencing_rules  (application-order, docs/03 §3)
-- =============================================================================
-- Application order encoded as versioned data, not hard-coded logic (docs/03 §3,
-- DECISIONS D-022). Catalog-style: world-readable to authenticated (incl. anon),
-- service-role writes (mirrors docs/02 §3). Pure ordering is low-risk cosmetic
-- optimisation; the ramp/frequency/cycling that ride on top are medical-adjacent
-- and fall under B-DERM-REVIEW (docs/03 §11) — so reviewed_by is NULL here too.
create table public.sequencing_rules (
  id            uuid primary key default gen_random_uuid(),
  role          text not null,        -- cleanser/toner/antioxidant/treatment/exfoliant/hydrating_serum/eye/moisturiser/oil/spf
  base_priority int  not null,        -- lower = applied earlier (cleanser=10 … spf=100)
  am_eligible   boolean not null default true,
  pm_eligible   boolean not null default true,
  default_phase text not null default 'either' check (default_phase in ('am', 'pm', 'either')),
  notes         text,                 -- claim-safe microcopy seed
  rule_version  int  not null default 1,
  reviewed_by   text,                 -- NULL until B-DERM-REVIEW
  is_active     boolean not null default true,
  unique (role, rule_version)
);

alter table public.sequencing_rules enable row level security;
create policy "sequencing_rules_read_active" on public.sequencing_rules
  for select to authenticated using (is_active);

-- Starter sequencing rules (docs/03 §3 canonical AM/PM order). Thin→thick,
-- low-pH-first, water-before-oil; SPF always last in the morning.
insert into public.sequencing_rules (role, base_priority, am_eligible, pm_eligible, default_phase, notes, reviewed_by) values
  ('cleanser',        10,  true,  true,  'either', 'Start with a clean base.', null),
  ('toner',           20,  true,  true,  'either', 'Optional — a hydrating or balancing layer.', null),
  ('antioxidant',     30,  true,  true,  'am',     'Vitamin C in the morning, under your SPF.', null),
  ('hydrating_serum', 35,  true,  true,  'either', 'A lightweight hydrating layer.', null),
  ('treatment',       40,  false, true,  'pm',     'Apply to dry skin · pea-sized · avoid the eye area.', null),
  ('exfoliant',       45,  false, true,  'pm',     'On exfoliation nights only.', null),
  ('eye',             50,  true,  true,  'either', 'A gentle pat around the eye area.', null),
  ('moisturiser',     60,  true,  true,  'either', 'Seal everything in.', null),
  ('oil',             70,  false, true,  'pm',     'Optional — a final nourishing layer at night.', null),
  ('spf',             100, true,  false, 'am',     'Always the last morning step. Reapply through the day.', null);
