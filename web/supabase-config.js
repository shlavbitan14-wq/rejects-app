/* =====================================================================
 * supabase-config.js — הגדרות חיבור ל-Supabase.
 * נטען לפני auth.js / cloud.js. חושף window.sb (לקוח Supabase).
 * המפתח הזה (publishable) מיועד לצד-לקוח — בטוח לפרסום. ההגנה היא ב-RLS.
 * ===================================================================== */
(function () {
  'use strict';
  window.SUPA = {
    url: 'https://jwhtujgfzqebfckcxdqt.supabase.co',
    key: 'sb_publishable_hUWVkILRMj9TNPaYBR9cKA_M1d06wbz'
  };
  // window.supabase מגיע מ-vendor/supabase.js (ה-UMD bundle)
  if (window.supabase && window.supabase.createClient) {
    window.sb = window.supabase.createClient(window.SUPA.url, window.SUPA.key, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  } else {
    console.error('[supabase] הספרייה לא נטענה (vendor/supabase.js)');
  }
})();
