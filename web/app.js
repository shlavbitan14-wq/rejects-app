/* =====================================================================
 * app.js — לוגיקת המערכת: state, views, פרויקטים, גלריית טמפלייטים,
 *          רינדור/איסוף מסמך-בלוקים, חתימות, autosave, PDF, בניית טמפלייטים.
 * נטען אחרון. תלוי ב: domain.js, blocks.js, reportTypes.js, templates.js.
 * ===================================================================== */
'use strict';
const D = window.DOMAIN;
const IS_EL = typeof window.qcAPI !== 'undefined';

// ===== STATE =====
let S = { projects: [], curProjId: null, curRptId: null };
let RS = { sigs: {}, sigNames: {} };           // חתימות לפי role key
let CUR = null;                                  // מסמך נוכחי
let userTemplates = [];                          // טמפלייטים מותאמים
let autoSaveTimer = null, activePhotoBox = null, curSigTarget = null, sigDrawing = false;
let projEditId = null;
let gal = { cat: 'build', typeId: null };        // מצב גלריה

window.getRS = () => RS;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sb-foot').textContent = 'v3.0 · ' + (IS_EL ? 'Desktop' : 'Web');
  init();
});

// ===== DB (פרויקטים) =====
async function dbLoad() {
  let raw = IS_EL ? await window.qcAPI.dbRead() : localStorage.getItem('qc_db');
  if (raw) { try { const d = JSON.parse(raw); if (d.projects) S.projects = d.projects; } catch (e) {} }
}
async function dbSave() {
  const json = JSON.stringify({ projects: S.projects });
  if (IS_EL) await window.qcAPI.dbWrite(json);
  else { try { localStorage.setItem('qc_db', json); } catch (e) { toast('שגיאת שמירה: ' + e.message, 'err'); } }
}
// ===== טמפלייטים מותאמים =====
async function tplStoreLoad() {
  let raw = IS_EL ? await window.qcAPI.tplStoreRead() : localStorage.getItem('qc_user_templates');
  if (raw) { try { const d = JSON.parse(raw); if (Array.isArray(d)) userTemplates = d; } catch (e) {} }
}
async function tplStoreSave() {
  const json = JSON.stringify(userTemplates);
  if (IS_EL) await window.qcAPI.tplStoreWrite(json);
  else { try { localStorage.setItem('qc_user_templates', json); } catch (e) {} }
}

// ===== TOAST =====
function toast(msg, type) {
  const d = document.createElement('div');
  d.className = 'toast' + (type ? ' ' + type : '');
  const icons = { ok: '✅', err: '❌', '': 'ℹ️' };
  d.textContent = (icons[type || ''] || 'ℹ️') + ' ' + msg;
  document.getElementById('toasts').appendChild(d);
  setTimeout(() => d.remove(), 3400);
}

// ===== MOBILE DRAWERS =====
function syncBackdrop() {
  const open = document.getElementById('sb').classList.contains('open') || document.getElementById('rPanel').classList.contains('open');
  document.getElementById('drawer-bd').classList.toggle('on', open);
}
window.toggleSidebar = function () { document.getElementById('rPanel').classList.remove('open'); document.getElementById('sb').classList.toggle('open'); syncBackdrop(); };
window.togglePanel = function () { document.getElementById('sb').classList.remove('open'); document.getElementById('rPanel').classList.toggle('open'); syncBackdrop(); };
window.closeDrawers = function () { document.getElementById('sb').classList.remove('open'); document.getElementById('rPanel').classList.remove('open'); syncBackdrop(); };

// ===== VIEWS =====
function showView(id) { closeDrawers(); document.querySelectorAll('.view').forEach(v => v.classList.remove('on')); document.getElementById(id).classList.add('on'); }
function goHome() { S.curProjId = null; S.curRptId = null; CUR = null; document.getElementById('nav-home').classList.add('on'); showView('vh'); renderHome(); renderSB(); }
function goProj(id) { S.curProjId = id; S.curRptId = null; document.getElementById('nav-home').classList.remove('on'); showView('vp'); renderProj(id); renderSB(); }
function goCurProj() { if (S.curProjId) goProj(S.curProjId); }
window.goHome = goHome; window.goProj = goProj; window.goCurProj = goCurProj;

