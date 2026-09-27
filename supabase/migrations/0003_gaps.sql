-- 0003: Det UI-et i prototypene trenger, men som 0001/0002 mangler, og noen sikkerhetsfikser.
-- Alt her er tillegg. 0001 og 0002 er uendret (bortsett fra pg_trgm øverst i 0002).

-- ─────────────────────────────────────────────────────────────
-- 1. Sikkerhet
-- ─────────────────────────────────────────────────────────────

-- Policyen «egen profil» (for all) lot en bruker kjøre
--   update profiles set is_admin = true, status = 'aktiv' where id = auth.uid();
-- Vanlige brukere får nå bare endre navnet sitt. Status og is_admin endres av
-- edge-funksjonen admin-invite med service role.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;

create function public.is_active() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and status = 'aktiv') $$;

-- Deaktiverte eiere skal heller ikke kunne styre invitasjoner.
create or replace function public.is_owner(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from cellar_members m join profiles p on p.id = m.user_id
                  where m.cellar_id = c and m.user_id = auth.uid() and m.role = 'owner' and p.status = 'aktiv') $$;

-- Admin skriver egne handlinger til loggen (Strekkoder-siden bruker vanlige tabellkall).
create policy "admin skriver logg" on audit_log for insert with check (is_admin() and actor = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. Produkter: brukere oppretter, men kan ikke overskrive andres data
-- ─────────────────────────────────────────────────────────────

-- Type, årgang og pris fylles bare inn hvis de mangler (første registrering vinner).
-- Navn og bilde oppdateres bare fra Vinmonopolet (edge-funksjonen vmp-sync).
create function public.ensure_product(p_vmp_nr text, p_name text, p_type text default null,
                                      p_vintage int default null, p_price numeric default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not is_active() then raise exception 'forbidden'; end if;
  if p_vmp_nr is null or p_vmp_nr !~ '^\d{1,12}$' then raise exception 'ugyldig varenummer'; end if;
  if p_type is not null and p_type not in ('Rødvin','Hvitvin','Musserende','Rosévin') then raise exception 'ugyldig type'; end if;
  insert into products (vmp_nr, name, type, vintage, price, image_url)
    values (p_vmp_nr, coalesce(nullif(trim(p_name), ''), 'Ukjent'), p_type, p_vintage, p_price,
            'https://bilder.vinmonopolet.no/cache/300x300-0/' || p_vmp_nr || '-1.jpg')
  on conflict (vmp_nr) do update set
    type    = coalesce(products.type, excluded.type),
    vintage = coalesce(products.vintage, excluded.vintage),
    price   = coalesce(products.price, excluded.price)
  returning id into pid;
  return pid;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3. Strekkoder: skann-telling, forslag og konflikter
-- ─────────────────────────────────────────────────────────────

alter table public.ean_map add column hits int not null default 0;

create table public.scan_events (
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  ean text not null,
  hit boolean not null,
  at timestamptz not null default now()
);
alter table scan_events enable row level security;
create policy "admin leser skann" on scan_events for select using (is_admin());
create index scan_events_at on scan_events (at);

-- Kalles av skanneren. Teller treff og returnerer produktet (0 rader = ukjent strekkode).
create function public.lookup_ean(p_ean text) returns setof public.products
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  update ean_map set hits = hits + 1 where ean = p_ean returning product_id into pid;
  insert into scan_events (user_id, ean, hit) values (auth.uid(), p_ean, pid is not null);
  return query select * from products where id = pid;
end $$;

-- «Hvilken vin er dette?» → brukeren valgte et produkt.
-- Første forslag blir koblingen. Et forslag om et annet produkt blir en konflikt.
create function public.suggest_ean(p_ean text, p_product uuid) returns text
language plpgsql security definer set search_path = public as $$
declare cur uuid; nr text;
begin
  if not is_active() then raise exception 'forbidden'; end if;
  if p_ean !~ '^\d{8,14}$' then raise exception 'ugyldig strekkode'; end if;
  select vmp_nr into nr from products where id = p_product;
  if not found then raise exception 'ukjent produkt'; end if;
  insert into ean_suggestions (ean, product_id, created_by) values (p_ean, p_product, auth.uid())
    on conflict do nothing;
  select product_id into cur from ean_map where ean = p_ean;
  if cur is null then
    insert into ean_map (ean, product_id, created_by) values (p_ean, p_product, auth.uid());
    insert into audit_log (actor, kind, action, target) values (auth.uid(), 'ean', 'Koblet strekkode', p_ean || ' → ' || coalesce(nr, '?'));
    return 'mapped';
  elsif cur = p_product then
    return 'same';
  end if;
  insert into audit_log (actor, kind, action, target) values (auth.uid(), 'ean', 'Foreslo annen vin for strekkode', p_ean || ' → ' || coalesce(nr, '?'));
  return 'conflict';
end $$;

-- Admin: alle koblinger og forslag, med konfliktflagg.
create view public.admin_eans with (security_invoker = true) as
  with s as (
    select ean, product_id, created_by, created_at from ean_suggestions
    union all
    select ean, product_id, created_by, created_at from ean_map
  ), d as (
    select distinct on (ean, product_id) ean, product_id, created_by, created_at
      from s order by ean, product_id, created_at
  )
  select d.ean, d.product_id, p.vmp_nr, p.name, d.created_by, d.created_at,
         coalesce(m.product_id = d.product_id, false) as mapped,
         case when m.product_id = d.product_id then m.hits else 0 end as hits,
         (select count(distinct s2.product_id) from s s2 where s2.ean = d.ean) > 1 as conflict
    from d join products p on p.id = d.product_id
    left join ean_map m on m.ean = d.ean
   where is_admin();   -- ean_map er lesbar for alle innloggede, men denne oversikten er for admin

-- ─────────────────────────────────────────────────────────────
-- 4. Deling av skap (Profil → Del skapet)
-- ─────────────────────────────────────────────────────────────
-- Profiler er private, så eieren trenger disse for å se og invitere medlemmer på e-post.

create function public.cellar_people(p_cellar uuid)
returns table (email text, role text, pending boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select u.email::text, m.role, false, m.user_id = auth.uid()
    from cellar_members m join auth.users u on u.id = m.user_id
   where m.cellar_id = p_cellar and (is_member(p_cellar) or is_admin())
  union all
  select i.email, 'member', true, false
    from cellar_invites i
   where i.cellar_id = p_cellar and (is_member(p_cellar) or is_admin())
$$;

-- Finnes brukeren, blir hen medlem med én gang. Ellers venter invitasjonen til kontoen opprettes
-- (handle_new_user). Det sendes ingen e-post herfra; tjenesteinvitasjonen går via admin.
create function public.invite_to_cellar(p_cellar uuid, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid; e text := lower(trim(p_email));
begin
  if not is_owner(p_cellar) then raise exception 'forbidden'; end if;
  if e !~ '^\S+@\S+\.\S+$' then raise exception 'ugyldig e-post'; end if;
  select id into uid from auth.users where lower(email) = e;
  if uid = auth.uid() then raise exception 'du er allerede eier'; end if;
  if uid is not null then
    insert into cellar_members (cellar_id, user_id, role) values (p_cellar, uid, 'member') on conflict do nothing;
    return 'added';
  end if;
  insert into cellar_invites (cellar_id, email, invited_by) values (p_cellar, e, auth.uid()) on conflict do nothing;
  return 'invited';
end $$;

create function public.remove_from_cellar(p_cellar uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(p_email));
begin
  if not is_owner(p_cellar) then raise exception 'forbidden'; end if;
  delete from cellar_members m using auth.users u
   where m.cellar_id = p_cellar and m.user_id = u.id and lower(u.email) = e and m.role <> 'owner';
  delete from cellar_invites where cellar_id = p_cellar and lower(email) = e;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Admin: brukere, skap, statistikk
-- ─────────────────────────────────────────────────────────────

-- profiles har ikke e-post, og auth.users er ikke lesbar fra klienten.
-- Status «invitert» = invitert via inviteUserByEmail, men ikke aktivert ennå.
create function public.admin_users()
returns table (id uuid, name text, email text, status text, is_admin boolean, created_at timestamptz,
               last_active timestamptz, cellar_ids uuid[], bottles bigint, scans bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, u.email::text,
         case when p.status = 'deaktivert' then 'deaktivert'
              when u.email_confirmed_at is null then 'invitert'
              else 'aktiv' end,
         p.is_admin, u.created_at,
         greatest(u.last_sign_in_at,
                  (select max(created_at) from movements mv where mv.created_by = p.id),
                  (select max(at) from scan_events s where s.user_id = p.id)),
         coalesce((select array_agg(m.cellar_id) from cellar_members m where m.user_id = p.id), '{}'),
         coalesce((select sum(ci.qty) from cellar_items ci
                    where ci.cellar_id in (select cellar_id from cellar_members where user_id = p.id)), 0)::bigint,
         (select count(*) from scan_events s where s.user_id = p.id)
    from profiles p join auth.users u on u.id = p.id
   where is_admin()
   order by u.created_at desc
$$;

create view public.admin_cellars with (security_invoker = true) as
  select c.id, c.name, c.owner_id, c.created_at,
         (select count(*) from cellar_members m where m.cellar_id = c.id) as members,
         coalesce((select sum(qty) from cellar_items i where i.cellar_id = c.id), 0)::bigint as bottles,
         (select count(*) from cellar_items i where i.cellar_id = c.id and i.qty > 0) as wines,
         coalesce((select sum(i.qty * coalesce(p.price, 0)) from cellar_items i
                     join products p on p.id = i.product_id where i.cellar_id = c.id), 0) as value,
         (select max(created_at) from movements mv where mv.cellar_id = c.id) as updated_at
    from cellars c;

create function public.admin_scans_per_day(p_days int default 14)
returns table (day date, n bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query
    select d::date, count(s.id)
      from generate_series((now() at time zone 'Europe/Oslo')::date - (p_days - 1),
                           (now() at time zone 'Europe/Oslo')::date, interval '1 day') d
      left join scan_events s on (s.at at time zone 'Europe/Oslo')::date = d::date
     group by d order by d;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 6. Duplikater: «Ikke duplikat» må huskes, og kortene viser skap/flasker
-- ─────────────────────────────────────────────────────────────

create table public.dupe_ignores (
  keep_id uuid references products on delete cascade,
  merge_id uuid references products on delete cascade,
  primary key (keep_id, merge_id)
);
alter table dupe_ignores enable row level security;
create policy "admin ignorerer duplikater" on dupe_ignores for all using (is_admin()) with check (is_admin());

drop view public.admin_duplicates;
create view public.admin_duplicates with (security_invoker = true) as
  select a.id as keep_id, a.name as keep_name, b.id as merge_id, b.name as merge_name, a.vmp_nr as keep_nr,
         (select count(distinct cellar_id) from cellar_items where product_id = a.id and qty > 0) as keep_cellars,
         coalesce((select sum(qty) from cellar_items where product_id = a.id), 0)::bigint as keep_bottles,
         (select count(distinct cellar_id) from cellar_items where product_id = b.id and qty > 0) as merge_cellars,
         coalesce((select sum(qty) from cellar_items where product_id = b.id), 0)::bigint as merge_bottles,
         case when a.producer is not null and lower(a.producer) = lower(b.producer)
              then 'Likt navn og produsent' else 'Likt navn · én uten varenummer' end as reason
    from products a join products b on a.id <> b.id
   where a.vmp_nr is not null and b.vmp_nr is null
     and extensions.similarity(lower(a.name), lower(b.name)) > 0.6
     and not exists (select 1 from dupe_ignores i where i.keep_id = a.id and i.merge_id = b.id);

-- Samme som i 0002, men strekkodeforslag flyttes også (de ble slettet via cascade).
create or replace function public.admin_merge_products(p_keep uuid, p_merge uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  insert into cellar_items (cellar_id, product_id, qty, drink_from, drink_to, note)
    select cellar_id, p_keep, qty, drink_from, drink_to, note from cellar_items where product_id = p_merge
    on conflict (cellar_id, product_id) do update set qty = cellar_items.qty + excluded.qty;
  delete from cellar_items where product_id = p_merge;
  update movements set product_id = p_keep where product_id = p_merge;
  insert into ean_suggestions (ean, product_id, created_by, created_at)
    select ean, p_keep, created_by, created_at from ean_suggestions where product_id = p_merge
    on conflict do nothing;
  update ean_map set product_id = p_keep where product_id = p_merge;
  delete from products where id = p_merge;
  insert into audit_log (actor, kind, action, target) values (auth.uid(), 'admin', 'Slo sammen produkt', p_merge || ' → ' || p_keep);
end $$;

-- ─────────────────────────────────────────────────────────────
-- 7. API-helse: skill mellom proxy-kall, nattlig synk og admin-test
-- ─────────────────────────────────────────────────────────────

alter table public.api_health add column source text not null default 'proxy'
  check (source in ('proxy','sync','test'));
create index api_health_at on api_health (at);
