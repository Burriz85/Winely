# Handoff: Vinskap – mobilapp + admin

## Oversikt
Vinskap holder oversikt over vinene i private vinskap. Brukerne skanner strekkoden når de setter inn eller tar ut flasker, og produktdata slås opp hos Vinmonopolet. Til tjenesten hører en admin-webapp der operatøren styrer brukere, skap, strekkodekoblinger, duplikater og API-helse. Registrering er bare mulig med invitasjon.

## Om designfilene
`Vinskap.dc.html` (mobilapp) og `Vinskap Admin.dc.html` (admin) er **HTML-prototyper som viser utseende og oppførsel**. De er ikke produksjonskode. Åpne dem i en nettleser (sammen med `support.js`) for å klikke gjennom dem. Oppgaven er å bygge dette i stacken nedenfor. All data er mock (`wines.js`, `admin-data.js`), og brukerne i prototypen ligger i localStorage.

**Fidelity: høy.** Farger, typografi, avstander og tekster er ment slik de står.

---

## Stack
| Del | Valg |
|---|---|
| Mobilapp | React Native + Expo (Expo Router, TanStack Query, `expo-camera`) |
| Admin | Next.js (App Router) eller Vite + React, responsiv (PC + mobil) |
| Backend | Supabase: Postgres, Auth (kun e-post/passord), RLS, Edge Functions |
| Produktdata | Vinmonopolet API `products/v0` via egen proxy |

Anbefalt mappestruktur (monorepo):
```
apps/mobile      Expo-app
apps/admin       admin-web
packages/shared  typer, vmp-klient, formatering (kr, drikkestatus)
supabase/        migrations/ + functions/ (følger med i denne pakken)
```

---

## Vinmonopolet API – verifiserte funn (testet 26.09.2026)
- Base: `https://apis.vinmonopolet.no`, header `Ocp-Apim-Subscription-Key`.
- Operasjoner i `products/v0`: **Get details-normal**, Get accumulated-sales-halfyear, Get accumulated-sales-monthly. Bare den første brukes.
- `GET /products/v0/details-normal` med parametrene `productId`, `productShortNameContains`, `maxResults`, `start`, `changedSince`.
- **Svaret inneholder bare** `{ basic: { productId, productShortName }, lastChanged: { date, time } }`. Det kommer ingen pris, type, årgang, land, druer eller strekkode.
- Søket krever sammenhengende tekst. Mellomrom gir feilen «No spaces …», så appen må erstatte mellomrom med `_` eller søke på ett ord.
- CORS er åpent, men nøkkelen **skal ikke ligge i klienten**. Bruk `supabase/functions/vmp` (setter `VMP_KEY` på serveren).
- Produktbilde: `https://bilder.vinmonopolet.no/cache/300x300-0/{productId}-1.jpg` (også `515x515-0`). Det fungerer som `<img>`/`Image`, men gir 404 hvis bildet mangler, så vis fargestripen for vintypen som reserve.
- Konsekvens: **type, årgang, drikkevindu og pris legges inn av brukeren** første gang vinen settes inn. Årgangen gjettes fra navnet (regex `19xx|20xx`).
- Den gamle nøkkelen har vært delt i klartekst. **Lag en ny nøkkel** før produksjon.

## Strekkoder (EAN → varenummer)
API-et har ikke strekkoder, så koblingen bygges opp av brukerne:
1. Skann → `ean_map`. Ved treff vises vinen med én gang.
2. Ingen treff → «Hvilken vin er dette?» → søk i Vinmonopolet → brukeren velger → ny rad i `ean_suggestions` og (ved første forslag) i `ean_map`.
3. Foreslås samme EAN for et annet produkt, er det en **konflikt**. Den vises under Strekkoder i admin («Behold denne» / Endre / Fjern).
4. Valgfritt: slå opp EAN i Open Food Facts for å fylle ut søkefeltet på forhånd.

Skanner: `expo-camera` med `barcodeTypes: ['ean13','ean8','upc_a']`. Skanneren pauses mens arket er åpent, og telefonen vibrerer ved treff.

---