// ===== SIDEBAR =====
function renderSB() {
  document.getElementById('sb-projs').innerHTML = S.projects.map(p =>
    `<div class="sb-proj ${p.id === S.curProjId ? 'on' : ''}" onclick="goProj('${p.id}')">
       <span class="pn">${esc(p.name)}</span><span class="pc">${p.reports.length}</span></div>`).join('');
}

// ===== HOME =====
function renderHome() {
  const el = document.getElementById('home-c');
  if (!S.projects.length) {
    el.innerHTML = `<div class="empty"><div class="ei">🏗️</div><h3>אין פרויקטים עדיין</h3>
      <p>צור פרויקט ראשון כדי להתחיל לנהל דוחות</p>
      <button class="btn btn-p" onclick="openProjModal()">＋ פרויקט חדש</button></div>`;
    return;
  }
  el.innerHTML = `<div class="pg-head"><div><h2>פרויקטים</h2><p>סה״כ ${S.projects.length} פרויקטים</p></div></div>
    <div class="proj-grid">${S.projects.map(p => `
      <div class="proj-card" onclick="goProj('${p.id}')">
        <div class="pc-act">
          <button class="btn btn-o btn-sm btn-ic" onclick="event.stopPropagation();editProjById('${p.id}')">✏️</button>
          <button class="btn btn-o btn-sm btn-ic" style="color:var(--err)" onclick="event.stopPropagation();delProjById('${p.id}')">🗑️</button>
        </div>
        <div class="pc-ico">🏗️</div><h3>${esc(p.name)}</h3>
        <div class="addr">${esc(p.address || 'אין כתובת')}${p.client ? ' · ' + esc(p.client) : ''}</div>
        <div class="pc-meta"><span>📄 ${p.reports.length} דוחות</span><span>📅 ${p.created}</span></div>
      </div>`).join('')}</div>`;
}

// ===== PROJECT =====
function getProj(id) { return S.projects.find(p => p.id === id); }
function openProjModal(editId) {
  projEditId = editId || null;
  const p = editId ? getProj(editId) : null;
  document.getElementById('mProj-title').textContent = p ? 'עריכת פרויקט' : 'פרויקט חדש';
  document.getElementById('pi-name').value = p ? p.name : '';
  document.getElementById('pi-addr').value = p ? (p.address || '') : '';
  document.getElementById('pi-clt').value = p ? (p.client || '') : '';
  openM('mProj'); setTimeout(() => document.getElementById('pi-name').focus(), 80);
}
window.openProjModal = openProjModal;
window.editCurProj = () => openProjModal(S.curProjId);
window.editProjById = (id) => openProjModal(id);
function saveProj() {
  const name = document.getElementById('pi-name').value.trim();
  if (!name) { toast('חובה להזין שם', 'err'); return; }
  if (projEditId) {
    const p = getProj(projEditId);
    if (p) { p.name = name; p.address = document.getElementById('pi-addr').value.trim(); p.client = document.getElementById('pi-clt').value.trim(); }
    closeM('mProj'); dbSave();
    if (S.curProjId === projEditId) renderProj(projEditId); else renderHome();
    renderSB(); toast('הפרויקט עודכן', 'ok');
  } else {
    const p = { id: 'p' + Date.now(), name, address: document.getElementById('pi-addr').value.trim(), client: document.getElementById('pi-clt').value.trim(), created: new Date().toLocaleDateString('he-IL'), reports: [] };
    S.projects.unshift(p); dbSave(); closeM('mProj'); renderSB(); goProj(p.id); toast('הפרויקט נוצר', 'ok');
  }
}
window.saveProj = saveProj;
window.delCurProj = function () { const p = getProj(S.curProjId); if (!p) return; if (!confirm('למחוק את "' + p.name + '" וכל דוחותיו?')) return; S.projects = S.projects.filter(x => x.id !== S.curProjId); dbSave(); goHome(); toast('הפרויקט נמחק', 'ok'); };
window.delProjById = function (id) { const p = getProj(id); if (!p) return; if (!confirm('למחוק "' + p.name + '"?')) return; S.projects = S.projects.filter(x => x.id !== id); dbSave(); renderHome(); renderSB(); toast('הפרויקט נמחק', 'ok'); };

