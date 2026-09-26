# Vinskap

Oversikt over vinene i private vinskap. Brukerne skanner strekkoden når de setter inn eller tar ut flasker, og produktdata slås opp hos Vinmonopolet. Operatøren styrer brukere, skap, strekkoder, duplikater og API-helse i en egen admin-webapp. Registrering skjer bare med invitasjon.

Bygget etter handoff-pakken i [`docs/design/`](docs/design/README.md) (prototyper, mockdata, SQL og edge functions).

```
apps/mobile      Expo-app (iOS, Android og web) – Expo Router, TanStack Query, expo-camera
apps/admin       Admin-webapp – Vite + React, responsiv (sidemeny ≥ 860 px)
packages/shared  Designtokens, Vinmonopolet-klient, formatering (kr, drikkestatus, tid)
supabase/        migrations/, functions/ (vmp, vmp-sync, admin-invite), e-postmaler, cron.sql
tests/           Integrasjonstester mot lokal Supabase, mock av Vinmonopolet, demodata
docs/design/     Handoff-pakken slik den ble levert
```

## Kom i gang lokalt

Krever Node 22 og Docker.

```bash
npm install
npx supabase start                  # Postgres, Auth, REST, edge runtime og Mailpit
npm run mock:vmp                    # (egen terminal) falsk Vinmonopolet på :8787
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
npm run seed                        # demodata; alle brukere har passordet «vinskap-demo»
```

Mobilappen:

```bash
cp apps/mobile/.env.example apps/mobile/.env      # anon-nøkkel fra `npx supabase status`
npm run mobile                                    # trykk w for web, eller skann QR-koden
```

`expo-camera` er en innebygd modul. Den virker i Expo Go, men ellers trengs en utviklingsbygg (`npx expo run:ios|android` eller `eas build --profile development`).

Admin:

```bash
cp apps/admin/.env.example apps/admin/.env.local
npm run admin                                     # http://127.0.0.1:5173, logg inn som admin@vinskap.no
```

E-poster (invitasjonskoder, nytt passord) havner i Mailpit på http://127.0.0.1:54324.

### Tester

```bash
npm test            # enhetstester i packages/shared
npm run typecheck   # alle pakker
npm run test:db     # 18 integrasjonstester mot lokal Supabase (krever oppsettet over)
```

`test:db` dekker handoff-oppgave 8 og mer: åpen registrering er stengt, invitasjon → aktivering med kode, en bruker kan ikke gjøre seg selv til admin, bare egne skap er synlige, deling, atomisk og idempotent inn/ut, strekkodekonflikt, proxyen krever innlogging, vmp-sync, duplikater og sammenslåing, og at en deaktivert bruker verken kan skrive eller logge inn.

## Produksjon

1. Opprett et Supabase-prosjekt og kjør `npx supabase link` og `npx supabase db push` (migreringene 0001–0003).
2. Authentication → Providers → Email: på. Authentication → Settings → «Allow new users to sign up»: **av**. Slå av alle OAuth-leverandører.
3. Lim inn malene fra `supabase/templates/` under Authentication → Email Templates (Invite og Reset password). De sender en 6-sifret kode i stedet for en lenke.
4. `npx supabase secrets set VMP_KEY=<ny nøkkel>` – **lag en ny nøkkel**, for den gamle har vært delt i klartekst.
5. `npx supabase functions deploy vmp vmp-sync admin-invite`
6. Lag din egen bruker i dashboardet og kjør `update profiles set is_admin = true where id = (select id from auth.users where email = '…');`
7. Kjør `supabase/cron.sql` i SQL-editoren (nattlig vmp-sync kl. 03).
8. Admin: `npm run build -w @vinskap/admin` og legg `apps/admin/dist` på en statisk vert. Mobil: `eas build`, og for webappen `npm run export:web -w @vinskap/mobile` (statisk `dist/`).

## Avvik fra handoff-pakken, og hvorfor

Handoffen sier at farger, typografi, avstander og tekster skal være slik de står. Det er de. Følgende er endret eller lagt til fordi pakken motsa seg selv, manglet noe skjermene trenger, eller var usikker.

**Sikkerhet**
- `profiles`: Policyen «egen profil» (`for all`) lot enhver bruker kjøre `update profiles set is_admin = true`. Nå kan brukere bare endre `name` (kolonnerettigheter). Status og admin endres av `admin-invite` med service role.
- `vmp`-proxyen var tenkt deployet med `--no-verify-jwt` og åpen CORS. Da kan hvem som helst bruke opp kvoten. Den krever nå en innlogget bruker. Anon-nøkkelen er også en gyldig JWT, så funksjonen sjekker rollen selv. Bare `products/v0/details-normal` slippes gjennom.
- `auth.admin.signOut` tar brukerens tilgangstoken, ikke bruker-id, så den kan ikke logge ut en annen bruker. Deaktivering bruker i stedet utestenging (`ban_duration`) og `status = 'deaktivert'`. Tokener som allerede er utstedt lever til de går ut (1 t), men `is_member()` stopper skriving med én gang.
- CORS i edge functions manglet `apikey` og `x-client-info`, som supabase-js sender. Kall fra nettleseren ville feilet på preflight.

