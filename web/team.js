/* =====================================================================
 * team.js — פאנל ניהול צוות למנהל חברה (role==='manager').
 * נטען אחרי admin.js. חושף window.TEAM.
 * ===================================================================== */
(function () {
  'use strict';

  let _profile = null;

  window.TEAM = {};

  window.TEAM.open = async function () {
    _profile = window.CLOUD && window.CLOUD.profile;
    if (!_profile) return;
    const v = document.getElementById('vTeam');
    if (!v) return;
    document.querySelectorAll('.view').forEach(el => el.classList.remove('on'));
    v.classList.add('on');
    renderTeamShell();
    loadTeamMembers();
  };

  function renderTeamShell() {
    const v = document.getElementById('vTeam');
    v.innerHTML = `
      <div class="topbar no-print">
        <button class="btn btn-g btn-sm mobile-only nav-back" onclick="goHome()" aria-label="חזרה">חזרה</button>
        <div class="tb-title">👥 ניהול צוות</div>
      </div>
      <div class="team-body">

        <div class="team-section">
          <div class="admin-sec-head">
            <span>הזמנת חבר צוות</span>
          </div>
          <div style="padding:16px 18px">
            <div class="inv-form">
              <input type="email" id="team-inv-email" placeholder="אימייל לשלוח הזמנה">
              <select id="team-inv-role">
                <option value="engineer">מהנדס</option>
                <option value="manager">מנהל</option>
              </select>
              <button class="btn btn-p btn-sm" onclick="TEAM.sendInvite()">הזמן</button>
            </div>
            <div id="team-inv-list" class="inv-list" style="margin-top:8px"></div>
          </div>
        </div>

        <div class="team-section">
          <div class="admin-sec-head">
            <span>חברי הצוות</span>
            <button class="btn btn-o btn-sm" onclick="TEAM.loadMembers()">🔄 רענן</button>
          </div>
          <div id="team-members-list" class="members-list" style="padding:12px 18px">
            <div class="admin-loading">טוען…</div>
          </div>
        </div>

      </div>`;
    loadTeamInvitations();
  }

  async function loadTeamMembers() {
    const el = document.getElementById('team-members-list');
    if (!el || !_profile) return;
    const { data, error } = await window.sb.rpc('list_company_members', { p_company_id: _profile.company_id });
    if (error || !data || !data.length) { el.innerHTML = '<div class="admin-loading">אין חברי צוות</div>'; return; }
    el.innerHTML = data.map(m => `
      <div class="member-row">
        <div class="member-av">${(m.full_name||'?').charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${esc(m.full_name)}</div>
          <div class="member-email">${esc(m.email)}</div>
        </div>
        <span class="plan-badge plan-${m.role}">${roleHe(m.role)}</span>
        ${m.id !== _profile.id ? `<button class="btn btn-o btn-sm" onclick="TEAM.removeMember('${m.id}','${esc(m.full_name)}')">הסר</button>` : '<span style="font-size:11px;color:var(--muted)">(אתה)</span>'}
      </div>`).join('');
  }

  async function loadTeamInvitations() {
    const el = document.getElementById('team-inv-list');
    if (!el || !_profile) return;
    const { data } = await window.sb.from('invitations')
      .select('id,email,role,token,expires_at')
      .eq('company_id', _profile.company_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    if (!data || !data.length) { el.innerHTML = ''; return; }
    el.innerHTML = data.map(inv => `
      <div class="inv-row">
        <span>${esc(inv.email)} <small>(${roleHe(inv.role)})</small></span>
        <button class="btn btn-o btn-sm" onclick="TEAM.copyLink('${inv.token}')">📋 העתק קישור</button>
      </div>`).join('');
  }

  window.TEAM.loadMembers = loadTeamMembers;

  window.TEAM.sendInvite = async function () {
    const email = document.getElementById('team-inv-email').value.trim();
    const role = document.getElementById('team-inv-role').value;
    if (!email) { alert('יש להזין אימייל'); return; }
    const { data: token, error } = await window.sb.rpc('create_invitation', {
      p_company_id: _profile.company_id, p_email: email, p_role: role
    });
    if (error) { alert('שגיאה: ' + error.message); return; }
    document.getElementById('team-inv-email').value = '';
    const link = location.origin + location.pathname + '?invite=' + token;
    navigator.clipboard.writeText(link).catch(() => {});
    window.toast && window.toast('הזמנה נשלחה — הקישור הועתק', 'ok');
    loadTeamInvitations();
  };

  window.TEAM.copyLink = function (token) {
    const link = location.origin + location.pathname + '?invite=' + token;
    navigator.clipboard.writeText(link).then(() => {
      window.toast && window.toast('הקישור הועתק', 'ok');
    });
  };

  window.TEAM.removeMember = async function (userId, name) {
    if (!confirm(`להסיר את ${name} מהצוות?`)) return;
    const { error } = await window.sb.rpc('remove_member', { p_user_id: userId });
    if (error) { alert('שגיאה: ' + error.message); return; }
    loadTeamMembers();
    window.toast && window.toast('המשתמש הוסר', 'ok');
  };

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function roleHe(r) { return {manager:'מנהל',engineer:'מהנדס',super_admin:'מנהל-על'}[r] || r; }
})();
