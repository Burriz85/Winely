-- Vinrådgiveren: egen kilde i api_health for kallene til Claude.
alter table public.api_health drop constraint if exists api_health_source_check;
alter table public.api_health add constraint api_health_source_check
  check (source in ('proxy','sync','test','web','label','advisor'));
