# Review Board

Preprosta review board aplikacija za zbiranje mnenj strank.

- **Review stran** (`/?loc=ID`) – stranka odda oceno (1–5 zvezdic). Zadovoljne stranke (4–5★) usmeri na Google recenzije, nezadovoljne (1–3★) na interni feedback obrazec.
- **Dashboard** (`/dashboard`) – z geslom zaščiten pregled mnenj za lastnika.
- **Brez custom backenda** – vse teče na Supabase (baza + REST) + statičen frontend na Vercelu.
- **Alerti** – Supabase Database Webhook ob slabem mnenju pošlje POST na n8n.

---

## Struktura

```
index.html          # review stran
dashboard.html      # dashboard (lastnik – svoje lokacije)
admin.html          # admin board (skrbnik – vse lokacije)
style.css           # skupni stili
review.js           # logika review strani
dashboard.js        # logika dashboarda
admin.js            # logika admin boarda
config.js           # env variabile (GENERIRANO na buildu)
config.example.js   # primer konfiguracije
mock-data.js        # dummy podatki za lokalni test
generate-config.js  # zgradi config.js iz env variabel (Vercel build)
supabase-setup.sql  # SQL za setup baze
vercel.json         # Vercel konfiguracija
.env.example        # primer env variabel
```

---

## Lokalni razvoj (brez Supabase)

`config.js` ima privzeto `USE_MOCK: true`, tako da aplikacija takoj deluje z dummy podatki iz `mock-data.js`.

Zaženi kateri koli statičen strežnik in odpri v brskalniku:

```bash
# Python
python -m http.server 8080
# ali Node
npx serve .
```

- Review stran: <http://localhost:8080/?loc=test>
- Dashboard: <http://localhost:8080/dashboard.html> (geslo: `geslo123`)

> Opomba: stran odpri prek strežnika (`http://…`), **ne** kot `file://`, sicer brskalnik ne naloži skript pravilno.

Za povezavo s pravim Supabase nastavi `USE_MOCK: false` in vpiši ključe v `config.js` (glej `config.example.js`).

---

## 1. Supabase projekt in baza

1. Ustvari brezplačen projekt na <https://supabase.com>.
2. V projektu odpri **SQL Editor → New query**.
3. Prilepi vsebino datoteke [`supabase-setup.sql`](supabase-setup.sql) in zaženi (**Run**).
   - Ustvari tabeli `reviews` in `locations`, indekse ter RLS pravila.
4. Ključa za frontend najdeš v **Project Settings → API Keys** (oz. prek gumba **Connect → Framework**):
   - **Project URL** (Settings → Data API) → `SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `SUPABASE_ANON_KEY` (javen, varen za frontend)

   > Skrivni (`sb_secret_...`) ključ **NI** potreben — dashboard se prijavlja prek Supabase Auth (glej korak 6). Tako v brskalniku ni nobenega skrivnega ključa.

### RLS / varnost na kratko

- **`reviews`**: `anon` (review stran) lahko samo **vstavlja**; prijavljen lastnik (`authenticated`) **bere in posodablja samo mnenja svojih lokacij**.
- **`locations`**: `anon` (review stran) bere katero koli lokacijo po id-ju; prijavljen lastnik (dashboard) vidi **samo svoje lokacije**.
- **Lastništvo** se določa prek stolpca `locations.owner_email`: vidiš samo lokacije, kjer je `owner_email` enak **e-pošti tvojega prijavnega računa** (Supabase Auth). Tako vsaka stranka vidi samo svoje podatke.

> ✅ **Varnost:** novi `sb_secret_` ključi so blokirani v brskalniku, zato dashboard uporablja Supabase Auth namesto skrivnega ključa. V frontendu je le javni publishable ključ; filtriranje po lastniku uveljavlja baza (RLS), ne frontend.

---

## 2. Dodajanje lokacije

Vsaka lokacija (= stranka / poslovalnica) je vrstica v tabeli `locations`. V Supabase **Table Editor → locations → Insert row**, ali prek SQL:

```sql
insert into locations (id, name, google_review_url, owner_email) values
  ('ABC123', 'Kavarna Center', 'https://search.google.com/local/writereview?placeid=PLACE_ID', 'lastnik@primer.si');
