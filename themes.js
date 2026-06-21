// themes.js – seznam tem za review stran (skupno za admin in dashboard)
// Vsaka tema ustreza html[data-theme="ID"] pravilom v style.css.

window.THEMES = [
  { id: "classic", label: "Klasična (zelena)" },
  { id: "ocean", label: "Ocean (modra)" },
  { id: "sunset", label: "Sončni zahod (oranžna)" },
  { id: "indigo", label: "Indigo (vijolična)" },
  { id: "dark", label: "Temna" },
];

window.themeLabel = function (id) {
  var t = window.THEMES.find(function (x) {
    return x.id === id;
  });
  return t ? t.label : id;
};

// Vrne HTML <option> nize; izbere "selected" (privzeto 'classic').
window.buildThemeOptions = function (selected) {
  var sel = selected || "classic";
  return window.THEMES.map(function (t) {
    return (
      '<option value="' +
      t.id +
      '"' +
      (t.id === sel ? " selected" : "") +
      ">" +
      t.label +
      "</option>"
    );
  }).join("");
};
