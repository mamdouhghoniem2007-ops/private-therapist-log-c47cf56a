-- 1) Update cases_after_change trigger: deactivation deletes future scheduled appointments
CREATE OR REPLACE FUNCTION public.cases_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.active THEN
    DELETE FROM public.appointments
    WHERE case_id = NEW.id
      AND status = 'scheduled'
      AND started_at IS NULL
      AND scheduled_date >= (now() AT TIME ZONE 'UTC')::date;

    PERFORM public.generate_case_appointments(NEW.id, (now() AT TIME ZONE 'UTC')::date + 56);
  ELSE
    -- Deactivated: remove all future un-started appointments so they disappear from schedule
    DELETE FROM public.appointments
    WHERE case_id = NEW.id
      AND status = 'scheduled'
      AND started_at IS NULL
      AND scheduled_date >= (now() AT TIME ZONE 'UTC')::date;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Specialist availability table (weekly recurring time windows)
CREATE TABLE IF NOT EXISTS public.specialist_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  specialist_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialist_availability TO authenticated;
GRANT ALL ON public.specialist_availability TO service_role;

ALTER TABLE public.specialist_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability: admin/supervisor full"
  ON public.specialist_availability FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

CREATE POLICY "availability: specialist read own"
  ON public.specialist_availability FOR SELECT
  USING (specialist_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_specialist_availability_spec ON public.specialist_availability(specialist_id, day_of_week);