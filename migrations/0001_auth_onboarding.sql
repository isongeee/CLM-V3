-- Auth + onboarding helpers for Enterprise CLM
-- - Sync auth.users -> public.users
-- - RPCs for tenant onboarding:
--   - create_company_and_join(p_company_name text)
--   - join_company_by_invite_code(p_invite_code text)

BEGIN;

-- 1) Helpers to read claims safely (PostgREST sets request.jwt.claims)
CREATE OR REPLACE FUNCTION public.jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

-- 2) Ensure the logged-in user has a row in public.users (FK target for companies/company_users)
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_claims jsonb := public.jwt_claims();
  v_email text := NULLIF(btrim(COALESCE(v_claims->>'email', '')), '');
  v_full_name text := v_claims->'user_metadata'->>'full_name';
  v_avatar_url text := v_claims->'user_metadata'->>'avatar_url';
  v_user public.users;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;

  IF v_email IS NULL THEN
    SELECT NULLIF(btrim(COALESCE(u.email, '')), '')
    INTO v_email
    FROM auth.users u
    WHERE u.id = v_uid;
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Email missing from JWT claims' USING errcode = '22023';
  END IF;

  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (v_uid, v_email, NULLIF(btrim(v_full_name), ''), NULLIF(btrim(v_avatar_url), ''))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url)
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM PUBLIC;

-- 3) Trigger: keep public.users in sync when a new auth user signs up
CREATE OR REPLACE FUNCTION public.sync_public_user_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_user_from_auth() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_auth_users_sync_public_users ON auth.users;
CREATE TRIGGER trg_auth_users_sync_public_users
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_user_from_auth();

-- 4) RPC: create a company and ensure the creator is an admin member
CREATE OR REPLACE FUNCTION public.create_company_and_join(p_company_name text)
RETURNS TABLE (company_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies;
BEGIN
  PERFORM public.ensure_user_profile();

  IF p_company_name IS NULL OR btrim(p_company_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required' USING errcode = '22023';
  END IF;

  INSERT INTO public.companies (name, created_by_user_id)
  VALUES (btrim(p_company_name), auth.uid())
  RETURNING * INTO v_company;

  -- Ensure membership even if trg_add_creator_to_company_users is not present.
  INSERT INTO public.company_users (company_id, user_id, is_admin, is_active, joined_at)
  VALUES (v_company.id, auth.uid(), true, true, now())
  ON CONFLICT ON CONSTRAINT company_users_company_id_user_id_unique DO UPDATE
    SET is_admin = true,
        is_active = true,
        joined_at = COALESCE(public.company_users.joined_at, now());

  company_id := v_company.id;
  invite_code := v_company.invite_code;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_and_join(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_and_join(text) TO authenticated;

-- 5) RPC: join an existing company using companies.invite_code
CREATE OR REPLACE FUNCTION public.join_company_by_invite_code(p_invite_code text)
RETURNS TABLE (company_id uuid, company_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies;
  v_code text := lower(btrim(COALESCE(p_invite_code, '')));
BEGIN
  PERFORM public.ensure_user_profile();

  IF v_code = '' THEN
    RAISE EXCEPTION 'Invite code is required' USING errcode = '22023';
  END IF;

  SELECT *
  INTO v_company
  FROM public.companies c
  WHERE lower(c.invite_code) = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code' USING errcode = '22023';
  END IF;

  INSERT INTO public.company_users (company_id, user_id, is_admin, is_active, invited_at, joined_at)
  VALUES (v_company.id, auth.uid(), false, true, now(), now())
  ON CONFLICT ON CONSTRAINT company_users_company_id_user_id_unique DO UPDATE
    SET is_active = true,
        joined_at = COALESCE(public.company_users.joined_at, now());

  company_id := v_company.id;
  company_name := v_company.name;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_company_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_company_by_invite_code(text) TO authenticated;

COMMIT;
