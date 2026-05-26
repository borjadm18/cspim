do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tenants'
      and policyname = 'superadmin manage tenants'
  ) then
    create policy "superadmin manage tenants" on public.tenants
      for all using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'superadmin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'superadmin'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'superadmin manage profiles'
  ) then
    create policy "superadmin manage profiles" on public.profiles
      for all using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'superadmin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'superadmin'
        )
      );
  end if;
end $$;
