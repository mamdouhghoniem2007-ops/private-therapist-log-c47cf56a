ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS counter_base_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS counter_start_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  ADD COLUMN IF NOT EXISTS sessions_per_cycle integer NOT NULL DEFAULT 8;