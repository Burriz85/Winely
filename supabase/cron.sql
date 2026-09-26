-- Nattlig vmp-sync (handoff: «Hver natt kalles details-normal?changedSince=<i går>»).
-- Kjøres manuelt i SQL-editoren i produksjon, ikke som migrering (inneholder prosjektspesifikke verdier).
-- Krever utvidelsene pg_cron og pg_net (Database → Extensions).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Legg prosjekt-URL og service role-nøkkel i Vault én gang:
--   select vault.create_secret('https://<prosjekt>.supabase.co', 'project_url');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');

select cron.schedule('vmp-sync', '0 3 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/vmp-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  );
$$);
