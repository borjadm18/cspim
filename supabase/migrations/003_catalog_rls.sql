create or replace function public.tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

do $$
begin
  if to_regclass('public.products') is not null then
    alter table public.products enable row level security;

    drop policy if exists "tenant_products_access" on public.products;
    create policy "tenant_products_access" on public.products
      for all
      using (tenant_id = public.tenant_id())
      with check (tenant_id = public.tenant_id());

    drop policy if exists "superadmin_products_all" on public.products;
    create policy "superadmin_products_all" on public.products
      for all
      using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role = 'superadmin'
        )
      );
  end if;

  if to_regclass('public.product_images') is not null then
    alter table public.product_images enable row level security;

    drop policy if exists "tenant_product_images_access" on public.product_images;
    create policy "tenant_product_images_access" on public.product_images
      for all
      using (
        product_id in (
          select id from public.products where tenant_id = public.tenant_id()
        )
      );
  end if;

  if to_regclass('public.product_attributes') is not null then
    alter table public.product_attributes enable row level security;

    drop policy if exists "tenant_product_attributes_access" on public.product_attributes;
    create policy "tenant_product_attributes_access" on public.product_attributes
      for all
      using (
        product_id in (
          select id from public.products where tenant_id = public.tenant_id()
        )
      );
  end if;

  if to_regclass('public.product_attachments') is not null then
    alter table public.product_attachments enable row level security;

    drop policy if exists "tenant_product_attachments_access" on public.product_attachments;
    create policy "tenant_product_attachments_access" on public.product_attachments
      for all
      using (
        product_id in (
          select id from public.products where tenant_id = public.tenant_id()
        )
      );
  end if;

  if to_regclass('public.categories') is not null then
    alter table public.categories enable row level security;

    drop policy if exists "tenant_categories_access" on public.categories;
    create policy "tenant_categories_access" on public.categories
      for all
      using (tenant_id = public.tenant_id())
      with check (tenant_id = public.tenant_id());
  end if;

  if to_regclass('public.organization_settings') is not null then
    alter table public.organization_settings enable row level security;

    drop policy if exists "tenant_org_settings_access" on public.organization_settings;
    create policy "tenant_org_settings_access" on public.organization_settings
      for all
      using (tenant_id = public.tenant_id())
      with check (tenant_id = public.tenant_id());
  end if;
end $$;
