# Vinskap

Oversikt over vinene i private vinskap. Brukerne skanner strekkoden når de setter inn eller tar ut flasker, og produktdata slås opp hos Vinmonopolet. Operatøren styrer brukere, skap, strekkoder, duplikater og API-helse i en egen admin-webapp. Registrering er stengt. Admin oppretter brukerne med brukernavn og passord, og det sendes aldri e-post.

Bygget etter handoff-pakken i [`docs/design/`](docs/design/README.md) (prototyper, mockdata, SQL og edge functions).

```
apps/mobile      Expo-app (iOS, Android og web) – Expo Router, TanStack Query, expo-camera
apps/admin       Admin-webapp – Vite + React, responsiv (sidemeny ≥ 860 px)
packages/shared  Designtokens, Vinmonopolet-klient, formatering (kr, drikkestatus, tid)
supabase/        migrations/, functions/ (vmp, vmp-sync, admin-users), cron.sql
tests/           Integrasjonstester mot lokal Supabase, mock av Vinmonopolet, demodata
docs/design/     Handoff-pakken slik den ble levert
```

## Kom i gang lokalt

Krever Node 22 og Docker.

```bash
npm install
npx supabase start                  # Postgres, Auth, REST og edge runtime
npm run mock:vmp                    # (egen terminal) falsk Vinmonopolet på :8787
cp supabase/functions/.env.example supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env
npm run seed                        # demodata; logg inn som «admin» eller «ola», passord «vinskap-demo»
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
npm run admin                                     # http://127.0.0.1:5173, logg inn som «admin»
```

### Tester

```bash
npm test            # enhetstester i packages/shared
npm run typecheck   # alle pakker
npm run test:db     # 17 integrasjonstester mot lokal Supabase (krever oppsettet over)
```

`test:db` dekker handoff-oppgave 8 og mer: åpen registrering er stengt, admin oppretter brukere og setter passord, brukeren bytter passord selv, en bruker kan ikke gjøre seg selv til admin, bare egne skap er synlige, deling, atomisk og idempotent inn/ut, strekkodekonflikt, proxyen krever innlogging, vmp-sync, duplikater og sammenslåing, og at en deaktivert bruker verken kan skrive eller logge inn.

## Produksjon

