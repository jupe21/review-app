// review.js – logika review strani (index.html)

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const USE_MOCK = !!cfg.USE_MOCK;

  // --- Supabase client (samo kadar ni mock) ---------------------------------
  let sb = null;
  if (!USE_MOCK) {
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      console.error("Supabase ni konfiguriran. Preveri config.js (ali nastavi USE_MOCK: true).");
    } else {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  }

  // --- Data layer (Supabase ali Mock) ---------------------------------------
  async function getLocation(locationId) {
    if (USE_MOCK) return window.MockDB.getLocation(locationId);
    if (!sb) return null;
    const { data, error } = await sb
      .from("locations")
      .select("id, name, google_review_url")
      .eq("id", locationId)
      .maybeSingle();
    if (error) {
      console.error("Napaka pri branju lokacije:", error);
      return null;
    }
    return data;
  }

  async function insertReview(review) {
    if (USE_MOCK) return window.MockDB.insertReview(review);
    if (!sb) throw new Error("Supabase ni na voljo");
    const { error } = await sb.from("reviews").insert(review);
    if (error) {
      console.error("Napaka pri shranjevanju mnenja:", error);
      throw error;
    }
  }

  // --- DOM ------------------------------------------------------------------
  const starsEl = document.getElementById("stars");
  const starBtns = Array.from(starsEl.querySelectorAll(".star"));
  const hintEl = document.getElementById("rate-hint");
  const btnNext = document.getElementById("btn-next");

  const btnFourGoogle = document.getElementById("btn-four-google");
  const btnFourNo = document.getElementById("btn-four-no");
  const btnSend = document.getElementById("btn-send");
  const feedbackText = document.getElementById("feedback-text");
  const errorText = document.getElementById("error-text");
  const thanksTitle = document.querySelector("#step-thanks h1");
  const thanksSub = document.querySelector("#step-thanks .subtitle");

  // --- stanje ---------------------------------------------------------------
  const state = {
    rating: 0,
    locationId: null,
    location: null,
    saved: false, // prepreči dvojno shranjevanje
  };

  // --- pomožne --------------------------------------------------------------
  function getLoc() {
    const params = new URLSearchParams(window.location.search);
    const loc = (params.get("loc") || "").trim();
    return loc;
  }

  function showStep(id) {
    document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function paintStars(upTo) {
    starBtns.forEach((b) => {
      const v = Number(b.dataset.value);
      b.classList.toggle("active", v <= upTo);
    });
  }

  function setRating(r) {
    state.rating = r;
    paintStars(r);

    if (r === 5) {
      btnNext.textContent = "Naprej na Google";
      btnNext.classList.add("btn-google");
      hintEl.textContent = "Super! Kliknite za oddajo ocene na Googlu.";
      hintEl.classList.add("show");
    } else {
      btnNext.textContent = "Naprej";
      btnNext.classList.remove("btn-google");
      hintEl.textContent = "";
      hintEl.classList.remove("show");
    }
    btnNext.disabled = false;
  }

  function redirectToGoogle() {
    const url = state.location && state.location.google_review_url;
    if (url) {
      window.location.href = url;
    } else {
      // brez URL-ja vsaj prikaži zahvalo
      showThanks("Hvala za vašo oceno!", "Cenimo, da ste si vzeli čas.");
    }
  }

  function showThanks(title, sub) {
    if (title) thanksTitle.textContent = title;
    if (sub) thanksSub.textContent = sub;
    showStep("step-thanks");
  }

  // Shrani natanko enkrat. Vrne true ob uspehu (oz. ko ne želimo blokirati).
  async function saveOnce(rating, comment, wentToGoogle) {
    if (state.saved) return true;
    state.saved = true;
    try {
      await insertReview({
        location_id: state.locationId,
        rating: rating,
        comment: comment || null,
        went_to_google: !!wentToGoogle,
      });
      return true;
    } catch (e) {
      // Ne blokiraj uporabnika ob napaki shranjevanja – dovoli nadaljevanje.
      state.saved = false;
      return false;
    }
  }

  function lockButtons(locked) {
    [btnNext, btnFourGoogle, btnFourNo, btnSend].forEach((b) => {
      if (b) b.disabled = locked;
    });
  }

  // --- event listenerji -----------------------------------------------------
  // hover preview
  starBtns.forEach((b) => {
    b.addEventListener("mouseenter", () => paintStars(Number(b.dataset.value)));
    b.addEventListener("click", () => setRating(Number(b.dataset.value)));
  });
  starsEl.addEventListener("mouseleave", () => paintStars(state.rating));

  // glavni "Naprej" gumb
  btnNext.addEventListener("click", async () => {
    if (state.rating === 0) return;

    if (state.rating === 5) {
      lockButtons(true);
      await saveOnce(5, null, true);
      redirectToGoogle();
      return;
    }
    if (state.rating === 4) {
      showStep("step-four");
      return;
    }
    // 1–3
    showStep("step-feedback");
    feedbackText.focus();
  });

  // 4 zvezde – gre na Google
  btnFourGoogle.addEventListener("click", async () => {
    lockButtons(true);
    await saveOnce(4, null, true);
    redirectToGoogle();
  });

  // 4 zvezde – raje ne
  btnFourNo.addEventListener("click", async () => {
    lockButtons(true);
    await saveOnce(4, null, false);
    showThanks("Hvala za vašo oceno!", "Cenimo, da ste si vzeli čas.");
  });

  // 1–3 zvezde – pošlji feedback
  btnSend.addEventListener("click", async () => {
    lockButtons(true);
    const comment = feedbackText.value.trim();
    await saveOnce(state.rating, comment, false);
    showThanks("Hvala za sporočilo", "Upoštevali bomo vaše mnenje.");
  });

  // --- init -----------------------------------------------------------------
  async function init() {
    const loc = getLoc();
    if (!loc) {
      errorText.textContent = "Manjka oznaka lokacije v povezavi. Prosimo, ponovno skenirajte kodo.";
      showStep("step-error");
      return;
    }
    state.locationId = loc;

    const location = await getLocation(loc);
    if (!location) {
      errorText.textContent = "Te lokacije ne najdemo. Prosimo, ponovno skenirajte kodo.";
      showStep("step-error");
      return;
    }
    state.location = location;
    // korak za oceno je že privzeto aktiven
  }

  init();
})();
