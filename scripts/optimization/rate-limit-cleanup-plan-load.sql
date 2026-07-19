\set ON_ERROR_STOP on

truncate table public.edge_rate_limits;

alter table public.edge_rate_limits set (autovacuum_enabled = false);

insert into public.edge_rate_limits (
  scope,
  key_hash,
  window_start,
  window_seconds,
  request_count,
  created_at,
  updated_at
)
select
  'fixture_' || (fixture_id % 16)::text,
  repeat(lpad(to_hex(fixture_id), 16, '0'), 4),
  to_timestamp(
    floor(extract(epoch from now()) / fixture_window.window_seconds) *
    fixture_window.window_seconds
  ),
  fixture_window.window_seconds,
  1 + (fixture_id % 80)::integer,
  now(),
  now()
from generate_series(1, :fresh_rows::bigint) as fixture(fixture_id)
cross join lateral (
  select case when fixture_id % 4 = 0 then 3600 else 900 end as window_seconds
) as fixture_window;

insert into public.edge_rate_limits (
  scope,
  key_hash,
  window_start,
  window_seconds,
  request_count,
  created_at,
  updated_at
)
select
  'fixture_' || (fixture_id % 16)::text,
  repeat(lpad(to_hex(:fresh_rows::bigint + fixture_id), 16, '0'), 4),
  date_trunc('minute', now()) - make_interval(hours => (2 + fixture_id % 72)::integer),
  case when fixture_id % 4 = 0 then 3600 else 900 end,
  1 + (fixture_id % 80)::integer,
  now() - make_interval(hours => (2 + fixture_id % 72)::integer),
  now() - make_interval(hours => (2 + fixture_id % 72)::integer)
from generate_series(1, :stale_rows::bigint) as fixture(fixture_id);

analyze public.edge_rate_limits;
