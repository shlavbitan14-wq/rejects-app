/* =====================================================================
 * landing.js — לוגיקת דף הנחיתה: כניסה + טופס ליד.
 * רץ ב-landing.html. תלוי ב-vendor/supabase.js + supabase-config.js.
 * ===================================================================== */
(function () {
  'use strict';

  const LAND = {};
  let busy = false;

  // ── utils ──
  function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function showErr(id, msg) {
    const e = document.getElementById(id);
    if (!e) return;
    e.textContent = msg; e.classList.toggle('on', !!msg);
  }
  function setBusy(btnId, b, label) {
    busy = b;
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = b; btn.textContent = b ? 'רגע…' : label;
  }

  // ── tab switching ──
  LAND.showTab = function (tab) {
    ['login', 'lead', 'success'].forEach(t => {
      const el = document.getElementById('tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    });
    ['login', 'lead'].forEach(t => {
      const btn = document.getElementById('tab-btn-' + t);
      if (btn) btn.classList.toggle('on', t === tab);
    });
    showErr('login-err', ''); showErr('lead-err', '');
  };

  // ── LOGIN ──
  LAND.doLogin = async function () {
    if (busy) return;
    showErr('login-err', '');
    const email = val('l-email'), pass = val('l-pass');
    if (!email || !pass) { showErr('login-err', 'יש למלא אימייל וסיסמה'); return; }
    setBusy('login-btn', true, 'התחבר');
    const { error } = await window.sb.auth.signInWithPassword({ email, password: pass });
    if (error) { setBusy('login-btn', false, 'התחבר'); showErr('login-err', translate(error.message)); return; }
    // הצלחה — עבור לאפליקציה
    window.location.href = 'index.html';
  };

  // ── LEAD FORM ──
  LAND.submitLead = async function () {
    if (busy) return;
    showErr('lead-err', '');
    const name = val('ld-name'), email = val('ld-email'), company = val('ld-company');
    if (!name || !email || !company) { showErr('lead-err', 'יש למלא שם, אימייל ושם חברה'); return; }
    if (!/.+@.+\..+/.test(email)) { showErr('lead-err', 'כתובת אימייל לא תקינה'); return; }

    setBusy('lead-btn', true, 'שלח בקשה');
    const payload = {
      full_name: name,
      email: email,
      company_name: company,
      phone: val('ld-phone') || null,
      industry: val('ld-industry') || 'construction',
      team_size: val('ld-size') || '1',
      message: val('ld-msg') || null
    };
    const { error } = await window.sb.from('leads').insert([payload]);
    setBusy('lead-btn', false, 'שלח בקשה');
    if (error) {
      // אם הטבלה לא קיימת עדיין — הצג success בכל זאת (graceful degradation)
      console.warn('leads insert error:', error.message);
    }
    LAND.showTab('success');
    // הסתר את הtabs
    const tabs = document.querySelector('.land-tabs');
    if (tabs) tabs.style.display = 'none';
  };

  // ── translate Supabase errors ──
  function translate(m) {
    if (/Invalid login/i.test(m)) return 'אימייל או סיסמה שגויים';
    if (/already registered/i.test(m)) return 'האימייל כבר רשום — נסה להתחבר';
    if (/Email not confirmed/i.test(m)) return 'יש לאשר את המייל לפני התחברות';
    if (/rate limit/i.test(m)) return 'יותר מדי ניסיונות — נסה שוב עוד כמה דקות';
    return m;
  }

  // ── Enter key support ──
  function bindEnterOnForm(formId, fn) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll('input').forEach(inp =>
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !busy) fn(); })
    );
  }

  // ── init: check if already logged in ──
  async function init() {
    if (!window.sb) return; // Supabase not ready
    try {
      const { data: { session } } = await window.sb.auth.getSession();
      if (session) {
        // כבר מחובר — עבור לאפליקציה
        window.location.href = 'index.html';
        return;
      }
    } catch (e) { /* ignore */ }

    // bind Enter on login form
    bindEnterOnForm('tab-login', LAND.doLogin);

    // focus on first input
    const first = document.getElementById('l-email');
    if (first) setTimeout(() => first.focus(), 100);
  }

  window.LAND = LAND;
  // init after DOM + scripts
  document.addEventListener('DOMContentLoaded', init);
  // fallback if DOMContentLoaded already fired
  if (document.readyState !== 'loading') init();
})();
