ALTER TABLE public.cases ADD COLUMN default_session_kind text NOT NULL DEFAULT 'regular';

CREATE OR REPLACE FUNCTION public.generate_case_appointments(_case_id uuid, _until date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.cases;
  d date;
  inserted_count integer := 0;
BEGIN
  IF NOT (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'supervisor') OR
    EXISTS (SELECT 1 FROM public.cases WHERE id = _case_id AND specialist_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO c FROM public.cases WHERE id = _case_id;
  IF NOT FOUND OR NOT c.active THEN
    RETURN 0;
  END IF;

  d := GREATEST(c.start_date, (now() AT TIME ZONE 'UTC')::date);
  WHILE d <= _until LOOP
    IF EXTRACT(DOW FROM d)::smallint = ANY(c.recurring_days) THEN
      INSERT INTO public.appointments (
        case_name, case_whatsapp, specialist_id, scheduled_date, scheduled_time,
        duration_minutes, cost, specialist_percentage, status, session_kind, case_id, created_by
      ) VALUES (
        c.name, c.whatsapp, c.specialist_id, d, c.recurring_time,
        c.default_duration_minutes, c.default_cost, c.default_specialist_percentage,
        'scheduled', COALESCE(c.default_session_kind,'regular'), c.id, c.created_by
      )
      ON CONFLICT (case_id, scheduled_date, scheduled_time) WHERE case_id IS NOT NULL DO NOTHING;
      IF FOUND THEN inserted_count := inserted_count + 1; END IF;
    END IF;
    d := d + 1;
  END LOOP;

  RETURN inserted_count;
END;
$function$;