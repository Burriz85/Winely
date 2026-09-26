-- Admin (tjenesteoperatør), invitasjonsbasert registrering, aktivitetslogg og API-helse.

create extension if not exists pg_trgm with schema extensions;   -- trengs av admin_duplicates

alter table public.profiles
  add column is_admin boolean not null default false,
  add column status text not null default 'aktiv' check (status in ('aktiv','deaktivert'));

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

-- Admin leser alt
create policy "admin leser profiler" on profiles for select using (is_admin());
create policy "admin endrer profiler" on profiles for update using (is_admin());
create policy "admin leser skap" on cellars for select using (is_admin());
create policy "admin leser medlemmer" on cellar_members for select using (is_admin());
create policy "admin leser beholdning" on cellar_items for select using (is_admin());
create policy "admin leser historikk" on movements for select using (is_admin());
create policy "admin endrer ean" on ean_map for all using (is_admin()) with check (is_admin());
create policy "admin endrer produkter" on products for all using (is_admin()) with check (is_admin());

-- Deaktiverte brukere mister skrivetilgang
create or replace function public.is_member(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from cellar_members m join profiles p on p.id = m.user_id
                  where m.cellar_id = c and m.user_id = auth.uid() and p.status = 'aktiv') $$;

-- Invitasjoner til tjenesten (sendes via edge function admin-invite -> auth.admin.inviteUserByEmail)
create table public.service_invites (
  email text primary key,
  name text not null,
  invited_by uuid references auth.users,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table service_invites enable row level security;
create policy "admin invitasjoner" on service_invites for all using (is_admin()) with check (is_admin());

-- Aktivitetslogg (admin-handlinger + ean-endringer; inn/ut ligger i movements)
create table public.audit_log (
  id bigserial primary key,
  actor uuid references auth.users,
  kind text not null check (kind in ('admin','ean','auth')),
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
alter table audit_log enable row level security;
create policy "admin leser logg" on audit_log for select using (is_admin());

-- Samlet aktivitetsvisning for admin
create view public.admin_activity with (security_invoker = true) as
  select m.created_at, m.created_by as actor, case m.dir when 'in' then 'inn' else 'ut' end as kind,
         (case m.dir when 'in' then 'Satte inn ' else 'Tok ut ' end) || m.qty || ' × ' || p.name as what
    from movements m join products p on p.id = m.product_id
  union all
  select created_at, actor, kind, action || coalesce(' ' || target, '') from audit_log;

-- Mulige duplikater: produkter uten varenr. med likt navn som et produkt med varenr.
create view public.admin_duplicates with (security_invoker = true) as
  select a.id as keep_id, a.name as keep_name, b.id as merge_id, b.name as merge_name
    from products a join products b on a.id <> b.id
   where a.vmp_nr is not null and b.vmp_nr is null
     and similarity(lower(a.name), lower(b.name)) > 0.6;   -- krever: create extension pg_trgm;

-- Slå sammen produkt b inn i a
create function public.admin_merge_products(p_keep uuid, p_merge uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  insert into cellar_items (cellar_id, product_id, qty, drink_from, drink_to, note)
    select cellar_id, p_keep, qty, drink_from, drink_to, note from cellar_items where product_id = p_merge
    on conflict (cellar_id, product_id) do update set qty = cellar_items.qty + excluded.qty;
  delete from cellar_items where product_id = p_merge;
  update movements set product_id = p_keep where product_id = p_merge;
  update ean_map set product_id = p_keep where product_id = p_merge;
  delete from products where id = p_merge;
  insert into audit_log (actor, kind, action, target) values (auth.uid(), 'admin', 'Slo sammen produkt', p_merge || ' → ' || p_keep);
end $$;

-- EAN-konflikter: samme ean foreslått til flere produkter (kø fra appen før godkjenning)
create table public.ean_suggestions (
  ean text not null,
  product_id uuid not null references products on delete cascade,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  primary key (ean, product_id)
);
alter table ean_suggestions enable row level security;
create policy "innloggede foreslår" on ean_suggestions for insert to authenticated with check (created_by = auth.uid());
create policy "admin ser forslag" on ean_suggestions for all using (is_admin());

-- API-helse (skrives av vmp-proxy / cron)
create table public.api_health (
  id bigserial primary key,
  at timestamptz not null default now(),
  status int, latency_ms int, error text
);
alter table api_health enable row level security;
create policy "admin leser api" on api_health for select using (is_admin());

-- Første admin: kjør manuelt etter at du har laget din egen bruker
-- update profiles set is_admin = true where id = (select id from auth.users where email = 'DIN@EPOST.NO');
