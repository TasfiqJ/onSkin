-- Keep server Shelf rows aligned with the local freshness state machine.
-- Existing rows without a trustworthy opened date become unopened; no date is invented.

update public.user_products
set is_opened = false
where is_opened = true
  and opened_at is null;

update public.user_products
set opened_at = null
where is_opened = false
  and opened_at is not null;

update public.user_products
set is_opened = false,
    opened_at = null
where opened_at > current_date;

update public.user_products
set pao_source = case when pao_months is null then 'unknown' else coalesce(pao_source, 'unknown') end;

update public.user_products
set expiry_source = case
  when is_opened = false and expiry_date is not null then 'printed'
  when is_opened = false then 'estimated'
  when expiry_computed is null then 'unknown'
  when expiry_date is not null and expiry_computed = expiry_date then 'printed'
  else 'pao_computed'
end;

alter table public.user_products
  alter column is_opened set default false,
  alter column pao_source set default 'unknown',
  alter column pao_source set not null,
  alter column expiry_source set default 'unknown',
  alter column expiry_source set not null;

alter table public.user_products
  add constraint user_products_opened_state_coherent
    check (
      (is_opened = true and opened_at is not null and opened_at <= current_date)
      or (is_opened = false and opened_at is null)
    ),
  add constraint user_products_pao_source_coherent
    check (
      (pao_months is null and pao_source = 'unknown')
      or pao_months is not null
    ),
  add constraint user_products_expiry_source_coherent
    check (
      expiry_source = case
        when is_opened = false and expiry_date is not null then 'printed'
        when is_opened = false then 'estimated'
        when expiry_computed is null then 'unknown'
        when expiry_date is not null and expiry_computed = expiry_date then 'printed'
        else 'pao_computed'
      end
    );