**Pålogging**
- `[auth.email] enable_signup = false` slår av hele e-postinnloggingen. Riktig bryter for «Allow new users to sign up» er `[auth] enable_signup`. Oppdaget i testene.
- «Aktiver konto» har fått et kodefelt. `inviteUserByEmail` sender ellers en lenke, og en lenke inn i en mobilapp krever dyplenker per plattform. Med koden virker samme skjerm også for «Nullstill passord». Navnefeltet er valgfritt; tomt beholder navnet admin skrev inn.
- Admin har egen innloggingsside og «Logg ut» nederst i menyen. Det finnes ikke i prototypen.

**Data som skjermene trenger** (`0003_gaps.sql`)
- `admin_users()`: `profiles` har ikke e-post, og `auth.users` er ikke lesbar fra klienten. «Invitert» = invitert, men ikke aktivert.
- `scan_events` og `ean_map.hits`: Skann per dag, skann per bruker og treff per strekkode hadde ingen kilde.
- `ensure_product()`: Brukere kunne legge inn produkter, men ikke oppdatere dem, og ingen regel sa hvem som eier type, årgang og pris. Nå vinner den første registreringen, og navn og bilde kommer bare fra Vinmonopolet.
- `suggest_ean()` og visningen `admin_eans`: Konfliktflyten i handoffen, med logging til `audit_log`.
- `cellar_people()`, `invite_to_cellar()` og `remove_from_cellar()`: Eieren må se og invitere medlemmer på e-post. Finnes personen, blir hen medlem med én gang. Ellers venter invitasjonen til kontoen opprettes. **Det sendes ingen e-post fra «Del skapet»**, og en person uten konto må fortsatt inviteres av admin. Toasten sier det.
- `dupe_ignores`: «Ikke duplikat» må huskes, ellers dukker kortet opp igjen.
- `api_health.source` skiller proxykall, nattlig synk og admin-test.
- `admin_merge_products()` flytter nå også strekkodeforslag. Før ble de slettet via cascade.
- `pg_trgm` opprettes øverst i 0002, så migreringene kan kjøres i rekkefølge uten et manuelt steg.

**Mobilappen**
- Skannearket for en ny vin har fått feltene **Pris per flaske** og **Drikkevindu** i tillegg til type og årgang. README-en sier at brukeren legger inn alle fire, men prototypen hadde bare to. Uten pris viser «Verdi» alltid kr 0.
- Arket «Vinmonopolet-API» lot brukeren lime inn nøkkelen. README-en sier at nøkkelen ikke skal ligge i klienten, så arket viser status for proxyen og har «Test nå». Pillen viser «tilkoblet» eller «frakoblet» (i stedet for «demo-data»).
- «Hvilken vin er dette?» (ukjent strekkode) har ingen egen skjerm i prototypen. Den bruker søkeskjermen med en annen tittel, og søkefeltet fylles fra Open Food Facts når det finnes et treff.
- Listevisningen (Rader, Kort, Drikkevindu) var bare en prop i prototypen. Den velges nå under Profil → Innstillinger → Visning. Samme sted kan man bytte skap når man er med i flere.
- En invitert bruker får både eget tomt skap (`handle_new_user`) og det delte skapet. Appen viser det delte når det egne er tomt.
- Resultatarket i prototypen viste flaskebildet to ganger (`sImgStyle` og `sw.swatch`). Det vises én gang.
- Smak og «Passer til» skjules når de er tomme. API-et gir ingen slike data.
- «HISTORIKK» i Syne 800 ved 44 px er om lag 389 px bred, mens innholdsbredden på en 390-skjerm er 350 px. Tittelen skaleres ned så den får plass.
- På web vises appen i en kolonne på maks 480 px.
- Du kan ikke logge ut mens det ligger registreringer i offline-køen. Da ville de gått tapt.

**Admin**
- «Kvote» finnes ikke i API-et. Verdien kommer fra `VITE_VMP_QUOTA`.
- «Endre» på en strekkode oppretter produktet med navn fra Vinmonopolet hvis varenummeret ikke finnes fra før.

## Kjente begrensninger

- **Vinmonopolet-API-et er ikke testet mot det ekte endepunktet her.** Alt går mot `tests/mock-vmp.mjs`, som er bygget etter funnene i handoffen. At `_` i stedet for mellomrom faktisk gir treff, er handoffens påstand. Jeg har ikke bekreftet det.
- **Strekkodeskanning er ikke testet med en ekte strekkode.** Kameraflyten er testet med et falskt kamera, og oppslag og kobling er testet i databasen. På web bruker `expo-camera` nettleserens `BarcodeDetector` der den finnes (Chrome på Android). Ellers laster den en WASM-polyfill fra CDN, blant annet i Safari på iOS.
- **Duplikater** oppstår bare for produkter uten varenummer. Appen har ingen måte å lage slike på (alt går via Vinmonopolet-søk), så siden blir tom i praksis til noen legger inn produkter manuelt.
- Produktbilder hentes fra bilder.vinmonopolet.no under deres vilkår. Mangler bildet (404), vises fargestripen for vintypen.
- Deling til en e-post uten konto sender ingen e-post (se over).
