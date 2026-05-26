create or replace function public.tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

do $$
begin
  if to_regclass('public.tenants') is not null then
    drop policy if exists "tenant isolation" on public.tenants;
    create policy "tenant isolation" on public.tenants
      for select
      using (id = public.tenant_id());

    drop policy if exists "superadmin all tenants" on public.tenants;
    create policy "superadmin all tenants" on public.tenants
      for all
      using (public.current_user_role() = 'superadmin')
      with check (public.current_user_role() = 'superadmin');

    drop policy if exists "superadmin manage tenants" on public.tenants;
    create policy "superadmin manage tenants" on public.tenants
      for all
      using (public.current_user_role() = 'superadmin')
      with check (public.current_user_role() = 'superadmin');
  end if;

  if to_regclass('public.profiles') is not null then
    drop policy if exists "own profile" on public.profiles;
    create policy "own profile" on public.profiles
      for select
      using (id = auth.uid());

    drop policy if exists "superadmin manage profiles" on public.profiles;
    create policy "superadmin manage profiles" on public.profiles
      for all
      using (public.current_user_role() = 'superadmin')
      with check (public.current_user_role() = 'superadmin');
  end if;
end $$;
