select version::text as migration_id
from supabase_migrations.schema_migrations
order by version;
