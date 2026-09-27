-- Produktdata fra vinmonopolet.no (vmpws/v3), hentet av edge-funksjonen vmp-sync.
-- Det offisielle API-et gir bare navn og varenummer; dette fyller resten.
alter table public.products
  add column taste text,
  add column food text,
  add column volume_cl numeric,
  add column details_updated_at timestamptz;

-- Egen kilde i api_health for kall mot nettstedet, så admin ser om det slutter å virke.
alter table public.api_health drop constraint if exists api_health_source_check;
alter table public.api_health add constraint api_health_source_check
  check (source in ('proxy','sync','test','web'));
