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
  owner_email       text
);

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
create policy "anon read locations"
  on locations for select
  to anon
  using (true);

drop policy if exists "owner read locations" on locations;
create policy "owner read locations"
  on locations for select
  to authenticated
  using (owner_email = (select auth.jwt() ->> 'email'));

-- ------------------------------------------------------------
-- Primer lokacije (po želji odkomentiraj in prilagodi)
-- ------------------------------------------------------------
-- insert into locations (id, name, google_review_url, owner_email) values
--   ('ABC123', 'Kavarna Center', 'https://search.google.com/local/writereview?placeid=XXXX', 'lastnik@primer.si');
