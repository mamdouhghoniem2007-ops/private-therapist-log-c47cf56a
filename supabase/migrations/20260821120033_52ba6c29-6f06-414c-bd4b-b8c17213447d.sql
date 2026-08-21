CREATE OR REPLACE FUNCTION public.sync_birth_date_from_study()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b text;
BEGIN
  IF NEW.case_id IS NULL THEN RETURN NEW; END IF;
  b := NULLIF(NEW.data->'child'->>'birth_date','');
  IF b IS NOT NULL THEN
    UPDATE public.cases SET birth_date = b::date WHERE id = NEW.case_id
      AND (birth_date IS DISTINCT FROM b::date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS case_studies_sync_birth_date ON public.case_studies;
CREATE TRIGGER case_studies_sync_birth_date
AFTER INSERT OR UPDATE ON public.case_studies
FOR EACH ROW EXECUTE FUNCTION public.sync_birth_date_from_study();

CREATE OR REPLACE FUNCTION public.sync_birth_date_to_study()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.birth_date IS DISTINCT FROM OLD.birth_date) THEN
    UPDATE public.case_studies
      SET data = jsonb_set(
            COALESCE(data,'{}'::jsonb),
            '{child,birth_date}',
            to_jsonb(to_char(NEW.birth_date,'YYYY-MM-DD')),
            true)
      WHERE case_id = NEW.id
        AND COALESCE(data->'child'->>'birth_date','') IS DISTINCT FROM to_char(NEW.birth_date,'YYYY-MM-DD');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cases_sync_birth_date ON public.cases;
CREATE TRIGGER cases_sync_birth_date
AFTER INSERT OR UPDATE OF birth_date ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.sync_birth_date_to_study();

-- backfill: study -> case
UPDATE public.cases c
SET birth_date = (s.data->'child'->>'birth_date')::date
FROM public.case_studies s
WHERE s.case_id = c.id
  AND c.birth_date IS NULL
  AND NULLIF(s.data->'child'->>'birth_date','') IS NOT NULL;

-- backfill: case -> study
UPDATE public.case_studies s
SET data = jsonb_set(COALESCE(s.data,'{}'::jsonb), '{child,birth_date}', to_jsonb(to_char(c.birth_date,'YYYY-MM-DD')), true)
FROM public.cases c
WHERE s.case_id = c.id
  AND c.birth_date IS NOT NULL
  AND NULLIF(s.data->'child'->>'birth_date','') IS NULL;