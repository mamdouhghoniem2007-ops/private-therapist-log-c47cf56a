
-- Add session_type to existing sessions
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_type text;

-- Appointments (schedule) table — created by admin for specialists
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_name text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45,
  session_type text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_specialist_date
  ON public.appointments (specialist_id, scheduled_date);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Specialist can view own appointments
CREATE POLICY "Specialists view own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (auth.uid() = specialist_id OR public.has_role(auth.uid(), 'admin'));

-- Only admin can insert/update/delete appointments
CREATE POLICY "Admins insert appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
