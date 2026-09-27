-- Viner som ikke finnes hos Vinmonopolet: produkter uten varenummer.
-- Id-en lages i appen, så operasjonen er idempotent i offline-køen (kjøres den to ganger, skjer ingenting).
-- Admin-siden Duplikater fanger opp manuelle viner som ligner en vin med varenummer.

create function public.create_manual_product(p_id uuid, p_name text, p_producer text default null,
  p_type text default null, p_vintage int default null, p_price numeric default null,
  p_country text default null, p_region text default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not is_active() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'navn mangler'; end if;
  if p_type is not null and p_type not in ('Rødvin','Hvitvin','Musserende','Rosévin') then raise exception 'ugyldig type'; end if;
  insert into products (id, vmp_nr, name, producer, type, vintage, price, country, region)
    values (p_id, null, trim(p_name), nullif(trim(p_producer), ''), p_type, p_vintage, p_price,
            nullif(trim(p_country), ''), nullif(trim(p_region), ''))
  on conflict (id) do nothing;
  return p_id;
end $$;

-- «Endre» for manuelle viner: navn, produsent, land og distrikt (for Vinmonopolet-viner kommer disse fra Vinmonopolet).
create function public.update_manual_details(p_cellar uuid, p_product uuid, p_name text, p_producer text,
                                             p_country text, p_region text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_cellar) then raise exception 'forbidden'; end if;
  if not exists (select 1 from cellar_items where cellar_id = p_cellar and product_id = p_product) then
    raise exception 'vinen er ikke i skapet';
  end if;
  if exists (select 1 from products where id = p_product and vmp_nr is not null) then
    raise exception 'navn og opprinnelse kommer fra Vinmonopolet for denne vinen';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'navn mangler'; end if;
  update products set name = trim(p_name), producer = nullif(trim(p_producer), ''),
                      country = nullif(trim(p_country), ''), region = nullif(trim(p_region), '')
   where id = p_product;
end $$;
