/* =====================================================================
 * blocks.js — מנוע בלוקים: render + collect לכל סוג בלוק, ובקרות עריכה.
 * נטען אחרי domain.js. חושף window.BLOCKS + פונקציות עזר גלובליות.
 * תלוי בפונקציות מ-app.js בזמן ריצה: schedSave, pickPhoto, clearPhoto,
 * openSig, clearSig, renderSigInDoc, getRS().
 * ===================================================================== */
(function () {
  'use strict';
  const D = window.DOMAIN;

  // ---------- עזרי בסיס ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function uid(p) { return (p || 'b') + Math.random().toString(36).slice(2, 9); }
  window.esc = window.esc || esc;
  window.uid = window.uid || uid;

  // contenteditable עם placeholder (CSS :empty:before משתמש ב-data-ph)
  function ce(cls, text, ph) {
    return `<div class="${cls}" contenteditable oninput="schedSave()" data-ph="${esc(ph || '')}">${esc(text)}</div>`;
  }
  function inp(cls, val, ph, type) {
    return `<input class="${cls}" type="${type || 'text'}" value="${esc(val)}" placeholder="${esc(ph || '')}" oninput="schedSave()">`;
  }
  function sel(cls, options, val, onchange) {
    const opts = options.map(o => `<option value="${esc(o.key)}"${o.key === val ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<select class="${cls}" onchange="${onchange || 'schedSave()'}">${opts}</select>`;
  }
  function txt(el, q) { const n = el.querySelector(q); return n ? (n.innerText || '').trim() : ''; }
  function ival(el, q) { const n = el.querySelector(q); return n ? n.value : ''; }
  function photoBox(src, ph) {
    return `<div class="pbox" onclick="pickPhoto(this)">${src
      ? `<img src="${esc(src)}">`
      : `<div class="ph">📷<br>${esc(ph || 'לחץ להעלאת תמונה')}</div>`}</div>`;
  }
  function photoActs() {
    return `<div class="pact no-print">
      <button class="mini" onclick="pickPhoto(this.closest('.pwrap').querySelector('.pbox'))">החלף</button>
      <button class="mini" onclick="clearPhoto(this)">מחק</button></div>`;
  }
  function imgSrc(el, q) { const im = el.querySelector(q + ' img'); return im ? im.src : null; }

  // ---------- קבצים מצורפים (שרטוטים / תוכניות) ----------
  function fileChip(f, i) {
    const isImg = /^image\//.test(f.type || '') || /\.(png|jpe?g|gif|webp)$/i.test(f.url || '');
    const thumb = isImg ? `<img src="${esc(f.url)}" alt="">` : `<span class="file-ico">📄</span>`;
    return `<span class="file-chip">
      <a href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.name)}">${thumb}<span class="file-name">${esc(f.name)}</span></a>
      <button class="file-x no-print" data-i="${i}" onclick="removeRejectFile(this)" title="הסר">✕</button></span>`;
  }
  function renderFileChips(arr) { return (arr || []).map(fileChip).join(''); }
  function filesRow(files) {
    return `<div class="files-row no-print-faint" data-files="${esc(JSON.stringify(files || []))}">
      <div class="files-label">שרטוטים / תוכניות:</div>
      <div class="files-list">${renderFileChips(files || [])}</div>
      <button class="btn-add files-add no-print" onclick="pickRejectFile(this)">＋ צרף שרטוט / תוכנית</button></div>`;
  }
  function collectFiles(it) { const r = it.querySelector('.files-row'); try { return JSON.parse(r ? r.dataset.files : '[]'); } catch (e) { return []; } }
  window.renderFileChips = renderFileChips;

  // ---------- רישום בלוקים ----------
  const BLOCKS = {};

  /* ===== meta — רשת פרטי זיהוי ===== */
  BLOCKS.meta = {
    label: 'פרטי זיהוי',
    make: (o) => ({ rows: (o && o.rows) || [{ label: 'פרויקט', value: '' }, { label: 'כתובת', value: '' }] }),
    render(b) {
      const rows = (b.rows || []).map((r, i) => `
        <div class="meta-row" data-i="${i}">
          ${ce('meta-label', r.label, 'תווית')}
          ${ce('meta-val', r.value, '—')}
          <button class="meta-x no-print" onclick="this.closest('.meta-row').remove();schedSave()" title="הסר">✕</button>
        </div>`).join('');
      return `<div class="meta-grid2">${rows}</div>
        <button class="btn-add no-print" onclick="addMetaRow(this)">＋ שורת פרט</button>`;
    },
    collect(el) {
      const rows = [];
      el.querySelectorAll('.meta-row').forEach(r => rows.push({ label: txt(r, '.meta-label'), value: txt(r, '.meta-val') }));
      return { rows };
    }
  };

  /* ===== heading — כותרת סעיף ===== */
  BLOCKS.heading = {
    label: 'כותרת סעיף',
    make: (o) => ({ text: (o && o.text) || 'כותרת' }),
    render: (b) => `<div class="sec-head">${ce('sec-head-txt', b.text, 'כותרת סעיף')}</div>`,
    collect: (el) => ({ text: txt(el, '.sec-head-txt') })
  };

  /* ===== text — פסקה חופשית ===== */
  BLOCKS.text = {
    label: 'פסקת טקסט',
    make: (o) => ({ text: (o && o.text) || '' }),
    render: (b) => ce('doc-text', b.text, 'הקלד טקסט חופשי...'),
    collect: (el) => ({ text: txt(el, '.doc-text') })
  };

  /* ===== legal — הצהרה / הסתייגות ===== */
  BLOCKS.legal = {
    label: 'הצהרה משפטית',
    make: (o) => ({ text: (o && o.text) || '' }),
    render: (b) => `<div class="doc-legal">${ce('doc-legal-txt', b.text, 'נוסח הצהרה...')}</div>`,
    collect: (el) => ({ text: txt(el, '.doc-legal-txt') })
  };

  /* ===== defects — רשימת רג'קטים / ליקויים (כרטיס פרמיום) ===== */
  function defectItem(it, n) {
    it = it || {};
    const sev = it.severity || 'med';
    const sevCls = { low: 'sev-low', med: 'sev-med', high: 'sev-high', crit: 'sev-high' }[sev] || 'sev-med';
    const statDef = (D.STATUS || []).find(s => s.key === (it.status || 'open')) || { label: 'פתוח', cls: 'badge-open' };
    const sevDef  = (D.SEVERITY || []).find(s => s.key === sev) || { label: '' };
    return `<div class="item ${sevCls}" data-id="${uid('it')}">
      <div class="item-head">
        <div class="item-num">${n}</div>
        <div class="item-locs">
          ${inp('inp f-loc item-loc', it.loc, 'מיקום — קומה / חדר / אזור')}
          <input class="inp f-dom item-dom" list="trades-dl" value="${esc(it.dom || '')}" placeholder="תחום עבודה" oninput="schedSave()">
        </div>
        <div class="item-badges">
          <span class="badge ${statDef.cls} s-badge">${esc(statDef.label)}</span>
        </div>
      </div>
      <div class="item-photos">
        <div class="photo-slot pwrap-a">
          <span class="pslot-lbl">לפני</span>
          <div class="pwrap">${photoBox(it.photo, 'תמונה לפני')}${photoActs()}</div>
        </div>
        <div class="photo-slot pwrap-b">
          <span class="pslot-lbl">אחרי (אופ׳)</span>
          <div class="pwrap">${photoBox(it.photoAfter, 'תמונה אחרי')}${photoActs()}</div>
        </div>
      </div>
      <div class="item-grid">
        <div class="item-fld">
          <span class="item-lbl">אחראי לתיקון</span>
          ${inp('inp f-resp', it.resp, 'קבלן / ספק')}
        </div>
        <div class="item-fld">
          <span class="item-lbl">יעד לתיקון</span>
          ${inp('inp f-due', it.due, 'תאריך')}
        </div>
        <div class="item-fld">
          <span class="item-lbl">תקן / סעיף</span>
          ${inp('inp f-std', it.std, 'ת"י / IS ...')}
        </div>
        <div class="item-fld">
          <span class="item-lbl">ערך נמדד</span>
          ${inp('inp f-meas', it.measured, 'מידה / ממצא')}
        </div>
      </div>
      <div class="item-desc-wrap">
        <span class="item-lbl">תיאור הליקוי</span>
        <textarea class="rbox f-desc" placeholder="תיאור מדויק — מה, איפה, מה נדרש לתיקון..." oninput="schedSave()">${esc(it.desc || '')}</textarea>
      </div>
      ${filesRow(it.files)}
      <div class="statusbar">
        <span class="sev-tag">חומרה: <b>${esc(sevDef.label)}</b></span>
        <span class="badge ${statDef.cls}">${esc(statDef.label)}</span>
      </div>
      <div class="item-foot no-print">
        <div class="item-ctrl">
          <span>חומרה:</span>${sel('f-sev', D.SEVERITY, sev, 'setSev(this);schedSave()')}
          <span>סטטוס:</span>${sel('f-status', D.STATUS, it.status || 'open', 'setStat(this);schedSave()')}
        </div>
        <button class="rdel" onclick="delDefect(this)">הסר</button>
      </div>
    </div>`;
  }
  BLOCKS.defects = {
    label: 'רשימת רג׳קטים',
    make: (o) => ({ items: (o && o.items) || [{}, {}, {}] }),
    render(b) {
      const items = (b.items || []).map((it, i) => defectItem(it, i + 1)).join('');
      return `<datalist id="trades-dl">${(D.TRADES || []).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        <div class="defects-list">${items}</div>
        <div class="add-row no-print"><button class="btn-add" onclick="addDefect(this)">＋ הוסף רג׳קט</button></div>`;
    },
    collect(el) {
      const items = [];
      el.querySelectorAll('.item:not(.thermo-item)').forEach(it => items.push({
        loc: ival(it, '.f-loc'), dom: ival(it, '.f-dom'), desc: (it.querySelector('.f-desc') || {}).value || '',
        std: ival(it, '.f-std'), tol: '', measured: ival(it, '.f-meas'),
        resp: ival(it, '.f-resp'), due: ival(it, '.f-due'),
        severity: ival(it, '.f-sev'), status: ival(it, '.f-status'),
        files: collectFiles(it),
        photo: imgSrc(it, '.pwrap-a .pbox'), photoAfter: imgSrc(it, '.pwrap-b .pbox')
      }));
      return { items };
    }
  };

  /* ===== measure — טבלת מדידות חשמל ===== */
  function measureRow(r) {
    r = r || {};
    const passSel = sel('m-pass', [{ key: '', label: '—' }, { key: 'pass', label: 'תקין' }, { key: 'fail', label: 'לא תקין' }], r.pass || '');
    return `<tr>
      <td>${inp('cell m-test', r.test, 'שם הבדיקה')}</td>
      <td class="num">${inp('cell num m-val', r.value, '')}</td>
      <td class="num">${inp('cell num m-unit', r.unit, '')}</td>
      <td>${inp('cell m-req', r.required, '')}</td>
      <td class="ctd">${passSel}</td>
      <td class="no-print"><button class="rowx" onclick="this.closest('tr').remove();schedSave()">✕</button></td></tr>`;
  }
  BLOCKS.measure = {
    label: 'טבלת מדידות',
    make: (o) => ({ caption: (o && o.caption) || 'טבלת מדידות ובדיקות', rows: (o && o.rows) || [] }),
    render(b) {
      const rows = (b.rows || []).map(measureRow).join('');
      return `<table class="mtable">
        <caption>${ce('cap', b.caption, 'כותרת טבלה')}</caption>
        <thead><tr><th>בדיקה</th><th>ערך נמדד</th><th>יחידה</th><th>ערך נדרש</th><th>תוצאה</th><th class="no-print"></th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="add-row no-print">
          <button class="btn-add" onclick="addMeasureRow(this)">＋ שורה</button>
          <button class="btn-add" onclick="loadElecTests(this)">טען בדיקות תקן</button></div>`;
    },
    collect(el) {
      const rows = [];
      el.querySelectorAll('tbody tr').forEach(tr => rows.push({
        test: ival(tr, '.m-test'), value: ival(tr, '.m-val'), unit: ival(tr, '.m-unit'),
        required: ival(tr, '.m-req'), pass: ival(tr, '.m-pass')
      }));
      return { caption: txt(el, '.cap'), rows };
    }
  };

  /* ===== checklist — סקר תקין/לא תקין ===== */
  function checkRow(r) {
    r = r || {};
    return `<tr>
      <td>${inp('cell c-item', r.item, 'פריט בדיקה')}</td>
      <td class="ctd">${sel('c-status', D.CHECK_STATUS, r.status || 'pass')}</td>
      <td>${inp('cell c-note', r.note, 'הערה')}</td>
      <td class="no-print"><button class="rowx" onclick="this.closest('tr').remove();schedSave()">✕</button></td></tr>`;
  }
  BLOCKS.checklist = {
    label: 'רשימת בדיקה',
    make: (o) => ({ caption: (o && o.caption) || 'רשימת בדיקה', rows: (o && o.rows) || [] }),
    render(b) {
      const rows = (b.rows || []).map(checkRow).join('');
      return `<table class="mtable">
        <caption>${ce('cap', b.caption, 'כותרת')}</caption>
        <thead><tr><th>פריט</th><th>תוצאה</th><th>הערה</th><th class="no-print"></th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="add-row no-print">
          <button class="btn-add" onclick="addCheckRow(this)">＋ שורה</button>
          <button class="btn-add" onclick="loadSafetyChecklist(this)">טען סקר בטיחות</button></div>`;
    },
    collect(el) {
      const rows = [];
      el.querySelectorAll('tbody tr').forEach(tr => rows.push({ item: ival(tr, '.c-item'), status: ival(tr, '.c-status'), note: ival(tr, '.c-note') }));
      return { caption: txt(el, '.cap'), rows };
    }
  };

  /* ===== boq — כתב כמויות ===== */
  function boqRow(r) {
    r = r || {};
    return `<tr>
      <td>${inp('cell b-desc', r.desc, 'תיאור סעיף')}</td>
      <td>${inp('cell sm b-unit', r.unit, 'יח׳')}</td>
      <td class="num">${inp('cell num sm b-qty', r.qty, '0', 'number')}</td>
      <td class="num">${inp('cell num sm b-price', r.price, '0', 'number')}</td>
      <td class="num b-total">—</td>
      <td class="no-print"><button class="rowx" onclick="this.closest('tr').remove();recalcBoq(this);schedSave()">✕</button></td></tr>`;
  }
  BLOCKS.boq = {
    label: 'כתב כמויות',
    make: (o) => ({ caption: (o && o.caption) || 'כתב כמויות', rows: (o && o.rows) || [] }),
    render(b) {
      const rows = (b.rows || []).map(boqRow).join('');
      return `<table class="mtable boq" oninput="recalcBoqEl(this)">
        <caption>${ce('cap', b.caption, 'כותרת')}</caption>
        <thead><tr><th>תיאור</th><th>יח׳</th><th>כמות</th><th>מחיר יח׳</th><th>סה״כ</th><th class="no-print"></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" class="boq-sumlbl">סה״כ</td><td class="num boq-sum">—</td><td class="no-print"></td></tr></tfoot>
        </table>
        <div class="add-row no-print"><button class="btn-add" onclick="addBoqRow(this)">＋ שורה</button></div>`;
    },
    collect(el) {
      const rows = [];
      el.querySelectorAll('tbody tr').forEach(tr => rows.push({
        desc: ival(tr, '.b-desc'), unit: ival(tr, '.b-unit'), qty: ival(tr, '.b-qty'), price: ival(tr, '.b-price')
      }));
      return { caption: txt(el, '.cap'), rows };
    }
  };

  /* ===== loadcalc — חישובי עומסים ===== */
  function loadRow(r) {
    r = r || {};
    return `<tr>
      <td>${inp('cell l-circ', r.circuit, 'מעגל / קו')}</td>
      <td class="num">${inp('cell num sm l-pow', r.power, '', 'number')}</td>
      <td class="num">${inp('cell num sm l-fac', r.factor, '', 'number')}</td>
      <td class="num">${inp('cell num sm l-cur', r.current, '', 'number')}</td>
      <td class="num">${inp('cell num sm l-drop', r.drop, '', 'number')}</td>
      <td class="no-print"><button class="rowx" onclick="this.closest('tr').remove();schedSave()">✕</button></td></tr>`;
  }
  BLOCKS.loadcalc = {
    label: 'חישובי עומסים',
    make: (o) => ({ caption: (o && o.caption) || 'חישובי עומסים', rows: (o && o.rows) || [] }),
    render(b) {
      const rows = (b.rows || []).map(loadRow).join('');
      return `<table class="mtable">
        <caption>${ce('cap', b.caption, 'כותרת')}</caption>
        <thead><tr><th>מעגל</th><th>עומס (kW)</th><th>מקדם בו״ז</th><th>זרם (A)</th><th>נפילת מתח (%)</th><th class="no-print"></th></tr></thead>
        <tbody>${rows}</tbody></table>
        <div class="add-row no-print"><button class="btn-add" onclick="addLoadRow(this)">＋ שורה</button></div>`;
    },
    collect(el) {
      const rows = [];
      el.querySelectorAll('tbody tr').forEach(tr => rows.push({
        circuit: ival(tr, '.l-circ'), power: ival(tr, '.l-pow'), factor: ival(tr, '.l-fac'),
        current: ival(tr, '.l-cur'), drop: ival(tr, '.l-drop')
      }));
      return { caption: txt(el, '.cap'), rows };
    }
  };

  /* ===== thermo — ממצאי תרמוגרפיה ===== */
  function thermoItem(it, n) {
    it = it || {};
    return `<div class="item thermo-item" data-id="${uid('th')}">
      <div class="num">${n}</div>
      <div class="photo-col">
        <div class="pwrap">${photoBox(it.photoThermal, 'תמונה תרמית')}${photoActs()}</div>
        <div class="pwrap" style="margin-top:6px">${photoBox(it.photoNormal, 'תמונה רגילה')}${photoActs()}</div>
      </div>
      <div class="info-col">
        <div class="frow"><label>מיקום</label>${inp('inp t-loc', it.location, 'לוח / מעגל / רכיב')}</div>
        <div class="tline">
          <span>טמפ׳ (°C)</span>${inp('inp sm t-temp', it.temp, '', 'number')}
          <span>ΔT (°C)</span>${inp('inp sm t-delta', it.delta, '', 'number')}
          <span>עומס (%)</span>${inp('inp sm t-load', it.load, '', 'number')}
        </div>
        <div class="rlabel">המלצה:</div>
        <textarea class="rbox t-rec" placeholder="המלצת טיפול..." oninput="schedSave()">${esc(it.recommendation || '')}</textarea>
        <div class="statusbar"><span class="sev-tag">חומרה: <b>${esc((D.THERMO_SEVERITY.find(s => s.key === (it.severity || 'watch')) || {}).label || '')}</b></span></div>
        <div class="srow no-print">
          <span>חומרה:</span>${sel('t-sev', D.THERMO_SEVERITY, it.severity || 'watch', 'setThermoSev(this);schedSave()')}
          <button class="rdel" onclick="delDefect(this)">הסר</button>
        </div></div></div>`;
  }
  BLOCKS.thermo = {
    label: 'תרמוגרפיה',
    make: (o) => ({ items: (o && o.items) || [{}] }),
    render(b) {
      const items = (b.items || []).map((it, i) => thermoItem(it, i + 1)).join('');
      return `<div class="defects-list">${items}</div>
        <div class="add-row no-print"><button class="btn-add" onclick="addThermo(this)">＋ ממצא</button></div>`;
    },
    collect(el) {
      const items = [];
      el.querySelectorAll('.thermo-item').forEach(it => items.push({
        location: ival(it, '.t-loc'), temp: ival(it, '.t-temp'), delta: ival(it, '.t-delta'),
        load: ival(it, '.t-load'), severity: ival(it, '.t-sev'), recommendation: (it.querySelector('.t-rec') || {}).value || '',
        photoThermal: imgSrc(it, '.pwrap:nth-child(1) .pbox'), photoNormal: imgSrc(it, '.pwrap:nth-child(2) .pbox')
      }));
      return { items };
    }
  };

  /* ===== summary — סיכום אוטומטי ===== */
  BLOCKS.summary = {
    label: 'סיכום ממצאים',
    make: () => ({}),
    render: () => `<div class="summary-box" data-summary>${summaryHTML()}</div>
      <button class="btn-add no-print" onclick="refreshSummary(this)">רענן סיכום</button>`,
    collect: () => ({})
  };

  /* ===== signatures — בלוק חתימות ===== */
  BLOCKS.signatures = {
    label: 'חתימות',
    make: (o) => ({ roles: (o && o.roles) || [{ key: 'insp', label: 'חתימת הבודק' }, { key: 'clt', label: 'חתימת הלקוח' }] }),
    render(b) {
      const roles = (b.roles || []);
      const cells = roles.map(r => `
        <div class="sig-block" data-key="${esc(r.key)}">
          <label>${esc(r.label)}</label>
          <div class="sig-line" id="sigw-${esc(r.key)}" onclick="openSig('${esc(r.key)}')">
            <span class="sig-ph" id="sigph-${esc(r.key)}">לחץ לחתימה</span>
          </div>
          <div class="sig-acts no-print">
            <button class="btn-add" onclick="openSig('${esc(r.key)}')">חתימה</button>
            <button class="btn-add" onclick="clearSig('${esc(r.key)}')">נקה</button>
          </div>
          <div class="sig-meta"><span>שם:</span><span class="sig-name" id="sign-${esc(r.key)}"></span></div>
        </div>`).join('');
      return `<div class="sig-section" style="grid-template-columns:repeat(${Math.min(roles.length, 3)},1fr)">${cells}</div>`;
    },
    collect(el) {
      const roles = [];
      el.querySelectorAll('.sig-block').forEach(s => roles.push({ key: s.dataset.key, label: txt(s, 'label') || (s.querySelector('label') || {}).innerText || '' }));
      return { roles };
    }
  };

  // ---------- מסגרת בלוק + בקרות ----------
  function renderBlock(b) {
    const def = BLOCKS[b.type];
    if (!def) return '';
    if (!b.id) b.id = uid('blk');
    return `<div class="block" data-type="${esc(b.type)}" data-id="${esc(b.id)}">
      <div class="block-ctl no-print">
        <span class="block-tag">${esc(def.label)}</span>
        <button onclick="moveBlock(this,-1)" title="מעלה">▲</button>
        <button onclick="moveBlock(this,1)" title="מטה">▼</button>
        <button class="bx" onclick="delBlock(this)" title="מחק בלוק">✕</button>
      </div>
      <div class="block-body">${def.render(b)}</div>
    </div>`;
  }
  function collectBlock(el) {
    const type = el.dataset.type, def = BLOCKS[type];
    if (!def) return null;
    const body = el.querySelector('.block-body') || el;
    const data = def.collect ? def.collect(body) : {};
    return Object.assign({ type, id: el.dataset.id }, data);
  }

  // ---------- סיכום אוטומטי ----------
  function scanDefects() {
    const all = [];
    document.querySelectorAll('.block[data-type="defects"] .item').forEach(it => {
      all.push({ dom: ival(it, '.f-dom'), severity: ival(it, '.f-sev'), status: ival(it, '.f-status') });
    });
    return all;
  }
  function summaryHTML() {
    const defs = scanDefects();
    const total = defs.length;
    const open = defs.filter(d => (D.OPEN_STATUSES || []).indexOf(d.status) >= 0).length;
    const fixed = defs.filter(d => d.status === 'fixed' || d.status === 'verified').length;
    const bySev = {};
    (D.SEVERITY || []).forEach(s => bySev[s.key] = defs.filter(d => d.severity === s.key).length);
    const sevCells = (D.SEVERITY || []).map(s => `<span class="sum-chip ${s.cls}">${esc(s.label)}: ${bySev[s.key] || 0}</span>`).join('');
    return `<div class="sum-row">
        <span class="sum-stat"><b>${total}</b> ליקויים</span>
        <span class="sum-stat"><b>${open}</b> פתוחים</span>
        <span class="sum-stat"><b>${fixed}</b> תוקנו</span>
      </div><div class="sum-sev">${sevCells}</div>`;
  }
  window.refreshSummary = function (btn) {
    const box = btn.closest('.block').querySelector('[data-summary]');
    if (box) box.innerHTML = summaryHTML();
  };
  window.refreshAllSummaries = function () {
    document.querySelectorAll('[data-summary]').forEach(box => box.innerHTML = summaryHTML());
  };

  // ---------- בקרות עריכה גלובליות ----------
  window.moveBlock = function (btn, dir) {
    const blk = btn.closest('.block');
    if (dir < 0 && blk.previousElementSibling) blk.parentNode.insertBefore(blk, blk.previousElementSibling);
    else if (dir > 0 && blk.nextElementSibling) blk.parentNode.insertBefore(blk.nextElementSibling, blk);
    schedSave();
  };
  window.delBlock = function (btn) {
    if (confirm('למחוק בלוק זה?')) { btn.closest('.block').remove(); schedSave(); }
  };
  window.addMetaRow = function (btn) {
    const grid = btn.closest('.block-body').querySelector('.meta-grid2');
    grid.insertAdjacentHTML('beforeend', `<div class="meta-row">${ce('meta-label', '', 'תווית')}${ce('meta-val', '', '—')}<button class="meta-x no-print" onclick="this.closest('.meta-row').remove();schedSave()" title="הסר">✕</button></div>`);
    schedSave();
  };
  window.addDefect = function (btn) {
    const list = btn.closest('.block-body').querySelector('.defects-list');
    list.insertAdjacentHTML('beforeend', defectItem({}, list.querySelectorAll('.item').length + 1));
    renumber(list); schedSave();
  };
  window.delDefect = function (btn) {
    if (!confirm('להסיר פריט זה?')) return;
    const list = btn.closest('.defects-list'); btn.closest('.item').remove(); renumber(list); refreshAllSummaries(); schedSave();
  };
  function renumber(list) { list && list.querySelectorAll('.item').forEach((it, i) => { const n = it.querySelector('.item-num') || it.querySelector('.num'); if (n) n.textContent = i + 1; }); }
  window.renumberDefects = function () { document.querySelectorAll('.defects-list').forEach(renumber); };
  window.addThermo = function (btn) {
    const list = btn.closest('.block-body').querySelector('.defects-list');
    list.insertAdjacentHTML('beforeend', thermoItem({}, list.querySelectorAll('.item').length + 1));
    renumber(list); schedSave();
  };
  window.addMeasureRow = function (btn) { btn.closest('.block-body').querySelector('tbody').insertAdjacentHTML('beforeend', measureRow({})); schedSave(); };
  window.addCheckRow = function (btn) { btn.closest('.block-body').querySelector('tbody').insertAdjacentHTML('beforeend', checkRow({})); schedSave(); };
  window.addBoqRow = function (btn) { btn.closest('.block-body').querySelector('tbody').insertAdjacentHTML('beforeend', boqRow({})); schedSave(); };
  window.addLoadRow = function (btn) { btn.closest('.block-body').querySelector('tbody').insertAdjacentHTML('beforeend', loadRow({})); schedSave(); };
  window.loadElecTests = function (btn) {
    const tb = btn.closest('.block-body').querySelector('tbody');
    tb.insertAdjacentHTML('beforeend', (D.ELEC_TESTS || []).map(measureRow).join(''));
    schedSave();
  };
  window.loadSafetyChecklist = function (btn) {
    const tb = btn.closest('.block-body').querySelector('tbody');
    tb.insertAdjacentHTML('beforeend', (D.SAFETY_CHECKLIST || []).map(item => checkRow({ item, status: 'pass' })).join(''));
    schedSave();
  };
  window.setSev = function (sel) {
    // צבע פס החומרה על הפריט + עדכון תווית להדפסה
    const item = sel.closest('.item'); if (!item) return;
    item.classList.remove('sev-low', 'sev-med', 'sev-high');
    const m = { low: 'sev-low', med: 'sev-med', high: 'sev-high', crit: 'sev-high' };
    item.classList.add(m[sel.value] || 'sev-med');
    const tag = item.querySelector('.statusbar .sev-tag b');
    if (tag) tag.textContent = ((D.SEVERITY || []).find(x => x.key === sel.value) || {}).label || '';
  };
  window.setStat = function (sel) {
    const item = sel.closest('.item');
    const s = (D.STATUS || []).find(x => x.key === sel.value) || { label: '', cls: '' };
    // statusbar badge (print)
    const b = item ? item.querySelector('.statusbar .badge') : null;
    if (b) { b.textContent = s.label; b.className = 'badge ' + s.cls; }
    // header badge (screen)
    const hb = item ? item.querySelector('.s-badge') : null;
    if (hb) { hb.textContent = s.label; hb.className = 'badge ' + s.cls + ' s-badge'; }
    refreshAllSummaries();
  };
  window.setThermoSev = function (sel) {
    const item = sel.closest('.item'); if (!item) return;
    const tag = item.querySelector('.statusbar .sev-tag b');
    if (tag) tag.textContent = ((D.THERMO_SEVERITY || []).find(x => x.key === sel.value) || {}).label || '';
    const m = { watch: 'sev-low', plan: 'sev-med', urgent: 'sev-high' };
    item.classList.remove('sev-low', 'sev-med', 'sev-high');
    item.classList.add(m[sel.value] || 'sev-low');
  };
  function rowTotal(tr) {
    const q = parseFloat(ival(tr, '.b-qty')) || 0, p = parseFloat(ival(tr, '.b-price')) || 0;
    const t = q * p; const cell = tr.querySelector('.b-total'); if (cell) cell.textContent = t ? t.toLocaleString('he-IL') : '—';
    return t;
  }
  window.recalcBoqEl = function (table) {
    let sum = 0; table.querySelectorAll('tbody tr').forEach(tr => sum += rowTotal(tr));
    const s = table.querySelector('.boq-sum'); if (s) s.textContent = sum ? sum.toLocaleString('he-IL') : '—';
  };
  window.recalcBoq = function (node) { const t = node.closest('table'); if (t) recalcBoqEl(t); };
  window.recalcAllBoq = function () { document.querySelectorAll('table.boq').forEach(recalcBoqEl); };

  // ---------- מנוע טבלאות גנרי (בלוקים טבלאיים חדשים) ----------
  function genRowHTML(columns, r) {
    r = r || {};
    const tds = columns.map(c => {
      if (c.kind === 'sel') return `<td class="ctd">${sel('tc-' + c.key, c.options, r[c.key] != null ? r[c.key] : (c.options[0] || {}).key)}</td>`;
      const num = c.kind === 'num';
      return `<td${num ? ' class="num"' : ''}>${inp('cell tc-' + c.key + (num ? ' num' : ''), r[c.key], c.ph || '', num ? 'number' : 'text')}</td>`;
    }).join('');
    return `<tr>${tds}<td class="no-print"><button class="rowx" onclick="this.closest('tr').remove();schedSave()">✕</button></td></tr>`;
  }
  function tableBlock(id, label, columns, seedFn) {
    const ths = columns.map(c => `<th>${esc(c.label)}</th>`).join('');
    BLOCKS[id] = {
      label, columns,
      make: (o) => ({ caption: (o && o.caption) || label, rows: (o && o.rows) || (seedFn ? seedFn() : [{}]) }),
      render(b) {
        const rows = (b.rows || []).map(r => genRowHTML(columns, r)).join('');
        return `<table class="mtable"><caption>${ce('cap', b.caption, 'כותרת')}</caption>
          <thead><tr>${ths}<th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table>
          <div class="add-row no-print"><button class="btn-add" onclick="addGenRow(this,'${id}')">＋ שורה</button></div>`;
      },
      collect(el) {
        const rows = [];
        el.querySelectorAll('tbody tr').forEach(tr => { const r = {}; columns.forEach(c => r[c.key] = ival(tr, '.tc-' + c.key)); rows.push(r); });
        return { caption: txt(el, '.cap'), rows };
      }
    };
  }
  window.addGenRow = function (btn, id) {
    const cols = (BLOCKS[id] || {}).columns || [];
    btn.closest('.block-body').querySelector('tbody').insertAdjacentHTML('beforeend', genRowHTML(cols, {}));
    schedSave();
  };

  const RESULT_OPTS = [{ key: '', label: '—' }, { key: 'pass', label: 'תקין' }, { key: 'fail', label: 'לא תקין' }];
  const PRIO_OPTS = (D.PRIORITY || []).map(p => ({ key: p.key, label: p.label }));

  tableBlock('parties', 'פרטי הצדדים', [
    { key: 'role', label: 'תפקיד', kind: 'text', ph: 'מזמין/קבלן/מפקח' },
    { key: 'name', label: 'שם', kind: 'text' }, { key: 'company', label: 'חברה', kind: 'text' },
    { key: 'license', label: 'ת"ז/רישיון', kind: 'text' }, { key: 'phone', label: 'טלפון', kind: 'text' }
  ], () => [{ role: 'מזמין' }, { role: 'קבלן' }, { role: 'מפקח' }]);

  tableBlock('tolerances', 'סטיות מותרות', [
    { key: 'element', label: 'אלמנט', kind: 'text' }, { key: 'allowed', label: 'סטייה מותרת', kind: 'text' }, { key: 'standard', label: 'תקן', kind: 'text' }
  ], () => (D.TOLERANCE_ROWS || []).map(t => ({ element: t.element, allowed: t.allowed, standard: t.standard })));

  tableBlock('recommendations', 'המלצות לתיקון', [
    { key: 'finding', label: 'ממצא', kind: 'text' }, { key: 'priority', label: 'עדיפות', kind: 'sel', options: PRIO_OPTS },
    { key: 'action', label: 'פעולה נדרשת', kind: 'text' }, { key: 'standard', label: 'תקן', kind: 'text' }, { key: 'due', label: 'יעד', kind: 'text' }
  ]);

  tableBlock('costsummary', 'סיכום עלויות', [
    { key: 'item', label: 'סעיף', kind: 'text' }, { key: 'qty', label: 'כמות', kind: 'num' }, { key: 'unit', label: 'יח׳', kind: 'text' }, { key: 'price', label: 'מחיר', kind: 'num' }
  ]);

  tableBlock('revisions', 'היסטוריית גרסאות', [
    { key: 'rev', label: 'גרסה', kind: 'text' }, { key: 'date', label: 'תאריך', kind: 'text' }, { key: 'author', label: 'עורך', kind: 'text' }, { key: 'desc', label: 'תיאור', kind: 'text' }
  ]);

  tableBlock('definitions', 'הגדרות ומונחים', [
    { key: 'term', label: 'מונח', kind: 'text' }, { key: 'definition', label: 'הגדרה', kind: 'text' }
  ]);

  tableBlock('panel', 'טבלת לוח מעגלים', [
    { key: 'circuit', label: 'מעגל', kind: 'text' }, { key: 'desc', label: 'תיאור', kind: 'text' }, { key: 'breaker', label: 'מאמ"ת', kind: 'text' },
    { key: 'poles', label: 'קטבים', kind: 'num' }, { key: 'csa', label: 'חתך mm²', kind: 'text' }, { key: 'rcd', label: 'פחת', kind: 'text' }, { key: 'phase', label: 'פאזה', kind: 'text' }
  ]);

  tableBlock('rcd', 'בדיקת מפסקי פחת', [
    { key: 'id', label: 'מזהה', kind: 'text' }, { key: 'idn', label: 'IΔn (mA)', kind: 'text' },
    { key: 'type', label: 'סוג', kind: 'sel', options: [{ key: 'AC', label: 'AC' }, { key: 'A', label: 'A' }, { key: 'B', label: 'B' }] },
    { key: 'trip', label: 'זרם ניתוק (mA)', kind: 'num' }, { key: 't1', label: 'זמן 1× (ms)', kind: 'num' }, { key: 't5', label: 'זמן 5× (ms)', kind: 'num' },
    { key: 'result', label: 'תוצאה', kind: 'sel', options: RESULT_OPTS }
  ]);

  tableBlock('earth', 'בדיקת הארקות', [
    { key: 'point', label: 'נקודה', kind: 'text' }, { key: 'electrode', label: 'אלקטרודה (Ω)', kind: 'num' }, { key: 'continuity', label: 'רציפות (Ω)', kind: 'num' },
    { key: 'method', label: 'שיטה', kind: 'text' }, { key: 'result', label: 'תוצאה', kind: 'sel', options: RESULT_OPTS }
  ]);

  tableBlock('equipment', 'מכשור וכיול', [
    { key: 'instrument', label: 'מכשיר', kind: 'text' }, { key: 'model', label: 'דגם', kind: 'text' }, { key: 'serial', label: 'מס׳ סידורי', kind: 'text' },
    { key: 'cert', label: 'תעודת כיול', kind: 'text' }, { key: 'valid', label: 'בתוקף עד', kind: 'text' }
  ]);

  // installdetails — וריאציית meta (key/value) עם ברירות מחדל לחשמל
  BLOCKS.installdetails = {
    label: 'פרטי מתקן',
    make: (o) => ({ rows: (o && o.rows) || [
      { label: 'מתח אספקה', value: '230/400V' }, { label: 'גודל חיבור', value: '3×25A' }, { label: 'פאזות', value: '3' },
      { label: 'שיטת הארקה', value: 'TN-C-S' }, { label: 'סוג הזנה', value: 'חברת חשמל' }, { label: 'מפסק ראשי', value: '' }
    ] }),
    render: BLOCKS.meta.render,
    collect: BLOCKS.meta.collect
  };

  // photoannex — גלריית תמונות ממוספרת
  function annexItem(it) {
    it = it || {};
    return `<div class="annex-item" data-id="${uid('ax')}">
      <div class="pwrap">${photoBox(it.photo, 'תמונה')}${photoActs()}</div>
      <div class="annex-meta">
        <div class="frow"><label>מס׳</label>${inp('inp sm a-ref', it.ref, '1')}</div>
        <div class="frow"><label>מיקום</label>${inp('inp a-loc', it.location, '')}</div>
        ${inp('inp a-cap', it.caption, 'כיתוב התמונה...')}
      </div></div>`;
  }
  BLOCKS.photoannex = {
    label: 'נספח תמונות',
    make: (o) => ({ items: (o && o.items) || [{}] }),
    render(b) {
      const items = (b.items || []).map(annexItem).join('');
      return `<div class="annex-grid">${items}</div>
        <div class="add-row no-print"><button class="btn-add" onclick="addAnnex(this)">＋ תמונה</button></div>`;
    },
    collect(el) {
      const items = [];
      el.querySelectorAll('.annex-item').forEach(a => items.push({ ref: ival(a, '.a-ref'), location: ival(a, '.a-loc'), caption: ival(a, '.a-cap'), photo: imgSrc(a, '.pbox') }));
      return { items };
    }
  };
  window.addAnnex = function (btn) { btn.closest('.block-body').querySelector('.annex-grid').insertAdjacentHTML('beforeend', annexItem({})); schedSave(); };

  window.BLOCKS = BLOCKS;
  window.renderBlock = renderBlock;
  window.collectBlock = collectBlock;
})();
