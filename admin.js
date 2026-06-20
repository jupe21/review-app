// admin.js – logika admin strani (admin.html)
// Poln dostop do vseh lokacij in mnenj. Dostop ima samo uporabnik, čigar
// e-pošta je v tabeli `admins` (uveljavlja RLS prek funkcije is_admin()).

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const USE_MOCK = !!cfg.USE_MOCK;

  let sb = null;
  if (!USE_MOCK) {
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      console.error("Supabase ni konfiguriran. Preveri config.js (ali nastavi USE_MOCK: true).");
    } else {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  }

  // --- Data layer -----------------------------------------------------------
  async function isAdmin() {
    if (USE_MOCK) return window.MockDB.isAdmin();
    if (!sb) return false;
    const { data, error } = await sb.rpc("is_admin");
    if (error) {
      console.error("Napaka pri preverjanju admin pravic:", error);
      return false;
    }
    return data === true;
  }

  async function getAllLocations() {
    if (USE_MOCK) return window.MockDB.getLocations();
    if (!sb) return [];
    const { data, error } = await sb.from("locations").select("*").order("name");
    if (error) {
      console.error("Napaka pri branju lokacij:", error);
      return [];
    }
    return data || [];
  }

  async function getAllReviews() {
    if (USE_MOCK) return window.MockDB.getReviews({});
    if (!sb) return [];
    const { data, error } = await sb
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Napaka pri branju mnenj:", error);
      return [];
    }
    return data || [];
  }

  async function upsertLocation(loc) {
    if (USE_MOCK) return window.MockDB.upsertLocation(loc);
    if (!sb) throw new Error("Supabase ni na voljo");
    const { error } = await sb.from("locations").upsert(loc);
    if (error) throw error;
  }

  async function deleteLocation(id) {
    if (USE_MOCK) return window.MockDB.deleteLocation(id);
    if (!sb) throw new Error("Supabase ni na voljo");
    const { error } = await sb.from("locations").delete().eq("id", id);
    if (error) throw error;
  }

  // --- DOM ------------------------------------------------------------------
  const loginEl = document.getElementById("login");
  const loginForm = document.getElementById("login-form");
  const emailEl = document.getElementById("email");
  const emailField = document.getElementById("email-field");
  const passwordEl = document.getElementById("password");
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");
  const appEl = document.getElementById("app");

  const notAdminEl = document.getElementById("not-admin");
  const adminContentEl = document.getElementById("admin-content");

  const locForm = document.getElementById("loc-form");
  const formTitle = document.getElementById("form-title");
  const fId = document.getElementById("f-id");
  const fName = document.getElementById("f-name");
  const fUrl = document.getElementById("f-url");
  const fOwner = document.getElementById("f-owner");
  const fLang = document.getElementById("f-lang");
  const formMsg = document.getElementById("form-msg");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const locBody = document.getElementById("loc-body");

  // --- pomožne --------------------------------------------------------------
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function starAvg(avg) {
    return avg ? avg.toFixed(1) : "–";
  }

  function starString(rating) {
    const r = Math.round(rating);
    return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
  }

  function locName(id) {
    return locationNames[id] || id;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const min = Math.floor((Date.now() - d) / 60000);
    if (min < 1) return "pravkar";
    if (min < 60) return "pred " + min + " min";
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return "pred " + hrs + " h";
    const days = Math.floor(hrs / 24);
    if (days < 7) return "pred " + days + (days === 1 ? " dnem" : " dnevi");
    return d.toLocaleDateString("sl-SI", { day: "numeric", month: "short", year: "numeric" });
  }

  // --- stanje ---------------------------------------------------------------
  let allReviews = [];
  let locationNames = {};
  let reviewFilter = "all";

  // --- render: vse skupaj ---------------------------------------------------
  async function loadLocations() {
    locBody.innerHTML = '<tr><td colspan="6"><div class="empty">Nalaganje…</div></td></tr>';
    const [locations, reviews] = await Promise.all([getAllLocations(), getAllReviews()]);

    allReviews = reviews;
    locationNames = {};
    locations.forEach((l) => (locationNames[l.id] = l.name));

    renderMetrics();
    renderReviews();

    const stats = {};
    reviews.forEach((r) => {
      if (!stats[r.location_id]) stats[r.location_id] = { sum: 0, count: 0 };
      stats[r.location_id].sum += r.rating;
      stats[r.location_id].count++;
    });

    if (locations.length === 0) {
      locBody.innerHTML =
        '<tr><td colspan="6"><div class="empty">Ni lokacij. Dodaj prvo zgoraj.</div></td></tr>';
      return;
    }

    locBody.innerHTML = locations
      .map((l) => {
        const s = stats[l.id] || { sum: 0, count: 0 };
        const avg = s.count ? s.sum / s.count : 0;
        const data = encodeURIComponent(JSON.stringify(l));
        return (
          "<tr>" +
          "<td>" + escapeHtml(l.name) +
          ' <span class="lang-tag">' + (l.lang === "en" ? "EN" : "SL") + "</span></td>" +
          "<td><code>" + escapeHtml(l.id) + "</code></td>" +
          "<td>" + escapeHtml(l.owner_email || "–") + "</td>" +
          '<td class="num">' + s.count + "</td>" +
          '<td class="num">' + starAvg(avg) + "</td>" +
          '<td class="num" style="white-space:nowrap">' +
          '<button class="row-btn" data-edit="' + data + '">Uredi</button> ' +
          '<button class="row-btn danger" data-del="' + escapeHtml(l.id) + '">Izbriši</button>' +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  // --- render: metrike ------------------------------------------------------
  function renderMetrics() {
    const total = allReviews.length;
    const avg = total ? allReviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const google = allReviews.filter((r) => r.went_to_google).length;
    const googlePct = total ? Math.round((google / total) * 100) : 0;
    const bad = allReviews.filter((r) => r.rating <= 3);
    const unread = bad.filter((r) => !r.read_at).length;

    document.getElementById("m-total").textContent = total;
    document.getElementById("m-avg").innerHTML = total
      ? avg.toFixed(1) + ' <small>/ 5</small>'
      : "–";
    document.getElementById("m-google").textContent = google;
    document.getElementById("m-google-sub").textContent = total ? googlePct + " % vseh" : " ";
    document.getElementById("m-bad").textContent = bad.length;
    document.getElementById("m-bad-sub").textContent =
      unread > 0 ? unread + " neprebranih" : "vse prebrano";
  }

  // --- render: vsa mnenja ---------------------------------------------------
  function renderReviews() {
    let list = allReviews.slice();
    if (reviewFilter === "bad") list = list.filter((r) => r.rating <= 3);
    else if (reviewFilter === "good") list = list.filter((r) => r.rating >= 4);

    document.getElementById("rev-count").textContent = "(" + list.length + ")";
    const el = document.getElementById("rev-list");
    if (list.length === 0) {
      el.innerHTML = '<div class="empty">Ni mnenj za ta filter.</div>';
      return;
    }
    el.innerHTML = list
      .map(
        (r) =>
          '<div class="review-item" style="cursor:default">' +
          '<div class="top">' +
          '<span class="ri-stars">' + starString(r.rating) + "</span>" +
          '<span class="ri-loc">' + escapeHtml(locName(r.location_id)) + "</span>" +
          (r.went_to_google ? '<span class="badge-google">Google</span>' : "") +
          '<span class="ri-time">' + formatTime(r.created_at) + "</span>" +
          "</div>" +
          '<div class="ri-comment">' +
          (r.comment ? escapeHtml(r.comment) : "<em>(brez komentarja)</em>") +
          "</div>" +
          "</div>"
      )
      .join("");
  }

  // filter chipi za mnenja
  document.getElementById("rev-chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    reviewFilter = chip.dataset.filter;
    document.querySelectorAll("#rev-chips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    renderReviews();
  });

  // --- obrazec --------------------------------------------------------------
  function resetForm() {
    locForm.reset();
    fId.disabled = false;
    formTitle.textContent = "Dodaj lokacijo";
    formMsg.textContent = "";
    formMsg.className = "form-msg";
  }

  function fillForm(loc) {
    fId.value = loc.id;
    fId.disabled = true; // ID je ključ – pri urejanju ga ne spreminjamo
    fName.value = loc.name || "";
    fUrl.value = loc.google_review_url || "";
    fOwner.value = loc.owner_email || "";
    fLang.value = loc.lang || "sl";
    formTitle.textContent = "Uredi lokacijo: " + loc.id;
    formMsg.textContent = "";
    formMsg.className = "form-msg";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e) {
    e.preventDefault();
    const loc = {
      id: fId.value.trim(),
      name: fName.value.trim(),
      google_review_url: fUrl.value.trim(),
      owner_email: fOwner.value.trim() || null,
      lang: fLang.value || "sl",
    };
    if (!loc.id || !loc.name || !loc.google_review_url) return;

    saveBtn.disabled = true;
    formMsg.textContent = "Shranjujem…";
    formMsg.className = "form-msg";
    try {
      await upsertLocation(loc);
      resetForm();
      formMsg.textContent = "✓ Lokacija shranjena.";
      formMsg.className = "form-msg ok";
      await loadLocations();
    } catch (err) {
      console.error(err);
      formMsg.textContent = "Napaka pri shranjevanju: " + (err.message || err);
      formMsg.className = "form-msg err";
    } finally {
      saveBtn.disabled = false;
    }
  }

  // klik v tabeli (uredi / izbriši)
  locBody.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) {
      try {
        fillForm(JSON.parse(decodeURIComponent(editBtn.dataset.edit)));
      } catch (_) {}
      return;
    }
    const delBtn = e.target.closest("[data-del]");
    if (delBtn) {
      const id = delBtn.dataset.del;
      if (!confirm('Izbrišem lokacijo "' + id + '"? Mnenja ostanejo v bazi.')) return;
      try {
        await deleteLocation(id);
        await loadLocations();
      } catch (err) {
        alert("Napaka pri brisanju: " + (err.message || err));
      }
    }
  });

  locForm.addEventListener("submit", handleSave);
  resetBtn.addEventListener("click", resetForm);

  // --- auth -----------------------------------------------------------------
  async function showApp() {
    loginEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    const admin = await isAdmin();
    if (!admin) {
      notAdminEl.classList.remove("hidden");
      adminContentEl.classList.add("hidden");
      return;
    }
    notAdminEl.classList.add("hidden");
    adminContentEl.classList.remove("hidden");
    loadLocations();
  }

  function showLogin() {
    loginEl.classList.remove("hidden");
    appEl.classList.add("hidden");
  }

  async function checkAuth() {
    if (USE_MOCK) {
      showApp();
      return;
    }
    if (!sb) {
      showLogin();
      loginError.textContent = "Supabase ni konfiguriran (preveri config.js).";
      return;
    }
    const { data } = await sb.auth.getSession();
    if (data && data.session) showApp();
    else {
      showLogin();
      emailEl.focus();
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    loginError.textContent = "";
    if (USE_MOCK) {
      showApp();
      return;
    }
    if (!sb) {
      loginError.textContent = "Supabase ni konfiguriran (preveri config.js).";
      return;
    }
    loginBtn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value,
    });
    loginBtn.disabled = false;
    if (error) {
      loginError.textContent = "Napačna e-pošta ali geslo.";
      passwordEl.value = "";
      passwordEl.focus();
    } else {
      showApp();
    }
  }

  async function handleLogout() {
    if (!USE_MOCK && sb) await sb.auth.signOut();
    location.reload();
  }

  if (USE_MOCK) emailField.classList.add("hidden");
  document.getElementById("logout").addEventListener("click", () => handleLogout());
  loginForm.addEventListener("submit", handleLogin);
  checkAuth();
})();