function renderProj(id) {
  const p = getProj(id); if (!p) { goHome(); return; }
  document.getElementById('vp-name').textContent = p.name;
  const el = document.getElementById('proj-c');
  if (!p.reports.length) {
    el.innerHTML = `<div class="empty"><div class="ei">📋</div><h3>אין דוחות עדיין</h3><p>צור דוח ראשון מתוך גלריית הטמפלייטים</p><button class="btn btn-p" onclick="newReport()">＋ דוח חדש</button></div>`;
    return;
  }
  const total = p.reports.reduce((s, r) => s + (r.itemCount || 0), 0);
  const open = p.reports.reduce((s, r) => s + (r.openCount || 0), 0);
  el.innerHTML = `<div class="pg-head"><div><h2>${esc(p.name)}</h2><p>${esc(p.address || '')}${p.client ? ' · ' + esc(p.client) : ''}</p></div></div>
    <div class="stats-row">
      <div class="stat-card"><div class="sv">${p.reports.length}</div><div class="sl">דוחות</div></div>
      <div class="stat-card"><div class="sv">${total}</div><div class="sl">סה״כ ליקויים</div></div>
      <div class="stat-card"><div class="sv" style="color:var(--err)">${open}</div><div class="sl">פתוחים</div></div>
    </div>
    <div class="card"><div class="card-head"><h3>דוחות הפרויקט</h3></div>
      <table class="tbl"><thead><tr><th>שם הדוח</th><th>סוג</th><th>תאריך</th><th>ליקויים</th><th>פתוחים</th><th>פעולות</th></tr></thead><tbody>
      ${p.reports.map(r => { const t = getType(r.typeId); return `<tr>
        <td><span class="tbl-link" onclick="openRpt('${id}','${r.id}')">${esc(r.name || 'דוח')}</span></td>
        <td>${t ? esc(t.name) : '—'}</td><td>${r.date || ''}</td><td>${r.itemCount || 0}</td>
        <td><span class="chip ${(r.openCount || 0) > 0 ? 'chip-o' : 'chip-f'}">${r.openCount || 0}</span></td>
        <td><button class="btn btn-o btn-sm" onclick="openRpt('${id}','${r.id}')">פתח</button>
            <button class="btn btn-g btn-sm" style="color:var(--err)" onclick="delRpt('${id}','${r.id}')">מחק</button></td></tr>`; }).join('')}
      </tbody></table></div>`;
}
window.renderProj = renderProj;
window.delRpt = function (projId, rptId) { const p = getProj(projId); if (!p) return; if (!confirm('למחוק דוח זה?')) return; p.reports = p.reports.filter(r => r.id !== rptId); dbSave(); renderProj(projId); toast('הדוח נמחק', 'ok'); };

// ===== TEMPLATE GALLERY =====
function newReport() { if (!getProj(S.curProjId)) return; gal = { cat: 'build', typeId: null }; renderGallery(); openM('mGallery'); }
window.newReport = newReport;
window.galCat = function (c) { gal.cat = c; gal.typeId = null; renderGallery(); };
window.galType = function (id) { gal.typeId = id; renderGallery(); };

