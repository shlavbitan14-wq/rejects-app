/* =====================================================================
 * auth.js — שער כניסה: התחברות / הרשמה / הקמת חברה, וניהול session.
 * נטען אחרי cloud.js, לפני app.js. חושף window.AUTH.
 * זרימה:  אין session → מסך התחברות.
 *         יש session ללא חברה → מסך "הקמת חברה".
 *         יש session + חברה → CLOUD.setSession + window.init() (טעינת האפליקציה).
 * רץ רק בדפדפן (web). באלקטרון (IS_EL) האפליקציה רצה מקומית ללא שער.
 * ===================================================================== */
(function () {
  'use strict';
  const AUTH = {};
  let gateEl = null, mode = 'login', busy = false;

  // ---------- UI ----------
  function ensureGate() {
    if (gateEl) return gateEl;
    gateEl = document.createElement('div');
    gateEl.id = 'authGate';
    document.body.appendChild(gateEl);
    return gateEl;
  }
  function show(html) { ensureGate().innerHTML = `<div class="auth-card">${html}</div>`; ensureGate().classList.add('on'); }
  function hide() { if (gateEl) gateEl.classList.remove('on'); }
  function err(msg) { const e = document.getElementById('auth-err'); if (e) { e.textContent = msg; e.style.display = msg ? 'block' : 'none'; } }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setBusy(b, label) {
    busy = b; const btn = document.getElementById('auth-go');
    if (btn) { btn.disabled = b; btn.textContent = b ? 'רגע…' : label; }
  }

  function loginView() {
    mode = 'login';
    show(`
      <div class="auth-brand">דוחות <em>מקצועיים</em></div>
      <div class="auth-sub">התחברות למערכת</div>
      <div class="auth-err" id="auth-err"></div>
      <label class="auth-fld"><span>אימייל</span><input id="au-email" type="email" autocomplete="email" placeholder="name@company.com"></label>
      <label class="auth-fld"><span>סיסמה</span><input id="au-pass" type="password" autocomplete="current-password" placeholder="••••••••"></label>
      <button class="auth-btn" id="auth-go" onclick="AUTH.doLogin()">התחבר</button>
      <div class="auth-swap">אין לך חשבון? <a onclick="AUTH.signupView()">הרשמה</a></div>`);
    bindEnter('AUTH.doLogin');
  }
  function signupView() {
    mode = 'signup';
    show(`
      <div class="auth-brand">דוחות <em>מקצועיים</em></div>
      <div class="auth-sub">פתיחת חשבון חדש</div>
      <div class="auth-err" id="auth-err"></div>
      <label class="auth-fld"><span>שם מלא</span><input id="au-name" type="text" autocomplete="name" placeholder="ישראל ישראלי"></label>
      <label class="auth-fld"><span>אימייל</span><input id="au-email" type="email" autocomplete="email" placeholder="name@company.com"></label>
      <label class="auth-fld"><span>סיסמה</span><input id="au-pass" type="password" autocomplete="new-password" placeholder="לפחות 6 תווים"></label>
      <button class="auth-btn" id="auth-go" onclick="AUTH.doSignup()">הרשמה</button>
      <div class="auth-swap">כבר רשום? <a onclick="AUTH.loginView()">התחברות</a></div>`);
    bindEnter('AUTH.doSignup');
  }
  function companyView() {
    mode = 'company';
    show(`
      <div class="auth-brand">דוחות <em>מקצועיים</em></div>
      <div class="auth-sub">הקמת החברה שלך</div>
      <p class="auth-note">זהו הצעד האחרון. תהפוך למנהל החברה ותוכל בעתיד לצרף מהנדסים.</p>
      <div class="auth-err" id="auth-err"></div>
      <label class="auth-fld"><span>שם החברה</span><input id="au-co" type="text" placeholder="שם החברה / העסק"></label>
      <button class="auth-btn" id="auth-go" onclick="AUTH.doCompany()">צור חברה והמשך</button>
      <div class="auth-swap"><a onclick="AUTH.signOut()">התנתק</a></div>`);
    bindEnter('AUTH.doCompany');
  }
  function bindEnter(fn) {
    ensureGate().querySelectorAll('input').forEach(i =>
      i.addEventListener('keydown', e => { if (e.key === 'Enter' && !busy) eval(fn + '()'); }));
    const first = ensureGate().querySelector('input'); if (first) setTimeout(() => first.focus(), 60);
  }

  // ---------- פעולות ----------
  AUTH.loginView = loginView;
  AUTH.signupView = signupView;

  AUTH.doLogin = async function () {
    if (busy) return; err('');
    const email = val('au-email'), pass = val('au-pass');
    if (!email || !pass) { err('יש למלא אימייל וסיסמה'); return; }
    setBusy(true, 'התחבר');
    const { error } = await window.sb.auth.signInWithPassword({ email, password: pass });
    if (error) { setBusy(false, 'התחבר'); err(translate(error.message)); return; }
    resolveProfile();
  };

  AUTH.doSignup = async function () {
    if (busy) return; err('');
    const name = val('au-name'), email = val('au-email'), pass = val('au-pass');
    if (!name || !email || !pass) { err('יש למלא את כל השדות'); return; }
    if (pass.length < 6) { err('הסיסמה חייבת להיות לפחות 6 תווים'); return; }
    setBusy(true, 'הרשמה');
    const { data, error } = await window.sb.auth.signUp({
      email, password: pass, options: { data: { full_name: name } }
    });
    if (error) { setBusy(false, 'הרשמה'); err(translate(error.message)); return; }
    // אם אישור אימייל כבוי — יש session מיד; אחרת צריך לאשר מייל.
    if (!data.session) { show(confirmHtml(email)); return; }
    companyView();
  };

  AUTH.doCompany = async function () {
    if (busy) return; err('');
    const co = val('au-co');
    if (!co) { err('יש להזין שם חברה'); return; }
    setBusy(true, 'צור חברה והמשך');
    const { data: { user } } = await window.sb.auth.getUser();
    const name = (user && user.user_metadata && user.user_metadata.full_name) || '';
    const { error } = await window.sb.rpc('bootstrap_company', { company_name: co, manager_name: name });
    if (error) { setBusy(false, 'צור חברה והמשך'); err(error.message); return; }
    resolveProfile();
  };

  AUTH.signOut = async function () {
    try { await window.sb.auth.signOut(); } catch (e) {}
    location.reload();
  };

  // ---------- זיהוי פרופיל ----------
  async function resolveProfile() {
    const { data: { user } } = await window.sb.auth.getUser();
    if (!user) { loginView(); return; }

    // בדיקת קישור הזמנה בכתובת ה-URL
    const inviteToken = new URLSearchParams(window.location.search).get('invite');
    if (inviteToken) {
      const { error: invErr } = await window.sb.rpc('accept_invitation', { p_token: inviteToken });
      if (!invErr) {
        // נקה את הפרמטר מהכתובת
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', url.toString());
      }
    }

    const { data: prof } = await window.sb
      .from('profiles').select('id, company_id, role, full_name, email').eq('id', user.id).maybeSingle();

    // super_admin לא חייב להיות קשור לחברה
    if (!prof) { companyView(); return; }
    if (prof.role !== 'super_admin' && !prof.company_id) { companyView(); return; }

    // ---- אכיפת רישיון (לא רלוונטי ל-super_admin) ----
    if (prof.role !== 'super_admin' && prof.company_id) {
      const { data: lic } = await window.sb
        .from('licenses').select('status, plan, expires_at').eq('company_id', prof.company_id).maybeSingle();
      if (lic) {
        const expired = lic.expires_at && new Date(lic.expires_at) < new Date();
        if (lic.status === 'suspended') { show(licBlockedHtml('suspended')); return; }
        if (expired || lic.status === 'expired') { show(licBlockedHtml('expired')); return; }
      }
    }

    const profile = {
      id: user.id, company_id: prof.company_id, role: prof.role,
      full_name: prof.full_name || (user.user_metadata && user.user_metadata.full_name) || '',
      email: prof.email || user.email
    };
    window.CLOUD.setSession(profile);
    hide();

    if (profile.role === 'super_admin') {
      if (typeof window.initAdmin === 'function') window.initAdmin(profile);
      else if (typeof window.init === 'function') window.init();
    } else {
      if (typeof window.init === 'function') window.init();
    }
    if (typeof window.renderUserChip === 'function') window.renderUserChip(profile);
  }

  // ---------- כניסה ----------
  AUTH.start = async function () {
    if (!window.sb) { show('<div class="auth-sub">שגיאת חיבור ל-Supabase</div>'); return; }
    const { data: { session } } = await window.sb.auth.getSession();
    // אם יש קישור הזמנה אבל אין session — הצג הרשמה
    const inviteToken = new URLSearchParams(window.location.search).get('invite');
    if (!session && inviteToken) { signupView(); return; }
    if (session) resolveProfile(); else loginView();
  };

  function confirmHtml(email) {
    return `<div class="auth-brand">דוחות <em>מקצועיים</em></div>
      <div class="auth-sub">אשר את כתובת המייל</div>
      <p class="auth-note">שלחנו קישור אישור אל <b>${email}</b>. אשר אותו וחזור להתחבר.</p>
      <button class="auth-btn" onclick="AUTH.loginView()">חזרה להתחברות</button>`;
  }
  function licBlockedHtml(reason) {
    const isExp = reason === 'expired';
    return `
      <div class="auth-brand">דוחות <em>מקצועיים</em></div>
      <div class="auth-sub" style="color:var(--err)">${isExp ? '⏰ הרישיון פג תוקף' : '🔒 החשבון מושעה'}</div>
      <p class="auth-note" style="margin-top:10px">
        ${isExp
          ? 'תוקף הרישיון של החברה שלך פג. <br>אנא צור קשר עם מנהל המערכת לחידוש.'
          : 'גישת החברה שלך הושעתה. <br>אנא צור קשר עם מנהל המערכת.'}
      </p>
      <button class="auth-btn" style="background:#6e6e73;margin-top:4px" onclick="AUTH.signOut()">התנתק</button>`;
  }

  function translate(m) {
    if (/Invalid login/i.test(m)) return 'אימייל או סיסמה שגויים';
    if (/already registered/i.test(m)) return 'האימייל כבר רשום — נסה להתחבר';
    if (/Email not confirmed/i.test(m)) return 'יש לאשר את המייל לפני התחברות';
    if (/rate limit/i.test(m)) return 'יותר מדי ניסיונות — נסה שוב עוד כמה דקות';
    return m;
  }

  window.AUTH = AUTH;
})();
