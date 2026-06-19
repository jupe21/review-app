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
    },
    ABC123: {
      id: "ABC123",
      name: "Kavarna Center",
      google_review_url: "https://www.google.com/search?q=kavarna+center",
      owner_email: "lastnik@primer.si",
    },
    XYZ789: {
      id: "XYZ789",
      name: "Restavracija Pri Lipi",
      google_review_url: "https://www.google.com/search?q=pri+lipi",
      owner_email: "lastnik2@primer.si",
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
