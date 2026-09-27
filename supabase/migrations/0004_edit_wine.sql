-- «Endre» på vindetaljen: rett opp type, årgang, pris og drikkevindu.
-- Type, årgang og pris ligger på produktet og deles av alle skap. Bare medlemmer av et skap
-- som har vinen, kan endre dem. Drikkevinduet gjelder bare dette skapet.
create function public.update_wine(p_cellar uuid, p_product uuid, p_type text, p_vintage int,
                                   p_price numeric, p_from int, p_to int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_cellar) then raise exception 'forbidden'; end if;
  if not exists (select 1 from cellar_items where cellar_id = p_cellar and product_id = p_product) then
    raise exception 'vinen er ikke i skapet';
  end if;
  if p_type is not null and p_type not in ('Rødvin','Hvitvin','Musserende','Rosévin') then raise exception 'ugyldig type'; end if;
  if p_vintage is not null and (p_vintage < 1900 or p_vintage > extract(year from now())::int + 1) then raise exception 'ugyldig årgang'; end if;
  if p_price is not null and p_price < 0 then raise exception 'ugyldig pris'; end if;
  if p_from is not null and p_to is not null and p_from > p_to then raise exception 'drikkevinduet slutter før det starter'; end if;
  update products set type = p_type, vintage = p_vintage, price = p_price where id = p_product;
  update cellar_items set drink_from = p_from, drink_to = p_to where cellar_id = p_cellar and product_id = p_product;
end $$;