```

- `id` – kratka oznaka, ki gre v URL (`/?loc=ABC123`). Lahko poljubna (npr. `ABC123`).
- `name` – prikazano ime na dashboardu.
- `google_review_url` – kamor usmerimo zadovoljne stranke.
- `owner_email` – ⚠️ **pomembno:** mora biti **enak e-pošti prijavnega računa** (Supabase Auth) lastnika te lokacije. Dashboard prikaže samo lokacije, kjer se `owner_email` ujema s prijavljenim uporabnikom. Če se ne ujema, lastnik te lokacije ne bo videl.

### Kako dobiti Google Review URL

1. Najdi svoj posel na <https://www.google.com/maps> in kopiraj **Place ID** prek <https://developers.google.com/maps/documentation/places/web-service/place-id>.
2. Sestavi: `https://search.google.com/local/writereview?placeid=PLACE_ID`
   (odpre okno za pisanje recenzije neposredno).

---

## 3. QR koda za lokacijo

Stranka odpre review stran prek povezave oblike:

```
https://tvoja-domena.com/?loc=ABC123
```

QR kodo iz te povezave ustvariš s katerim koli generatorjem, npr.:

- <https://www.qr-code-generator.com>
- ali CLI: `npx qrcode "https://tvoja-domena.com/?loc=ABC123" -o abc123.png`

Natisni QR kodo / nalepko in jo postavi na mizo, blagajno ali pošlji prek NFC nalepke.

---

## 4. Supabase Database Webhook → n8n

Ob vsakem novem mnenju z oceno 1–3 želimo opozorilo v n8n.

### a) Pripravi n8n webhook

1. V n8n ustvari workflow z vozliščem **Webhook** (HTTP `POST`).
2. Kopiraj produkcijski URL, npr. `https://tvoj-n8n.domena.com/webhook/review-alert`.
3. Dodaj naslednje korake (Slack/email/…) po želji.

### b) Nastavi webhook v Supabase

1. V Supabase odpri **Database → Webhooks → Create a new hook**.
2. Nastavi:
   - **Name**: `review-alert`
   - **Table**: `reviews`
   - **Events**: ✅ `Insert`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: tvoj n8n webhook URL (iz `N8N_WEBHOOK_URL`)
3. (Priporočeno) Filtriraj samo slaba mnenja, da n8n ne dobi vseh:
   - V naprednih nastavitvah / pogojih omeji na `rating <= 3`.
   - Če pogoji niso na voljo, filtriraj znotraj n8n (preveri `body.record.rating <= 3`).
4. Shrani.

Supabase pošlje payload v obliki:

```json
{
  "type": "INSERT",
  "table": "reviews",
  "record": { "id": "...", "rating": 2, "comment": "...", "location_id": "..." }
}
```

V n8n preberi `{{$json.body.record.rating}}`, `{{$json.body.record.comment}}`, `{{$json.body.record.location_id}}`.

---

## 5. Deploy na Vercel

1. Potisni kodo v Git repozitorij in ga poveži z Vercelom (**Add New → Project**).
2. V **Settings → Environment Variables** dodaj (iz `.env.example`):

   | Variabla            | Vrednost                   |
   | ------------------- | -------------------------- |
   | `SUPABASE_URL`      | `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | `sb_publishable_...`       |

   - Skrivni (`sb_secret_`) ključ **NE** sodi sem — dashboard uporablja Supabase Auth.
   - `DASHBOARD_PASSWORD` je potreben le za lokalni mock; v produkciji ni nujen.
   - `N8N_WEBHOOK_URL` se uporablja v Supabase webhooku, ne v frontendu.

3. Build je že nastavljen v [`vercel.json`](vercel.json):
   - `buildCommand: node generate-config.js` → iz env variabel ustvari `config.js`.
   - `cleanUrls: true` → `dashboard.html` je dostopen na `/dashboard`.
4. **Deploy.** Po deployu je `config.js` samodejno napolnjen iz env variabel (in `USE_MOCK` postavljen na `false`, ker je `SUPABASE_URL` nastavljen).

> Po spremembi env variabel je potreben **ponoven deploy**, da se `config.js` regenerira.

---

## 6. Dostop do dashboarda (Supabase Auth)

Dashboard se prijavlja prek **Supabase Auth** (e-pošta + geslo) — to ni OAuth, samo en račun za lastnika. Najprej ustvari ta račun:

### a) Ustvari lastnikov račun (enkrat)

1. V Supabase: **Authentication → Users → Add user → Create new user**.
2. Vpiši **e-pošto** in **geslo** ter (priporočeno) vključi **Auto Confirm User**, da računa ni treba potrjevati prek e-pošte.
3. Shrani. To sta poverilnici za prijavo v dashboard.

> Po želji v **Authentication → Providers → Email** izklopi javno registracijo (»Allow new users to sign up«), da se ne more registrirati nihče drug.

### b) Prijava

- Odpri `https://tvoja-domena.com/dashboard`.
- Vpiši **e-pošto in geslo** računa iz koraka (a). Supabase Auth ohrani sejo (ostaneš prijavljen tudi po osvežitvi).
- Z gumbom **Odjava** se odjaviš.

