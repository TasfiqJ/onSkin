-- Phase 9 public Edge Function abuse controls.
-- Stores only keyed-hashed request keys; raw IPs/user agents must not be persisted.

create table if not exists public.edge_rate_limits (
  scope text not null check (scope ~ '^[a-z0-9_-]{1,64}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds between 60 and 86400),
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_start)
);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;

create index if not exists edge_rate_limits_updated_idx
  on public.edge_rate_limits (updated_at);

create or replace function public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_request_count integer;
begin
  if p_scope is null or p_scope !~ '^[a-z0-9_-]{1,64}$' then
    raise exception 'invalid scope';
  end if;

  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid key hash';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid limit';
  end if;

  if p_window_seconds is null or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'invalid window';
  end if;

  v_window_start :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.edge_rate_limits (
    scope,
    key_hash,
    window_start,
    window_seconds,
    request_count
  )
  values (
    p_scope,
    p_key_hash,
    v_window_start,
    p_window_seconds,
    1
  )
  on conflict (scope, key_hash, window_start)
  do update set
    request_count = public.edge_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_request_count;

  if random() < 0.01 then
    delete from public.edge_rate_limits
    where window_start < now() - make_interval(secs => greatest(p_window_seconds * 4, 3600));
  end if;

  return v_request_count <= p_limit;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, text, integer, integer) to service_role;
