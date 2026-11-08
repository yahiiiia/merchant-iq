-- SELECT-only release inventory, not a migration or fixture script.
-- Obtain target identity from the independently verified connection, not current_database().
SELECT jsonb_build_object(
  'serverVersion', current_setting('server_version'),
  'tables', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'name', c.relname, 'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity,
      'owner', pg_get_userbyid(c.relowner)
    ) ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  ),
  'policies', (
    SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname), '[]'::jsonb)
    FROM pg_policies p WHERE p.schemaname = 'public'
  ),
  'grants', (
    SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.table_name, g.grantee, g.privilege_type), '[]'::jsonb)
    FROM information_schema.table_privileges g
    WHERE g.table_schema = 'public' AND g.grantee IN ('anon','authenticated','service_role')
  ),
  'columns', (
    SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.table_name, a.ordinal_position), '[]'::jsonb)
    FROM (
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
      FROM information_schema.columns WHERE table_schema = 'public'
    ) a
  ),
  'constraints', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'table', r.relname, 'name', c.conname, 'validated', c.convalidated,
      'definition', pg_get_constraintdef(c.oid, true)
    ) ORDER BY r.relname, c.conname), '[]'::jsonb)
    FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public'
  ),
  'functions', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'signature', p.oid::regprocedure::text, 'definer', p.prosecdef,
      'config', p.proconfig, 'acl', p.proacl, 'definition', pg_get_functiondef(p.oid)
    ) ORDER BY p.proname, p.oid::regprocedure::text), '[]'::jsonb)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'crm_%' AND p.prokind = 'f'
  ),
  'triggers', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', r.relname, 'name', t.tgname,
      'enabled', t.tgenabled, 'definition', pg_get_triggerdef(t.oid, true)
    ) ORDER BY n.nspname, r.relname, t.tgname), '[]'::jsonb)
    FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE NOT t.tgisinternal AND (n.nspname = 'public' OR (n.nspname = 'auth' AND r.relname = 'users'))
  ),
  'migrationRelations', (
    SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations' AND c.relkind IN ('r','p')
  )
) AS catalog_inventory;
