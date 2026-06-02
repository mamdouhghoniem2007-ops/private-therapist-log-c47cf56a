CREATE OR REPLACE FUNCTION public.cases_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.active THEN
    -- Remove future, still-scheduled (un-started) appointments for this case
    -- so that edits to time / days / specialist don't leave behind duplicates.
    DELETE FROM public.appointments
    WHERE case_id = NEW.id
      AND status = 'scheduled'
      AND started_at IS NULL
      AND scheduled_date >= (now() AT TIME ZONE 'UTC')::date;

    PERFORM public.generate_case_appointments(NEW.id, (now() AT TIME ZONE 'UTC')::date + 56);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS cases_after_change_trg ON public.cases;
CREATE TRIGGER cases_after_change_trg
AFTER INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.cases_after_change();