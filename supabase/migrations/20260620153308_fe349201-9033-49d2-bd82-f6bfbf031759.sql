ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS cases_archived_idx ON public.cases(archived);