// review.js – logika review strani (review.html)

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
      next_review: "Naprej na oceno",
      hint5: "Super! Kliknite za oddajo ocene.",
      platform_title: "Odlično!",
      platform_subtitle: "Kje bi nas ocenili?",
      no_thanks: "Raje ne, hvala",
      feedback_title: "Žal nam je.",
      feedback_subtitle: "Povejte nam, kaj je šlo narobe in popravili bomo.",
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
      next_review: "Continue to review",
      hint5: "Great! Tap to leave your review.",
      platform_title: "Excellent!",
      platform_subtitle: "Where would you like to leave a review?",
      no_thanks: "No thanks",
      feedback_title: "We're sorry.",
      feedback_subtitle: "Tell us what went wrong and we will make it right.",
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

  // --- tema -----------------------------------------------------------------
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme || "classic");
  }

  // --- Supabase client ------------------------------------------------------
  let sb = null;
  if (!USE_MOCK) {
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      console.error("Supabase ni konfiguriran. Preveri config.js (ali nastavi USE_MOCK: true).");
    } else {
      sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }
  }

  // --- Data layer -----------------------------------------------------------
  async function getLocation(locationId) {
    if (USE_MOCK) return window.MockDB.getLocation(locationId);
    if (!sb) return null;
    const { data, error } = await sb
      .from("locations")
      .select("*")
      .eq("id", locationId)
      .maybeSingle();
    if (error) { console.error("Napaka pri branju lokacije:", error); return null; }
    return data;
  }

  async function getLocationPlatforms(locationId) {
    if (USE_MOCK) return window.MockDB.getPlatforms(locationId);
    if (!sb) return [];
    const { data, error } = await sb
      .from("location_platforms")
      .select("platform, url, sort_order")
      .eq("location_id", locationId)
      .order("sort_order");
    if (error) { console.error("Napaka pri branju platform:", error); return []; }
    return data || [];
  }

  async function insertReview(review) {
    if (USE_MOCK) return window.MockDB.insertReview(review);
    if (!sb) throw new Error("Supabase ni na voljo");
    const { error } = await sb.from("reviews").insert(review);
    if (error) { console.error("Napaka pri shranjevanju mnenja:", error); throw error; }
  }

  // --- DOM ------------------------------------------------------------------
  const starsEl = document.getElementById("stars");
  const starBtns = Array.from(starsEl.querySelectorAll(".star"));
  const hintEl = document.getElementById("rate-hint");
  const btnNext = document.getElementById("btn-next");
  const btnSkipPlatform = document.getElementById("btn-skip-platform");
  const platformBtnsEl = document.getElementById("platform-btns");
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
    platforms: [],      // [{platform, url, sort_order}]
    urlPlatform: null,  // vrednost ?platform= iz URL-ja (za QR po platformi)
    saved: false,
  };

  // --- pomožne --------------------------------------------------------------
  function showStep(id) {
    document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function paintStars(upTo) {
    starBtns.forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.value) <= upTo);
    });
  }

  function setRating(r) {
    state.rating = r;
    paintStars(r);
    const hasPlatforms = state.platforms.length > 0;
    if (r >= 4) {
      btnNext.textContent = hasPlatforms ? t("next_review") : t("next_review");
      btnNext.classList.toggle("btn-google", !hasPlatforms && r === 5);
      hintEl.textContent = r === 5 ? t("hint5") : "";
      hintEl.classList.toggle("show", r === 5);
    } else {
      btnNext.textContent = t("next");
      btnNext.classList.remove("btn-google");
      hintEl.textContent = "";
      hintEl.classList.remove("show");
    }
    btnNext.disabled = false;
  }

  function showThanks(title, sub) {
    if (title) thanksTitle.textContent = title;
    if (sub) thanksSub.textContent = sub;
    showStep("step-thanks");
  }

  async function saveOnce(rating, comment, wentToReview) {
    if (state.saved) return true;
    state.saved = true;
    try {
      await insertReview({
        location_id: state.locationId,
        rating: rating,
        comment: comment || null,
        went_to_google: !!wentToReview,
      });
      return true;
    } catch (e) {
      state.saved = false;
      return false;
    }
  }

  function lockButtons(locked) {
    [btnNext, btnSkipPlatform, btnSend].forEach((b) => { if (b) b.disabled = locked; });
    platformBtnsEl.querySelectorAll("button").forEach((b) => { b.disabled = locked; });
  }

  // Resolviraj platforme glede na state.urlPlatform in state.location (fallback)
  function resolvedPlatforms() {
    let ps = state.platforms;
    // Če je v URL-ju ?platform=X, filtriraj samo na tisto
    if (state.urlPlatform) {
      const match = ps.find((p) => p.platform === state.urlPlatform);
      if (match) return [match];
    }
    // Fallback na google_review_url za stare lokacije brez platform
    if (ps.length === 0 && state.location && state.location.google_review_url) {
      return [{ platform: "google", url: state.location.google_review_url }];
    }
    return ps;
  }

  function buildPlatformButtons(platforms) {
    platformBtnsEl.innerHTML = "";
    platforms.forEach((p) => {
      const meta = window.platformById ? window.platformById(p.platform) : { label: p.platform };
      const btn = document.createElement("button");
      btn.className = "btn btn-platform";
      btn.textContent = meta.label;
      btn.addEventListener("click", async () => {
        lockButtons(true);
        await saveOnce(state.rating, null, true);
        window.location.href = p.url;
      });
      platformBtnsEl.appendChild(btn);
    });
  }

  // --- event listenerji -----------------------------------------------------
  starBtns.forEach((b) => {
    b.addEventListener("mouseenter", () => paintStars(Number(b.dataset.value)));
    b.addEventListener("click", () => setRating(Number(b.dataset.value)));
  });
  starsEl.addEventListener("mouseleave", () => paintStars(state.rating));

  btnNext.addEventListener("click", async () => {
    if (state.rating === 0) return;

    if (state.rating <= 3) {
      showStep("step-feedback");
      feedbackText.focus();
      return;
    }

    // Rating 4 ali 5: prikaži platforme
    const ps = resolvedPlatforms();
    if (ps.length === 0) {
      // res ni ničesar konfiguriranega
      await saveOnce(state.rating, null, false);
      showThanks(t("rating_thanks_title"), t("rating_thanks_subtitle"));
      return;
    }
    if (ps.length === 1 && state.rating === 5) {
      // direkten redirect (5 zvezdic + ena platforma)
      lockButtons(true);
      await saveOnce(5, null, true);
      window.location.href = ps[0].url;
      return;
    }
    // 4 zvezde ali več platform – prikaži izbiro
    buildPlatformButtons(ps);
    showStep("step-platform");
  });

  btnSkipPlatform.addEventListener("click", async () => {
    lockButtons(true);
    await saveOnce(state.rating, null, false);
    showThanks(t("rating_thanks_title"), t("rating_thanks_subtitle"));
  });

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
    if (urlLang) setLang(urlLang);

    const urlTheme = (params.get("theme") || "").trim().toLowerCase();
    if (urlTheme) setTheme(urlTheme);

    state.urlPlatform = (params.get("platform") || "").trim().toLowerCase() || null;

    const loc = (params.get("loc") || "").trim();
    if (!loc) {
      errorText.textContent = t("error_missing");
      showStep("step-error");
      return;
    }
    state.locationId = loc;

    const [location, platforms] = await Promise.all([
      getLocation(loc),
      getLocationPlatforms(loc),
    ]);

    if (!location) {
      errorText.textContent = t("error_notfound");
      showStep("step-error");
      return;
    }
    state.location = location;
    state.platforms = platforms;

    if (!urlLang) setLang(location.lang || "sl");
    if (!urlTheme) setTheme(location.theme || "classic");
  }

  init();
})();
