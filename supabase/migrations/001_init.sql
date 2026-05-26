create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#1B3A5C',
  primary_hover text not null default '#152E4A',
  primary_text text not null default '#ffffff',
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  role text not null check (role in ('superadmin', 'admin', 'content_manager', 'comercial')),
  full_name text,
  created_at timestamptz default now()
);

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'tenant isolation'
  ) then
    create policy "tenant isolation" on public.tenants
      for select using (
        id = (select tenant_id from public.profiles where id = auth.uid())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'own profile'
  ) then
    create policy "own profile" on public.profiles
      for select using (id = auth.uid());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'superadmin all tenants'
  ) then
    create policy "superadmin all tenants" on public.tenants
      for all using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'superadmin'
        )
      );
  end if;
end $$;

create or replace function public.custom_jwt_claims()
returns jsonb
language plpgsql
stable
as $$
declare
  profile_row public.profiles%rowtype;
begin
  select * into profile_row from public.profiles where id = auth.uid();
  return jsonb_build_object(
    'tenant_id', profile_row.tenant_id,
    'role', profile_row.role
  );
end;
$$;
