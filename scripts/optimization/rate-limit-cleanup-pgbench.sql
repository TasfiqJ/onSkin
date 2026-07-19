\set txn_no :txn_no + 1

select public.consume_edge_rate_limit(
  case when :key_mode = 1 then 'load_hot' else 'load_many' end,
  case
    when :key_mode = 1 then repeat('a', 64)
    else
      md5(:client_id::text || ':' || :txn_no::text) ||
      md5('fixture-only:' || :client_id::text || ':' || :txn_no::text)
  end,
  1000,
  900
);