function templatesForType(typeId) {
  return (window.builtinTemplatesForType(typeId) || []).concat(userTemplates.filter(t => t.typeId === typeId));
}
function renderGallery() {
  document.querySelectorAll('.gal-cat').forEach(c => c.classList.toggle('on', c.dataset.cat === gal.cat));
  const types = (window.REPORT_TYPES || []).filter(t => t.category === gal.cat);
  document.getElementById('gal-types').innerHTML = types.map(t =>
    `<div class="gal-type ${t.id === gal.typeId ? 'on' : ''}" onclick="galType('${t.id}')">
      <div class="gt-ico">${t.icon || '📄'}</div><h4>${esc(t.name)}</h4><p>${esc(t.desc || '')}</p></div>`).join('');
  const wrap = document.getElementById('gal-tpls-wrap');
  if (!gal.typeId) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const tpls = templatesForType(gal.typeId);
  const blank = `<div class="tpl-card" onclick="pickTemplate('${gal.typeId}','')">
      <div class="tc-bar" style="background:#cbd5e1"></div><h4>מסמך ריק</h4><p>מבנה בסיסי של סוג הדוח, ללא תוכן מוכן</p><div class="tc-tag">ברירת מחדל</div></div>`;
  document.getElementById('gal-tpls').innerHTML = blank + tpls.map(t => {
    const pal = D.PALETTES[t.palette] || D.PALETTES.slateRed;
    const del = t.builtin ? '' : `<button class="tc-del" onclick="event.stopPropagation();delUserTpl('${t.id}')">מחק</button>`;
    return `<div class="tpl-card" onclick="pickTemplate('${t.typeId}','${t.id}')">${del}
      <div class="tc-bar" style="background:${pal.accent}"></div>
      <h4>${esc(t.name)}</h4><p>${esc(t.description || '')}</p>
      <div class="tc-tag">${t.builtin ? 'מובנה' : 'מותאם'}</div></div>`;
  }).join('');
}
window.pickTemplate = function (typeId, tplId) { closeM('mGallery'); createReport(typeId, tplId || null); };
window.startBlank = function () { closeM('mGallery'); createReport('custom', null); };
window.renameReport = function () {
  const p = getProj(S.curProjId), r = p && p.reports.find(x => x.id === S.curRptId); if (!r) return;
  const name = prompt('שם הדוח:', r.name); if (name == null) return;
  r.name = name.trim() || r.name; document.getElementById('vr-rpt').textContent = r.name; dbSave(); renderSB();
};
window.delUserTpl = async function (id) { if (!confirm('למחוק טמפלייט מותאם זה?')) return; userTemplates = userTemplates.filter(t => t.id !== id); await tplStoreSave(); renderGallery(); toast('הטמפלייט נמחק', 'ok'); };

function findTemplate(id) { return window.getBuiltinTemplate(id) || userTemplates.find(t => t.id === id); }

// ===== CREATE / OPEN REPORT =====
function createReport(typeId, tplId) {
  const type = getType(typeId); if (!type) return;
  const tpl = tplId ? findTemplate(tplId) : null;
  const doc = {
    typeId, templateId: tplId || null,
    palette: tpl ? tpl.palette : type.palette,
    branding: tpl && tpl.branding ? Object.assign({}, tpl.branding) : defaultBranding(),
    blocks: deepClone(tpl ? tpl.blocks : type.blocks()),
    sigs: {}, sigNames: {}, docNum: '001', docRev: '1.0',
    date: new Date().toLocaleDateString('he-IL')
  };
  reassignIds(doc.blocks);
  const p = getProj(S.curProjId);
  const r = { id: 'r' + Date.now(), name: type.name + ' · ' + doc.date, date: doc.date, typeId, templateId: tplId || null, itemCount: 0, openCount: 0, data: doc };
  p.reports.unshift(r); dbSave();
  openRpt(S.curProjId, r.id);
}
function defaultBranding() { return { logoText: 'שם החברה', logoSub: '', coName: '', coPhone: '', coInsp: '', coLicense: '', logoUrl: null }; }
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
function reassignIds(blocks) { blocks.forEach(b => { b.id = uid('blk'); }); }

function openRpt(projId, rptId) {
  const p = getProj(projId); if (!p) return;
  const r = p.reports.find(x => x.id === rptId); if (!r) return;
  S.curProjId = projId; S.curRptId = rptId;
  let data = r.data;
  if (data && data.items && !data.blocks) data = migrateLegacy(data);   // תאימות אחורה
  if (!data || !data.blocks) data = buildDefaultDoc(r.typeId || 'rej-flow');
  CUR = data; r.typeId = CUR.typeId; r.data = CUR;
  RS = { sigs: Object.assign({}, CUR.sigs || {}), sigNames: Object.assign({}, CUR.sigNames || {}) };

  const t = getType(CUR.typeId);
  document.getElementById('vr-proj').textContent = p.name;
  document.getElementById('vr-rpt').textContent = r.name;
  document.getElementById('vr-type').textContent = t ? t.name : '';

  applyPalette(CUR.palette);
  populatePanel();
  renderLetterhead();
  renderBlocksArea();
  document.getElementById('doc-num').textContent = CUR.docNum || '001';
  document.getElementById('doc-rev').textContent = CUR.docRev || '1.0';
  showView('vr'); renderSB();
}
window.openRpt = openRpt;

