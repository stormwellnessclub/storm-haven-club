-- 1) Restrict manager_refund_code column access
REVOKE SELECT (manager_refund_code) ON public.profiles FROM authenticated;
REVOKE SELECT (manager_refund_code) ON public.profiles FROM anon;

-- Re-grant only to service_role (used by edge functions / admin RPCs)
GRANT SELECT (manager_refund_code) ON public.profiles TO service_role;

-- 2) Validation RPC: returns true if provided code matches any admin/super_admin's manager_refund_code
CREATE OR REPLACE FUNCTION public.validate_manager_refund_code(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.manager_refund_code IS NOT NULL
      AND p.manager_refund_code = _code
      AND ur.role IN ('admin'::app_role, 'super_admin'::app_role)
  );
$$;

REVOKE ALL ON FUNCTION public.validate_manager_refund_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_manager_refund_code(text) TO authenticated;

-- 3) Make member-photos bucket private (objects only served via signed URLs / RLS)
UPDATE storage.buckets SET public = false WHERE id = 'member-photos';
