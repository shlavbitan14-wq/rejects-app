-- =====================================================================
-- schema_leads.sql — טבלת לידים + עדכונים ל-doc_shares.
-- הרץ ב-Supabase SQL Editor.
-- =====================================================================

-- ── טבלת לידים (בקשות גישה מהדף הנחיתה) ──
CREATE TABLE IF NOT EXISTS public.leads (
  id           uuid      DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name    text      NOT NULL,
  email        text      NOT NULL,
  company_name text      NOT NULL,
  phone        text,
  industry     text      DEFAULT 'construction',
  team_size    text      DEFAULT '1',
  message      text,
  status       text      DEFAULT 'new',   -- new | contacted | converted | rejected
  notes        text,                       -- הערות פנימיות של אדמין
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- כל אחד (כולל אורח) יכול להוסיף ליד
DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- רק super_admin יכול לקרוא ולעדכן
DROP POLICY IF EXISTS "Super admin manages leads" ON public.leads;
CREATE POLICY "Super admin manages leads"
  ON public.leads FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- trigger לעדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── עדכון doc_shares — הוספת שיתוף חיצוני ──
ALTER TABLE public.doc_shares
  ADD COLUMN IF NOT EXISTS external_token text UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shared_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS permission text DEFAULT 'view'; -- view | edit

-- RLS updates for doc_shares
ALTER TABLE public.doc_shares ENABLE ROW LEVEL SECURITY;

-- בעל הדוח יכול לשתף
DROP POLICY IF EXISTS "Owner can share" ON public.doc_shares;
CREATE POLICY "Owner can share"
  ON public.doc_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = doc_shares.workspace_id
        AND w.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = doc_shares.workspace_id
        AND w.owner_id = auth.uid()
    )
  );

-- מנהל בחברה יכול לראות שיתופים של הצוות
DROP POLICY IF EXISTS "Manager sees company shares" ON public.doc_shares;
CREATE POLICY "Manager sees company shares"
  ON public.doc_shares FOR SELECT
  USING (
    my_role() = 'manager' AND
    EXISTS (
      SELECT 1 FROM public.workspaces w
      JOIN public.profiles p ON p.id = w.owner_id
      WHERE w.id = doc_shares.workspace_id
        AND p.company_id = my_company_id()
    )
  );

-- משתמש שאיתו שותף הדוח יכול לראות
DROP POLICY IF EXISTS "Recipient can view share" ON public.doc_shares;
CREATE POLICY "Recipient can view share"
  ON public.doc_shares FOR SELECT
  USING (shared_with = auth.uid());

-- super_admin יכול הכל
DROP POLICY IF EXISTS "Super admin full doc_shares" ON public.doc_shares;
CREATE POLICY "Super admin full doc_shares"
  ON public.doc_shares FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());


-- ── RPCs ──

-- מנהל מושך את כל workspaces של החברה שלו
CREATE OR REPLACE FUNCTION public.get_company_workspaces()
RETURNS TABLE (
  workspace_id  uuid,
  owner_id      uuid,
  owner_name    text,
  owner_email   text,
  project_id    text,
  report_id     text,
  title         text,
  updated_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF my_role() NOT IN ('manager', 'super_admin') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  RETURN QUERY
    SELECT
      w.id,
      w.owner_id,
      p.full_name,
      p.email,
      w.project_id,
      w.report_id,
      COALESCE((w.data->>'title'), 'ללא שם') AS title,
      w.updated_at
    FROM public.workspaces w
    JOIN public.profiles p ON p.id = w.owner_id
    WHERE p.company_id = my_company_id()
    ORDER BY w.updated_at DESC;
END;
$$;

-- RPC: שתף מסמך עם משתמש בחברה
CREATE OR REPLACE FUNCTION public.share_workspace(
  p_workspace_id  uuid,
  p_target_user   uuid,
  p_permission    text DEFAULT 'view'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- וודא שהמשתמש הנוכחי הוא בעל הדוח או מנהל בחברה
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND (w.owner_id = auth.uid() OR my_role() = 'manager' OR is_super_admin())
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  INSERT INTO public.doc_shares (workspace_id, shared_with, shared_by, permission)
  VALUES (p_workspace_id, p_target_user, auth.uid(), p_permission)
  ON CONFLICT (workspace_id, shared_with) DO UPDATE
    SET permission = EXCLUDED.permission, updated_at = now();
END;
$$;

-- RPC: קבל רשימת מסמכים שמשותפים איתי
CREATE OR REPLACE FUNCTION public.get_shared_with_me()
RETURNS TABLE (
  workspace_id  uuid,
  owner_name    text,
  project_id    text,
  report_id     text,
  title         text,
  permission    text,
  shared_at     timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT
      w.id,
      p.full_name,
      w.project_id,
      w.report_id,
      COALESCE((w.data->>'title'), 'ללא שם') AS title,
      ds.permission,
      ds.created_at
    FROM public.doc_shares ds
    JOIN public.workspaces w ON w.id = ds.workspace_id
    JOIN public.profiles p ON p.id = w.owner_id
    WHERE ds.shared_with = auth.uid()
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
    ORDER BY ds.created_at DESC;
END;
$$;

-- RPC: צור לינק שיתוף חיצוני
CREATE OR REPLACE FUNCTION public.create_external_share(
  p_workspace_id uuid,
  p_days         int DEFAULT 30
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token text;
BEGIN
  -- וודא גישה
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND (w.owner_id = auth.uid() OR my_role() = 'manager' OR is_super_admin())
  ) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  -- generate token
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  INSERT INTO public.doc_shares (workspace_id, shared_with, shared_by, permission, external_token, expires_at)
  VALUES (p_workspace_id, NULL, auth.uid(), 'view', v_token, now() + (p_days || ' days')::interval)
  ON CONFLICT (external_token) DO NOTHING;
  RETURN v_token;
END;
$$;

-- RPC: קבל נתוני workspace לפי external_token (ללא auth)
CREATE OR REPLACE FUNCTION public.get_workspace_by_token(p_token text)
RETURNS TABLE (
  workspace_id uuid,
  data         jsonb,
  title        text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT w.id, w.data, COALESCE((w.data->>'title'), 'ללא שם')
    FROM public.doc_shares ds
    JOIN public.workspaces w ON w.id = ds.workspace_id
    WHERE ds.external_token = p_token
      AND (ds.expires_at IS NULL OR ds.expires_at > now())
    LIMIT 1;
END;
$$;

-- admin RPC: עדכון סטטוס ליד
CREATE OR REPLACE FUNCTION public.admin_update_lead(
  p_lead_id uuid,
  p_status  text,
  p_notes   text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'access denied'; END IF;
  UPDATE public.leads
    SET status = p_status,
        notes = COALESCE(p_notes, notes),
        updated_at = now()
  WHERE id = p_lead_id;
END;
$$;

-- count new leads (for admin badge)
CREATE OR REPLACE FUNCTION public.admin_count_new_leads()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'access denied'; END IF;
  RETURN (SELECT count(*) FROM public.leads WHERE status = 'new');
END;
$$;
