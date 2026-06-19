// dashboard.js – logika dashboarda (dashboard.html)

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const USE_MOCK = !!cfg.USE_MOCK;
  const WINDOW_DAYS = 30; // časovno okno za metrike/pregled
  const AUTH_KEY = "dash_auth";

  // --- Supabase client ------------------------------------------------------
  // Uporablja anon/publishable ključ; dostop do mnenj dobi šele prijavljen
  // lastnik prek Supabase Auth (RLS: select/update samo za 'authenticated').
  let sb = null;
  if (!USE_MOCK) {
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      console.error("Supabase ni konfiguriran. Preveri config.js (ali nastavi USE_MOCK: true).");
    } else {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  }

  // --- Data layer -----------------------------------------------------------
  function sinceISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }

  async function getReviews() {
    if (USE_MOCK) return window.MockDB.getReviews({ sinceDays: WINDOW_DAYS });
    if (!sb) return [];
    const { data, error } = await sb
      .from("reviews")
      .select("*")
      .gte("created_at", sinceISO(WINDOW_DAYS))
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Napaka pri branju mnenj:", error);
      return [];
    }
    return data || [];
  }

  async function getLocations() {
    if (USE_MOCK) return window.MockDB.getLocations();
    if (!sb) return [];
    const { data, error } = await sb.from("locations").select("id, name");
    if (error) {
      console.error("Napaka pri branju lokacij:", error);
      return [];
    }
    return data || [];
  }

  async function markRead(reviewId) {
    if (USE_MOCK) return window.MockDB.markRead(reviewId);
    if (!sb) return null;
    const { error } = await sb
      .from("reviews")
      .update({ read_at: new Date().toISOString() })
      .eq("id", reviewId)
      .is("read_at", null);
    if (error) console.error("Napaka pri označevanju kot prebrano:", error);
    return null;
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

  // --- stanje ---------------------------------------------------------------
  let allReviews = [];
  let locationNames = {}; // id -> name
  let currentFilter = "all";

  // --- pomožne --------------------------------------------------------------
  function starString(rating) {
    const r = Math.round(rating);
    return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
  }

  function locName(id) {
    return locationNames[id] || id;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "pravkar";
    if (min < 60) return "pred " + min + " min";
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return "pred " + hrs + " h";
    const days = Math.floor(hrs / 24);
    if (days < 7) return "pred " + days + (days === 1 ? " dnem" : " dnevi");
    return d.toLocaleDateString("sl-SI", { day: "numeric", month: "short", year: "numeric" });
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
    document.getElementById("m-google-sub").textContent = total ? googlePct + " % vseh" : " ";
    document.getElementById("m-bad").textContent = bad.length;
    document.getElementById("m-bad-sub").textContent =
      unread > 0 ? unread + " neprebranih" : "vse prebrano";
  }

  // --- render: razporeditev ocen -------------------------------------------
  function renderDistribution() {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allReviews.forEach((r) => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
    });
    const max = Math.max(1, ...Object.values(counts));

    const el = document.getElementById("distribution");
    if (allReviews.length === 0) {
      el.innerHTML = '<div class="empty">Ni podatkov.</div>';
      return;
    }
    let html = "";
    for (let star = 5; star >= 1; star--) {
      const c = counts[star];
      const pct = Math.round((c / max) * 100);
      html +=
        '<div class="dist-row">' +
        '<div class="dist-label">' + star + "★</div>" +
        '<div class="dist-track"><div class="dist-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="dist-count">' + c + "</div>" +
        "</div>";
    }
    el.innerHTML = html;
  }

  // --- render: lokacije -----------------------------------------------------
  function renderLocations() {
    const groups = {};
    allReviews.forEach((r) => {
      if (!groups[r.location_id]) groups[r.location_id] = { sum: 0, count: 0 };
      groups[r.location_id].sum += r.rating;
      groups[r.location_id].count++;
    });

    const rows = Object.keys(groups)
      .map((id) => ({
        id,
        name: locName(id),
        avg: groups[id].sum / groups[id].count,
        count: groups[id].count,
      }))
      .sort((a, b) => b.count - a.count);

    const body = document.getElementById("loc-body");
    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="4"><div class="empty">Ni podatkov.</div></td></tr>';
      return;
    }
    body.innerHTML = rows
      .map(
        (r) =>
          "<tr>" +
          "<td>" + escapeHtml(r.name) + "</td>" +
          '<td class="num">' + r.avg.toFixed(1) + "</td>" +
          '<td class="num">' + r.count + "</td>" +
          '<td style="color:var(--star-on)">' + starString(r.avg) + "</td>" +
          "</tr>"
      )
      .join("");
  }

  // --- render: slaba mnenja -------------------------------------------------
  function filteredBad() {
    let list = allReviews.filter((r) => r.rating <= 3);
    if (currentFilter === "unread") list = list.filter((r) => !r.read_at);
    else if (currentFilter === "12") list = list.filter((r) => r.rating <= 2);
    else if (currentFilter === "3") list = list.filter((r) => r.rating === 3);
    return list;
  }

  function renderBadList() {
    const list = filteredBad();
    const el = document.getElementById("bad-list");
    if (list.length === 0) {
      el.innerHTML = '<div class="empty">Ni mnenj za ta filter. 🎉</div>';
      return;
    }
    el.innerHTML = list
      .map((r) => {
        const unread = !r.read_at;
        return (
          '<div class="review-item ' + (unread ? "unread" : "read") + '" data-id="' + r.id + '">' +
          '<div class="top">' +
          '<span class="ri-stars">' + starString(r.rating) + "</span>" +
          '<span class="ri-loc">' + escapeHtml(locName(r.location_id)) + "</span>" +
          (unread ? '<span class="badge-new">nova</span>' : "") +
          '<span class="ri-time">' + formatTime(r.created_at) + "</span>" +
          "</div>" +
          '<div class="ri-comment">' +
          (r.comment ? escapeHtml(r.comment) : "<em>(brez komentarja)</em>") +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAll() {
    renderMetrics();
    renderDistribution();
    renderLocations();
    renderBadList();
  }

  // --- interakcije ----------------------------------------------------------
  // filter chipi
  document.getElementById("chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    document.querySelectorAll("#chips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    renderBadList();
  });

  // klik na mnenje -> označi kot prebrano
  document.getElementById("bad-list").addEventListener("click", async (e) => {
    const item = e.target.closest(".review-item");
    if (!item) return;
    const id = item.dataset.id;
    const review = allReviews.find((r) => r.id === id);
    if (!review || review.read_at) return;

    review.read_at = new Date().toISOString(); // optimistično
    await markRead(id);
    renderMetrics();
    renderBadList();
  });

  // odjava
  document.getElementById("logout").addEventListener("click", () => {
    handleLogout();
  });

  // --- nalaganje podatkov ---------------------------------------------------
  async function loadData() {
    document.getElementById("period-note").textContent = "Zadnjih " + WINDOW_DAYS + " dni";
    const [reviews, locations] = await Promise.all([getReviews(), getLocations()]);
    allReviews = reviews;
    locationNames = {};
    locations.forEach((l) => (locationNames[l.id] = l.name));
    renderAll();
  }

  // --- auth -----------------------------------------------------------------
  // MOCK: preprost gate z geslom (samo za lokalni razvoj).
  // PRAVI: Supabase Auth (e-pošta + geslo) – RLS dovoli branje samo prijavljenim.

  function showApp() {
    loginEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    loadData();
  }

  function showLogin() {
    loginEl.classList.remove("hidden");
    appEl.classList.add("hidden");
  }

  async function checkAuth() {
    if (USE_MOCK) {
      if (sessionStorage.getItem(AUTH_KEY) === "ok") showApp();
      else {
        showLogin();
        passwordEl.focus();
      }
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
      const expected = cfg.DASHBOARD_PASSWORD || "";
      if (expected && passwordEl.value === expected) {
        sessionStorage.setItem(AUTH_KEY, "ok");
        showApp();
      } else {
        loginError.textContent = "Napačno geslo.";
        passwordEl.value = "";
        passwordEl.focus();
      }
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
    if (USE_MOCK) sessionStorage.removeItem(AUTH_KEY);
    else if (sb) await sb.auth.signOut();
    location.reload();
  }

  // V mock načinu ni e-pošte – skrij polje.
  if (USE_MOCK) emailField.classList.add("hidden");

  loginForm.addEventListener("submit", handleLogin);
  checkAuth();
})();
