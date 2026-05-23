
ALTER TABLE public.appointments
  ADD COLUMN started_at timestamptz,
  ADD COLUMN ended_at timestamptz;
