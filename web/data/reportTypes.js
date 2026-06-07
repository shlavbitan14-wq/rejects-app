/* =====================================================================
 * reportTypes.js — 10 סכמות סוגי דוח (5 בנייה + 5 חשמל).
 * נטען אחרי blocks.js. חושף window.REPORT_TYPES + window.mkBlock + window.getType.
 * כל סוג: id, category, name, icon, palette, blocks() → מערך בלוקים ריק (ברירת מחדל).
 * ===================================================================== */
(function () {
  'use strict';
  const D = window.DOMAIN;

  // בונה בלוק טרי מתוך register הבלוקים
  function mk(type, opts) {
    const def = window.BLOCKS[type] || {};
    return Object.assign({ type, id: window.uid('blk') }, def.make ? def.make(opts) : {});
  }
  window.mkBlock = mk;

  const meta = (rows) => mk('meta', { rows });
  const heading = (text) => mk('heading', { text });
  const text = (t) => mk('text', { text: t });
  const legal = (t) => mk('legal', { text: t });
  const sigs = (roles) => mk('signatures', { roles });

  // רשתות מטא נפוצות
  const META_BUILD = () => [
    { label: 'פרויקט', value: '' }, { label: 'כתובת', value: '' },
    { label: 'מבנה / קומה', value: '' }, { label: 'דירה / יחידה', value: '' },
    { label: 'קבלן', value: '' }, { label: 'בודק / מפקח', value: '' },
    { label: 'תאריך בדיקה', value: '' }, { label: 'מס׳ דוח', value: '' }
  ];
  const META_ELEC = () => [
    { label: 'מזמין / בעל נכס', value: '' }, { label: 'כתובת המתקן', value: '' },
    { label: 'ייעוד', value: 'מגורים' }, { label: 'מתח הזנה', value: '230/400V' },
    { label: 'סוג הזנה', value: 'תלת-פאזי' }, { label: 'גודל חיבור (A)', value: '' },
    { label: 'שיטת הארקה', value: 'TN-C-S' }, { label: 'בודק + מס׳ רישיון', value: '' },
    { label: 'תאריך בדיקה', value: '' }, { label: 'מס׳ תעודה', value: '' }
  ];

  const TYPES = [
    /* ===================== בנייה ===================== */
    {
      id: 'rej-flow', category: 'build', name: 'דוח רג׳קטים שוטף', icon: '📋', palette: 'slateRed',
      desc: 'רשימת ליקויים שוטפת בזמן בנייה',
      blocks: () => [
        meta(META_BUILD()),
        mk('defects', { items: [{}, {}, {}] }),
        mk('summary'),
        sigs([{ key: 'insp', label: 'חתימת הבודק' }, { key: 'contractor', label: 'חתימת הקבלן' }])
      ]
    },
    {
      id: 'handover', category: 'build', name: 'פרוטוקול מסירת דירה', icon: '🔑', palette: 'slateRed',
      desc: 'מסירה פורמלית לרוכש — תחילת תקופת הבדק',
      blocks: () => [
        meta([
          { label: 'פרויקט', value: '' }, { label: 'כתובת', value: '' }, { label: 'דירה / יחידה', value: '' },
          { label: 'היזם / קבלן', value: '' }, { label: 'רוכש', value: '' }, { label: 'מועד מסירה', value: '' }
        ]),
        heading('מצב מערכות ומסירת מסמכים'),
        mk('checklist', {
          caption: 'בדיקת מערכות במעמד המסירה', rows: [
            { item: 'מונה מים — קריאה', status: 'pass' }, { item: 'מונה חשמל — קריאה', status: 'pass' },
            { item: 'מונה גז — קריאה', status: 'pass' }, { item: 'מסירת מפתחות', status: 'pass' },
            { item: 'תעודות אחריות וספרי מתקן', status: 'pass' }, { item: 'הוראות הפעלה למערכות', status: 'pass' }
          ]
        }),
        heading('ליקויים וחוסרים שנרשמו'),
        mk('defects', { items: [{}, {}] }),
        legal(D.LEGAL.handoverNote),
        sigs([{ key: 'contractor', label: 'נציג היזם / הקבלן' }, { key: 'buyer', label: 'הרוכש' }])
      ]
    },
    {
      id: 'pre-handover', category: 'build', name: 'דוח בדק לפני מסירה', icon: '🔍', palette: 'slateRed',
      desc: 'בדיקת רוכש לפני חתימה על המסירה',
      blocks: () => [
        meta(META_BUILD()),
        heading('שיטת הבדיקה ומכשור'),
        text('הבדיקה בוצעה ויזואלית ובאמצעות: מד רטיבות, פלס/מאזנת, סרגל 2 מ׳ ומצלמה. ' +
          'הליקויים נמדדו ביחס לסטיות המותרות לפי ת"י 789 והמפרט.'),
        heading('ממצאים'),
        mk('defects', { items: [{}, {}, {}] }),
        mk('summary'),
        legal(D.LEGAL.disclaimer),
        sigs([{ key: 'insp', label: 'חתימת הבודק' }, { key: 'clt', label: 'חתימת המזמין' }])
      ]
    },
    {
      id: 'bedek-year', category: 'build', name: 'דוח שנת בדק', icon: '📅', palette: 'slateRed',
      desc: 'ליקויים שהתגלו בתקופת הבדק',
      blocks: () => [
        meta([...META_BUILD().slice(0, 6), { label: 'מועד מסירה', value: '' }, { label: 'מס׳ דוח', value: '' }]),
        text('דוח זה מפרט ליקויים שהתגלו לאחר המסירה, במהלך תקופת הבדק. ' +
          'נדרש תיקונם על ידי הקבלן בהתאם לחוק המכר (דירות).'),
        heading('ליקויים'),
        mk('defects', { items: [{}, {}] }),
        legal(D.LEGAL.bedekNote),
        sigs([{ key: 'insp', label: 'חתימת הבודק' }, { key: 'contractor', label: 'חתימת הקבלן' }])
      ]
    },
    {
      id: 'expert', category: 'build', name: 'חוות דעת הנדסית', icon: '⚖️', palette: 'navySteel',
      desc: 'חוות דעת מומחה לבית משפט / מחלוקת',
      blocks: () => [
        meta([
          { label: 'בעניין', value: '' }, { label: 'נכס', value: '' }, { label: 'מזמין חוות הדעת', value: '' },
          { label: 'עורך חוות הדעת', value: '' }, { label: 'השכלה / רישיון', value: '' }, { label: 'תאריך', value: '' }
        ]),
        heading('רקע ומטרה'),
        text(''),
        heading('המסמכים שעמדו בפניי'),
        text(''),
        heading('ממצאים ואומדן עלויות'),
        mk('defects', { items: [{}, {}] }),
        mk('boq', { caption: 'אומדן עלות תיקון הליקויים', rows: [] }),
        heading('מסקנות'),
        text(''),
        legal(D.LEGAL.expertDeclaration),
        sigs([{ key: 'expert', label: 'חתימת המומחה' }])
      ]
    },

    /* ===================== חשמל ===================== */
    {
      id: 'elec-cert', category: 'elec', name: 'תעודת בדיקת מתקן חשמל', icon: '⚡', palette: 'engBlue',
      desc: 'בדיקת בודק חשמל מוסמך + מדידות',
      blocks: () => [
        meta(META_ELEC()),
        heading('טבלת מדידות ובדיקות'),
        mk('measure', { caption: 'מדידות לפי ת"י 1419 / חוק החשמל', rows: D.ELEC_TESTS.map(t => Object.assign({}, t, { value: '', pass: '' })) }),
        heading('ליקויים והמלצות'),
        mk('defects', { items: [{}] }),
        legal(D.LEGAL.inspectorDeclaration),
        sigs([{ key: 'inspector', label: 'חתימת הבודק + חותמת' }])
      ]
    },
    {
      id: 'elec-expert', category: 'elec', name: 'חוות דעת מומחה חשמל', icon: '⚖️', palette: 'engBlue',
      desc: 'חוות דעת מומחה חשמל לבית משפט',
      blocks: () => [
        meta([
          { label: 'בעניין', value: '' }, { label: 'נכס / מתקן', value: '' }, { label: 'מזמין', value: '' },
          { label: 'המומחה', value: '' }, { label: 'רישיון', value: '' }, { label: 'תאריך', value: '' }
        ]),
        heading('רקע ומטרה'),
        text(''),
        heading('תיאור המתקן והבדיקה'),
        text(''),
        heading('ממצאים'),
        mk('defects', { items: [{}, {}] }),
        heading('מסקנות'),
        text(''),
        legal(D.LEGAL.expertDeclaration),
        sigs([{ key: 'expert', label: 'חתימת המומחה' }])
      ]
    },
    {
      id: 'elec-design', category: 'elec', name: 'דוח תכנון וייעוץ חשמל', icon: '📐', palette: 'graphiteTeal',
      desc: 'תכנון, חישובי עומסים וכתב כמויות',
      blocks: () => [
        meta([
          { label: 'פרויקט', value: '' }, { label: 'כתובת', value: '' }, { label: 'מזמין', value: '' },
          { label: 'מהנדס / יועץ', value: '' }, { label: 'תאריך', value: '' }, { label: 'מהדורה', value: '1.0' }
        ]),
        heading('מפרט טכני'),
        text('המפרט מבוסס על המפרט הכללי הבין-משרדי, פרק 08 — מתקני חשמל.'),
        heading('חישובי עומסים'),
        mk('loadcalc', { caption: 'חישובי עומסים ונפילת מתח', rows: [{}] }),
        heading('כתב כמויות'),
        mk('boq', { caption: 'כתב כמויות — מתקני חשמל', rows: [{}] }),
        sigs([{ key: 'engineer', label: 'חתימת המהנדס' }])
      ]
    },
    {
      id: 'elec-safety', category: 'elec', name: 'סקר בטיחות חשמל', icon: '🛡️', palette: 'engBlue',
      desc: 'סקר בטיחות למבנה / עסק',
      blocks: () => [
        meta([
          { label: 'שם העסק / מבנה', value: '' }, { label: 'כתובת', value: '' }, { label: 'מזמין', value: '' },
          { label: 'בודק + רישיון', value: '' }, { label: 'תאריך', value: '' }, { label: 'מס׳ דוח', value: '' }
        ]),
        heading('רשימת בדיקת בטיחות'),
        mk('checklist', { caption: 'סקר בטיחות חשמל', rows: D.SAFETY_CHECKLIST.map(item => ({ item, status: 'pass' })) }),
        heading('ליקויים והמלצות'),
        mk('defects', { items: [{}] }),
        sigs([{ key: 'inspector', label: 'חתימת הבודק' }])
      ]
    },
    {
      id: 'elec-thermo', category: 'elec', name: 'דוח תרמוגרפיה', icon: '🌡️', palette: 'graphiteTeal',
      desc: 'בדיקת תרמוגרפיה ללוחות חשמל',
      blocks: () => [
        meta([
          { label: 'מזמין / מבנה', value: '' }, { label: 'כתובת', value: '' }, { label: 'לוחות שנבדקו', value: '' },
          { label: 'בודק', value: '' }, { label: 'מצלמה / דגם', value: '' }, { label: 'תאריך', value: '' }
        ]),
        text('בדיקת תרמוגרפיה בוצעה בעומס עבודה. לכל ממצא מצורפות תמונה תרמית ותמונה רגילה, ' +
          'טמפרטורה, הפרש ΔT מעל הסביבה ודירוג חומרה.'),
        heading('ממצאים'),
        mk('thermo', { items: [{}] }),
        sigs([{ key: 'inspector', label: 'חתימת הבודק' }])
      ]
    },

    /* ===================== מסמך מאפס ===================== */
    {
      id: 'custom', category: 'custom', name: 'מסמך מאפס', icon: '✨', palette: 'navySteel',
      desc: 'התחל ממסמך ריק והוסף כל בלוק שתרצה',
      blocks: () => [
        meta([{ label: 'נושא', value: '' }, { label: 'תאריך', value: '' }, { label: 'נערך ע"י', value: '' }]),
        heading('כותרת ראשית'),
        text(''),
        sigs([{ key: 'sig1', label: 'חתימה' }])
      ]
    }
  ];

  const byId = {};
  TYPES.forEach(t => byId[t.id] = t);
  window.REPORT_TYPES = TYPES;
  window.getType = (id) => byId[id];
})();
