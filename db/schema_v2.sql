-- ============================================================================
--  schema_v2.sql — הרחבת מערכת: super_admin · רישוי · הזמנות · שיתוף מסמכים
--  הרץ אחרי schema.sql (idempotent — בטוח להריץ שוב).
--  Supabase → SQL Editor → New query → הדבק הכל → Run
-- ============================================================================

-- ---------- helper: is_super_admin ----------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- ---------- טבלת רישיון ----------
CREATE TABLE IF NOT EXISTS public.licenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan          text NOT NULL DEFAULT 'trial',    -- trial | starter | pro | enterprise
  status        text NOT NULL DEFAULT 'active',   -- active | suspended | expired
  max_engineers int  NOT NULL DEFAULT 3,
  max_projects  int  NOT NULL DEFAULT 20,
  expires_at    timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------- טבלת הזמנות ----------
CREATE TABLE IF NOT EXISTS public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'engineer',
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token       text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- שיתוף מסמכים בין מהנדסים ----------
CREATE TABLE IF NOT EXISTS public.doc_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  proj_id       text NOT NULL,
  report_id     text NOT NULL,
  report_title  text,
  permission    text NOT NULL DEFAULT 'view',     -- view | edit
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, proj_id, report_id)
);

-- ---------- RLS ----------
ALTER TABLE public.licenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_shares  ENABLE ROW LEVEL SECURITY;

-- licenses
DROP POLICY IF EXISTS licenses_select        ON public.licenses;
DROP POLICY IF EXISTS licenses_superadmin    ON public.licenses;
CREATE POLICY licenses_select ON public.licenses FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() OR public.is_super_admin());
CREATE POLICY licenses_superadmin ON public.licenses FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- invitations
DROP POLICY IF EXISTS inv_select ON public.invitations;
DROP POLICY IF EXISTS inv_insert ON public.invitations;
DROP POLICY IF EXISTS inv_delete ON public.invitations;
CREATE POLICY inv_select ON public.invitations FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() OR public.is_super_admin());
CREATE POLICY inv_insert ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    (company_id = public.my_company_id() AND public.my_role() IN ('manager','super_admin'))
    OR public.is_super_admin()
  );
CREATE POLICY inv_delete ON public.invitations FOR DELETE TO authenticated
  USING (
    (company_id = public.my_company_id() AND public.my_role() IN ('manager','super_admin'))
    OR public.is_super_admin()
  );

-- doc_shares
DROP POLICY IF EXISTS ds_select ON public.doc_shares;
DROP POLICY IF EXISTS ds_insert ON public.doc_shares;
DROP POLICY IF EXISTS ds_delete ON public.doc_shares;
CREATE POLICY ds_select ON public.doc_shares FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY ds_insert ON public.doc_shares FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid() AND company_id = public.my_company_id());
CREATE POLICY ds_delete ON public.doc_shares FOR DELETE TO authenticated
  USING (from_user_id = auth.uid() OR public.is_super_admin());

-- ---------- עדכון מדיניות קיימות: הוסף super_admin bypass ----------

-- companies
DROP POLICY IF EXISTS companies_select        ON public.companies;
DROP POLICY IF EXISTS companies_update        ON public.companies;
DROP POLICY IF EXISTS companies_insert_sa     ON public.companies;
DROP POLICY IF EXISTS companies_delete_sa     ON public.companies;
CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated
  USING (id = public.my_company_id() OR public.is_super_admin());
CREATE POLICY companies_insert_sa ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY companies_update ON public.companies FOR UPDATE TO authenticated
  USING ((id = public.my_company_id() AND public.my_role() = 'manager') OR public.is_super_admin());
CREATE POLICY companies_delete_sa ON public.companies FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- profiles
DROP POLICY IF EXISTS profiles_select  ON public.profiles;
DROP POLICY IF EXISTS profiles_update  ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR company_id = public.my_company_id() OR public.is_super_admin());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (public.my_role() IN ('manager','super_admin') AND company_id = public.my_company_id())
    OR public.is_super_admin()
  );

-- workspaces
DROP POLICY IF EXISTS workspaces_select ON public.workspaces;
CREATE POLICY workspaces_select ON public.workspaces FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (company_id = public.my_company_id() AND public.my_role() IN ('manager','super_admin'))
    OR public.is_super_admin()
  );

-- ============================================================================
--  פונקציות ניהול (SECURITY DEFINER)
-- ============================================================================

