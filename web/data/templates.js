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

  // ---- תבניות מקצועיות מורחבות (תוכן מסוכני דומיין בנייה+חשמל) ----
  const H = (t) => mk('heading', { text: t });
  const T = (t) => mk('text', { text: t || '' });
  const LG = (t) => mk('legal', { text: t });
  const chk = (caption, arr) => mk('checklist', { caption, rows: arr.map(item => ({ item, status: 'pass' })) });
  const meas = (caption, tests) => mk('measure', { caption, rows: tests.map(t => Object.assign({}, t, { value: '', pass: '' })) });
  const rt = (id, typeId, name, desc, palette, blocks) => ({ id, typeId, name, description: desc, palette, branding: defaultBranding(), builtin: true, blocks });

  const RICH = [
    rt('rich-bedek', 'pre-handover', 'בדק בית מפורט לפני מסירה', 'שיטה, סטיות מותרות, ממצאים, נספח תמונות והמלצות', 'slateRed', [
      mk('meta', { rows: [{ label: 'נכס', value: '' }, { label: 'כתובת', value: '' }, { label: 'דירה/קומה', value: '' }, { label: 'מזמין', value: '' }, { label: 'יזם/קבלן', value: '' }, { label: 'תאריך בדיקה', value: '' }, { label: 'בודק + רישיון', value: '' }, { label: 'מס׳ תיק', value: '' }] }),
      H('מבוא ותיאור הנכס'), T(D.LEGAL.scopeIntro),
      H('שיטת בדיקה ומכשור'), T(D.LEGAL.methodology),
      mk('tolerances'),
      H('ממצאים'),
      mk('defects', { items: [
        { loc: 'סלון', dom: 'טיח וצבע', desc: 'סדק התכווצות אופקי בקיר מערבי, ~40 ס"מ', severity: 'med', std: 'ת"י 1920', status: 'open' },
        { loc: 'אמבטיה', dom: 'איטום', desc: 'מים עומדים — שיפוע ניקוז לקוי ליד הניקוז', severity: 'high', std: 'שיפוע מינ׳ 1.5%', status: 'open' },
        { loc: 'מטבח', dom: 'חשמל', desc: 'שקע מעל משטח ללא הארקה תקינה', severity: 'crit', std: 'ת"י 1142', status: 'open' }
      ] }),
      chk('בדיקות תפקוד', ['כל הדלתות נפתחות ונסגרות תקין', 'ברזים ללא נזילה', 'מפסק פחת מנתק בבדיקה', 'אין חלל מתחת לריצוף (טפיחה)', 'מעקות בגובה ≥105 ס"מ', 'אטימת חלונות למים ואוויר']),
      mk('photoannex'), mk('summary'), mk('recommendations'), LG(D.LEGAL.disclaimer),
      mk('signatures', { roles: [{ key: 'insp', label: 'חתימת הבודק' }, { key: 'clt', label: 'חתימת המזמין' }] })
    ]),
    rt('rich-qc', 'rej-flow', 'בקרת איכות חודשי לקבלן', 'שלבי ביצוע, ליקויים, עלויות ועדיפויות', 'slateRed', [
      mk('meta', { rows: [{ label: 'פרויקט', value: '' }, { label: 'מגרש/בניין', value: '' }, { label: 'חודש דיווח', value: '' }, { label: 'מפקח/בקר איכות', value: '' }, { label: 'קבלן ראשי', value: '' }, { label: 'מס׳ דוח', value: '' }] }),
      H('סיכום פעילות החודש'), T('במהלך החודש המדווח בוצעו סיורי בקרת איכות שוטפים בהתאם לתכנית הבקרה. הדוח מרכז את הממצאים ומצב הטיפול בליקויים.'),
      mk('revisions'),
      chk('בקרת שלבי ביצוע', ['התאמת ביצוע לתכניות מאושרות', 'אישור יציקה ובדיקות בטון', 'אטימה לפני חיפוי', 'בדיקת מערכות לפני סגירת קירות', 'ניקיון ובטיחות באתר', 'תיעוד צילומי לשלבים סמויים']),
      mk('defects', { items: [{}, {}] }), mk('costsummary'), mk('recommendations'), mk('summary'),
      mk('signatures', { roles: [{ key: 'qc', label: 'בקר איכות' }, { key: 'pm', label: 'מנהל פרויקט' }] })
    ]),
    rt('rich-expert', 'expert', 'חוות דעת הנדסית מפורטת', 'הצהרה, מתודולוגיה, ממצאים, עלויות ומסקנות', 'navySteel', [
      mk('meta', { rows: [{ label: 'בעניין', value: '' }, { label: 'בית משפט/הליך', value: '' }, { label: 'התובע', value: '' }, { label: 'הנתבע', value: '' }, { label: 'הנכס', value: '' }, { label: 'המומחה', value: '' }, { label: 'השכלה/רישיון', value: '' }, { label: 'תאריך', value: '' }] }),
      H('הצהרת המומחה'), LG(D.LEGAL.expertDeclaration), mk('definitions'),
      H('כתב המינוי והשאלה הנדונה'), T('מוניתי לבחון את ליקויי הבנייה הנטענים בנכס, להעריך את עלות תיקונם ולחוות דעתי בשאלת ההתאמה לתקנים ולחוק המכר (דירות).'),
      H('שיטת בדיקה'), T(D.LEGAL.methodology), mk('tolerances'),
      H('ממצאים'), mk('defects', { items: [{}, {}] }), mk('photoannex'), mk('costsummary'),
      H('מסקנות'), T(''), LG(D.LEGAL.terms),
      mk('signatures', { roles: [{ key: 'expert', label: 'חתימת המומחה' }] })
    ]),
    rt('rich-eleccert', 'elec-cert', 'תעודת בדיקת מתקן חשמל מלאה', 'לוח מעגלים, מדידות, פחת, הארקות ומכשור', 'engBlue', [
      mk('installdetails'),
      H('1. מבוא והיקף הבדיקה'), T(D.LEGAL.elecMethodology),
      mk('panel', { rows: [{ circuit: '1', desc: 'תאורה כללי', breaker: 'C16', poles: '1', csa: '1.5', rcd: '—', phase: 'L1' }, { circuit: '2', desc: 'שקעים', breaker: 'C16', poles: '1', csa: '2.5', rcd: '30mA', phase: 'L2' }, { circuit: '3', desc: 'מזגן', breaker: 'C25', poles: '1', csa: '4', rcd: '30mA', phase: 'L3' }] }),
      H('בדיקות מדידה'), meas('מדידות לפי ת"י 60364', D.ELEC_TESTS),
      mk('rcd', { rows: [{ id: 'RCD-1', idn: '30', type: 'A', trip: '24', t1: '18', t5: '9', result: 'pass' }] }),
      mk('earth', { rows: [{ point: 'אלקטרודת הארקה ראשית', electrode: '8.4', continuity: '0.3', method: 'Fall-of-Potential', result: 'pass' }] }),
      chk('בדיקה חזותית', D.SAFETY_CHECKLIST.slice(0, 8)),
      mk('recommendations'), mk('equipment'), mk('summary'), LG(D.LEGAL.inspectorDeclaration),
      mk('signatures', { roles: [{ key: 'inspector', label: 'חתימת הבודק + חותמת' }] }), mk('photoannex')
    ]),
    rt('rich-elecsafety', 'elec-safety', 'דוח בטיחות חשמל למפעל/עסק', 'סקר בטיחות מלא כולל תרמוגרפיה ובדיקות', 'engBlue', [
      mk('meta', { rows: [{ label: 'שם העסק/מפעל', value: '' }, { label: 'ענף', value: '' }, { label: 'כתובת', value: '' }, { label: 'מזמין', value: '' }, { label: 'תאריך', value: '' }, { label: 'עורך הסקר + רישיון', value: '' }] }),
      mk('installdetails', { rows: [{ label: 'מתח אספקה', value: '230/400V' }, { label: 'גודל חיבור', value: '3×160A' }, { label: 'שיטת הארקה', value: 'TN-S' }, { label: 'סוג הזנה', value: 'מ"נ + גנרטור' }, { label: 'מפסק ראשי', value: '160A' }] }),
      H('1. מטרת הסקר והיקפו'), T(D.LEGAL.elecMethodology),
      H('2. ממצאי בטיחות'), chk('סקר בטיחות חשמל', D.SAFETY_CHECKLIST),
      H('3. בדיקות מדידה ותרמוגרפיה'), meas('מדידות', D.ELEC_TESTS.slice(0, 8)),
      mk('thermo', { items: [{}] }), mk('defects', { items: [{}] }),
      mk('recommendations'), LG(D.LEGAL.safetyDisclaimer), mk('summary'),
      mk('signatures', { roles: [{ key: 'inspector', label: 'עורך הסקר' }, { key: 'mgr', label: 'מנהל המפעל' }] })
    ]),
    rt('rich-elecdesign', 'elec-design', 'דוח תכנון חשמל עם כתב כמויות', 'עומסים, לוח מעגלים וכתב כמויות', 'graphiteTeal', [
      mk('meta', { rows: [{ label: 'פרויקט', value: '' }, { label: 'כתובת', value: '' }, { label: 'מזמין', value: '' }, { label: 'מתכנן + רישיון', value: '' }, { label: 'תאריך', value: '' }, { label: 'מהדורה', value: '1.0' }] }),
      H('1. תיאור הפרויקט ובסיס התכנון'), T('התכנון בהתאם לת"י 60364, ת"י 1419/61439 ללוחות, וחוק החשמל.'),
      mk('installdetails', { rows: [{ label: 'מתח אספקה', value: '230/400V' }, { label: 'גודל חיבור מתוכנן', value: '3×80A' }, { label: 'הספק מותקן', value: '45kW' }, { label: 'מקדם ביקוש', value: '0.65' }] }),
      H('2. חישוב עומסים'), mk('loadcalc', { rows: [{ circuit: 'תאורה', power: '4', factor: '0.9', current: '18', drop: '2.1' }, { circuit: 'שקעים', power: '6', factor: '0.7', current: '21', drop: '3.4' }, { circuit: 'מיזוג', power: '12', factor: '0.8', current: '34', drop: '4.2' }] }),
      H('3. תכנון לוח ומעגלים'), mk('panel'),
      H('4. כתב כמויות'), mk('boq', { rows: [{ desc: 'מאמ"ת C16 חד-פאזי', unit: 'יח׳', qty: '24', price: '' }, { desc: 'מפסק פחת 2P 30mA', unit: 'יח׳', qty: '8', price: '' }, { desc: 'כבל NYY 5×6', unit: 'מ׳', qty: '120', price: '' }, { desc: 'לוח 36 מודולים', unit: 'יח׳', qty: '1', price: '' }] }),
      mk('recommendations'), LG(D.LEGAL.inspectorDeclaration),
      mk('signatures', { roles: [{ key: 'designer', label: 'חתימת המתכנן' }, { key: 'clt', label: 'מזמין' }] })
    ])
  ];
  ALL.push(...RICH);

  const byId = {};
  ALL.forEach(t => byId[t.id] = t);

  window.BUILTIN_TEMPLATES = ALL;
  window.getBuiltinTemplate = (id) => byId[id];
  window.builtinTemplatesForType = (typeId) => ALL.filter(t => t.typeId === typeId);
})();
