// config.example.js
// -----------------------------------------------------------------------------
// Primer konfiguracije. Na Vercelu se config.js GENERIRA samodejno iz
// environment variabel med build procesom (glej generate-config.js + vercel.json).
//
// Za LOKALNI razvoj: kopiraj to datoteko v config.js in vpiši svoje vrednosti,
// ALI pusti USE_MOCK = true za testiranje brez Supabase (mock-data.js).
// -----------------------------------------------------------------------------

window.APP_CONFIG = {
  // Supabase – ANON / publishable ključ je javen in varen za frontend (RLS).
  // (sb_publishable_... ali stari eyJ... anon ključ – oba delujeta.)
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_...",

  // Dashboard se prijavi prek Supabase Auth (e-pošta + geslo) – skrivni
  // ključ NI več v brskalniku. DASHBOARD_PASSWORD se uporablja LE v mock
  // načinu za lokalni razvoj.
  DASHBOARD_PASSWORD: "geslo123",

  // true = uporabi mock-data.js namesto Supabase (lokalno testiranje).
  USE_MOCK: false,
};
