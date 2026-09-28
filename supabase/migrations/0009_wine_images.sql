-- Bilder av viner som ikke finnes hos Vinmonopolet (etikettbildet, eller et eget bilde fra vinsiden).
-- Offentlig lesbar bøtte: adressene er tilfeldige (produkt-id + tidsstempel), men alle med lenken ser bildet.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wine-images', 'wine-images', true, 2000000, array['image/jpeg'])
on conflict (id) do nothing;

-- Aktive brukere kan laste opp under manual/. Ingen kan endre eller slette andres filer (bare admin via dashboardet).
create policy "aktive laster opp vinbilder" on storage.objects for insert to authenticated
  with check (bucket_id = 'wine-images' and (storage.foldername(name))[1] = 'manual' and public.is_active());

-- Knytt et opplastet bilde til en manuell vin i et skap du er medlem av.
create function public.set_wine_image(p_cellar uuid, p_product uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_cellar) then raise exception 'forbidden'; end if;
  if not exists (select 1 from cellar_items where cellar_id = p_cellar and product_id = p_product) then
    raise exception 'vinen er ikke i skapet';
  end if;
  if exists (select 1 from products where id = p_product and vmp_nr is not null) then
    raise exception 'bildet kommer fra Vinmonopolet for denne vinen';
  end if;
  if p_url !~ '/storage/v1/object/public/wine-images/manual/[0-9a-f-]{36}-\d+\.jpg$' then
    raise exception 'ugyldig bildeadresse';
  end if;
  update products set image_url = p_url where id = p_product;
end $$;
