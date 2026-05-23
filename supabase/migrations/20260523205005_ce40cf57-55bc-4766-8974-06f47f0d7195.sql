
-- Add session_kind and case_id to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_kind text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS case_id uuid;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_session_kind_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_session_kind_check
  CHECK (session_kind IN ('regular','initial_assessment','test','periodic_assessment'));

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text,
  specialist_id uuid NOT NULL,
  recurring_days smallint[] NOT NULL DEFAULT '{}',
  recurring_time time NOT NULL,
  default_duration_minutes integer NOT NULL DEFAULT 45,
  default_cost numeric NOT NULL DEFAULT 0,
  default_specialist_percentage numeric NOT NULL DEFAULT 50,
  start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cases_recurring_days_valid CHECK (
    recurring_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  )
);

CREATE INDEX IF NOT EXISTS idx_cases_specialist ON public.cases(specialist_id);

DROP TRIGGER IF EXISTS cases_set_updated_at ON public.cases;
CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Unique partial index so generation is idempotent for case-bound appointments
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_case_slot
  ON public.appointments(case_id, scheduled_date, scheduled_time)
  WHERE case_id IS NOT NULL;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Specialists view own cases" ON public.cases;
CREATE POLICY "Specialists view own cases" ON public.cases
  FOR SELECT TO authenticated
  USING (auth.uid() = specialist_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

DROP POLICY IF EXISTS "Admins insert cases" ON public.cases;
CREATE POLICY "Admins insert cases" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

DROP POLICY IF EXISTS "Admins update cases" ON public.cases;
CREATE POLICY "Admins update cases" ON public.cases
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

DROP POLICY IF EXISTS "Admins delete cases" ON public.cases;
CREATE POLICY "Admins delete cases" ON public.cases
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

-- Generator function
CREATE OR REPLACE FUNCTION public.generate_case_appointments(_case_id uuid, _until date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.cases;
  d date;
  inserted_count integer := 0;
BEGIN
  SELECT * INTO c FROM public.cases WHERE id = _case_id;
  IF NOT FOUND OR NOT c.active THEN
    RETURN 0;
  END IF;

  d := GREATEST(c.start_date, (now() AT TIME ZONE 'UTC')::date);
  WHILE d <= _until LOOP
    -- Postgres EXTRACT(DOW): 0=Sunday..6=Saturday
    IF EXTRACT(DOW FROM d)::smallint = ANY(c.recurring_days) THEN
      INSERT INTO public.appointments (
        case_name, case_whatsapp, specialist_id, scheduled_date, scheduled_time,
        duration_minutes, cost, specialist_percentage, status, session_kind, case_id, created_by
      ) VALUES (
        c.name, c.whatsapp, c.specialist_id, d, c.recurring_time,
        c.default_duration_minutes, c.default_cost, c.default_specialist_percentage,
        'scheduled', 'regular', c.id, c.created_by
      )
      ON CONFLICT (case_id, scheduled_date, scheduled_time) WHERE case_id IS NOT NULL DO NOTHING;
      IF FOUND THEN
        inserted_count := inserted_count + 1;
      END IF;
    END IF;
    d := d + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_case_appointments(uuid, date) TO authenticated;

-- Auto generate 8 weeks ahead when case is created/updated
CREATE OR REPLACE FUNCTION public.cases_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active THEN
    PERFORM public.generate_case_appointments(NEW.id, (now() AT TIME ZONE 'UTC')::date + 56);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_autogen ON public.cases;
CREATE TRIGGER cases_autogen
  AFTER INSERT OR UPDATE OF active, recurring_days, recurring_time, start_date, default_duration_minutes, default_cost, default_specialist_percentage, name, whatsapp, specialist_id
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.cases_after_change();
