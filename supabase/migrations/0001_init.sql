-- Vinskap: brukere, skap, deling, produkter, strekkoder, beholdning og historikk.
-- Brukere håndteres av Supabase Auth (auth.users). profiles speiler navn.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table public.cellars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null default 'Vinskapet',
  created_at timestamptz not null default now()
);

create table public.cellar_members (
  cellar_id uuid references public.cellars on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null check (role in ('owner','member')),
  primary key (cellar_id, user_id)
);

create table public.cellar_invites (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references public.cellars on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users,
  created_at timestamptz not null default now(),
  unique (cellar_id, email)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  vmp_nr text unique,
  name text not null,
  producer text, vintage int, type text,
  country text, region text, grapes text[], abv numeric, price numeric,
  image_url text, vmp_updated_at timestamptz
);

create table public.ean_map (
  ean text primary key,
  product_id uuid not null references public.products on delete cascade,
  source text not null default 'user',
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create table public.cellar_items (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references public.cellars on delete cascade,
  product_id uuid not null references public.products,
  qty int not null default 0 check (qty >= 0),
  drink_from int, drink_to int, note text,
  unique (cellar_id, product_id)
);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  cellar_id uuid not null references public.cellars on delete cascade,
  product_id uuid not null references public.products,
  dir text not null check (dir in ('in','out')),
  qty int not null check (qty > 0),
  created_by uuid not null references auth.users default auth.uid(),
  created_at timestamptz not null default now(),
  client_id text unique            -- idempotens for offline-kø
);

-- Ny bruker: profil + eget skap + eventuelle ventende invitasjoner.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name',''));
  insert into cellars (owner_id) values (new.id) returning id into c;
  insert into cellar_members values (c, new.id, 'owner');
  insert into cellar_members (cellar_id, user_id, role)
    select cellar_id, new.id, 'member' from cellar_invites where lower(email) = lower(new.email);
  delete from cellar_invites where lower(email) = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Registrer inn/ut atomisk.
create function public.register_movement(p_cellar uuid, p_product uuid, p_dir text, p_qty int, p_client_id text)
returns int language plpgsql security invoker as $$
declare new_qty int;
begin
  if exists (select 1 from movements where client_id = p_client_id) then
    select qty into new_qty from cellar_items where cellar_id = p_cellar and product_id = p_product;
    return coalesce(new_qty, 0);
  end if;
  insert into cellar_items (cellar_id, product_id, qty) values (p_cellar, p_product, 0)
    on conflict (cellar_id, product_id) do nothing;
  update cellar_items set qty = qty + case when p_dir = 'in' then p_qty else -p_qty end
    where cellar_id = p_cellar and product_id = p_product
    returning qty into new_qty;   -- check (qty >= 0) stopper uttak av mer enn man har
  insert into movements (cellar_id, product_id, dir, qty, client_id)
    values (p_cellar, p_product, p_dir, p_qty, p_client_id);
  return new_qty;
end $$;

-- Row Level Security
alter table profiles enable row level security;
alter table cellars enable row level security;
alter table cellar_members enable row level security;
alter table cellar_invites enable row level security;
alter table products enable row level security;
alter table ean_map enable row level security;
alter table cellar_items enable row level security;
alter table movements enable row level security;

create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from cellar_members where cellar_id = c and user_id = auth.uid()) $$;
create function public.is_owner(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from cellar_members where cellar_id = c and user_id = auth.uid() and role = 'owner') $$;

create policy "egen profil" on profiles for all using (id = auth.uid());
create policy "medlem ser skap" on cellars for select using (is_member(id));
create policy "eier endrer skap" on cellars for update using (is_owner(id));
create policy "medlem ser medlemmer" on cellar_members for select using (is_member(cellar_id));
create policy "eier fjerner medlem" on cellar_members for delete using (is_owner(cellar_id));
create policy "eier inviterer" on cellar_invites for all using (is_owner(cellar_id)) with check (is_owner(cellar_id));
create policy "alle innloggede leser produkter" on products for select to authenticated using (true);
create policy "innloggede legger til produkter" on products for insert to authenticated with check (true);
create policy "alle innloggede leser ean" on ean_map for select to authenticated using (true);
create policy "innloggede kobler ean" on ean_map for insert to authenticated with check (created_by = auth.uid());
create policy "medlem beholdning" on cellar_items for all using (is_member(cellar_id)) with check (is_member(cellar_id));
create policy "medlem historikk les" on movements for select using (is_member(cellar_id));
create policy "medlem historikk skriv" on movements for insert with check (is_member(cellar_id) and created_by = auth.uid());
