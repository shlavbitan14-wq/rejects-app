/* =====================================================================
 * admin.js — פאנל Super Admin: ניהול טננטים, רישיון, לידים, חברים.
 * נטען אחרי auth.js. נקרא כאשר role==='super_admin'.
 * חושף window.initAdmin(profile) + window.ADMIN.
 * ===================================================================== */
(function () {
  'use strict';

  const ADMIN = {};
  let _profile = null;
  let _companies = [];
  let _selectedCompany = null;
  let _leads = [];
  let _selectedLead = null;

  // ===== כניסה ראשית =====
  window.initAdmin = function (profile) {
    _profile = profile;
    document.getElementById('vAdmin').classList.add('on');
    document.querySelectorAll('.view').forEach(v => { if (v.id !== 'vAdmin') v.classList.remove('on'); });
    if (typeof window.renderUserChip === 'function') window.renderUserChip(profile);
    renderAdminShell();
    loadStats();
    loadCompanies();
    loadLeadsCount(); // badge
  };

  // ===== Shell =====
  function renderAdminShell() {
    const v = document.getElementById('vAdmin');
    v.innerHTML = `
      <div class="topbar no-print">
        <div class="tb-title" style="font-size:16px">🛡️ Super Admin</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-o btn-sm" id="leads-nav-btn" onclick="ADMIN.switchSection('leads')">
            📥 לידים <span class="leads-badge" id="leads-badge" style="display:none">0</span>
          </button>
          <button class="btn btn-o btn-sm" id="companies-nav-btn" onclick="ADMIN.switchSection('companies')">🏢 חברות</button>
          <button class="btn btn-p btn-sm" onclick="ADMIN.openCreateCompany()">＋ חברה חדשה</button>
        </div>
      </div>
      <div class="admin-body">

        <!-- Stats -->
        <div class="admin-stats" id="admin-stats">
          <div class="stat-card"><div class="stat-n" id="st-companies">—</div><div class="stat-l">חברות</div></div>
          <div class="stat-card"><div class="stat-n" id="st-users">—</div><div class="stat-l">משתמשים</div></div>
          <div class="stat-card ok"><div class="stat-n" id="st-active">—</div><div class="stat-l">רישיונות פעילים</div></div>
          <div class="stat-card warn"><div class="stat-n" id="st-trial">—</div><div class="stat-l">Trial</div></div>
          <div class="stat-card err"><div class="stat-n" id="st-expiring">—</div><div class="stat-l">פג תוקף בחודש</div></div>
          <div class="stat-card" id="stat-leads-card" onclick="ADMIN.switchSection('leads')" style="cursor:pointer">
            <div class="stat-n" id="st-new-leads">—</div><div class="stat-l">לידים חדשים</div>
          </div>
        </div>

        <!-- Section: Companies -->
        <div id="admin-section-companies" class="admin-section-wrap">
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

        <!-- Section: Leads -->
        <div id="admin-section-leads" class="admin-section-wrap" style="display:none">
          <div class="admin-section">
            <div class="admin-sec-head">
              <span>בקשות גישה (לידים)</span>
              <div style="display:flex;gap:8px;align-items:center">
                <select id="lead-filter" onchange="ADMIN.filterLeads()" style="font-family:inherit;font-size:12px;padding:5px 9px;border:1px solid var(--hair);border-radius:8px;background:var(--card)">
                  <option value="all">הכל</option>
                  <option value="new">חדשים</option>
                  <option value="contacted">נוצר קשר</option>
                  <option value="converted">הומרו</option>
                  <option value="rejected">נדחו</option>
                </select>
                <button class="btn btn-o btn-sm" onclick="ADMIN.loadLeads()">🔄 רענן</button>
              </div>
            </div>
            <div id="admin-leads-wrap">
              <div class="admin-loading">טוען…</div>
            </div>
          </div>
        </div>

      </div><!-- /admin-body -->

      <!-- פאנל ימין — חברה -->
      <div class="admin-side-panel" id="admin-co-panel" style="display:none">
        <button class="admin-panel-close" onclick="ADMIN.closeCoPanel()">✕</button>
        <div id="admin-co-detail"></div>
      </div>

      <!-- פאנל ימין — ליד -->
      <div class="admin-side-panel" id="admin-lead-panel" style="display:none">
        <button class="admin-panel-close" onclick="ADMIN.closeLeadPanel()">✕</button>
        <div id="admin-lead-detail"></div>
      </div>`;

    ADMIN.switchSection('companies'); // ברירת מחדל
  }

  // ── Navigation between sections ──
  ADMIN.switchSection = function(sec) {
    document.getElementById('admin-section-companies').style.display = sec === 'companies' ? '' : 'none';
    document.getElementById('admin-section-leads').style.display = sec === 'leads' ? '' : 'none';
    if (sec === 'leads') { loadLeads(); }
  };

  // ===== Stats =====
  async function loadStats() {
    const { data, error } = await window.sb.rpc('admin_get_stats');
    if (error || !data) return;
    document.getElementById('st-companies').textContent = data.total_companies ?? '—';
    document.getElementById('st-users').textContent = data.total_users ?? '—';
    document.getElementById('st-active').textContent = data.active_licenses ?? '—';
    document.getElementById('st-trial').textContent = data.trial_licenses ?? '—';
    document.getElementById('st-expiring').textContent = data.expiring_soon ?? '—';
  }

  async function loadLeadsCount() {
    try {
      const { data } = await window.sb.rpc('admin_count_new_leads');
      const count = Number(data) || 0;
      const badge = document.getElementById('leads-badge');
      const stat  = document.getElementById('st-new-leads');
      const card  = document.getElementById('stat-leads-card');
      if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
      if (stat)  stat.textContent = count;
      if (card)  card.classList.toggle('err', count > 0);
      // גם בnavigation
      const navBadge = document.getElementById('admin-leads-nav-badge');
      if (navBadge) { navBadge.textContent = count; navBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    } catch (e) {}
  }

  // ===== Companies =====
  async function loadCompanies() {
    const wrap = document.getElementById('admin-companies-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="admin-loading">טוען…</div>';
    const { data, error } = await window.sb.rpc('admin_list_companies');
    if (error) { wrap.innerHTML = `<div class="admin-err">${error.message}</div>`; return; }
    _companies = data || [];
    if (!_companies.length) { wrap.innerHTML = '<div class="admin-loading">אין חברות עדיין. צור חברה ראשונה ↑</div>'; return; }
    wrap.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>שם החברה</th><th>תוכנית</th><th>סטטוס</th><th>מהנדסים</th><th>תפוגה</th><th></th>
        </tr></thead>
        <tbody>
          ${_companies.map(c => `
            <tr class="co-row" onclick="ADMIN.openCoPanel('${c.id}')">
              <td class="co-name">${esc(c.name)}</td>
              <td><span class="plan-badge plan-${c.plan}">${c.plan}</span></td>
              <td><span class="lic-badge lic-${c.lic_status}">${statusHe(c.lic_status)}</span></td>
              <td>${c.eng_count} / ${c.max_engineers}</td>
              <td>${c.expires_at ? fmtDate(c.expires_at) : '—'}</td>
              <td><button class="btn btn-o btn-sm" onclick="event.stopPropagation();ADMIN.openCoPanel('${c.id}')">פרטים</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // ===== Leads =====
  async function loadLeads() {
    const wrap = document.getElementById('admin-leads-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="admin-loading">טוען…</div>';
    const { data, error } = await window.sb.from('leads')
      .select('*').order('created_at', { ascending: false });
    if (error) { wrap.innerHTML = `<div class="admin-err">${error.message}</div>`; return; }
    _leads = data || [];
    renderLeadsList(_leads);
  }

  function renderLeadsList(leads) {
    const wrap = document.getElementById('admin-leads-wrap');
    if (!wrap) return;
    if (!leads.length) { wrap.innerHTML = '<div class="admin-loading">אין לידים</div>'; return; }
    wrap.innerHTML = leads.map(l => `
      <div class="lead-row" onclick="ADMIN.openLeadPanel('${l.id}')">
        <div class="lead-row-left">
          <div class="lead-av">${(l.full_name||'?').charAt(0).toUpperCase()}</div>
          <div class="lead-info">
            <div class="lead-name">${esc(l.full_name)}</div>
            <div class="lead-co">${esc(l.company_name)} · ${industryHe(l.industry)} · ${teamSizeHe(l.team_size)}</div>
            <div class="lead-email">${esc(l.email)}${l.phone ? ' · ' + esc(l.phone) : ''}</div>
          </div>
        </div>
        <div class="lead-row-right">
          <span class="lead-status-badge status-${l.status}">${leadStatusHe(l.status)}</span>
          <span class="lead-date">${fmtRelDate(l.created_at)}</span>
        </div>
      </div>`).join('');
  }

  ADMIN.filterLeads = function() {
    const f = document.getElementById('lead-filter').value;
    renderLeadsList(f === 'all' ? _leads : _leads.filter(l => l.status === f));
  };

  ADMIN.loadLeads = loadLeads;

  // ===== Lead panel =====
  ADMIN.openLeadPanel = function(leadId) {
    _selectedLead = _leads.find(l => l.id === leadId);
    if (!_selectedLead) return;
    const panel = document.getElementById('admin-lead-panel');
    if (panel) panel.style.display = 'flex';
    ADMIN.closeCoPanel();
    renderLeadDetail(_selectedLead);
  };

  ADMIN.closeLeadPanel = function() {
    const p = document.getElementById('admin-lead-panel');
    if (p) p.style.display = 'none';
    _selectedLead = null;
  };

  function renderLeadDetail(l) {
    const el = document.getElementById('admin-lead-detail');
    el.innerHTML = `
      <div class="co-panel-head">
        <div class="co-panel-name">${esc(l.full_name)}</div>
        <div class="co-panel-sub">${esc(l.company_name)}</div>
        <div style="margin-top:10px">
          <span class="lead-status-badge status-${l.status}">${leadStatusHe(l.status)}</span>
        </div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">פרטי קשר</div>
        <div class="lead-detail-grid">
          <div class="lead-detail-row"><span>אימייל</span><a href="mailto:${esc(l.email)}" style="color:var(--accent-ui)">${esc(l.email)}</a></div>
          ${l.phone ? `<div class="lead-detail-row"><span>טלפון</span><a href="tel:${esc(l.phone)}">${esc(l.phone)}</a></div>` : ''}
          <div class="lead-detail-row"><span>תחום</span>${industryHe(l.industry)}</div>
          <div class="lead-detail-row"><span>גודל צוות</span>${teamSizeHe(l.team_size)}</div>
          <div class="lead-detail-row"><span>נשלח</span>${fmtDate(l.created_at)}</div>
        </div>
        ${l.message ? `<div style="margin-top:10px;font-size:12.5px;color:var(--muted);background:var(--fill2);border-radius:8px;padding:10px 12px;line-height:1.6">"${esc(l.message)}"</div>` : ''}
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">פעולות</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-p btn-sm" onclick="ADMIN.convertLeadToCompany('${l.id}')">
            🏢 צור חברה מהליד הזה
          </button>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${['new','contacted','converted','rejected'].map(s =>
              `<button class="btn btn-sm ${l.status===s?'btn-p':'btn-o'}" onclick="ADMIN.setLeadStatus('${l.id}','${s}')">${leadStatusHe(s)}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">הערות פנימיות</div>
        <textarea id="lead-notes-${l.id}" style="width:100%;min-height:80px;padding:9px 12px;border:1px solid var(--border);border-radius:9px;font-family:inherit;font-size:13px;background:var(--fill2);outline:none;resize:vertical" placeholder="הערות, תזכורות...">${esc(l.notes||'')}</textarea>
        <button class="btn btn-o btn-sm" style="margin-top:8px" onclick="ADMIN.saveLeadNotes('${l.id}')">שמור הערות</button>
      </div>`;
  }

  ADMIN.setLeadStatus = async function(leadId, status) {
    const notes = (() => { const el = document.getElementById('lead-notes-' + leadId); return el ? el.value.trim() : null; })();
    const { error } = await window.sb.rpc('admin_update_lead', { p_lead_id: leadId, p_status: status, p_notes: notes || null });
    if (error) { alert('שגיאה: ' + error.message); return; }
    const l = _leads.find(x => x.id === leadId);
    if (l) l.status = status;
    renderLeadDetail(l);
    ADMIN.filterLeads();
    loadLeadsCount();
    window.toast && window.toast('סטטוס עודכן: ' + leadStatusHe(status), 'ok');
  };

  ADMIN.saveLeadNotes = async function(leadId) {
    const notes = document.getElementById('lead-notes-' + leadId).value.trim();
    const { error } = await window.sb.rpc('admin_update_lead', { p_lead_id: leadId, p_status: _leads.find(l=>l.id===leadId)?.status || 'new', p_notes: notes });
    if (error) { alert('שגיאה: ' + error.message); return; }
    const l = _leads.find(x => x.id === leadId); if (l) l.notes = notes;
    window.toast && window.toast('הערות נשמרו', 'ok');
  };

  ADMIN.convertLeadToCompany = function(leadId) {
    const l = _leads.find(x => x.id === leadId);
    if (!l) return;
    ADMIN.closeLeadPanel();
    ADMIN.switchSection('companies');
    // פתח מודל יצירת חברה עם ערכים מהליד
    ADMIN.openCreateCompany(l);
    // סמן כנוצר קשר
    if (l.status === 'new') ADMIN.setLeadStatus(leadId, 'contacted');
  };

  // ===== Company Panel =====
  async function openCoPanel(companyId) {
    _selectedCompany = _companies.find(c => c.id === companyId) || null;
    if (!_selectedCompany) return;
    ADMIN.closeLeadPanel();
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
          <div class="fld"><label>תוכנית</label>
            <select id="lic-plan">
              ${['trial','starter','pro','enterprise'].map(p => `<option value="${p}" ${c.plan===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="fld"><label>סטטוס</label>
            <select id="lic-status">
              ${['active','suspended','expired'].map(s => `<option value="${s}" ${c.lic_status===s?'selected':''}>${statusHe(s)}</option>`).join('')}
            </select>
          </div>
          <div class="fld"><label>מקסימום מהנדסים</label>
            <input type="number" id="lic-maxeng" value="${c.max_engineers}" min="1" max="999">
          </div>
          <div class="fld"><label>תפוגה</label>
            <input type="date" id="lic-expires" value="${c.expires_at ? c.expires_at.slice(0,10) : ''}">
          </div>
          <div class="fld" style="grid-column:1/-1"><label>הערות</label>
            <input type="text" id="lic-notes" value="${esc(c.notes||'')}">
          </div>
          <button class="btn btn-p btn-sm" style="grid-column:1/-1" onclick="ADMIN.saveLicense('${c.id}')">שמור רישיון</button>
        </div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">הזמנת חבר צוות</div>
        <div class="inv-form">
          <input type="email" id="inv-email" placeholder="אימייל">
          <select id="inv-role"><option value="engineer">מהנדס</option><option value="manager">מנהל</option></select>
          <button class="btn btn-p btn-sm" onclick="ADMIN.sendInvite('${c.id}')">שלח</button>
        </div>
        <div style="margin-top:8px">
          <button class="btn btn-o btn-sm" onclick="ADMIN.copyInviteLink('_gen_','${c.id}')">📋 צור קישור הזמנה</button>
        </div>
        <div id="inv-list-${c.id}" class="inv-list" style="margin-top:10px"></div>
      </div>

      <div class="co-panel-section">
        <div class="co-panel-sec-title">חברי החברה</div>
        <div id="members-list-${c.id}" class="members-list"><div class="admin-loading">טוען…</div></div>
      </div>

      <div class="co-panel-section danger-zone">
        <div class="co-panel-sec-title">אזור סכנה</div>
        <button class="btn btn-sm" style="background:#fef2f2;color:var(--err);border:1px solid #fca5a5"
          onclick="ADMIN.deleteCompany('${c.id}','${esc(c.name)}')">🗑️ מחק חברה לצמיתות</button>
      </div>`;
  }

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
        <button class="btn btn-o btn-sm" onclick="ADMIN.viewUserWorkspace('${m.id}','${esc(m.full_name)}','${companyId}')">👁️ כנס</button>
        <button class="btn btn-o btn-sm" onclick="ADMIN.removeMember('${m.id}','${esc(m.full_name)}','${companyId}')">הסר</button>
      </div>`).join('');
  }

  async function loadInvitations(companyId) {
    const el = document.getElementById('inv-list-' + companyId);
    if (!el) return;
    const { data } = await window.sb.from('invitations')
      .select('id,email,role,token,expires_at,accepted_at')
      .eq('company_id', companyId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    if (!data || !data.length) { el.innerHTML = ''; return; }
    el.innerHTML = data.map(inv => `
      <div class="inv-row">
        <span>${esc(inv.email)} <small>(${roleHe(inv.role)})</small></span>
        <button class="btn btn-o btn-sm" onclick="ADMIN.copyInviteLink('${inv.token}')">📋 קישור</button>
      </div>`).join('');
  }

  // ===== View-As =====
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
    const modal = document.getElementById('mViewAs');
    if (modal) modal.classList.remove('on');
    const { data: ws, error } = await window.sb
      .from('workspaces').select('data').eq('user_id', userId).maybeSingle();
    if (error) { alert('שגיאה: ' + error.message); return; }

    window._adminViewAsPrev = { profile: window.CLOUD && window.CLOUD.profile };
    // show the engineer's profile + data in app
    window._viewAsReadOnly = false; // מנהל-על יכול לערוך
    if (window.CLOUD) window.CLOUD._viewAsUserId = userId;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    document.getElementById('vh').classList.add('on');
    const banner = document.getElementById('admin-view-banner');
    if (banner) { banner.style.display = 'flex'; document.getElementById('admin-view-banner-name').textContent = 'סביבת: ' + userName; }
    if (window.S && ws && ws.data) {
      try { const d = JSON.parse(ws.data); if (d.projects) window.S.projects = d.projects; } catch (e) {}
    }
    if (typeof window.renderHome === 'function') window.renderHome();
    if (typeof window.renderSB === 'function') window.renderSB();
    window.toast && window.toast('מצב צפייה: ' + userName, '');
  };

  ADMIN.exitViewAs = function () {
    const banner = document.getElementById('admin-view-banner');
    if (banner) banner.style.display = 'none';
    if (window.CLOUD) window.CLOUD._viewAsUserId = null;
    window._viewAsReadOnly = false;
    if (typeof window.initAdmin === 'function') window.initAdmin(_profile);
    window.toast && window.toast('חזרת לפאנל Super Admin', 'ok');
  };

  // ===== CRUD Actions =====
  ADMIN.loadCompanies = loadCompanies;
  ADMIN.openCoPanel = openCoPanel;

  ADMIN.closeCoPanel = function () {
    document.getElementById('admin-co-panel').style.display = 'none';
    _selectedCompany = null;
  };

  ADMIN.openCreateCompany = function (leadData) {
    const modal = document.getElementById('mCreateCompany');
    if (!modal) return;
    modal.classList.add('on');
    // אם הועבר ליד — מלא מהנתונים שלו
    document.getElementById('nc-name').value = (leadData && leadData.company_name) || '';
    document.getElementById('nc-plan').value = 'trial';
    document.getElementById('nc-maxeng').value = '5';
    document.getElementById('nc-expires').value = '';
    // שמור ליד לצורך conversion אוטומטי
    if (leadData) modal.dataset.leadId = leadData.id;
    else delete modal.dataset.leadId;
    // pre-fill invite email
    if (leadData) {
      const invEmail = document.getElementById('nc-invite-email');
      if (invEmail) invEmail.value = leadData.email || '';
    }
  };

  ADMIN.doCreateCompany = async function () {
    const name = document.getElementById('nc-name').value.trim();
    const plan = document.getElementById('nc-plan').value;
    const maxEng = parseInt(document.getElementById('nc-maxeng').value) || 5;
    const expires = document.getElementById('nc-expires').value;
    const invEmail = (document.getElementById('nc-invite-email') || {}).value || '';
    if (!name) { alert('יש להזין שם חברה'); return; }
    const btn = document.getElementById('nc-go'); btn.disabled = true; btn.textContent = 'יוצר…';
    const { error } = await window.sb.rpc('admin_create_company', {
      p_name: name, p_plan: plan, p_max_eng: maxEng, p_expires_at: expires || null
    });
    btn.disabled = false; btn.textContent = 'צור חברה';
    if (error) { alert('שגיאה: ' + error.message); return; }

    // אם יש מייל — שלח הזמנה
    if (invEmail) {
      const { data: companies } = await window.sb.rpc('admin_list_companies');
      const newCo = (companies || []).find(c => c.name === name);
      if (newCo) {
        await window.sb.rpc('create_invitation', { p_company_id: newCo.id, p_email: invEmail, p_role: 'manager' });
      }
    }

    // סמן ליד כ-converted
    const modal = document.getElementById('mCreateCompany');
    const leadId = modal && modal.dataset.leadId;
    if (leadId) {
      await window.sb.rpc('admin_update_lead', { p_lead_id: leadId, p_status: 'converted' });
      const l = _leads.find(x => x.id === leadId); if (l) l.status = 'converted';
      loadLeadsCount();
    }

    closeModal('mCreateCompany');
    loadCompanies();
    loadStats();
    window.toast && window.toast('החברה נוצרה' + (invEmail ? ' וההזמנה נשלחה' : ''), 'ok');
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
    const co = _companies.find(c => c.id === companyId);
    if (co) { co.plan = plan; co.lic_status = status; co.max_engineers = maxEng; co.expires_at = expires || null; }
    loadCompanies(); loadStats();
    window.toast && window.toast('רישיון עודכן', 'ok');
  };

  ADMIN.sendInvite = async function (companyId) {
    const email = document.getElementById('inv-email').value.trim();
    const role = document.getElementById('inv-role').value;
    if (!email) { alert('יש להזין אימייל'); return; }
    const { data: token, error } = await window.sb.rpc('create_invitation', { p_company_id: companyId, p_email: email, p_role: role });
    if (error) { alert('שגיאה: ' + error.message); return; }
    document.getElementById('inv-email').value = '';
    const link = location.origin + location.pathname.replace('index.html','') + 'index.html?invite=' + token;
    navigator.clipboard.writeText(link).catch(() => {});
    window.toast && window.toast('הזמנה נשלחה — קישור הועתק ללוח', 'ok');
    loadInvitations(companyId);
  };

  ADMIN.copyInviteLink = async function (token, companyId) {
    if (token === '_gen_' && companyId) {
      // צור token חדש
      const role = document.getElementById('inv-role') ? document.getElementById('inv-role').value : 'engineer';
      const email = document.getElementById('inv-email') ? document.getElementById('inv-email').value.trim() : '';
      if (!email) { alert('הכנס אימייל ולחץ שלח'); return; }
      return ADMIN.sendInvite(companyId);
    }
    const link = location.origin + location.pathname.replace('index.html','') + 'index.html?invite=' + token;
    navigator.clipboard.writeText(link).then(() => { window.toast && window.toast('הקישור הועתק', 'ok'); });
  };

  ADMIN.removeMember = async function (userId, name, companyId) {
    if (!confirm(`להסיר את ${name} מהחברה?`)) return;
    const { error } = await window.sb.rpc('remove_member', { p_user_id: userId });
    if (error) { alert('שגיאה: ' + error.message); return; }
    loadMembers(companyId); loadStats();
    window.toast && window.toast('המשתמש הוסר', 'ok');
  };

  ADMIN.deleteCompany = async function (companyId, name) {
    if (!confirm(`למחוק לצמיתות את "${name}"?\nפעולה זו אינה הפיכה.`)) return;
    const { error } = await window.sb.rpc('admin_delete_company', { p_company_id: companyId });
    if (error) { alert('שגיאה: ' + error.message); return; }
    ADMIN.closeCoPanel(); loadCompanies(); loadStats();
    window.toast && window.toast('החברה נמחקה', 'ok');
  };

  window.ADMIN = ADMIN;

  // ===== עזרים =====
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
  function fmtRelDate(d) {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `לפני ${mins} ד׳`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `לפני ${hrs} ש׳`;
    const days = Math.floor(hrs / 24);
    return `לפני ${days} יום`;
  }
  function statusHe(s) { return {active:'פעיל',suspended:'מושעה',expired:'פג תוקף'}[s] || s; }
  function roleHe(r) { return {manager:'מנהל',engineer:'מהנדס',super_admin:'מנהל-על'}[r] || r; }
  function leadStatusHe(s) { return {new:'חדש',contacted:'נוצר קשר',converted:'הומר',rejected:'נדחה'}[s] || s; }
  function industryHe(i) { return {construction:'בנייה',electrical:'חשמל',inspection:'פיקוח',other:'אחר'}[i] || i || '—'; }
  function teamSizeHe(s) { return {1:'עצמאי','2-5':'2-5 מהנדסים','6-20':'6-20 מהנדסים','21+':'21+ מהנדסים'}[s] || s || '—'; }
  function closeModal(id) { const m = document.getElementById(id); if (m) m.classList.remove('on'); }
})();
