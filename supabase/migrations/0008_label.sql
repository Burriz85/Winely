-- Etikettlesing: druer på manuelle viner, og egen kilde i api_health for kallene til Claude.
drop function public.create_manual_product(uuid, text, text, text, int, numeric, text, text);
create function public.create_manual_product(p_id uuid, p_name text, p_producer text default null,
  p_type text default null, p_vintage int default null, p_price numeric default null,
  p_country text default null, p_region text default null, p_grapes text[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not is_active() then raise exception 'forbidden'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'navn mangler'; end if;
  if p_type is not null and p_type not in ('Rødvin','Hvitvin','Musserende','Rosévin') then raise exception 'ugyldig type'; end if;
  insert into products (id, vmp_nr, name, producer, type, vintage, price, country, region, grapes)
    values (p_id, null, trim(p_name), nullif(trim(p_producer), ''), p_type, p_vintage, p_price,
            nullif(trim(p_country), ''), nullif(trim(p_region), ''), nullif(p_grapes, '{}'))
  on conflict (id) do nothing;
  return p_id;
end $$;

alter table public.api_health drop constraint if exists api_health_source_check;
alter table public.api_health add constraint api_health_source_check
  check (source in ('proxy','sync','test','web','label'));