-- יצירת חברה + רישיון (רק super_admin)
CREATE OR REPLACE FUNCTION public.admin_create_company(
  p_name       text,
  p_plan       text        DEFAULT 'trial',
  p_max_eng    int         DEFAULT 5,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.companies(name, license_status, max_engineers)
    VALUES (p_name, p_plan, p_max_eng) RETURNING id INTO cid;
  INSERT INTO public.licenses(company_id, plan, status, max_engineers, expires_at)
    VALUES (cid, p_plan, 'active', p_max_eng, p_expires_at);
  RETURN jsonb_build_object('company_id', cid);
END $$;

-- עדכון רישיון (רק super_admin)
CREATE OR REPLACE FUNCTION public.admin_update_license(
  p_company_id uuid,
  p_plan       text,
  p_status     text,
  p_max_eng    int,
  p_expires_at timestamptz DEFAULT NULL,
  p_notes      text        DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.licenses(company_id, plan, status, max_engineers, expires_at, notes)
    VALUES (p_company_id, p_plan, p_status, p_max_eng, p_expires_at, p_notes)
    ON CONFLICT (company_id) DO UPDATE
      SET plan=p_plan, status=p_status, max_engineers=p_max_eng,
          expires_at=p_expires_at, notes=COALESCE(p_notes, licenses.notes),
          updated_at=now();
  UPDATE public.companies
    SET license_status=p_plan, max_engineers=p_max_eng
    WHERE id = p_company_id;
END $$;

-- מחיקת חברה + כל הנתונים (רק super_admin)
CREATE OR REPLACE FUNCTION public.admin_delete_company(p_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  -- ניתוק משתמשים מהחברה (לא מוחקים אותם)
  UPDATE public.profiles SET company_id = NULL, role = 'engineer' WHERE company_id = p_company_id;
  DELETE FROM public.workspaces WHERE company_id = p_company_id;
  DELETE FROM public.companies WHERE id = p_company_id;
END $$;

-- סטטיסטיקות למנהל מערכת
CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN (SELECT jsonb_build_object(
    'total_companies', (SELECT count(*) FROM public.companies),
    'total_users',     (SELECT count(*) FROM public.profiles WHERE role <> 'super_admin'),
    'active_licenses', (SELECT count(*) FROM public.licenses WHERE status = 'active'),
    'trial_licenses',  (SELECT count(*) FROM public.licenses WHERE plan = 'trial'),
    'expiring_soon',   (SELECT count(*) FROM public.licenses
                         WHERE status='active' AND expires_at IS NOT NULL
                           AND expires_at BETWEEN now() AND now() + interval '30 days')
  ));
END $$;

-- רשימת כל החברות עם מטה-נתונים (רק super_admin)
CREATE OR REPLACE FUNCTION public.admin_list_companies()
RETURNS TABLE(
  id            uuid,
  name          text,
  created_at    timestamptz,
  plan          text,
  lic_status    text,
  max_engineers int,
  expires_at    timestamptz,
  notes         text,
  eng_count     bigint,
  mgr_count     bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.created_at,
           COALESCE(l.plan,'trial'), COALESCE(l.status,'active'),
           COALESCE(l.max_engineers,3), l.expires_at, l.notes,
           (SELECT count(*) FROM public.profiles p WHERE p.company_id=c.id AND p.role='engineer'),
           (SELECT count(*) FROM public.profiles p WHERE p.company_id=c.id AND p.role='manager')
    FROM public.companies c
    LEFT JOIN public.licenses l ON l.company_id=c.id
    ORDER BY c.created_at DESC;
END $$;

-- רשימת חברי חברה (מנהל + super_admin)
CREATE OR REPLACE FUNCTION public.list_company_members(p_company_id uuid)
RETURNS TABLE(id uuid, full_name text, email text, role text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin()
          OR (public.my_role() IN ('manager','super_admin') AND public.my_company_id()=p_company_id))
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  RETURN QUERY
    SELECT p.id, COALESCE(p.full_name,'—'), COALESCE(p.email,'—'), p.role, p.created_at
    FROM public.profiles p WHERE p.company_id=p_company_id
    ORDER BY p.role='manager' DESC, p.full_name;
END $$;

-- שינוי תפקיד משתמש (מנהל + super_admin)
CREATE OR REPLACE FUNCTION public.set_member_role(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_company uuid;
BEGIN
  SELECT company_id INTO target_company FROM public.profiles WHERE id=p_user_id;
  IF NOT (public.is_super_admin()
          OR (public.my_role()='manager' AND public.my_company_id()=target_company))
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET role=p_role WHERE id=p_user_id;
END $$;

-- הסרת משתמש מחברה (מנהל + super_admin)
CREATE OR REPLACE FUNCTION public.remove_member(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_company uuid;
BEGIN
  SELECT company_id INTO target_company FROM public.profiles WHERE id=p_user_id;
  IF NOT (public.is_super_admin()
          OR (public.my_role()='manager' AND public.my_company_id()=target_company))
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.profiles SET company_id=NULL, role='engineer' WHERE id=p_user_id;
  DELETE FROM public.workspaces WHERE user_id=p_user_id AND company_id=target_company;
END $$;

-- יצירת קישור הזמנה (מנהל + super_admin)
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_company_id uuid,
  p_email      text,
  p_role       text DEFAULT 'engineer'
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tok text;
BEGIN
  IF NOT (public.is_super_admin()
          OR (public.my_role() IN ('manager','super_admin') AND public.my_company_id()=p_company_id))
  THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.invitations WHERE company_id=p_company_id AND email=p_email;
  INSERT INTO public.invitations(company_id, email, role, invited_by)
    VALUES (p_company_id, p_email, p_role, auth.uid())
    RETURNING token INTO tok;
  RETURN tok;
END $$;

-- קבלת הזמנה (בעת הרשמה / כניסה)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD;
BEGIN
  SELECT * INTO inv FROM public.invitations
    WHERE token=p_token AND accepted_at IS NULL AND expires_at > now();
  IF inv IS NULL THEN RAISE EXCEPTION 'Invalid or expired invitation token'; END IF;
  INSERT INTO public.profiles(id, company_id, role, email)
    VALUES (auth.uid(), inv.company_id, inv.role, inv.email)
    ON CONFLICT (id) DO UPDATE
      SET company_id=inv.company_id, role=inv.role, email=EXCLUDED.email;
  INSERT INTO public.workspaces(user_id, company_id)
    VALUES (auth.uid(), inv.company_id)
    ON CONFLICT (user_id) DO UPDATE SET company_id=inv.company_id;
  UPDATE public.invitations SET accepted_at=now() WHERE id=inv.id;
  RETURN jsonb_build_object('company_id', inv.company_id, 'role', inv.role);
END $$;

-- ============================================================================
--  כדי להפוך את המשתמש הראשון שלך ל-super_admin, הרץ אחרי הרשמה:
--    UPDATE public.profiles SET role='super_admin', company_id=NULL
--    WHERE email='YOUR-EMAIL';
-- ============================================================================
