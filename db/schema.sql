-- ============================================================================
--  rejects-app · סכמת מולטי-טננט ל-Supabase
--  הדבק את כל הקובץ ב-Supabase → SQL Editor → New query → Run.
--  בטוח להריץ שוב (idempotent).
--
--  מבנה:
--    companies   — חברות (טננטים). כל חברה = סביבה מבודדת.
--    profiles    — פרופיל לכל משתמש (auth.users), משויך לחברה + תפקיד.
--    workspaces  — "שולחן העבודה" של כל מהנדס: כל הפרויקטים/דוחות כ-JSON.
--    storage     — דלי 'attachments' לשרטוטים/תוכניות.
--
--  הרשאות (RLS):
--    מהנדס רואה/עורך רק את עצמו. מנהל רואה את כל המהנדסים בחברה שלו.
--    אף אחד לא רואה חברה אחרת — נאכף ברמת בסיס הנתונים.
-- ============================================================================

-- ---------- טבלאות ----------
create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  license_status  text not null default 'trial',   -- trial | active | suspended
  license_expires date,
  max_engineers   int  not null default 5,
  created_at      timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete set null,
  role        text not null default 'engineer',     -- manager | engineer | super_admin
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.workspaces (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete cascade,
  data        jsonb not null default '{"projects":[]}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------- פונקציות עזר (SECURITY DEFINER — נמנעות מרקורסיית RLS) ----------
create or replace function public.my_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- הקמת חברה חדשה + הפיכת המשתמש הנוכחי למנהל שלה. נקרא פעם אחת אחרי הרשמה.
create or replace function public.bootstrap_company(company_name text, manager_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  -- אם כבר משויך לחברה — החזר אותה (לא יוצר כפילות)
  select company_id into cid from public.profiles where id = auth.uid() and company_id is not null;
  if cid is not null then return cid; end if;

  insert into public.companies(name) values (company_name) returning id into cid;

  insert into public.profiles(id, company_id, role, full_name, email)
    values (auth.uid(), cid, 'manager', manager_name,
            (select email from auth.users where id = auth.uid()))
  on conflict (id) do update set company_id = cid, role = 'manager', full_name = manager_name;

  insert into public.workspaces(user_id, company_id) values (auth.uid(), cid)
  on conflict (user_id) do update set company_id = cid;

  return cid;
end $$;

-- ---------- הפעלת RLS ----------
alter table public.companies  enable row level security;
alter table public.profiles   enable row level security;
alter table public.workspaces enable row level security;

-- companies: חברי החברה רואים את החברה שלהם; מנהל יכול לעדכן.
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (id = public.my_company_id());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using (id = public.my_company_id() and public.my_role() = 'manager');

-- profiles: רואים את עצמך + את כל מי שבחברה שלך. עורכים רק את עצמך.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or company_id = public.my_company_id());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid());

-- workspaces: מהנדס — רק שלו. מנהל — קריאה של כל הסביבות בחברה.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces for select to authenticated
  using (user_id = auth.uid()
         or (company_id = public.my_company_id() and public.my_role() in ('manager','super_admin')));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (user_id = auth.uid() and company_id = public.my_company_id());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces for update to authenticated
  using (user_id = auth.uid());

-- ---------- אחסון: דלי לשרטוטים/תוכניות ----------
-- ציבורי לקריאה (קישור קבוע, נוח להטמעה ב-PDF). שמות קבצים אקראיים.
-- העלאה/מחיקה מוגבלות לחברי החברה בלבד (לפי תיקיית company_id).
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', true)
on conflict (id) do update set public = true;

drop policy if exists att_insert on storage.objects;
create policy att_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and (storage.foldername(name))[1] = public.my_company_id()::text);

drop policy if exists att_delete on storage.objects;
create policy att_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments'
         and (storage.foldername(name))[1] = public.my_company_id()::text);

-- ============================================================================
--  סיום. עכשיו אפשר להירשם מהאפליקציה — המשתמש הראשון של כל חברה הופך למנהל.
-- ============================================================================
