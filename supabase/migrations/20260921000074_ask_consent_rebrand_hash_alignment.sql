-- 0074 · align the current draft Ask consent tuples with the exact Layerwell
-- mobile/Edge disclosure bytes. Earlier draft tuples and staging events stay
-- immutable history; neither this migration nor the draft staging RPC approves
-- copy or permits a production grant.

begin;
set local lock_timeout = '5s';

do $$
begin
  perform *
    from public.stage_health_consent_copy_draft_successor(
      'ask_layerwell',
      'grant',
      'ask-advisor-2026-06-14-placeholder',
      '4bc7f130404b5d0d12aa52e0999efa72b1b68dd537fb90bbd708e60c561e1dcc',
      'ask-advisor-2026-06-14-placeholder',
      '242f45399eb0fc3a792124b641f733feae9bf8321291d7e2c49e2799b8623303',
      'DB-MIGRATION-20260921000074-ASK-GRANT-HASH-CORRECTION',
      'migration:20260921000074',
      '50f4ef320dd7511dced84061726410b77a9d355ee083b59431544dc9c6beecbc'
    );

  perform *
    from public.stage_health_consent_copy_draft_successor(
      'ask_layerwell',
      'withdraw',
      'ask-advisor-2026-06-14-placeholder',
      '5ef385c3e618e3a4167b7096b3d99ffe3d22468269f6d899a51527b7959c9aff',
      'ask-advisor-2026-06-14-placeholder',
      '4d0b588ed43f4680adaf6e7699641c706e113bed7b9212b408532235e4fe1e57',
      'DB-MIGRATION-20260921000074-ASK-WITHDRAW-HASH-CORRECTION',
      'migration:20260921000074',
      'b49e7353f63065127d49bf84564c8f3f48db1a61ec3c4c5e29f93a6da6c7db87'
    );
end;
$$;

commit;
