alter table if exists catalog_cache
add column if not exists meta jsonb;
