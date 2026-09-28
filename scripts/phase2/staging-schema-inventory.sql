select
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  ) as public_tables,
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity
  ) as public_rls_tables,
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'v'
  ) as public_views,
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind = 'm'
  ) as public_materialized_views,
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
  ) as public_functions,
  (
    select count(*)::integer
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('i', 'I')
  ) as public_indexes,
  (
    select count(*)::integer
    from pg_catalog.pg_trigger as trigger
    join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and not trigger.tgisinternal
  ) as public_triggers,
  (
    select count(*)::integer
    from pg_catalog.pg_policy as policy
    join pg_catalog.pg_class as relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
  ) as public_policies,
  (
    select count(*)::integer
    from pg_catalog.pg_type as type
    join pg_catalog.pg_namespace as namespace on namespace.oid = type.typnamespace
    where namespace.nspname = 'public'
      and type.typtype = 'e'
  ) as public_enums,
  (
    (
      select count(*)
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind not in ('r', 'p', 'v', 'm', 'i', 'I')
    ) +
    (
      select count(*)
      from pg_catalog.pg_type as type
      join pg_catalog.pg_namespace as namespace on namespace.oid = type.typnamespace
      where namespace.nspname = 'public'
        and type.typtype <> 'e'
        and type.typrelid = 0
    ) +
    (
      select count(*)
      from pg_catalog.pg_collation as collation
      join pg_catalog.pg_namespace as namespace on namespace.oid = collation.collnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_conversion as conversion
      join pg_catalog.pg_namespace as namespace on namespace.oid = conversion.connamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_operator as operator
      join pg_catalog.pg_namespace as namespace on namespace.oid = operator.oprnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_opclass as operator_class
      join pg_catalog.pg_namespace as namespace on namespace.oid = operator_class.opcnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_opfamily as operator_family
      join pg_catalog.pg_namespace as namespace on namespace.oid = operator_family.opfnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_ts_config as text_search_config
      join pg_catalog.pg_namespace as namespace on namespace.oid = text_search_config.cfgnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_ts_dict as text_search_dictionary
      join pg_catalog.pg_namespace as namespace on namespace.oid = text_search_dictionary.dictnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_ts_parser as text_search_parser
      join pg_catalog.pg_namespace as namespace on namespace.oid = text_search_parser.prsnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_ts_template as text_search_template
      join pg_catalog.pg_namespace as namespace on namespace.oid = text_search_template.tmplnamespace
      where namespace.nspname = 'public'
    ) +
    (
      select count(*)
      from pg_catalog.pg_constraint as catalog_constraint
      join pg_catalog.pg_namespace as namespace on namespace.oid = catalog_constraint.connamespace
      where namespace.nspname = 'public'
        and catalog_constraint.conrelid = 0
    ) +
    (
      select count(*)
      from pg_catalog.pg_extension as extension
      join pg_catalog.pg_namespace as namespace on namespace.oid = extension.extnamespace
      where namespace.nspname = 'public'
    )
  )::integer as public_other_objects,
  (
    select count(*)::integer
    from auth.users
  ) as auth_users,
  (
    select count(*)::integer
    from auth.identities
  ) as auth_identities,
  (
    select count(*)::integer
    from auth.identities
    where provider = 'apple'
  ) as apple_identities,
  (
    select count(*)::integer
    from auth.sessions
  ) as auth_sessions,
  (
    select count(*)::integer
    from storage.buckets
  ) as storage_buckets,
  (
    select count(*)::integer
    from storage.objects
  ) as storage_objects;
