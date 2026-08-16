CREATE TABLE public.case_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  child_name text NOT NULL,
  specialist_id uuid,
  status text NOT NULL DEFAULT 'draft',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_studies TO authenticated;
GRANT ALL ON public.case_studies TO service_role;

ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage case studies" ON public.case_studies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Supervisors manage case studies" ON public.case_studies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'::public.app_role));

CREATE POLICY "Specialists view own case studies" ON public.case_studies FOR SELECT TO authenticated
  USING (specialist_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Specialists insert case studies" ON public.case_studies FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Specialists update own case studies" ON public.case_studies FOR UPDATE TO authenticated
  USING (specialist_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (specialist_id = auth.uid() OR created_by = auth.uid());

CREATE TRIGGER case_studies_set_updated_at BEFORE UPDATE ON public.case_studies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();