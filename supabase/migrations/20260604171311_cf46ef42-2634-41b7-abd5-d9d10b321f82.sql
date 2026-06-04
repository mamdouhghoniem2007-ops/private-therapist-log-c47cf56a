
-- Fix 1: Restrict Realtime subscriptions to admins/supervisors
-- Specialists access their appointments via direct queries; broad realtime would leak other specialists' data.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated admins and supervisors can receive realtime" ON realtime.messages;
CREATE POLICY "Authenticated admins and supervisors can receive realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- Fix 2: Prevent specialists from changing financial fields on their own appointments
CREATE OR REPLACE FUNCTION public.appointments_guard_specialist_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'supervisor'::public.app_role) THEN
    RETURN NEW;
  END IF;

  -- Specialists: lock down financial / assignment fields
  NEW.cost := OLD.cost;
  NEW.specialist_percentage := OLD.specialist_percentage;
  NEW.discount_percentage := OLD.discount_percentage;
  NEW.payment_type := OLD.payment_type;
  NEW.specialist_id := OLD.specialist_id;
  NEW.case_id := OLD.case_id;
  NEW.created_by := OLD.created_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_guard_specialist_updates_trg ON public.appointments;
CREATE TRIGGER appointments_guard_specialist_updates_trg
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.appointments_guard_specialist_updates();

-- Fix 3: Hardening — restrictive policy so only admins can write user_roles,
-- even if a future permissive policy is added by mistake.
DROP POLICY IF EXISTS "Only admins can write user_roles (restrictive)" ON public.user_roles;
CREATE POLICY "Only admins can write user_roles (restrictive)"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
