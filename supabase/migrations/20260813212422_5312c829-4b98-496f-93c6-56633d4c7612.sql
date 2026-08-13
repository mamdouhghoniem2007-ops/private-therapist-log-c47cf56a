CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  case_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  method text NOT NULL DEFAULT 'cash',
  period_from date,
  period_to date,
  notes text,
  receipt_no bigint GENERATED ALWAYS AS IDENTITY,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX payments_case_id_idx ON public.payments (case_id, paid_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Supervisors manage payments" ON public.payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'::public.app_role));

CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();