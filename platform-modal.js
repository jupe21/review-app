// platform-modal.js – upravljanje platform za zbiranje ocen
// Skupno za admin in dashboard.
// window.PlatformMgr.open({ locationId, locationName, sb, useMock })

(function () {
  "use strict";

  var overlay = null;
  var state = {};

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function platformReviewUrl(locId, platformId) {
    return window.location.origin + "/review?loc=" + encodeURIComponent(locId) + "&platform=" + encodeURIComponent(platformId);
  }

  async function fetchPlatforms() {
    if (state.useMock) return window.MockDB.getPlatforms(state.locationId);
    if (!state.sb) return [];
    var res = await state.sb
      .from("location_platforms")
      .select("*")
      .eq("location_id", state.locationId)
      .order("sort_order");
    return (res.data || []);
  }

  async function savePlatform(platformId, url) {
    var sortOrder = (state.currentPlatforms || []).length;
    if (state.useMock) {
      return window.MockDB.upsertPlatform({
        location_id: state.locationId,
        platform: platformId,
        url: url,
        sort_order: sortOrder,
      });
    }
    if (!state.sb) return;
    var res = await state.sb.from("location_platforms").upsert(
      { location_id: state.locationId, platform: platformId, url: url, sort_order: sortOrder },
      { onConflict: "location_id,platform" }
    );
    if (res.error) throw res.error;
  }

  async function removePlatform(platformId) {
    if (state.useMock) return window.MockDB.deletePlatform(state.locationId, platformId);
    if (!state.sb) return;
    var res = await state.sb
      .from("location_platforms")
      .delete()
      .eq("location_id", state.locationId)
      .eq("platform", platformId);
    if (res.error) throw res.error;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "pm-overlay hidden";
    overlay.innerHTML =
      '<div class="pm-modal" role="dialog" aria-modal="true">' +
      '<button class="pm-close" type="button" aria-label="Zapri">&times;</button>' +
      '<h3 class="pm-title"></h3>' +
      '<div class="pm-list" id="pm-list"><div class="empty">Nalaganje…</div></div>' +
      '<div class="pm-add" id="pm-add">' +
      '<div class="pm-add-row">' +
      '<select id="pm-platform-sel"></select>' +
      '<input type="url" id="pm-url-input" placeholder="https://…" />' +
      '<button type="button" id="pm-add-btn" class="qr-btn qr-btn-primary">Dodaj</button>' +
      '</div>' +
      '<p class="pm-msg" id="pm-msg"></p>' +
      '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".pm-close").addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && !overlay.classList.contains("hidden")) close();
    });
    overlay.querySelector("#pm-add-btn").addEventListener("click", handleAdd);
    overlay.querySelector("#pm-url-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
    });
  }

  async function handleAdd() {
    var sel = overlay.querySelector("#pm-platform-sel");
    var urlInput = overlay.querySelector("#pm-url-input");
    var msgEl = overlay.querySelector("#pm-msg");
    var platformId = sel.value;
    var url = urlInput.value.trim();
    if (!platformId) { msgEl.textContent = "Izberi platformo."; return; }
    if (!url) { msgEl.textContent = "Vpiši URL."; return; }
    var btn = overlay.querySelector("#pm-add-btn");
    btn.disabled = true;
    msgEl.textContent = "Shranjujem…";
    try {
      await savePlatform(platformId, url);
      urlInput.value = "";
      msgEl.textContent = "";
      await renderList();
    } catch (e) {
      msgEl.textContent = "Napaka: " + (e.message || e);
    } finally {
      btn.disabled = false;
    }
  }

  async function renderList() {
    var listEl = overlay.querySelector("#pm-list");
    listEl.innerHTML = '<div class="empty">Nalaganje…</div>';

    var platforms = await fetchPlatforms();
    state.currentPlatforms = platforms;

    // update selector – only show platforms not yet configured
    var existingIds = platforms.map(function (p) { return p.platform; });
    var available = (window.PLATFORMS || []).filter(function (p) {
      return existingIds.indexOf(p.id) === -1;
    });
    var sel = overlay.querySelector("#pm-platform-sel");
    sel.innerHTML = available
      .map(function (p) { return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.label) + "</option>"; })
      .join("");
    overlay.querySelector("#pm-add").style.display = available.length === 0 ? "none" : "";

    if (platforms.length === 0) {
      listEl.innerHTML = '<div class="empty">Ni dodanih platform. Dodaj spodaj.</div>';
      return;
    }

    listEl.innerHTML = platforms
      .map(function (p) {
        var meta = window.platformById ? window.platformById(p.platform) : { label: p.platform };
        var qrUrl = platformReviewUrl(state.locationId, p.platform);
        return (
          '<div class="pm-row" data-platform="' + escapeHtml(p.platform) + '">' +
          '<span class="pm-platform-name">' + escapeHtml(meta.label) + "</span>" +
          '<span class="pm-url" title="' + escapeHtml(p.url) + '">' + escapeHtml(p.url) + "</span>" +
          '<button type="button" class="row-btn pm-qr-btn"' +
          ' data-qr-url="' + escapeHtml(qrUrl) + '"' +
          ' data-qr-name="' + escapeHtml(state.locationName + " – " + meta.label) + '">QR</button>' +
          '<button type="button" class="row-btn danger pm-del-btn">Odstrani</button>' +
          "</div>"
        );
      })
      .join("");

    listEl.querySelectorAll(".pm-qr-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var locId = state.locationId;
        var name = btn.dataset.qrName;
        var url = btn.dataset.qrUrl;
        if (window.QR) window.QR.open(locId, name, url);
      });
    });

    listEl.querySelectorAll(".pm-del-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var row = btn.closest("[data-platform]");
        var platformId = row.dataset.platform;
        var meta = window.platformById ? window.platformById(platformId) : { label: platformId };
        if (!confirm('Odstranim platformo "' + meta.label + '"?')) return;
        btn.disabled = true;
        try {
          await removePlatform(platformId);
          await renderList();
        } catch (e) {
          alert("Napaka: " + (e.message || e));
          btn.disabled = false;
        }
      });
    });
  }

  function close() {
    if (overlay) overlay.classList.add("hidden");
  }

  function open(opts) {
    state = {
      locationId: opts.locationId,
      locationName: opts.locationName || opts.locationId,
      sb: opts.sb || null,
      useMock: !!opts.useMock,
      currentPlatforms: [],
    };
    ensureOverlay();
    overlay.querySelector(".pm-title").textContent = "Platforme – " + state.locationName;
    overlay.querySelector("#pm-msg").textContent = "";
    overlay.classList.remove("hidden");
    renderList();
  }

  window.PlatformMgr = { open: open };
})();
