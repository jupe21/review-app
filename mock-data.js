// mock-data.js
// -----------------------------------------------------------------------------
// Dummy podatki za lokalno testiranje brez Supabase.
// Aktiviraj z USE_MOCK: true v config.js.
//
// Izpostavi window.MockDB s funkcijami, ki posnemajo Supabase API,
// ki ga uporabljata review.js in dashboard.js.
// -----------------------------------------------------------------------------

(function () {
  // --- lokacije -------------------------------------------------------------
  const locations = {
    test: {
      id: "test",
      name: "Testna lokacija",
      google_review_url: "https://www.google.com/search?q=google+reviews",
      owner_email: "test@primer.si",
      lang: "sl",
      theme: "classic",
    },
    ABC123: {
      id: "ABC123",
      name: "Kavarna Center",
      google_review_url: "https://www.google.com/search?q=kavarna+center",
      owner_email: "lastnik@primer.si",
      lang: "sl",
      theme: "ocean",
    },
    XYZ789: {
      id: "XYZ789",
      name: "Restavracija Pri Lipi",
      google_review_url: "https://www.google.com/search?q=pri+lipi",
      owner_email: "lastnik2@primer.si",
      lang: "en",
      theme: "indigo",
    },
  };

  // --- generirana mnenja (zadnjih ~30 dni) ----------------------------------
  function daysAgo(d, h = 0) {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(t.getHours() - h);
    return t.toISOString();
  }

  let idCounter = 1;
  function makeId() {
    return "mock-" + String(idCounter++).padStart(4, "0");
  }

  const reviews = [
    { location_id: "ABC123", rating: 5, comment: null, went_to_google: true, created_at: daysAgo(1), read_at: null },
    { location_id: "ABC123", rating: 5, comment: null, went_to_google: true, created_at: daysAgo(2), read_at: null },
    { location_id: "ABC123", rating: 4, comment: null, went_to_google: true, created_at: daysAgo(2, 3), read_at: null },
    { location_id: "ABC123", rating: 2, comment: "Predolgo čakanje na kavo, skoraj 20 minut.", went_to_google: false, created_at: daysAgo(3), read_at: null },
    { location_id: "ABC123", rating: 1, comment: "Osebje je bilo neprijazno.", went_to_google: false, created_at: daysAgo(4), read_at: daysAgo(3) },
    { location_id: "XYZ789", rating: 5, comment: null, went_to_google: true, created_at: daysAgo(1, 2), read_at: null },
    { location_id: "XYZ789", rating: 3, comment: "Hrana je bila v redu, ambient malo hrupen.", went_to_google: false, created_at: daysAgo(5), read_at: null },
    { location_id: "XYZ789", rating: 4, comment: null, went_to_google: false, created_at: daysAgo(6), read_at: null },
    { location_id: "XYZ789", rating: 2, comment: "Naročilo je bilo napačno.", went_to_google: false, created_at: daysAgo(7), read_at: daysAgo(6) },
    { location_id: "test", rating: 5, comment: null, went_to_google: true, created_at: daysAgo(8), read_at: null },
    { location_id: "test", rating: 3, comment: "Povprečno, nič posebnega.", went_to_google: false, created_at: daysAgo(9), read_at: null },
    { location_id: "test", rating: 1, comment: "Zelo slaba izkušnja, ne priporočam.", went_to_google: false, created_at: daysAgo(10), read_at: null },
  ].map((r) => ({ id: makeId(), ...r }));

  // --- platforme za zbiranje ocen ------------------------------------------
  const platforms = {
    test: [
      { id: "mp1", location_id: "test", platform: "google", url: "https://www.google.com/search?q=test+reviews", sort_order: 0 },
    ],
    ABC123: [
      { id: "mp2", location_id: "ABC123", platform: "google", url: "https://www.google.com/search?q=kavarna+center+reviews", sort_order: 0 },
      { id: "mp3", location_id: "ABC123", platform: "tripadvisor", url: "https://www.tripadvisor.com", sort_order: 1 },
    ],
    XYZ789: [
      { id: "mp4", location_id: "XYZ789", platform: "google", url: "https://www.google.com/search?q=pri+lipi+reviews", sort_order: 0 },
      { id: "mp5", location_id: "XYZ789", platform: "booking", url: "https://www.booking.com", sort_order: 1 },
    ],
  };

  // --- javni API ------------------------------------------------------------
  window.MockDB = {
    async getLocation(locationId) {
      // posnemaj malo zakasnitve omrežja
      await new Promise((res) => setTimeout(res, 150));
      return locations[locationId] || null;
    },

    async insertReview(review) {
      await new Promise((res) => setTimeout(res, 200));
      const row = {
        id: makeId(),
        created_at: new Date().toISOString(),
        read_at: null,
        comment: null,
        went_to_google: false,
        ...review,
      };
      reviews.unshift(row);
      console.log("[MOCK] vstavljen review:", row);
      return row;
    },

    async getReviews({ sinceDays } = {}) {
      await new Promise((res) => setTimeout(res, 200));
      let rows = [...reviews];
      if (sinceDays) {
        const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
        rows = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
      }
      return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    async getLocations() {
      await new Promise((res) => setTimeout(res, 100));
      return Object.values(locations);
    },

    // --- admin board ---
    async isAdmin() {
      await new Promise((res) => setTimeout(res, 50));
      return true; // v mock načinu je vse dovoljeno (lokalni razvoj)
    },

    async upsertLocation(loc) {
      await new Promise((res) => setTimeout(res, 150));
      locations[loc.id] = {
        id: loc.id,
        name: loc.name,
        google_review_url: loc.google_review_url,
        owner_email: loc.owner_email || null,
        lang: loc.lang || "sl",
        theme: loc.theme || "classic",
      };
      console.log("[MOCK] shranjena lokacija:", locations[loc.id]);
      return locations[loc.id];
    },

    async updateTheme(id, theme) {
      await new Promise((res) => setTimeout(res, 100));
      if (locations[id]) {
        locations[id].theme = theme;
        console.log("[MOCK] tema posodobljena:", id, theme);
      }
    },

    async deleteLocation(id) {
      await new Promise((res) => setTimeout(res, 100));
      delete locations[id];
      delete platforms[id];
      console.log("[MOCK] izbrisana lokacija:", id);
    },

    async getPlatforms(locationId) {
      await new Promise((res) => setTimeout(res, 80));
      return (platforms[locationId] || []).slice().sort((a, b) => a.sort_order - b.sort_order);
    },

    async upsertPlatform(p) {
      await new Promise((res) => setTimeout(res, 100));
      if (!platforms[p.location_id]) platforms[p.location_id] = [];
      const arr = platforms[p.location_id];
      const idx = arr.findIndex((x) => x.platform === p.platform);
      const row = { id: "mp-" + Date.now(), ...p };
      if (idx >= 0) arr[idx] = row;
      else arr.push(row);
      console.log("[MOCK] platforma upsert:", row);
      return row;
    },

    async deletePlatform(locationId, platform) {
      await new Promise((res) => setTimeout(res, 80));
      if (platforms[locationId]) {
        platforms[locationId] = platforms[locationId].filter((p) => p.platform !== platform);
      }
      console.log("[MOCK] platforma izbrisana:", locationId, platform);
    },

    async markRead(reviewId) {
      await new Promise((res) => setTimeout(res, 100));
      const row = reviews.find((r) => r.id === reviewId);
      if (row && !row.read_at) {
        row.read_at = new Date().toISOString();
        console.log("[MOCK] označeno kot prebrano:", reviewId);
      }
      return row;
    },
  };
})();
