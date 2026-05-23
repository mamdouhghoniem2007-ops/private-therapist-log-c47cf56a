
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS test_type text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS test_type text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cost numeric;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS specialist_percentage numeric NOT NULL DEFAULT 50;
