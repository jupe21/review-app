// qr.js – generiranje QR kod za lokacije (skupno za admin in dashboard)
// Uporablja qr-code-styling (naložen prek CDN), generira v brskalniku.
// Javni API: window.QR.open(locationId, locationName)

(function () {
  "use strict";

  var LOGO = "/public/n3x7_logo_black.svg";

  function reviewUrl(id) {
    return window.location.origin + "/review?loc=" + encodeURIComponent(id);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var overlay, titleEl, urlEl, qrBox;
  var qr = null;
  var current = {};

  function ensureModal() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "qr-overlay hidden";
    overlay.innerHTML =
      '<div class="qr-modal" role="dialog" aria-modal="true">' +
      '<button class="qr-close" type="button" aria-label="Zapri">&times;</button>' +
      '<h3 class="qr-title"></h3>' +
      '<div class="qr-box"></div>' +
      '<p class="qr-url"></p>' +
      '<div class="qr-actions">' +
      '<button class="qr-btn qr-btn-primary qr-dl-png" type="button">Prenesi PNG</button>' +
      '<button class="qr-btn qr-dl-svg" type="button">Prenesi SVG</button>' +
      '<button class="qr-btn qr-print" type="button">Natisni nalepko</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    titleEl = overlay.querySelector(".qr-title");
    urlEl = overlay.querySelector(".qr-url");
    qrBox = overlay.querySelector(".qr-box");

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector(".qr-close").addEventListener("click", close);
    overlay.querySelector(".qr-dl-png").addEventListener("click", function () {
      if (qr) qr.download({ name: "qr-" + current.id, extension: "png" });
    });
    overlay.querySelector(".qr-dl-svg").addEventListener("click", function () {
      if (qr) qr.download({ name: "qr-" + current.id, extension: "svg" });
    });
    overlay.querySelector(".qr-print").addEventListener("click", printCard);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  function makeQr(url) {
    return new window.QRCodeStyling({
      width: 1000,
      height: 1000,
      type: "canvas",
      data: url,
      margin: 16,
      qrOptions: { errorCorrectionLevel: "H" },
      image: LOGO,
      imageOptions: { crossOrigin: "anonymous", margin: 8, imageSize: 0.26 },
      dotsOptions: { color: "#1b2233", type: "rounded" },
      cornersSquareOptions: { color: "#5b6ef5", type: "extra-rounded" },
      cornersDotOptions: { color: "#5b6ef5" },
      backgroundOptions: { color: "#ffffff" },
    });
  }

  function open(id, name) {
    if (!window.QRCodeStyling) {
      alert("QR knjižnica se ni naložila. Osvežite stran in poskusite znova.");
      return;
    }
    ensureModal();
    current = { id: id, name: name || id, url: reviewUrl(id) };
    titleEl.textContent = current.name;
    urlEl.textContent = current.url;
    qrBox.innerHTML = "";
    qr = makeQr(current.url);
    qr.append(qrBox);
    overlay.classList.remove("hidden");
  }

  function close() {
    if (overlay) overlay.classList.add("hidden");
  }

  async function printCard() {
    if (!qr) return;
    var dataUrl;
    try {
      var blob = await qr.getRawData("png");
      dataUrl = URL.createObjectURL(blob);
    } catch (e) {
      console.error("Napaka pri pripravi QR za tisk:", e);
      return;
    }
    var w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      '<!DOCTYPE html><html lang="sl"><head><meta charset="utf-8" />' +
        "<title>QR " +
        escapeHtml(current.name) +
        "</title><style>" +
        "*{box-sizing:border-box}" +
        "body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
        "display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}" +
        ".card{width:360px;text-align:center;border:1px solid #e7eaf3;border-radius:20px;padding:32px 28px}" +
        ".card h1{font-size:1.35rem;margin:0 0 4px;color:#1b2233}" +
        ".card .sub{color:#5b6577;margin:0 0 16px;font-size:1rem}" +
        ".card img{width:280px;height:280px;display:block;margin:0 auto}" +
        ".card .cta{font-weight:700;margin-top:14px;font-size:1.05rem;color:#1b2233}" +
        "@media print{.no-print{display:none}}" +
        "</style></head><body><div class='card'>" +
        "<h1>" +
        escapeHtml(current.name) +
        "</h1>" +
        "<p class='sub'>Skenirajte in nas ocenite</p>" +
        "<img src='" +
        dataUrl +
        "' alt='QR koda' />" +
        "<div class='cta'>Hvala za vaše mnenje</div>" +
        "<button class='no-print' onclick='window.print()' " +
        "style='margin-top:18px;padding:10px 18px;border:1px solid #e7eaf3;border-radius:10px;" +
        "background:#5b6ef5;color:#fff;font-weight:600;cursor:pointer'>Natisni</button>" +
        "</div><script>window.onload=function(){setTimeout(function(){window.print()},350)}<\/script>" +
        "</body></html>"
    );
    w.document.close();
  }

  window.QR = { open: open };
})();