## Pålogging og roller
- Supabase Auth med **bare e-post og passord**. Slå av alle OAuth-leverandører og **åpen registrering** («Allow new users to sign up» = av).
- Admin inviterer via `functions/admin-invite` (`inviteUserByEmail`). Brukeren får en e-post og setter passord. I appen heter dette «Aktiver konto».
- Triggeren `handle_new_user` oppretter profil og eget skap, og kobler ventende skapinvitasjoner.
- Roller: `profiles.is_admin` (tjenesteoperatør), og `cellar_members.role` = owner/member (deling av skap).
- `profiles.status = 'deaktivert'` stopper skrivetilgang (via `is_member`). Logg også ut aktive økter med `auth.admin.signOut`.
- Første admin settes manuelt med SQL (se bunnen av `0002_admin.sql`).

## Datamodell
Se `supabase/migrations/0001_init.sql` (kjerne) og `0002_admin.sql` (admin). Kort fortalt:
- `profiles`, `cellars`, `cellar_members`, `cellar_invites`
- `products` (vmp_nr unik), `ean_map`, `ean_suggestions`
- `cellar_items` (qty ≥ 0, drink_from/to), `movements` (in/out, `client_id` for idempotens)
- `service_invites`, `audit_log`, `api_health`, visningene `admin_activity` og `admin_duplicates`
- RPC: `register_movement()` (atomisk inn/ut) og `admin_merge_products()`
- `0002` krever `create extension pg_trgm;`

## Edge Functions
| Funksjon | Hva |
|---|---|
| `vmp` | Proxy til `apis.vinmonopolet.no/products/v0/*`. Nøkkelen ligger på serveren, med cache i 1 t. Bør også skrive til `api_health`. |
| `admin-invite` | `{email,name}` inviterer, og `{email,action:'reset'}` sender e-post for nytt passord. Bare for admin. |
| (cron) `vmp-sync` | Å lage: Hver natt kalles `details-normal?changedSince=<i går>` for å oppdatere navn på produkter i `products`. |

---

## Skjermer – mobilapp (`Vinskap.dc.html`, 390×844)
1. **Logg inn / Aktiver konto:** monogram (`monogram-bg-sage.png`, 132 px) sentrert, label, stor tittel, e-post, passord (minst 8 tegn) og feilmelding i `#A04040`. Nederst lenken «Fått invitasjon? Aktiver konto».
2. **Skapet:** «{N} FLASKER», stat-rad (Viner / Klar / Verdi), søk og chips (Alle, Rødvin, Hvitvin, Musserende, Rosévin). Tre listevisninger (prop `listView`): Rader (gruppert på type), Kort (2 kolonner) og Drikkevindu. Rader har flaskebilde 40×60 med en typefarget stripe på venstre side. Øverst til høyre: pillen for API-status og initial-knapp (profil).
3. **Vindetaljer:** topp i typefarge, flaskebilde i et hvitt kort som overlapper toppen, navn, «I skapet» med Ta ut / Sett inn, drikkevindu, smak og en Vinmonopolet-seksjon (varenr., distrikt, druer, alkohol, verdi) med knappen «Oppdater fra API» og lenke.
4. **Skann (overlay):** kameravisning med ramme 260×160 og en animert honninglinje. Knappen «Søk i Vinmonopolet i stedet». Bunnark: bilde, navn og varenr. Hvis vinen er **ny**, velger man type (chips) og årgang. Antall 1–24, spørsmålet «Hva vil du gjøre?», knappene **Ta ut** (deaktivert hvis vinen ikke er i skapet) og **Sett inn**, og lenken «Feil vin? Søk i Vinmonopolet».
5. **Søk i Vinmonopolet:** fullskjerm med søkefelt, og resultater med bilde og varenr.
6. **Historikk:** «SATT INN / TATT UT · tid», navn og ±n i grønn/rød.
7. **Profil (bunnark):** navn og e-post, Del skapet (inviter/fjern medlem på e-post), Vinmonopolet-API og Logg ut.
8. **Tab-bar:** Skapet · [Skann-knapp 64 px, kull, løftet] · Historikk. En toast over tab-baren i 2,4 s.