> RLS dovoli branje mnenj samo prijavljenim uporabnikom, zato brez prijave dashboard ne prikaže podatkov.

Dashboard prikazuje (zadnjih 30 dni):

- **Metrike**: skupaj mnenj, povprečna ocena, koliko jih je šlo na Google, število slabih mnenj (1–3★) in neprebranih.
- **Razporeditev ocen** (1–5).
- **Pregled po lokacijah**.
- **Seznam slabih mnenj** s filtri (Vsa / Neprebrana / 1–2★ / 3★). Klik na mnenje ga označi kot prebrano (`read_at`).

---

## 7. Admin board (za tebe / skrbnika aplikacije)

`/admin` je ločena stran s **polnim dostopom**: dodajanje/urejanje/brisanje **vseh** lokacij in vpogled v **vsa** mnenja. Namenjena je skrbniku aplikacije, ne lastnikom posameznih lokacij.

Razlika med stranema:

| Stran | Kdo | Kaj vidi |
| ----- | --- | -------- |
| `/dashboard` | lastnik lokacije | samo **svoje** lokacije (po `owner_email`) |
| `/admin` | skrbnik (v tabeli `admins`) | **vse** lokacije + dodajanje/urejanje |

### a) Določi, kdo je admin

Admin je vsak prijavljen uporabnik, čigar e-pošta je v tabeli `admins`. Dodaj sebe (v Supabase **SQL Editor**):

```sql
insert into admins (email) values ('tvoja-prijavna@eposta.si');
```

> E-pošta mora biti enaka tisti, s katero se prijaviš (Supabase Auth račun iz koraka 6). Admin pravice uveljavlja baza (RLS prek funkcije `is_admin()`), ne frontend.

### b) Uporaba

- Odpri `https://tvoja-domena.com/admin` in se prijavi (isti Auth račun).
- **Dodaj lokacijo**: vpiši `ID`, ime, Google Review URL in (neobvezno) `owner_email` lastnika. Klik **Shrani lokacijo**.
  - Če vpišeš obstoječ `ID`, se lokacija **posodobi** (ali klikni **Uredi** v tabeli).
  - S tem ko nastaviš `owner_email`, ta lastnik to lokacijo vidi v svojem `/dashboard`.
- **Vse lokacije**: tabela z lastnikom, številom mnenj in povprečjem; gumba **Uredi** / **Izbriši**.

> Če stran pokaže »Ta račun nima admin pravic«, te še ni v tabeli `admins` (glej korak a).

---

## Flow review strani

| Ocena | Vedenje                                                                                          | `went_to_google` |
| ----- | ----------------------------------------------------------------------------------------------- | ---------------- |
| 5★    | Gumb **»Naprej na Google«** (moder) + hint → takojšen redirect na Google                         | `true`           |
| 4★    | Vmesni korak: **»Odpri Google recenzije«** ali **»Raje ne, hvala«**                              | `true` le ob kliku na Google |
| 1–3★  | Feedback obrazec (»Opišite vašo izkušnjo…«) → zahvalna stran                                     | `false`          |

Vsako mnenje se shrani v tabelo `reviews`.
