-- Admin knytter brukere til eksisterende skap.
-- 1) Ny bruker opprettet med join_cellar i metadata blir medlem der i stedet for å få eget tomt skap.
--    Metadata settes bare av admin-users (service role); åpen registrering er stengt.
-- 2) admin_set_member(): legg til / fjern medlem i et hvilket som helst skap.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare c uuid; j uuid;
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name',''));
  begin
    j := nullif(new.raw_user_meta_data->>'join_cellar', '')::uuid;
  exception when invalid_text_representation then j := null;
  end;
  if j is not null and exists (select 1 from cellars where id = j) then
    insert into cellar_members (cellar_id, user_id, role) values (j, new.id, 'member');
  else
    insert into cellars (owner_id) values (new.id) returning id into c;
    insert into cellar_members values (c, new.id, 'owner');
  end if;
  insert into cellar_members (cellar_id, user_id, role)
    select cellar_id, new.id, 'member' from cellar_invites where lower(email) = lower(new.email)
    on conflict do nothing;
  delete from cellar_invites where lower(email) = lower(new.email);
  return new;
end $$;

create function public.admin_set_member(p_cellar uuid, p_user uuid, p_add boolean) returns void
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select coalesce(nullif(p.name, ''), u.email) into who from auth.users u join profiles p on p.id = u.id where u.id = p_user;
  if who is null then raise exception 'ukjent bruker'; end if;
  if p_add then
    insert into cellar_members (cellar_id, user_id, role) values (p_cellar, p_user, 'member') on conflict do nothing;
    insert into audit_log (actor, kind, action, target)
      select auth.uid(), 'admin', 'La til i skapet «' || name || '»:', who from cellars where id = p_cellar;
  else
    if exists (select 1 from cellar_members where cellar_id = p_cellar and user_id = p_user and role = 'owner') then
      raise exception 'eieren kan ikke fjernes fra sitt eget skap';
    end if;
    delete from cellar_members where cellar_id = p_cellar and user_id = p_user;
    insert into audit_log (actor, kind, action, target)
      select auth.uid(), 'admin', 'Fjernet fra skapet «' || name || '»:', who from cellars where id = p_cellar;
  end if;
end $$;
