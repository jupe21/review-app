// generate-config.js
// -----------------------------------------------------------------------------
// Zažene se med Vercel build procesom (buildCommand v vercel.json).
// Iz environment variabel ustvari config.js, ki ga frontend naloži v brskalniku.
//
// Lokalno lahko zaženeš:  node generate-config.js
// (npr. z .env vrednostmi izvoženimi v okolje)
// -----------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

// Opomba: SERVICE key namenoma NI vključen – dashboard uporablja Supabase Auth,
// zato v brskalniku ni nobenega skrivnega ključa.
const cfg = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD || "",
  // Če Supabase URL ni nastavljen, vklopi mock (da build ne pade na praznem okolju).
  USE_MOCK: !process.env.SUPABASE_URL,
};

const out =
  "// GENERIRANO med build procesom (generate-config.js). Ne urejaj ročno.\n" +
  "window.APP_CONFIG = " +
  JSON.stringify(cfg, null, 2) +
  ";\n";

fs.writeFileSync(path.join(__dirname, "config.js"), out, "utf8");

console.log(
  "config.js generiran. USE_MOCK=" +
    cfg.USE_MOCK +
    (cfg.SUPABASE_URL ? " (Supabase URL nastavljen)" : " (brez Supabase URL)")
);