function buildDefaultDoc(typeId) {
  const type = getType(typeId) || getType('rej-flow');
  const doc = { typeId: type.id, templateId: null, palette: type.palette, branding: defaultBranding(), blocks: type.blocks(), sigs: {}, sigNames: {}, docNum: '001', docRev: '1.0', date: new Date().toLocaleDateString('he-IL') };
  reassignIds(doc.blocks); return doc;
}
function migrateLegacy(d) {
  const tpl = d.tpl || {};
  const blocks = [
    mkBlock('meta', { rows: [
      { label: 'פרויקט / קומה', value: d.sbP || '' }, { label: 'דירה / יחידה', value: d.sbU || '' },
      { label: 'סטטוס', value: d.sbS || '' }, { label: 'נושא', value: d.subject || 'דוח רג׳קטים' }
    ] }),
    mkBlock('defects', { items: (d.items || []).map(it => ({ loc: it.loc, dom: it.dom, desc: it.desc, status: it.status || 'open', severity: 'med', photo: it.photo || null })) }),
    mkBlock('summary'),
    mkBlock('signatures', { roles: [{ key: 'insp', label: 'חתימת הבודק' }, { key: 'clt', label: 'חתימת הלקוח' }] })
  ];
  return {
    typeId: 'rej-flow', templateId: null, palette: 'slateRed',
    branding: { logoText: tpl.logoText || 'שם החברה', logoSub: tpl.logoSub || '', coName: tpl.coName || '', coPhone: tpl.coPhone || '', coInsp: tpl.coInsp || '', coLicense: '', logoUrl: tpl.logoUrl || null },
    blocks, sigs: d.sigs || {}, sigNames: d.sigNames || {}, docNum: d.docNum || '001', docRev: '1.0', date: new Date().toLocaleDateString('he-IL')
  };
}

// ===== PALETTE =====
function applyPalette(palId) {
  const p = D.PALETTES[palId] || D.PALETTES.slateRed;
  CUR && (CUR.palette = p.id);
  const sh = document.getElementById('sheet'); if (!sh) return;
  const set = (k, v) => sh.style.setProperty(k, v);
  set('--accent', p.accent); set('--accent2', p.accent2);
  set('--ink', p.ink); set('--paper', p.paper);
  set('--g1', p.g1); set('--g2', p.g2); set('--g3', p.g3);
  set('--d-ok', p.ok); set('--d-warn', p.warn); set('--d-err', p.err);
  document.querySelectorAll('#pal-row .pal-sw').forEach(s => s.classList.toggle('on', s.dataset.pal === p.id));
}
window.pickPalette = function (palId) { applyPalette(palId); schedSave(); };

// ===== PANEL (branding) =====
function populatePanel() {
  const b = CUR.branding || {};
  ['logoText', 'logoSub', 'coName', 'coPhone', 'coInsp', 'coLicense'].forEach(id => { const el = document.getElementById(id); if (el) el.value = b[id] || ''; });
  // palette swatches
  const row = document.getElementById('pal-row');
  row.innerHTML = Object.values(D.PALETTES).map(p =>
    `<div class="pal-sw" data-pal="${p.id}" title="${esc(p.name)}" style="background:${p.accent}" onclick="pickPalette('${p.id}')"></div>`).join('');
  applyPalette(CUR.palette);
  // logo preview
  const prev = document.getElementById('logoPrev');
  if (b.logoUrl) { prev.innerHTML = ''; const im = document.createElement('img'); im.src = b.logoUrl; prev.appendChild(im); }
  else prev.innerHTML = '<span class="ph">אין לוגו</span>';
}
function readPanel() {
  if (!CUR.branding) CUR.branding = defaultBranding();
  ['logoText', 'logoSub', 'coName', 'coPhone', 'coInsp', 'coLicense'].forEach(id => { const el = document.getElementById(id); if (el) CUR.branding[id] = el.value; });
}
window.applyBranding = function () { readPanel(); renderLetterhead(); schedSave(); };