1. Opprett et Supabase-prosjekt og kjør `npx supabase link` og `npx supabase db push` (migreringene 0001–0003).
2. Authentication → Sign In / Providers: «Allow new users to sign up» **av**. Email-leverandøren **på** (ellers virker ingen innlogging), minste passordlengde 8. Alle OAuth-leverandører av. E-postmaler og SMTP trengs ikke.
3. `npx supabase secrets set VMP_KEY=<ny nøkkel>` – **lag en ny nøkkel**, for den gamle har vært delt i klartekst.
4. `npx supabase functions deploy vmp vmp-sync admin-users`
5. Lag din egen bruker i dashboardet (Authentication → Users → Add user → Create new user, «Auto Confirm User» på; bruk f.eks. `admin@vinskap.local` for å logge inn som «admin») og kjør `update profiles set is_admin = true where id = (select id from auth.users where email = '…');`
6. Kjør `supabase/cron.sql` i SQL-editoren (nattlig vmp-sync kl. 03).
7. Netlify, to nettsteder fra samme repo (Base directory tomt, Node 22 fra `.nvmrc`):
   - Admin: build `npm run build:admin`, publish `apps/admin/dist`, miljøvariabler `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VMP_QUOTA`.
   - Webappen: build `npm run build:web`, publish `apps/mobile/dist`, miljøvariabler `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - `_redirects` i begge sender alle stier til `index.html`. Native app: `eas build`.

## Avvik fra handoff-pakken, og hvorfor

Handoffen sier at farger, typografi, avstander og tekster skal være slik de står. Det er de. Følgende er endret eller lagt til fordi pakken motsa seg selv, manglet noe skjermene trenger, eller var usikker.

**Sikkerhet**
- `profiles`: Policyen «egen profil» (`for all`) lot enhver bruker kjøre `update profiles set is_admin = true`. Nå kan brukere bare endre `name` (kolonnerettigheter). Status og admin endres av `admin-invite` med service role.
- `vmp`-proxyen var tenkt deployet med `--no-verify-jwt` og åpen CORS. Da kan hvem som helst bruke opp kvoten. Den krever nå en innlogget bruker. Anon-nøkkelen er også en gyldig JWT, så funksjonen sjekker rollen selv. Bare `products/v0/details-normal` slippes gjennom.
- `auth.admin.signOut` tar brukerens tilgangstoken, ikke bruker-id, så den kan ikke logge ut en annen bruker. Deaktivering bruker i stedet utestenging (`ban_duration`) og `status = 'deaktivert'`. Tokener som allerede er utstedt lever til de går ut (1 t), men `is_member()` stopper skriving med én gang.
- CORS i edge functions manglet `apikey` og `x-client-info`, som supabase-js sender. Kall fra nettleseren ville feilet på preflight.

**Pålogging**
- `[auth.email] enable_signup = false` slår av hele e-postinnloggingen. Riktig bryter for «Allow new users to sign up» er `[auth] enable_signup`. Oppdaget i testene.
- **Ingen e-postinvitasjoner** (bestemt 27.09.2026). Admin oppretter brukeren med brukernavn og passord (`admin-users`, tidligere `admin-invite`). Prototypens «Aktiver konto», «Send invitasjon på nytt», «Trekk tilbake» og status «Invitert» er fjernet. «Nullstill passord» er erstattet av «Sett nytt passord» i admin, og brukeren kan bytte passord under Profil.
- **Brukernavn:** Supabase Auth har bare e-post. Et brukernavn uten `@` lagres som `<navn>@vinskap.local`, og domenet skjules overalt i UI-et. Ekte e-postadresser virker også.
- Admin kjenner passordet brukeren først får. Det vises bare én gang etter opprettelse.
- Admin har egen innloggingsside og «Logg ut» nederst i menyen. Det finnes ikke i prototypen.

**Data som skjermene trenger** (`0003_gaps.sql`)
- `admin_users()`: `profiles` har ikke e-post, og `auth.users` er ikke lesbar fra klienten. («Invitert» brukes ikke lenger, siden admin oppretter bekreftede brukere.)
- `scan_events` og `ean_map.hits`: Skann per dag, skann per bruker og treff per strekkode hadde ingen kilde.
- `ensure_product()`: Brukere kunne legge inn produkter, men ikke oppdatere dem, og ingen regel sa hvem som eier type, årgang og pris. Nå vinner den første registreringen, og navn og bilde kommer bare fra Vinmonopolet.
- `suggest_ean()` og visningen `admin_eans`: Konfliktflyten i handoffen, med logging til `audit_log`.
- `cellar_people()`, `invite_to_cellar()` og `remove_from_cellar()`: Eieren må se og invitere medlemmer på e-post. Finnes personen, blir hen medlem med én gang. Ellers venter tilgangen til admin har opprettet brukeren. Deles skapet med et brukernavn, gjøres det om på samme måte som ved innlogging. Det sendes ingen e-post, så toasten sier «Lagret» i stedet for prototypens «Invitasjon sendt».
- `dupe_ignores`: «Ikke duplikat» må huskes, ellers dukker kortet opp igjen.
- `api_health.source` skiller proxykall, nattlig synk og admin-test.
- `admin_merge_products()` flytter nå også strekkodeforslag. Før ble de slettet via cascade.
- `pg_trgm` opprettes øverst i 0002, så migreringene kan kjøres i rekkefølge uten et manuelt steg.

**Mobilappen**
- Skannearket for en ny vin har fått feltene **Pris per flaske** og **Drikkevindu** i tillegg til type og årgang. README-en sier at brukeren legger inn alle fire, men prototypen hadde bare to. Uten pris viser «Verdi» alltid kr 0.
- Arket «Vinmonopolet-API» lot brukeren lime inn nøkkelen. README-en sier at nøkkelen ikke skal ligge i klienten, så arket viser status for proxyen og har «Test nå». Pillen viser «tilkoblet» eller «frakoblet» (i stedet for «demo-data»).
- «Hvilken vin er dette?» (ukjent strekkode) har ingen egen skjerm i prototypen. Den bruker søkeskjermen med en annen tittel, og søkefeltet fylles fra Open Food Facts når det finnes et treff.
- Listevisningen (Rader, Kort, Drikkevindu) var bare en prop i prototypen. Den velges nå under Profil → Innstillinger → Visning. Samme sted kan man bytte skap når man er med i flere.
- En bruker som er med i et delt skap, har også sitt eget tomme skap (`handle_new_user`) og det delte skapet. Appen viser det delte når det egne er tomt.
- Resultatarket i prototypen viste flaskebildet to ganger (`sImgStyle` og `sw.swatch`). Det vises én gang.
- Smak og «Passer til» skjules når de er tomme. API-et gir ingen slike data.
- «HISTORIKK» i Syne 800 ved 44 px er om lag 389 px bred, mens innholdsbredden på en 390-skjerm er 350 px. Tittelen skaleres ned så den får plass.
- På web vises appen i en kolonne på maks 480 px.
- Du kan ikke logge ut mens det ligger registreringer i offline-køen. Da ville de gått tapt.

**Admin**
- «Kvote» finnes ikke i API-et. Verdien kommer fra `VITE_VMP_QUOTA`.
- «Endre» på en strekkode oppretter produktet med navn fra Vinmonopolet hvis varenummeret ikke finnes fra før.

## Kjente begrensninger

- Vinmonopolet-API-et er testet mot det ekte endepunktet 27.09.2026: proxyen, søk på ett og to ord (mellomrom → `_`) og produktbilder virker. De automatiske testene går fortsatt mot `tests/mock-vmp.mjs`.
- **Strekkodeskanning er ikke testet med en ekte strekkode.** Kameraflyten er testet med et falskt kamera, og oppslag og kobling er testet i databasen. På web bruker `expo-camera` nettleserens `BarcodeDetector` der den finnes (Chrome på Android). Ellers laster den en WASM-polyfill fra CDN, blant annet i Safari på iOS.
- **Duplikater** oppstår bare for produkter uten varenummer. Appen har ingen måte å lage slike på (alt går via Vinmonopolet-søk), så siden blir tom i praksis til noen legger inn produkter manuelt.
- Produktbilder hentes fra bilder.vinmonopolet.no under deres vilkår. Mangler bildet (404), vises fargestripen for vintypen.
