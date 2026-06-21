// landing.js – logika landing strani (kontaktni obrazec)

(function () {
  "use strict";

  // Kam naj gre oddaja obrazca.
  // Pusti prazno za mailto (odpre e-poštni odjemalec), ali vpiši URL n8n
  // webhooka oz. Formspree obrazca za pravo oddajo brez odpiranja e-pošte.
  var CONTACT_ENDPOINT = "";
  var CONTACT_EMAIL = "info@n3x7.si";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var nameEl = document.getElementById("c-name");
  var emailEl = document.getElementById("c-email");
  var messageEl = document.getElementById("c-message");
  var submitEl = document.getElementById("c-submit");
  var msg = document.getElementById("contact-msg");

  function setMsg(text, cls) {
    msg.textContent = text;
    msg.className = "lp-form-msg" + (cls ? " " + cls : "");
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var data = {
      name: nameEl.value.trim(),
      email: emailEl.value.trim(),
      message: messageEl.value.trim(),
    };
    if (!data.name || !data.email || !data.message) {
      setMsg("Prosimo, izpolnite vsa polja.", "err");
      return;
    }

    if (CONTACT_ENDPOINT) {
      submitEl.disabled = true;
      setMsg("Pošiljam...");
      try {
        var res = await fetch(CONTACT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        form.reset();
        setMsg("Hvala za sporočilo. Oglasimo se v najkrajšem možnem času.", "ok");
      } catch (err) {
        setMsg("Pošiljanje ni uspelo. Pišite nam na " + CONTACT_EMAIL + ".", "err");
      } finally {
        submitEl.disabled = false;
      }
      return;
    }

    // Brez backenda: odpremo e-poštni odjemalec z izpolnjenim sporočilom.
    var subject = encodeURIComponent("Povpraševanje n3x7 (" + data.name + ")");
    var body = encodeURIComponent(
      data.message + "\n\nIme: " + data.name + "\nE-pošta: " + data.email
    );
    window.location.href =
      "mailto:" + CONTACT_EMAIL + "?subject=" + subject + "&body=" + body;
    setMsg("Odpiramo vaš e-poštni odjemalec...", "ok");
  });
})();