function renderLetterhead() {
  const b = CUR.branding || {};
  const logo = document.getElementById('logoBlock');
  if (b.logoUrl) { logo.innerHTML = ''; const im = document.createElement('img'); im.src = b.logoUrl; logo.appendChild(im); }
  else logo.innerHTML = `<div class="logo-txt">${esc(b.logoText || 'שם החברה')}</div>${b.logoSub ? `<small class="logo-sub">${esc(b.logoSub)}</small>` : ''}`;
  const t = getType(CUR.typeId);
  const rows = [];
  if (b.coName) rows.push(['חברה', b.coName]);
  if (b.coPhone) rows.push(['טלפון', b.coPhone]);
  if (b.coInsp) rows.push(['עורך הדוח', b.coInsp]);
  if (b.coLicense) rows.push(['רישיון', b.coLicense]);
  rows.push(['נושא', t ? t.name : '']);
  rows.push(['תאריך', CUR.date || new Date().toLocaleDateString('he-IL')]);
  document.getElementById('headMeta').innerHTML = rows.map(([k, v]) => `<b>${esc(k)}:</b><div class="mval">${esc(v)}</div>`).join('');
  document.getElementById('foot-firm').textContent = b.coName || b.logoText || 'שם החברה';
}

// logo upload
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoInput').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ev => { if (!CUR.branding) CUR.branding = defaultBranding(); CUR.branding.logoUrl = ev.target.result; populatePanel(); renderLetterhead(); schedSave(); };
    rd.readAsDataURL(f);
  });
  document.getElementById('photoInput').addEventListener('change', onPhotoPicked);
});

// ===== BLOCKS AREA =====
function renderBlocksArea() {
  document.getElementById('blocks').innerHTML = (CUR.blocks || []).map(renderBlock).join('');
  // post-render hooks
  document.querySelectorAll('.block[data-type="defects"] .item, .block[data-type="thermo"] .item').forEach(it => {
    const fs = it.querySelector('.f-sev'); if (fs) setSev(fs);
    const ts = it.querySelector('.t-sev'); if (ts) setThermoSev(ts);
  });
  recalcAllBoq(); refreshAllSummaries();
  Object.keys(RS.sigs).forEach(k => renderSigInDoc(k));
  document.querySelectorAll('.sig-block').forEach(s => renderSigInDoc(s.dataset.key));
}
window.addBlock = function (type) {
  const b = mkBlock(type);
  document.getElementById('blocks').insertAdjacentHTML('beforeend', renderBlock(b));
  if (type === 'signatures') renderSigInDoc((b.roles[0] || {}).key);
  schedSave();
};

// ===== COLLECT =====
function collectDoc() {
  if (!CUR) return;
  readPanel();
  CUR.blocks = [...document.querySelectorAll('#blocks > .block')].map(collectBlock).filter(Boolean);
  CUR.sigs = RS.sigs; CUR.sigNames = RS.sigNames;
  CUR.docNum = (document.getElementById('doc-num') || {}).textContent || '001';
  CUR.docRev = (document.getElementById('doc-rev') || {}).textContent || '1.0';
}

// ===== AUTO-SAVE =====
function schedSave() { clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(autoSave, 1200); }
window.schedSave = schedSave;
function autoSave() {
  const p = getProj(S.curProjId); if (!p || !S.curRptId) return;
  const r = p.reports.find(x => x.id === S.curRptId); if (!r) return;
  collectDoc();
  const defs = []; document.querySelectorAll('.block[data-type="defects"] .item').forEach(it => defs.push({ status: (it.querySelector('.f-status') || {}).value }));
  r.data = CUR; r.typeId = CUR.typeId;
  r.itemCount = defs.length;
  r.openCount = defs.filter(d => (D.OPEN_STATUSES || []).indexOf(d.status) >= 0).length;
  r.date = new Date().toLocaleDateString('he-IL');
  dbSave();
}
setInterval(() => { if (S.curRptId) autoSave(); }, 30000);

