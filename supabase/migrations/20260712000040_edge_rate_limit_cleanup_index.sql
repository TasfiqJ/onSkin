-- Align the index with consume_edge_rate_limit's existing opportunistic cleanup
-- predicate. This does not choose a retention period or install a schedule.

create index if not exists edge_rate_limits_window_start_idx
  on public.edge_rate_limits (window_start);
