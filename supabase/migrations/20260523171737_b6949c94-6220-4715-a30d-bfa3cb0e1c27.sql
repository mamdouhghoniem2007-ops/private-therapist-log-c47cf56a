
-- Attendance table for staff check-in/check-out
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  check_in timestamptz,
  check_out timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

CREATE INDEX idx_attendance_user_date ON public.attendance(user_id, work_date DESC);
CREATE INDEX idx_attendance_date ON public.attendance(work_date DESC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Users view own
CREATE POLICY "Users view own attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins / supervisors view all
CREATE POLICY "Admins view all attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors view all attendance"
  ON public.attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Users insert own
CREATE POLICY "Users insert own attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users update own
CREATE POLICY "Users update own attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Admins manage all
CREATE POLICY "Admins update any attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert any attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
