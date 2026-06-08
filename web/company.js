/* =====================================================================
 * company.js — ממשק "פרויקטי החברה" למנהל.
 * מנהל רואה את כל הפרויקטים/דוחות של הצוות שלו,
 * יכול להיכנס לכל דוח לצורך עריכה מלאה.
 * חושף window.CO (Company view manager).
 * ===================================================================== */
(function () {
  'use strict';

  const CO = {};
  let _allWorkspaces = [];   // [{workspace_id, owner_id, owner_name, project_id, report_id, title, updated_at}]
  let _engineers = [];       // רשימת מהנדסים ייחודיים
  let _filterEngineer = '';  // '' = כולם
  let _filterSearch = '';

  // ===== פתיחת ה-view =====
  CO.open = function () {
    const vCo = document.getElementById('vCompany');
    if (!vCo) return;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    vCo.classList.add('on');
    document.querySelectorAll('.nav-i').forEach(n => n.classList.remove('on'));
    const navCo = document.getElementById('nav-company');
    if (navCo) navCo.classList.add('on');
    renderShell();
    loadWorkspaces();
  };

  function renderShell() {
    const vCo = document.getElementById('vCompany');
    vCo.innerHTML = `
      <div class="topbar no-print">
        <button class="btn btn-g btn-sm mobile-only nav-back" onclick="goHome()" aria-label="חזרה">חזרה</button>
        <div class="tb-title">פרויקטי החברה</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="search" id="co-search" placeholder="חיפוש פרויקט…"
            style="padding:7px 12px;border:1px solid var(--border);border-radius:20px;font-family:inherit;font-size:12.5px;outline:none;background:var(--fill2);color:var(--text);width:200px"
            oninput="CO.onSearch(this.value)">
          <select id="co-eng-filter" onchange="CO.filterByEngineer(this.value)"
            style="font-family:inherit;font-size:12.5px;padding:7px 10px;border:1px solid var(--border);border-radius:20px;background:var(--fill2);color:var(--text);outline:none">
            <option value="">כל המהנדסים</option>
          </select>
          <button class="btn btn-o btn-sm" onclick="CO.reload()">🔄</button>
        </div>
      </div>
      <div class="content" id="co-content">
        <div class="co-loading">טוען פרויקטים…</div>
      </div>`;
  }

  // ===== Load all workspaces =====
  async function loadWorkspaces() {
    const content = document.getElementById('co-content');
    if (!content) return;
    content.innerHTML = '<div class="co-loading">טוען פרויקטים…</div>';

    const { data, error } = await window.sb.rpc('get_company_workspaces');
    if (error) {
      content.innerHTML = `<div class="co-err">שגיאה: ${esc(error.message)}</div>`;
      return;
    }

    _allWorkspaces = data || [];

    // חלץ מהנדסים ייחודיים
    const engMap = {};
    _allWorkspaces.forEach(w => { if (!engMap[w.owner_id]) engMap[w.owner_id] = w.owner_name || '—'; });
    _engineers = Object.entries(engMap).map(([id, name]) => ({ id, name }));
    updateEngFilter();
    renderContent();
  }

  CO.reload = loadWorkspaces;

  function updateEngFilter() {
    const sel = document.getElementById('co-eng-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="">כל המהנדסים</option>' +
      _engineers.map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
    if (_filterEngineer) sel.value = _filterEngineer;
  }

  // ===== Filter + Render =====
  CO.filterByEngineer = function(eid) {
    _filterEngineer = eid;
    renderContent();
  };

  CO.onSearch = function(q) {
    _filterSearch = q.trim().toLowerCase();
    renderContent();
  };

  function getFiltered() {
    return _allWorkspaces.filter(w => {
      if (_filterEngineer && w.owner_id !== _filterEngineer) return false;
      if (_filterSearch) {
        const hay = (w.title + ' ' + w.owner_name + ' ' + w.project_id).toLowerCase();
        if (!hay.includes(_filterSearch)) return false;
      }
      return true;
    });
  }

  function renderContent() {
    const content = document.getElementById('co-content');
    if (!content) return;
    const filtered = getFiltered();
    if (!filtered.length) {
      content.innerHTML = `<div class="empty"><div class="ei">🔍</div><h3>אין תוצאות</h3><p>נסה חיפוש אחר</p></div>`;
      return;
    }

    // Group by engineer
    const byEng = {};
    filtered.forEach(w => {
      if (!byEng[w.owner_id]) byEng[w.owner_id] = { name: w.owner_name, email: w.owner_email, items: [] };
      byEng[w.owner_id].items.push(w);
    });

    let html = '';
    for (const [engId, eng] of Object.entries(byEng)) {
      // Group engineer's workspaces by project
      const byProj = {};
      eng.items.forEach(w => {
        if (!byProj[w.project_id]) byProj[w.project_id] = [];
        byProj[w.project_id].push(w);
      });

      html += `
        <div class="co-eng-section">
          <div class="co-eng-head" onclick="CO.toggleEngineer('eng-${esc(engId)}')">
            <div class="co-eng-av">${(eng.name||'?').charAt(0).toUpperCase()}</div>
            <div class="co-eng-info">
              <div class="co-eng-name">${esc(eng.name)}</div>
              <div class="co-eng-sub">${esc(eng.email)} · ${eng.items.length} דוחות</div>
            </div>
            <span class="co-eng-chevron">›</span>
          </div>
          <div class="co-eng-projects" id="eng-${esc(engId)}">
            ${Object.entries(byProj).map(([projId, ws]) => `
              <div class="co-proj-group">
                <div class="co-proj-name">📁 ${esc(projId || 'ללא פרויקט')}</div>
                <div class="co-reports-grid">
                  ${ws.map(w => `
                    <div class="co-report-card" onclick="CO.openReport('${esc(w.workspace_id)}','${esc(engId)}','${esc(eng.name)}')">
                      <div class="co-report-title">${esc(w.title)}</div>
                      <div class="co-report-date">${fmtRelDate(w.updated_at)}</div>
                      <div class="co-report-actions no-print">
                        <button class="btn btn-o btn-sm" onclick="event.stopPropagation();CO.openReport('${esc(w.workspace_id)}','${esc(engId)}','${esc(eng.name)}')">✏️ פתח</button>
                        <button class="btn btn-o btn-sm" onclick="event.stopPropagation();CO.shareReport('${esc(w.workspace_id)}')">🔗 שתף</button>
                      </div>
                    </div>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }
    content.innerHTML = html;
  }

  CO.toggleEngineer = function(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const isOpen = el.classList.toggle('open');
    // rotate chevron
    const sec = el.previousElementSibling;
    const chev = sec ? sec.querySelector('.co-eng-chevron') : null;
    if (chev) chev.style.transform = isOpen ? 'rotate(90deg)' : '';
  };

  // ===== פתיחת דוח ב-view-as mode (מנהל = גישה מלאה) =====
  CO.openReport = async function (workspaceId, ownerId, ownerName) {
    // טען workspace ספציפי
    const { data: ws, error } = await window.sb
      .from('workspaces')
      .select('data, project_id, report_id')
      .eq('id', workspaceId)
      .single();

    if (error || !ws) { alert('שגיאה בטעינת הדוח'); return; }

    // set view-as context (מנהל לא read-only)
    window._viewAsWorkspaceId = workspaceId;
    window._viewAsUserId = ownerId;
    window._viewAsOwnerName = ownerName;
    window._viewAsReadOnly = false;

    // banner
    const banner = document.getElementById('manager-view-banner');
    if (banner) {
      banner.style.display = 'flex';
      const label = document.getElementById('manager-view-banner-name');
      if (label) label.textContent = 'עורך: דוח של ' + ownerName;
    }

    // load into app
    if (window.S && ws.data) {
      try {
        const d = typeof ws.data === 'string' ? JSON.parse(ws.data) : ws.data;
        // find the specific report
        const proj = (d.projects || []).find(p => p.id === ws.project_id);
        if (proj) {
          // Navigate directly to report
          if (typeof window.openReport === 'function') {
            window.S.projects = d.projects || [];
            window.openReport(ws.project_id, ws.report_id);
            return;
          }
        }
        window.S.projects = d.projects || [];
      } catch (e) { console.error(e); }
    }
    if (typeof window.renderHome === 'function') window.renderHome();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
    document.getElementById('vh').classList.add('on');
  };

  // ===== שיתוף דוח =====
  CO.shareReport = async function (workspaceId) {
    if (typeof window.SHARE === 'function' || window.SHARE) {
      window.SHARE.openModal(workspaceId);
    } else {
      // Fallback: copy external link
      try {
        const { data: token } = await window.sb.rpc('create_external_share', { p_workspace_id: workspaceId, p_days: 30 });
        if (token) {
          const url = location.origin + location.pathname.replace('index.html','') + 'share.html?t=' + token;
          navigator.clipboard.writeText(url);
          window.toast && window.toast('לינק שיתוף הועתק ללוח (תוקף 30 יום)', 'ok');
        }
      } catch (e) { alert('שגיאה: ' + e.message); }
    }
  };

  CO.exitViewAs = function () {
    const banner = document.getElementById('manager-view-banner');
    if (banner) banner.style.display = 'none';
    window._viewAsWorkspaceId = null;
    window._viewAsUserId = null;
    window._viewAsReadOnly = false;
    CO.open();
  };

  window.CO = CO;

  // ===== Utils =====
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtRelDate(d) {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} ד׳`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `לפני ${hrs} ש׳`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `לפני ${days} ימים`;
    return new Date(d).toLocaleDateString('he-IL');
  }
})();
