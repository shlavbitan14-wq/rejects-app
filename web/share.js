/* =====================================================================
 * share.js — לוגיקת דף השיתוף החיצוני.
 * טוען workspace לפי ?t=TOKEN מ-Supabase (ללא auth),
 * מרנדר את הדוח ב-read-only, ומאפשר הורדת PDF.
 * ===================================================================== */
(function () {
  'use strict';

  let _reportData = null;  // saved report JSON
  let _title = '';

  // ── Stub functions that blocks.js calls (not available in share mode) ──
  window.schedSave = function () {};
  window.pickPhoto = function () {};
  window.clearPhoto = function () {};
  window.openSig = function () {};
  window.clearSig = function () {};
  window.renderSigInDoc = function () {};
  window.getRS = function () { return {}; };
  window.addDefect = function () {};
  window.addThermo = function () {};
  window.addMeasureRow = function () {};
  window.addCheckRow = function () {};
  window.addBoqRow = function () {};
  window.addLoadRow = function () {};
  window.addGenRow = function () {};
  window.addAnnex = function () {};
  window.addBlock = function () {};
  window.moveBlock = function () {};
  window.delBlock = function () {};
  window.delDefect = function () {};
  window.addMetaRow = function () {};
  window.setSev = function () {};
  window.setStat = function () {};
  window.setThermoSev = function () {};
  window.recalcBoq = function () {};
  window.recalcBoqEl = function () {};
  window.recalcAllBoq = function () {};
  window.refreshSummary = function () {};
  window.refreshAllSummaries = function () {};
  window.loadElecTests = function () {};
  window.loadSafetyChecklist = function () {};
  window.pickRejectFile = function () {};
  window.removeRejectFile = function () {};

  // ── Main ──
  async function init() {
    const token = new URLSearchParams(window.location.search).get('t');
    if (!token) { showError(); return; }

    try {
      const { data, error } = await window.sb.rpc('get_workspace_by_token', { p_token: token });
      if (error || !data || !data.length) { showError(); return; }

      const row = data[0];
      _title = row.title || 'דוח';
      const raw = row.data;
      _reportData = typeof raw === 'string' ? JSON.parse(raw) : raw;

      document.getElementById('sh-title').textContent = _title;
      document.title = _title + ' — RejectsApp';

      renderReport(_reportData);
    } catch (e) {
      console.error('share init error', e);
      showError();
    }
  }

  function showError() {
    document.getElementById('share-loading').style.display = 'none';
    document.getElementById('share-error').style.display = 'flex';
  }

  function renderReport(data) {
    document.getElementById('share-loading').style.display = 'none';

    // Find the report within the projects
    let report = null;
    const params = new URLSearchParams(window.location.search);
    const projId = params.get('p');
    const rptId  = params.get('r');

    if (projId && rptId && data.projects) {
      const proj = (data.projects || []).find(p => p.id === projId);
      if (proj) report = (proj.reports || []).find(r => r.id === rptId);
    }
    // fallback: first report found
    if (!report && data.projects) {
      for (const p of (data.projects || [])) {
        if (p.reports && p.reports.length) { report = p.reports[0]; break; }
      }
    }

    if (!report) { showError(); return; }

    const sheet = document.getElementById('sheet');
    if (!sheet) return;

    // Apply branding
    const brand = data.branding || {};
    applyBranding(sheet, brand, report);

    // Render blocks
    const blocksEl = document.createElement('div');
    blocksEl.id = 'blocks';
    sheet.querySelector('#blocks') && sheet.querySelector('#blocks').remove();

    if (typeof window.renderBlock === 'function' && report.blocks) {
      report.blocks.forEach(b => {
        blocksEl.insertAdjacentHTML('beforeend', window.renderBlock(b));
      });
    }
    sheet.appendChild(blocksEl);

    // Re-render signatures from saved data
    if (typeof window.renderSigInDoc === 'function') {
      // noop in share mode
    }

    document.getElementById('share-doc').style.display = '';
    document.getElementById('btn-pdf').style.display = '';
  }

  function applyBranding(sheet, brand, report) {
    // Header
    let headMeta = sheet.querySelector('#headMeta');
    if (!headMeta) {
      headMeta = document.createElement('div');
      headMeta.id = 'headMeta';
      headMeta.className = 'meta-grid';
    }
    const meta = report.meta || {};
    headMeta.innerHTML = Object.entries(meta).map(([k, v]) =>
      `<b>${esc(k)}</b><span class="mval">${esc(v)}</span>`
    ).join('');
    if (!sheet.querySelector('#headMeta')) sheet.querySelector('.doc-head').appendChild(headMeta);

    // Logo
    let logoBlock = sheet.querySelector('#logoBlock');
    if (!logoBlock) { logoBlock = document.createElement('div'); logoBlock.id = 'logoBlock'; logoBlock.className = 'logo-block'; }
    if (brand.logo) {
      logoBlock.innerHTML = `<img src="${esc(brand.logo)}" alt="לוגו">`;
    } else if (brand.text) {
      logoBlock.innerHTML = `<div class="logo-txt">${esc(brand.text)}</div>${brand.sub ? `<span class="logo-sub">${esc(brand.sub)}</span>` : ''}`;
    }

    // Accent color
    if (brand.accent) {
      sheet.style.setProperty('--accent', brand.accent);
    }

    // Footer
    const foot = sheet.querySelector('.doc-foot');
    if (foot && brand.firm) {
      const firm = foot.querySelector('#foot-firm');
      if (firm) firm.textContent = brand.firm;
    }
  }

  // ── PDF Download ──
  window.shareDownloadPDF = async function () {
    const btn = document.getElementById('btn-pdf');
    if (btn) { btn.disabled = true; btn.textContent = 'מכין…'; }
    try {
      const sheet = document.getElementById('sheet');
      if (!sheet || !window.html2canvas || !window.jspdf) throw new Error('Missing libraries');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
      const A4W = 210, A4H = 297;
      const mX = 10, mY = 12, cW = A4W - mX * 2;

      const A4_PX = 1240;
      const prevStyle = sheet.style.cssText;
      sheet.style.cssText += `;width:${A4_PX}px!important;max-width:${A4_PX}px!important;`;
      document.body.classList.add('pdf-exporting');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const SCALE = 2;
      const canvas = await window.html2canvas(sheet, {
        scale: SCALE, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
        logging: false, imageTimeout: 20000,
        width: A4_PX, height: sheet.scrollHeight, windowWidth: A4_PX
      });

      document.body.classList.remove('pdf-exporting');
      sheet.style.cssText = prevStyle;

      const mmPerPx = A4W / (A4_PX * SCALE);
      const totalH = canvas.height * mmPerPx;
      const pageH  = A4H - mY * 2;
      let page = 0;

      while (page * pageH < totalH) {
        if (page > 0) pdf.addPage();
        const srcY = page * pageH / mmPerPx;
        const srcH = Math.min(pageH / mmPerPx, canvas.height - srcY);
        if (srcH <= 0) break;
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = srcH;
        slice.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        const sliceMm = srcH * mmPerPx;
        pdf.addImage(slice.toDataURL('image/jpeg', 0.97), 'JPEG', mX, mY, cW, sliceMm, '', 'FAST');
        page++;
      }

      const fileName = (_title || 'דוח').replace(/[^֐-׿\w\s-]/g, '') + '.pdf';
      pdf.save(fileName);
    } catch (e) {
      alert('שגיאה בהפקת PDF: ' + e.message);
      console.error(e);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📄 הורד PDF'; }
      document.body.classList.remove('pdf-exporting');
    }
  };

  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // wait for Supabase
  if (window.sb) { init(); }
  else { document.addEventListener('DOMContentLoaded', init); }
})();
