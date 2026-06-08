/* =====================================================================
 * admin.js — פאנל Super Admin: ניהול טננטים, רישיון, חברים.
 * נטען אחרי auth.js. נקרא כאשר role==='super_admin'.
 * חושף window.initAdmin(profile).
 * ===================================================================== */
(function () {
  'use strict';

  let _profile = null;
  let _companies = [];
  let _selectedCompany = null;

  // ===== כניסה ראשית =====
  window.initAdmin = function (profile) {
    _profile = profile;
    document.getElementById('vAdmin').classList.add('on');
    document.querySelectorAll('.view').forEach(v => { if (v.id !== 'vAdmin') v.classList.remove('on'); });
    if (typeof window.renderUserChip === 'function') window.renderUserChip(profile);
    renderAdminShell();
    loadStats();
    loadCompanies();
  };

  function renderAdminShell() {
    const v = document.getElementById('vAdmin');
    v.innerHTML = `
      <div class="topbar no-print">
        <div class="tb-title" style="font-size:16px">🛡️ Super Admin</div>
        <button class="btn btn-p btn-sm" onclick="ADMIN.openCreateCompany()">＋ חברה חדשה</button>
      </div>
      <div class="admin-body">
        <div class="admin-stats" id="admin-stats">
          <div class="stat-card"><div class="stat-n" id="st-companies">—</div><div class="stat-l">חברות</div></div>
          <div class="stat-card"><div class="stat-n" id="st-users">—</div><div class="stat-l">משתמשים</div></div>
          <div class="stat-card ok"><div class="stat-n" id="st-active">—</div><div class="stat-l">רישיונות פעילים</div></div>
          <div class="stat-card warn"><div class="stat-n" id="st-trial">—</div><div class="stat-l">Trial</div></div>
          <div class="stat-card err"><div class="stat-n" id="st-expiring">—</div><div class="stat-l">פג תוקף בחודש</div></div>
        </div>
        <div class="admin-section">
          <div class="admin-sec-head">
            <span>חברות רשומות</span>
            <button class="btn btn-o btn-sm" onclick="ADMIN.loadCompanies()">🔄 רענן</button>
          </div>
          <div id="admin-companies-wrap">
            <div class="admin-loading">טוען…</div>
          </div>
        </div>
      </div>

      <!-- פאנל חברה נבחרת -->
      <div class="admin-side-panel" id="admin-co-panel" style="display:none">
        <button class="admin-panel-close" onclick="ADMIN.closeCoPanel()">✕</button>
        <div id="admin-co-detail"></div>
      </div>`;
  }

  // ===== סטטיסטיקות =====
  async function loadStats() {
    const { data, error } = await window.sb.rpc('admin_get_stats');
    if (error || !data) return;
    document.getElementById('st-companies').textContent = data.total_companies ?? '—';
    document.getElementById('st-users').textContent = data.total_users ?? '—';
    document.getElementById('st-active').textContent = data.active_licenses ?? '—';
    document.getElementById('st-trial').textContent = data.trial_licenses ?? '—';
    document.getElementById('st-expiring').textContent = data.expiring_soon ?? '—';
  }

  // ===== רשימת חברות =====
  async function loadCompanies() {
    const wrap = document.getElementById('admin-companies-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="admin-loading">טוען…</div>';
    const { data, error } = await window.sb.rpc('admin_list_companies');
    if (error) { wrap.innerHTML = `<div class="admin-err">${error.message}</div>`; return; }
    _companies = data || [];
    if (!_companies.length) { wrap.innerHTML = '<div class="admin-loading">אין חברות עדיין</div>'; return; }
    wrap.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>שם החברה</th><th>תוכנית</th><th>סטטוס</th><th>מהנדסים</th><th>מנהלים</th><th>תפוגה</th><th></th>
        </tr></thead>
        <tbody>
          ${_companies.map(c => `
            <tr class="co-row" onclick="ADMIN.openCoPanel('${c.id}')">
              <td class="co-name">${esc(c.name)}</td>
              <td><span class="plan-badge plan-${c.plan}">${c.plan}</span></td>
              <td><span class="lic-badge lic-${c.lic_status}">${statusHe(c.lic_status)}</span></td>
              <td>${c.eng_count} / ${c.max_engineers}</td>
              <td>${c.mgr_count}</td>
              <td>${c.expires_at ? fmtDate(c.expires_at) : '—'}</td>
              <td onclick="event.stopPropagation()">
                <button class="btn btn-o btn-sm" onclick="ADMIN.openCoPanel('${c.id}')">פרטים</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ===== פרטי חברה =====
  async function openCoPanel(companyId) {
    _selectedCompany = _companies.find(c => c.id === companyId) || null;
    if (!_selectedCompany) return;
    const panel = document.getElementById('admin-co-panel');
    panel.style.display = 'flex';
    renderCoDetail(_selectedCompany);
    loadMembers(companyId);
    loadInvitations(companyId);
  }

  function renderCoDetail(c) {
    const el = document.getElementById('admin-co-detail');
    el.innerHTML = `
      <div class="co-panel-head">
        <div class="co-panel-name">${esc(c.name)}</div>
        <div class="co-panel-sub">נוצר: ${fmtDate(c.created_at)}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-o btn-sm" onclick="ADMIN.browseCompanyMembers('${c.id}')">👁️ כניסה לסביבה</button>
        </div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">רישיון</div>
        <div class="lic-form">
          <div class="fld">
            <label>תוכנית</label>
            <select id="lic-plan">
              ${['trial','starter','pro','enterprise'].map(p => `<option value="${p}" ${c.plan===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="fld">
            <label>סטטוס</label>
            <select id="lic-status">
              ${['active','suspended','expired'].map(s => `<option value="${s}" ${c.lic_status===s?'selected':''}>${statusHe(s)}</option>`).join('')}
            </select>
          </div>
          <div class="fld">
            <label>מקסימום מהנדסים</label>
            <input type="number" id="lic-maxeng" value="${c.max_engineers}" min="1" max="999">
          </div>
          <div class="fld">
            <label>תפוגה</label>
            <input type="date" id="lic-expires" value="${c.expires_at ? c.expires_at.slice(0,10) : ''}">
          </div>
          <div class="fld">
            <label>הערות</label>
            <input type="text" id="lic-notes" value="${esc(c.notes||'')}">
          </div>
          <button class="btn btn-p btn-sm" style="margin-top:4px" onclick="ADMIN.saveLicense('${c.id}')">שמור רישיון</button>
        </div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">הזמנת מנהל / מהנדס</div>
        <div class="inv-form">
          <input type="email" id="inv-email" placeholder="אימייל" style="flex:1">
          <select id="inv-role"><option value="engineer">מהנדס</option><option value="manager">מנהל</option></select>
          <button class="btn btn-p btn-sm" onclick="ADMIN.sendInvite('${c.id}')">שלח</button>
        </div>
        <div id="inv-list-${c.id}" class="inv-list"></div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">חברי החברה</div>
        <div id="members-list-${c.id}" class="members-list"><div class="admin-loading">טוען…</div></div>
      </div>

      <div class="co-panel-section danger-zone">
        <div class="co-panel-sec-title">אזור סכנה</div>
        <button class="btn btn-sm" style="background:#fef2f2;color:var(--err);border:1px solid #fca5a5" onclick="ADMIN.deleteCompany('${c.id}','${esc(c.name)}')">🗑️ מחק חברה לצמיתות</button>
      </div>`;
  }

  // ===== חברים =====
  async function loadMembers(companyId) {
    const el = document.getElementById('members-list-' + companyId);
    if (!el) return;
    const { data, error } = await window.sb.rpc('list_company_members', { p_company_id: companyId });
    if (error || !data || !data.length) { el.innerHTML = '<div class="admin-loading">אין חברים</div>'; return; }
    el.innerHTML = data.map(m => `
      <div class="member-row">
        <div class="member-av">${(m.full_name||'?').charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${esc(m.full_name)}</div>
          <div class="member-email">${esc(m.email)}</div>
        </div>
        <span class="plan-badge plan-${m.role}">${roleHe(m.role)}</span>
        <button class="btn btn-o btn-sm" onclick="ADMIN.viewUserWorkspace('${m.id}','${esc(m.full_name)}','${companyId}')">👁️ צפה</button>
        <button class="btn btn-o btn-sm" onclick="ADMIN.removeMember('${m.id}','${esc(m.full_name)}','${companyId}')">הסר</button>
      </div>`).join('');
  }

  // ===== כניסה לסביבת משתמש (Super Admin view-as) =====
  ADMIN.browseCompanyMembers = async function (companyId) {
    const { data, error } = await window.sb.rpc('list_company_members', { p_company_id: companyId });
    if (error || !data || !data.length) { alert('אין חברים בחברה זו'); return; }
    const co = _companies.find(c => c.id === companyId);
    const modal = document.getElementById('mViewAs');
    if (!modal) return;
    document.getElementById('view-as-title').textContent = (co ? co.name : '') + ' — בחר משתמש';
    document.getElementById('view-as-list').innerHTML = data.map(m => `
      <div class="member-row" style="cursor:pointer;padding:10px;border-radius:10px;transition:.12s"
           onmouseover="this.style.background='rgba(0,113,227,.07)'"
           onmouseout="this.style.background=''"
           onclick="ADMIN.viewUserWorkspace('${m.id}','${esc(m.full_name)}','${companyId}')">
        <div class="member-av">${(m.full_name||'?').charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${esc(m.full_name)}</div>
          <div class="member-email">${esc(m.email)} · ${roleHe(m.role)}</div>
        </div>
        <span style="font-size:18px;color:var(--muted)">›</span>
      </div>`).join('');
    modal.classList.add('on');
  };

  ADMIN.viewUserWorkspace = async function (userId, userName, companyId) {
    // סגור modal אם פתוח
    const modal = document.getElementById('mViewAs');
    if (modal) modal.classList.remove('on');

    // טען את ה-workspace של המשתמש הזה
    const { data: ws, error } = await window.sb
      .from('workspaces').select('data').eq('user_id', userId).maybeSingle();

    if (error) { alert('שגיאה בטעינת הסביבה: ' + error.message); return; }

    // שמור snapshot של המצב הנוכחי (super admin)
    window._adminViewAsPrev = {
      profile: window.CLOUD && window.CLOUD.profile,
    };

    // הפעל את האפליקציה עם הנתונים שלו (read-only view)
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    document.getElementById('vh').classList.add('on');

    // הודעת באנר
    const banner = document.getElementById('admin-view-banner');
    if (banner) {
      banner.style.display = 'flex';
      document.getElementById('admin-view-banner-name').textContent = 'צופה בסביבת: ' + userName;
    }

    // טען נתונים לתוך האפליקציה (read-only, לא ישמור)
    if (window.S && ws && ws.data) {
      try {
        const d = JSON.parse(ws.data);
        if (d.projects) { window.S.projects = d.projects; }
      } catch (e) {}
    }
    if (typeof window.renderHome === 'function') window.renderHome();
    if (typeof window.renderSB === 'function') window.renderSB();
    window.toast && window.toast('מצב צפייה: ' + userName + ' (read-only)', '');
  };

  ADMIN.exitViewAs = function () {
    const banner = document.getElementById('admin-view-banner');
    if (banner) banner.style.display = 'none';
    // חזרה לפאנל ה-admin
    if (typeof window.initAdmin === 'function') window.initAdmin(_profile);
    window.toast && window.toast('חזרת לפאנל Super Admin', 'ok');
  };

  // ===== הזמנות =====
  async function loadInvitations(companyId) {
    const el = document.getElementById('inv-list-' + companyId);
    if (!el) return;
    const { data } = await window.sb.from('invitations')
      .select('id,email,role,token,expires_at,accepted_at')
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    if (!data || !data.length) { el.innerHTML = ''; return; }
    el.innerHTML = data.map(inv => {
      const link = location.origin + location.pathname + '?invite=' + inv.token;
      return `
        <div class="inv-row">
          <span>${esc(inv.email)} <small>(${roleHe(inv.role)})</small></span>
          <button class="btn btn-o btn-sm" onclick="ADMIN.copyInviteLink('${inv.token}')">📋 העתק קישור</button>
        </div>`;
    }).join('');
  }

  // ===== פעולות =====
  const ADMIN = {};

  ADMIN.loadCompanies = loadCompanies;
  ADMIN.openCoPanel = openCoPanel;

  ADMIN.closeCoPanel = function () {
    document.getElementById('admin-co-panel').style.display = 'none';
    _selectedCompany = null;
  };

  ADMIN.openCreateCompany = function () {
    const modal = document.getElementById('mCreateCompany');
    if (!modal) return;
    modal.classList.add('on');
    document.getElementById('nc-name').value = '';
    document.getElementById('nc-plan').value = 'trial';
    document.getElementById('nc-maxeng').value = '5';
    document.getElementById('nc-expires').value = '';
  };

  ADMIN.doCreateCompany = async function () {
    const name = document.getElementById('nc-name').value.trim();
    const plan = document.getElementById('nc-plan').value;
    const maxEng = parseInt(document.getElementById('nc-maxeng').value) || 5;
    const expires = document.getElementById('nc-expires').value;
    if (!name) { alert('יש להזין שם חברה'); return; }
    const btn = document.getElementById('nc-go'); btn.disabled = true; btn.textContent = 'יוצר…';
    const { error } = await window.sb.rpc('admin_create_company', {
      p_name: name, p_plan: plan, p_max_eng: maxEng,
      p_expires_at: expires || null
    });
    btn.disabled = false; btn.textContent = 'צור חברה';
    if (error) { alert('שגיאה: ' + error.message); return; }
    closeModal('mCreateCompany');
    loadCompanies();
    loadStats();
  };

  ADMIN.saveLicense = async function (companyId) {
    const plan = document.getElementById('lic-plan').value;
    const status = document.getElementById('lic-status').value;
    const maxEng = parseInt(document.getElementById('lic-maxeng').value) || 3;
    const expires = document.getElementById('lic-expires').value;
    const notes = document.getElementById('lic-notes').value.trim();
    const { error } = await window.sb.rpc('admin_update_license', {
      p_company_id: companyId, p_plan: plan, p_status: status,
      p_max_eng: maxEng, p_expires_at: expires || null, p_notes: notes || null
    });
    if (error) { alert('שגיאה: ' + error.message); return; }
    // עדכן מקומי
    const co = _companies.find(c => c.id === companyId);
    if (co) { co.plan = plan; co.lic_status = status; co.max_engineers = maxEng; co.expires_at = expires || null; }
    loadCompanies();
    loadStats();
    window.toast && window.toast('רישיון עודכן', 'ok');
  };

  ADMIN.sendInvite = async function (companyId) {
    const email = document.getElementById('inv-email').value.trim();
    const role = document.getElementById('inv-role').value;
    if (!email) { alert('יש להזין אימייל'); return; }
    const { data: token, error } = await window.sb.rpc('create_invitation', {
      p_company_id: companyId, p_email: email, p_role: role
    });
    if (error) { alert('שגיאה: ' + error.message); return; }
    document.getElementById('inv-email').value = '';
    const link = location.origin + location.pathname + '?invite=' + token;
    navigator.clipboard.writeText(link).catch(() => {});
    window.toast && window.toast('הזמנה נשלחה — הקישור הועתק ללוח', 'ok');
    loadInvitations(companyId);
  };

  ADMIN.copyInviteLink = function (token) {
    const link = location.origin + location.pathname + '?invite=' + token;
    navigator.clipboard.writeText(link).then(() => {
      window.toast && window.toast('הקישור הועתק', 'ok');
    });
  };

  ADMIN.removeMember = async function (userId, name, companyId) {
    if (!confirm(`להסיר את ${name} מהחברה?`)) return;
    const { error } = await window.sb.rpc('remove_member', { p_user_id: userId });
    if (error) { alert('שגיאה: ' + error.message); return; }
    loadMembers(companyId);
    loadStats();
    window.toast && window.toast('המשתמש הוסר', 'ok');
  };

  ADMIN.deleteCompany = async function (companyId, name) {
    if (!confirm(`למחוק לצמיתות את "${name}"?\nפעולה זו אינה הפיכה.`)) return;
    const { error } = await window.sb.rpc('admin_delete_company', { p_company_id: companyId });
    if (error) { alert('שגיאה: ' + error.message); return; }
    ADMIN.closeCoPanel();
    loadCompanies();
    loadStats();
    window.toast && window.toast('החברה נמחקה', 'ok');
  };

  window.ADMIN = ADMIN;

  // ===== עזרים =====
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
  function statusHe(s) { return {active:'פעיל',suspended:'מושעה',expired:'פג תוקף'}[s] || s; }
  function roleHe(r) { return {manager:'מנהל',engineer:'מהנדס',super_admin:'מנהל-על'}[r] || r; }
  function closeModal(id) {
    const m = document.getElementById(id); if (m) m.classList.remove('on');
  }
})();
