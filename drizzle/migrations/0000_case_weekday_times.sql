ALTER TABLE public.cases ADD COLUMN recurring_times jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.cases.recurring_times IS 'Per-weekday HH:MM times keyed by weekday 0..6; missing keys use recurring_time for legacy compatibility.';
ALTER TABLE public.cases ADD CONSTRAINT cases_recurring_times_object CHECK (jsonb_typeof(recurring_times) = 'object');
CREATE OR REPLACE FUNCTION public.validate_case_recurring_times() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE entry record;
BEGIN
  FOR entry IN SELECT key, value FROM jsonb_each_text(NEW.recurring_times) LOOP
    IF entry.key !~ '^[0-6]$' OR entry.value !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
      RAISE EXCEPTION 'Invalid weekday appointment time';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER cases_validate_recurring_times BEFORE INSERT OR UPDATE OF recurring_times ON public.cases FOR EACH ROW EXECUTE FUNCTION public.validate_case_recurring_times();
CREATE OR REPLACE FUNCTION public.generate_case_appointments(_case_id uuid, _until date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.cases;
  d date;
  inserted_count integer := 0;
  kind text;
  sub text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'supervisor') OR
    EXISTS (SELECT 1 FROM public.cases WHERE id = _case_id AND specialist_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO c FROM public.cases WHERE id = _case_id;
  IF NOT FOUND OR NOT c.active THEN RETURN 0; END IF;
  kind := COALESCE(c.default_session_kind, 'regular');
  sub := c.default_session_subtype;
  d := GREATEST(c.start_date, (now() AT TIME ZONE 'UTC')::date);
  WHILE d <= _until LOOP
    IF EXTRACT(DOW FROM d)::smallint = ANY(c.recurring_days) THEN
      INSERT INTO public.appointments (
        case_name, case_whatsapp, specialist_id, scheduled_date, scheduled_time,
        duration_minutes, cost, specialist_percentage, status, session_kind,
        session_type, test_type, case_id, created_by, payment_type, discount_percentage
      ) VALUES (
        c.name, c.whatsapp, c.specialist_id, d,
        COALESCE((c.recurring_times ->> (EXTRACT(DOW FROM d)::integer)::text)::time, c.recurring_time),
        c.default_duration_minutes, c.default_cost, c.default_specialist_percentage,
        'scheduled', kind,
        CASE WHEN kind = 'test' THEN NULL ELSE sub END,
        CASE WHEN kind = 'test' THEN sub ELSE NULL END,
        c.id, c.created_by,
        COALESCE(c.payment_type, 'per_session'), COALESCE(c.discount_percentage, 0)
      )
      ON CONFLICT (case_id, scheduled_date, scheduled_time) WHERE case_id IS NOT NULL DO NOTHING;
      IF FOUND THEN inserted_count := inserted_count + 1; END IF;
    END IF;
    d := d + 1;
  END LOOP;
  RETURN inserted_count;
END;
$function$;