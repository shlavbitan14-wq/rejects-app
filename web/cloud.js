/* =====================================================================
 * cloud.js — שכבת סנכרון ל-Supabase: workspace (פרויקטים/דוחות) + קבצים.
 * נטען אחרי supabase-config.js. חושף window.CLOUD.
 *   CLOUD.ready          — האם מחוברים (יש session) ולכן עובדים מול הענן
 *   CLOUD.profile        — { id, company_id, role, full_name, email }
 *   CLOUD.loadWorkspace()  → מחזיר מחרוזת JSON של { projects } (או null)
 *   CLOUD.saveWorkspace(jsonString) — שומר (debounced) לענן
 *   CLOUD.uploadAttachment(file) → { name, url, type, size, path }
 *   CLOUD.deleteAttachment(path)
 * ===================================================================== */
(function () {
  'use strict';
  const CLOUD = {
    ready: false,
    profile: null,
    _saveTimer: null,
    _pending: null
  };

  CLOUD.setSession = function (profile) {
    CLOUD.profile = profile || null;
    CLOUD.ready = !!(profile && profile.company_id && window.sb);
  };

  // ---------- workspace ----------
  CLOUD.loadWorkspace = async function () {
    if (!CLOUD.ready) return null;
    try {
      const { data, error } = await window.sb
        .from('workspaces').select('data').eq('user_id', CLOUD.profile.id).maybeSingle();
      if (error) { console.warn('[cloud] loadWorkspace', error.message); return null; }
      if (!data) return null;
      return JSON.stringify(data.data || { projects: [] });
    } catch (e) { console.warn('[cloud] loadWorkspace', e); return null; }
  };

  // שמירה עם debounce — מאחדת ריבוי autosave-ים לכתיבה אחת
  CLOUD.saveWorkspace = function (jsonString) {
    if (!CLOUD.ready) return;
    CLOUD._pending = jsonString;
    clearTimeout(CLOUD._saveTimer);
    CLOUD._saveTimer = setTimeout(CLOUD._flush, 900);
  };

  CLOUD._flush = async function () {
    if (!CLOUD.ready || CLOUD._pending == null) return;
    const payload = CLOUD._pending; CLOUD._pending = null;
    let dataObj;
    try { dataObj = JSON.parse(payload); } catch (e) { return; }
    try {
      const { error } = await window.sb.from('workspaces').upsert({
        user_id: CLOUD.profile.id,
        company_id: CLOUD.profile.company_id,
        data: dataObj,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) console.warn('[cloud] saveWorkspace', error.message);
    } catch (e) { console.warn('[cloud] saveWorkspace', e); }
  };

  // ---------- קבצים (שרטוטים / תוכניות) ----------
  CLOUD.uploadAttachment = async function (file) {
    if (!CLOUD.ready) throw new Error('לא מחוברים לענן');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const path = `${CLOUD.profile.company_id}/${CLOUD.profile.id}/${rand}.${ext}`;
    const { error } = await window.sb.storage.from('attachments')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (error) throw new Error(error.message);
    const { data } = window.sb.storage.from('attachments').getPublicUrl(path);
    return { name: file.name, url: data.publicUrl, type: file.type || '', size: file.size, path };
  };

  CLOUD.deleteAttachment = async function (path) {
    if (!CLOUD.ready || !path) return;
    try { await window.sb.storage.from('attachments').remove([path]); }
    catch (e) { console.warn('[cloud] deleteAttachment', e); }
  };

  window.CLOUD = CLOUD;
})();
