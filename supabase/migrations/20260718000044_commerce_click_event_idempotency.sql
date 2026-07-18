-- One random click token represents one explicit handoff attempt. Collapse any
-- historical duplicate retries before enforcing the durable operation identity.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, click_token
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.commerce_click_events
)
delete from public.commerce_click_events as event
using ranked
where event.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index commerce_click_events_user_token_uidx
  on public.commerce_click_events (user_id, click_token);

comment on index public.commerce_click_events_user_token_uidx is
  'Durable idempotency identity for one content-free commerce handoff attempt.';
