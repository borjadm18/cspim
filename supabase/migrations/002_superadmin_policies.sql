create policy "superadmin manage tenants" on tenants
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );

create policy "superadmin manage profiles" on profiles
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'superadmin'
    )
  );
