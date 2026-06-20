// review.js – logika review strani (index.html)

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const USE_MOCK = !!cfg.USE_MOCK;

  // --- i18n -----------------------------------------------------------------
  const I18N = {
    sl: {
      page_title: "Vaše mnenje",
      rate_title: "Kako zadovoljni ste bili?",
      rate_subtitle: "Vaše mnenje nam veliko pomeni.",
      next: "Naprej",
      next_google: "Naprej na Google",
      hint5: "Super! Kliknite za oddajo ocene na Googlu.",
      four_title: "Hvala za oceno!",
      four_subtitle: "Bi nam pomagali z oceno tudi na Googlu? Traja le trenutek.",
      open_google: "Odpri Google recenzije",
      no_thanks: "Raje ne, hvala",
      feedback_title: "Žal nam je.",
      feedback_subtitle: "Povejte nam, kaj je šlo narobe — popravili bomo.",
      feedback_placeholder: "Opišite vašo izkušnjo...",
      send: "Pošlji",
      feedback_thanks_title: "Hvala za sporočilo",
      feedback_thanks_subtitle: "Upoštevali bomo vaše mnenje.",
      rating_thanks_title: "Hvala za vašo oceno!",
      rating_thanks_subtitle: "Cenimo, da ste si vzeli čas.",
      error_title: "Lokacija ni najdena",
      error_missing: "Manjka oznaka lokacije v povezavi. Prosimo, ponovno skenirajte kodo.",
      error_notfound: "Te lokacije ne najdemo. Prosimo, ponovno skenirajte kodo.",
    },
    en: {
      page_title: "Your feedback",
      rate_title: "How satisfied were you?",
      rate_subtitle: "Your feedback means a lot to us.",
      next: "Next",
      next_google: "Continue to Google",
      hint5: "Great! Tap to leave your review on Google.",
      four_title: "Thanks for your rating!",
      four_subtitle: "Would you help us with a Google review too? It only takes a moment.",
      open_google: "Open Google reviews",
      no_thanks: "No thanks",
      feedback_title: "We're sorry.",
      feedback_subtitle: "Tell us what went wrong — we'll make it right.",
      feedback_placeholder: "Describe your experience...",
      send: "Send",
      feedback_thanks_title: "Thank you for your message",
      feedback_thanks_subtitle: "We'll take your feedback into account.",
      rating_thanks_title: "Thank you for your rating!",
      rating_thanks_subtitle: "We appreciate you taking the time.",
      error_title: "Location not found",
      error_missing: "The location code is missing from the link. Please scan the code again.",
      error_notfound: "We couldn't find this location. Please scan the code again.",
    },
  };

  let lang = "sl";
  function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.sl[key] || key;
  }
  function setLang(l) {
    lang = I18N[l] ? l : "sl";
    document.documentElement.lang = lang;
    document.title = t("page_title");
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
    });
  }

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
      .select("id, name, google_review_url, lang")
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
      btnNext.textContent = t("next_google");
      btnNext.classList.add("btn-google");
      hintEl.textContent = t("hint5");
      hintEl.classList.add("show");
    } else {
      btnNext.textContent = t("next");
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
      showThanks(t("rating_thanks_title"), t("rating_thanks_subtitle"));
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
    showThanks(t("rating_thanks_title"), t("rating_thanks_subtitle"));
  });

  // 1–3 zvezde – pošlji feedback
  btnSend.addEventListener("click", async () => {
    lockButtons(true);
    const comment = feedbackText.value.trim();
    await saveOnce(state.rating, comment, false);
    showThanks(t("feedback_thanks_title"), t("feedback_thanks_subtitle"));
  });

  // --- init -----------------------------------------------------------------
  async function init() {
    const params = new URLSearchParams(window.location.search);
    const urlLang = (params.get("lang") || "").trim().toLowerCase();
    // Jezik iz URL-ja (npr. ?lang=en) takoj uveljavi – brez utripa.
    if (urlLang) setLang(urlLang);

    const loc = (params.get("loc") || "").trim();
    if (!loc) {
      errorText.textContent = t("error_missing");
      showStep("step-error");
      return;
    }
    state.locationId = loc;

    const location = await getLocation(loc);
    if (!location) {
      errorText.textContent = t("error_notfound");
      showStep("step-error");
      return;
    }
    state.location = location;

    // Jezik lokacije (če ni že nastavljen prek URL-ja).
    if (!urlLang) setLang(location.lang || "sl");
    // korak za oceno je že privzeto aktiven
  }

  init();
})();
