create table catalog_cache (
  tenant_key text primary key,
  products jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Service role bypasses RLS automatically — no policies needed for server-side writes.
-- If you need to inspect the cache via dashboard with anon key, add a permissive SELECT policy.
