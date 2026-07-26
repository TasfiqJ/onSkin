-- Shelf freshness dates are user-local calendar dates. A user's local "today"
-- can be the server's UTC tomorrow, so compare against an explicit UTC date
-- boundary instead of the session-dependent current_date.
--
-- Install and validate the relaxed constraint before removing the original so
-- the opened/unopened coherence invariant remains enforced throughout.

alter table public.user_products
  add constraint user_products_opened_state_coherent_utc_tomorrow
    check (
      (
        is_opened = true
        and opened_at is not null
        and opened_at <= (
          (pg_catalog.statement_timestamp() at time zone 'UTC')::date + 1
        )
      )
      or (is_opened = false and opened_at is null)
    )
    not valid;

alter table public.user_products
  validate constraint user_products_opened_state_coherent_utc_tomorrow;

alter table public.user_products
  drop constraint user_products_opened_state_coherent;

alter table public.user_products
  rename constraint user_products_opened_state_coherent_utc_tomorrow
    to user_products_opened_state_coherent;
