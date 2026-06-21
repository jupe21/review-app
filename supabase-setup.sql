-- ============================================================
-- Review Board – Supabase setup
-- Zaženi celoten skript v Supabase: Project → SQL Editor → New query
-- ============================================================

-- ------------------------------------------------------------
-- reviews tabela
-- ------------------------------------------------------------
create table if not exists reviews (
  id            uuid        default gen_random_uuid() primary key,
  created_at    timestamptz default now(),
  location_id   text        not null,
  rating        int         not null check (rating between 1 and 5),
  comment       text,
  went_to_google boolean    default false,
  read_at       timestamptz
);

-- Indeksi za hitrejši dashboard (filtriranje, sortiranje)
create index if not exists reviews_created_at_idx  on reviews (created_at desc);
create index if not exists reviews_location_id_idx on reviews (location_id);
create index if not exists reviews_rating_idx      on reviews (rating);
create index if not exists reviews_read_at_idx      on reviews (read_at);

-- ------------------------------------------------------------
-- locations tabela
-- ------------------------------------------------------------
create table if not exists locations (
  id                text primary key,
  name              text not null,
  google_review_url text not null,
  owner_email       text,
  lang              text not null default 'sl',        -- jezik review strani: 'sl' ali 'en'
  theme             text not null default 'classic'    -- videz review strani (glej style.css)
);

-- Za obstoječe baze (če stolpca še ne obstajata):
alter table locations add column if not exists lang  text not null default 'sl';
alter table locations add column if not exists theme text not null default 'classic';

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- ------------------------------------------------------------

-- reviews:
--   * anon (review stran) lahko SAMO vstavlja, ne bere.
--   * authenticated (prijavljen lastnik) bere/posodablja SAMO mnenja svojih
--     lokacij (locations.owner_email = prijavna e-pošta).
alter table reviews enable row level security;

-- anon (review stran) – samo vstavljanje
drop policy if exists "insert only" on reviews;
create policy "insert only"
  on reviews for insert
  to anon
  with check (true);

-- lastnik bere SAMO mnenja svojih lokacij
drop policy if exists "read all for service" on reviews;    -- počisti stare politike
drop policy if exists "read for authenticated" on reviews;
drop policy if exists "owner read reviews" on reviews;
create policy "owner read reviews"
  on reviews for select
  to authenticated
  using (
    location_id in (
      select id from locations
      where owner_email = (select auth.jwt() ->> 'email')
    )
  );

-- lastnik posodablja (read_at) SAMO mnenja svojih lokacij
drop policy if exists "update for authenticated" on reviews;
drop policy if exists "owner update reviews" on reviews;
create policy "owner update reviews"
  on reviews for update
  to authenticated
  using (
    location_id in (
      select id from locations
      where owner_email = (select auth.jwt() ->> 'email')
    )
  )
  with check (
    location_id in (
      select id from locations
      where owner_email = (select auth.jwt() ->> 'email')
    )
  );

-- locations:
--   * anon (review stran) lahko bere katero koli lokacijo po id-ju
--     (potrebuje ime + google_review_url).
--   * authenticated (dashboard) vidi SAMO svoje lokacije.
alter table locations enable row level security;

drop policy if exists "read locations anon" on locations;   -- stara imena
drop policy if exists "read locations" on locations;
drop policy if exists "anon read locations" on locations;
create policy "anon read locations"
  on locations for select
  to anon
  using (true);

drop policy if exists "owner read locations" on locations;
create policy "owner read locations"
  on locations for select
  to authenticated
  using (owner_email = (select auth.jwt() ->> 'email'));

-- lastnik lahko ureja SVOJE lokacije (npr. temo iz dashboarda).
-- with check prepreči, da bi owner_email spremenil na tujega.
drop policy if exists "owner update locations" on locations;
create policy "owner update locations"
  on locations for update
  to authenticated
  using (owner_email = (select auth.jwt() ->> 'email'))
  with check (owner_email = (select auth.jwt() ->> 'email'));

-- ------------------------------------------------------------
-- Admin dostop (admin board) – poln dostop do vseh lokacij in mnenj
-- ------------------------------------------------------------

-- Seznam admin e-poštnih naslovov (kdo ima poln dostop do aplikacije).
create table if not exists admins (
  email text primary key
);
alter table admins enable row level security;
-- Namerno BREZ politik: tabela ni dosegljiva prek javnega API-ja.
-- Bere jo le funkcija is_admin() (security definer) oz. service_role / SQL editor.

-- Pomožna funkcija: ali je prijavljeni uporabnik admin?
-- security definer => obide RLS na tabeli admins (sicer bi preverjanje vrnilo prazno).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admins
    where email = (select auth.jwt() ->> 'email')
  );
$$;

-- locations: admin ima POLN dostop (dodaja/ureja/briše + bere vse).
drop policy if exists "admin all locations" on locations;
create policy "admin all locations"
  on locations for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- reviews: admin lahko bere VSA mnenja (vse lokacije).
drop policy if exists "admin read reviews" on reviews;
create policy "admin read reviews"
  on reviews for select
  to authenticated
  using (is_admin());

-- ⬇️ DODAJ SEBE KOT ADMINA (zamenjaj z e-pošto svojega prijavnega računa):
-- insert into admins (email) values ('admin@primer.si');

-- ------------------------------------------------------------
-- Primer lokacije (po želji odkomentiraj in prilagodi)
-- ------------------------------------------------------------
-- insert into locations (id, name, google_review_url, owner_email) values
--   ('ABC123', 'Kavarna Center', 'https://search.google.com/local/writereview?placeid=XXXX', 'lastnik@primer.si');
