create table if not exists public.catalog_index (
  tenant_key text primary key,
  products   jsonb not null,
  fetched_at timestamptz not null default now()
);
-- Service role bypasses RLS automatically.
