CREATE OR REPLACE FUNCTION public.sessions_guard_specialist_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sessions_guard_specialist_updates_trg ON public.sessions;
CREATE TRIGGER sessions_guard_specialist_updates_trg
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.sessions_guard_specialist_updates();