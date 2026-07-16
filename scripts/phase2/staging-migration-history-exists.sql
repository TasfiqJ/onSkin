select (
  to_regclass('supabase_migrations.schema_migrations') is not null
) as migration_history_exists;
