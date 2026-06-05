/* =====================================================================
 * templates.js — 50 טמפלייטים מובנים (5 לכל סוג דוח).
 * נטען אחרי reportTypes.js. חושף window.BUILTIN_TEMPLATES + עזרי גישה.
 * נבנים קומפקטית: מבנה בסיס מסוג הדוח + 5 וריאציות (מבנה/תוכן/פלטה).
 * ===================================================================== */
(function () {
  'use strict';
  const D = window.DOMAIN, mk = window.mkBlock;

  const deep = (b) => JSON.parse(JSON.stringify(b));
  const has = (blocks, t) => blocks.some(b => b.type === t);
  const insertBeforeSig = (blocks, block) => {
    const i = blocks.findIndex(b => b.type === 'signatures');
    if (i >= 0) blocks.splice(i, 0, block); else blocks.push(block);
  };

  function defaultBranding() {
    return { logoText: '', logoSub: '', coName: '', coPhone: '', coInsp: '', coLicense: '', logoUrl: null, docNum: '001', docRev: '1.0' };
  }

  // ---- טרנספורמציות וריאציה ----
  function trimShort(blocks) {
    const keep = { meta: 1, defects: 1, measure: 1, checklist: 1, thermo: 1, loadcalc: 1, boq: 1, signatures: 1 };
    const out = blocks.filter(b => keep[b.type]);
    out.forEach(b => { if (b.type === 'defects' && Array.isArray(b.items)) b.items = b.items.slice(0, 1); });
    return out;
  }
  function expand(blocks) {
    blocks.push(mk('heading', { text: 'הערות נוספות' }));
    blocks.push(mk('text', { text: '' }));
    if (has(blocks, 'defects') && !has(blocks, 'summary')) insertBeforeSig(blocks, mk('summary'));
    return blocks;
  }
  function branded(blocks) {
    if (!has(blocks, 'legal')) insertBeforeSig(blocks, mk('legal', { text: D.LEGAL.disclaimer }));
    return blocks;
  }

  // ---- 5 וריאציות לכל סוג ----
  function buildFor(type) {
    const cat = type.category;
    const altA = cat === 'build' ? 'navySteel' : 'graphiteTeal';
    const altB = cat === 'build' ? 'ironAmber' : 'navySteel';
    const variants = [
      { suf: 'סטנדרט', d: 'מבנה מלא ומומלץ לשימוש שוטף', pal: type.palette, mut: (b) => b },
      { suf: 'מקוצר', d: 'גרסה תמציתית — שדות חיוניים בלבד', pal: type.palette, mut: trimShort },
      { suf: 'מורחב', d: 'כולל סעיפי הערות וסיכום נוספים', pal: type.palette, mut: expand },
      { suf: 'עיצוב חלופי', d: 'אותו תוכן בפלטת צבעים חלופית', pal: altA, mut: (b) => b },
      { suf: 'ממותג', d: 'כולל הסתייגות וברנדינג מותאם', pal: altB, mut: branded }
    ];
    return variants.map((v, i) => ({
      id: type.id + '-t' + (i + 1),
      typeId: type.id,
      name: type.name + ' — ' + v.suf,
      description: v.d,
      palette: v.pal,
      branding: defaultBranding(),
      builtin: true,
      blocks: v.mut(deep(type.blocks()))
    }));
  }

  const ALL = [];
  (window.REPORT_TYPES || []).forEach(t => ALL.push(...buildFor(t)));

  const byId = {};
  ALL.forEach(t => byId[t.id] = t);

  window.BUILTIN_TEMPLATES = ALL;
  window.getBuiltinTemplate = (id) => byId[id];
  window.builtinTemplatesForType = (typeId) => ALL.filter(t => t.typeId === typeId);
})();