## Skjermer – admin (`Vinskap Admin.dc.html`, responsiv)
Sidemeny på 232 px når skjermen er ≥ 860 px, ellers en horisontal fanerad øverst. Tallmerker i honning for ting som venter.
1. **Oversikt:** statistikk (aktive brukere + inviterte, skap, flasker + verdi, skann siste 14 dager), søylediagram over skann per dag, «Trenger oppfølging» (lenker) og siste aktivitet.
2. **Brukere:** søk, statusfilter (Alle/Aktiv/Invitert/Deaktivert) og «+ Inviter bruker» (modal). Rader med navn/e-post, skap, sist aktiv og statuspille. Et klikk åpner et **sidepanel** (440 px, fullbredde på mobil) med statistikk, skap, aktivitet og handlinger: Nullstill passord, Deaktiver/Aktiver igjen, Send invitasjon på nytt, Trekk tilbake.
3. **Skap:** alle skap (eier, medlemmer, flasker, verdi). Et klikk viser innholdet med bilder. Bare lesetilgang.
4. **Strekkoder:** søk. Konfliktrader er markert i honning. Endre varenr. direkte i raden, Fjern, «Behold denne».
5. **Duplikater:** kort med «Beholdes» / «Slås inn» og knappene «Ikke duplikat» og «Slå sammen» (→ `admin_merge_products`).
6. **Aktivitet:** filter (Inn/Ut/Strekkode/Admin) og en tabell med tid, merkelapp, hvem og hva.
7. **API-status:** tilkoblingsstatus, svartid, kall og feil siste 24 t, kvote, siste feil, og «Test tilkobling nå» (tester via `vmp`-proxyen). Nøkkelen vises aldri.

---

## Designtokens
- **Farger:** Elfenbein `#FAFAF5` (bakgrunn), Ivory dark `#F0EFE8`, Sage `#6B8C6A`, Sage dark `#4E6B4D` (primær), Sage light `#B8CEB7` (linjer), Sage tint `#E4ECE3` (aktiv/valgt), Honey `#C8993A`, Honey text `#A87C28`, Honey tint `#F4EBD6`, Kull `#2A2520`, Kull soft `#4A403A`, Rød `#A04040`, Rød tint `#F3E2E0`.
- **Vintyper:** Rødvin `#7A3A3A`, Hvitvin `#C9B878`, Musserende `#B8CEB7`, Rosévin `#D49A8F`.
- **Typografi:** Syne 600/700/800 (titler i STORE BOKSTAVER, −0.04em) og Figtree 400/500/600. Labels er 11 px, 500, 0.22em, i store bokstaver.
- **Radius:** 4 (felt/knapper/kort), 16 (bunnark), pille (chips, sirkelknapper).
- **Avstand:** 20 px sidepadding på mobil, clamp(16px, 4vw, 48px) i admin, 18–28 px mellom seksjoner.
- **Skygge:** bare på skanneknappen (`0 6px 18px rgba(42,37,32,.25)`). Ellers er alt flatt.
- **Ikoner:** strekikoner i Lucide-stil med 1,6 px strek. Bruk `lucide-react-native` og `lucide-react`.
- **Knappehøyde:** minst 44 px på mobil.

## Assets
- `monogram-bg-sage.png` – B&G-monogram i appens farger (1254×1254, gjennomsiktig). `monogram-bg.png` er originalen i vinrødt og gull.
- `logo-mark-sage.svg` – B-merket (brukes ikke lenger i UI-et).
- Produktbilder hentes fra Vinmonopolet under deres vilkår.

---

## Oppgaver for Claude Code (foreslått rekkefølge)
1. Opprett Supabase-prosjekt. Kjør `0001_init.sql` og `0002_admin.sql` (først `create extension pg_trgm;`). Slå av åpen registrering og OAuth.
2. `supabase secrets set VMP_KEY=<ny nøkkel>`, og deploy `vmp` og `admin-invite`.
3. Lag din egen bruker og sett `is_admin = true`.
4. `packages/shared`: porter `vmp.js` til TypeScript (erstatt mellomrom med `_` i søk, sett `img`-URL og gjett årgang).
5. `apps/mobile`: bygg skjermene 1–8. Supabase-klienten lagrer økten i SecureStore. Offline-kø for `register_movement`.
6. `apps/admin`: bygg skjermene 1–7, med beskyttet rute (`is_admin()`).
7. Cron `vmp-sync` og logging til `api_health`.
8. Test RLS: vanlig bruker ser bare egne skap, deaktivert bruker kan ikke skrive, og admin kan lese alt.

## Filer i pakken
```
README.md
Vinskap.dc.html, Vinskap Admin.dc.html, support.js   prototyper
wines.js, admin-data.js                              mockdata
vmp.js                                               referanseklient for Vinmonopolet
ios-frame.jsx                                        bare enhetsramme til presentasjon
monogram-bg-sage.png, monogram-bg.png, logo-mark-sage.svg
supabase/migrations/0001_init.sql, 0002_admin.sql
supabase/functions/vmp/index.ts, admin-invite/index.ts
```