// ===== PHOTOS =====
function pickPhoto(box) { activePhotoBox = box; const i = document.getElementById('photoInput'); i.value = ''; i.click(); }
window.pickPhoto = pickPhoto;
function clearPhoto(btn) { const box = btn.closest('.pwrap').querySelector('.pbox'); box.innerHTML = '<div class="ph">📷<br>לחץ להעלאת תמונה</div>'; schedSave(); }
window.clearPhoto = clearPhoto;
function onPhotoPicked(e) {
  const f = e.target.files[0]; if (!f || !activePhotoBox) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const tmp = new Image();
    tmp.onload = () => {
      const max = 800, sc = Math.min(1, max / Math.max(tmp.width, tmp.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(tmp.width * sc); cv.height = Math.round(tmp.height * sc);
      cv.getContext('2d').drawImage(tmp, 0, 0, cv.width, cv.height);
      const img = document.createElement('img'); img.src = cv.toDataURL('image/jpeg', 0.82);
      activePhotoBox.innerHTML = ''; activePhotoBox.appendChild(img); schedSave();
    };
    tmp.src = ev.target.result;
  };
  rd.readAsDataURL(f);
}

// ===== SIGNATURES (generalized by role key) =====
function openSig(key) {
  curSigTarget = key;
  const blk = document.querySelector(`.sig-block[data-key="${key}"] label`);
  document.getElementById('mSig-title').textContent = blk ? blk.textContent : 'חתימה';
  document.getElementById('sigName').value = RS.sigNames[key] || '';
  openM('mSig'); initSigPad();
}
window.openSig = openSig;
function clearSig(key) { RS.sigs[key] = null; RS.sigNames[key] = ''; renderSigInDoc(key); schedSave(); }
window.clearSig = clearSig;
function renderSigInDoc(key) {
  const wrap = document.getElementById('sigw-' + key), nameEl = document.getElementById('sign-' + key);
  if (!wrap) return;
  if (RS.sigs[key]) {
    wrap.innerHTML = ''; const img = document.createElement('img'); img.src = RS.sigs[key]; wrap.appendChild(img);
    if (nameEl) nameEl.textContent = RS.sigNames[key] || '';
  } else { wrap.innerHTML = `<span class="sig-ph" id="sigph-${key}">לחץ לחתימה</span>`; if (nameEl) nameEl.textContent = ''; }
}
window.renderSigInDoc = renderSigInDoc;
function initSigPad() {
  const old = document.getElementById('sigCanvas'); const nw = old.cloneNode(true); old.parentNode.replaceChild(nw, old);
  const ctx = nw.getContext('2d'); ctx.strokeStyle = '#1a1d24'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; sigDrawing = false;
  const pos = e => { const r = nw.getBoundingClientRect(), sx = nw.width / r.width, sy = nw.height / r.height; return e.touches ? { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy } : { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }; };
  nw.addEventListener('mousedown', e => { sigDrawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  nw.addEventListener('mousemove', e => { if (!sigDrawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  nw.addEventListener('mouseup', () => sigDrawing = false); nw.addEventListener('mouseleave', () => sigDrawing = false);
  nw.addEventListener('touchstart', e => { e.preventDefault(); sigDrawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, { passive: false });
  nw.addEventListener('touchmove', e => { e.preventDefault(); if (!sigDrawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(p.x, p.y); }, { passive: false });
  nw.addEventListener('touchend', () => sigDrawing = false);
}
window.clearSigPad = function () { const cv = document.getElementById('sigCanvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); };
window.applySig = function () {
  const cv = document.getElementById('sigCanvas'), ctx = cv.getContext('2d');
  const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
  if (!Array.from(px).some((v, i) => i % 4 === 3 && v > 0)) { toast('לא נרשמה חתימה', 'err'); return; }
  RS.sigs[curSigTarget] = cv.toDataURL('image/png');
  RS.sigNames[curSigTarget] = document.getElementById('sigName').value.trim();
  renderSigInDoc(curSigTarget); closeM('mSig'); schedSave(); toast('החתימה נשמרה', 'ok');
};

// ===== PDF =====
window.doPDF = async function () {
  autoSave();
  const p = getProj(S.curProjId);
  const name = (p ? p.name + '_' : '') + (getType(CUR.typeId) || {}).name + '_' + new Date().toISOString().slice(0, 10);
  const docNum = (CUR && CUR.docNum) || '001';
  if (IS_EL) {
    const r = await window.qcAPI.exportPDF({ defaultName: name, docNum });
    if (r.ok) toast('PDF נשמר: ' + r.path, 'ok'); else if (r.error) toast('שגיאה: ' + r.error, 'err');
  } else window.print();
};

// ===== SAVE / LOAD REPORT FILES =====
window.saveRptFile = async function () {
  autoSave();
  const p = getProj(S.curProjId), r = p && p.reports.find(x => x.id === S.curRptId);
  if (!r || !r.data) { toast('אין נתונים לשמירה', 'err'); return; }
  const name = (p.name || 'report') + '_' + r.date;
  const json = JSON.stringify(r, null, 2);
  if (IS_EL) { const res = await window.qcAPI.saveReportFile({ defaultName: name, jsonString: json }); if (res.ok) toast('הדוח נשמר: ' + res.path, 'ok'); }
  else { dlFile(name + '.qcreport', json, 'application/json'); toast('הדוח הורד', 'ok'); }
};
window.importReport = async function () {
  if (IS_EL) { const res = await window.qcAPI.loadReportFile(); if (!res.ok) return; try { loadRptData(JSON.parse(res.content)); } catch (e) { toast('שגיאה בקריאת הקובץ', 'err'); } }
  else pickFile(raw => { try { loadRptData(JSON.parse(raw)); } catch (e) { toast('שגיאה', 'err'); } });
};
function loadRptData(data) {
  let p = getProj(S.curProjId) || S.projects[0];
  if (!p) { p = { id: 'p' + Date.now(), name: 'ייבוא', address: '', client: '', created: new Date().toLocaleDateString('he-IL'), reports: [] }; S.projects.unshift(p); }
  const r = Object.assign({}, data, { id: 'r' + Date.now() });
  p.reports.unshift(r); dbSave(); renderSB(); openRpt(p.id, r.id); toast('הדוח נטען', 'ok');
}

// ===== SAVE AS TEMPLATE =====
window.openSaveTpl = function () {
  if (!CUR) return;
  const t = getType(CUR.typeId);
  document.getElementById('ti-name').value = (t ? t.name : 'דוח') + ' — מותאם';
  document.getElementById('ti-desc').value = '';
  openM('mTpl');
};
window.saveTplConfirm = async function () {
  collectDoc();
  const name = document.getElementById('ti-name').value.trim() || 'טמפלייט';
  const desc = document.getElementById('ti-desc').value.trim();
  const tpl = { id: 'ut' + Date.now(), typeId: CUR.typeId, name, description: desc, palette: CUR.palette, branding: Object.assign({}, CUR.branding), blocks: deepClone(CUR.blocks), builtin: false };
  reassignIds(tpl.blocks);
  userTemplates.unshift(tpl); await tplStoreSave();
  closeM('mTpl'); toast('הטמפלייט נשמר', 'ok');
  if (document.getElementById('ti-export').checked) exportTplFile(tpl);
};
function exportTplFile(tpl) {
  const json = JSON.stringify(tpl, null, 2);
  if (IS_EL) window.qcAPI.saveTemplate(json).then(r => { if (r.ok) toast('הטמפלייט יוצא: ' + r.path, 'ok'); });
  else { dlFile((tpl.name || 'template') + '.qctpl', json, 'application/json'); toast('הטמפלייט הורד', 'ok'); }
}
window.importTplFile = async function () {
  const handle = raw => {
    try {
      const t = JSON.parse(raw);
      if (!t.typeId || !t.blocks) { toast('קובץ טמפלייט לא תקין', 'err'); return; }
      t.id = 'ut' + Date.now(); t.builtin = false;
      userTemplates.unshift(t); tplStoreSave(); toast('הטמפלייט יובא', 'ok');
      if (document.getElementById('mGallery').classList.contains('on')) renderGallery();
    } catch (e) { toast('שגיאה בקריאת הקובץ', 'err'); }
  };
  if (IS_EL) { const r = await window.qcAPI.loadTemplate(); if (r.ok) handle(r.content); }
  else pickFile(handle);
};

// ===== UTILS =====
function openM(id) { document.getElementById(id).classList.add('on'); }
function closeM(id) { document.getElementById(id).classList.remove('on'); }
window.openM = openM; window.closeM = closeM;
function dlFile(name, content, mime) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
function pickFile(cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = '.qcreport,.qctpl,.json'; i.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => cb(ev.target.result); r.readAsText(f, 'utf-8'); }; i.click(); }

// ===== INIT =====
async function init() {
  await dbLoad(); await tplStoreLoad();
  document.querySelectorAll('.overlay').forEach(el => el.addEventListener('click', e => { if (e.target === el) el.classList.remove('on'); }));
  document.getElementById('doc-num') && document.getElementById('doc-num').addEventListener('input', schedSave);
  document.getElementById('doc-rev') && document.getElementById('doc-rev').addEventListener('input', schedSave);
  renderSB(); goHome();
}
