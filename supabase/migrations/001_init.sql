create extension if not exists pgcrypto;

-- Tenants
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#1B3A5C',
  primary_hover text not null default '#152E4A',
  primary_text text not null default '#ffffff',
  created_at timestamptz default now()
);

-- Profiles (extiende auth.users de Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  role text not null check (role in ('superadmin', 'admin', 'content_manager', 'comercial')),
  full_name text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table tenants enable row level security;
alter table profiles enable row level security;

-- Un usuario solo ve su propio tenant
create policy "tenant isolation" on tenants
  for select using (
    id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "own profile" on profiles
  for select using (id = auth.uid());

-- Superadmin ve todo (gestionar desde Supabase dashboard)
create policy "superadmin all tenants" on tenants
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );

create or replace function public.custom_jwt_claims()
returns jsonb
language plpgsql
stable
as $$
declare
  profile_row profiles%rowtype;
begin
  select * into profile_row from profiles where id = auth.uid();
  return jsonb_build_object(
    'tenant_id', profile_row.tenant_id,
    'role', profile_row.role
  );
end;
$$;
