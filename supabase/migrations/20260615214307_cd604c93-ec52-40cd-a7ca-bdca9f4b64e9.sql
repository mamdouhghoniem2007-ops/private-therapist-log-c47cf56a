DROP POLICY IF EXISTS "availability: admin/supervisor full" ON public.specialist_availability;
DROP POLICY IF EXISTS "availability: specialist read own" ON public.specialist_availability;

CREATE POLICY "availability: admin/supervisor full"
  ON public.specialist_availability
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "availability: specialist read own"
  ON public.specialist_availability
  FOR SELECT
  TO authenticated
  USING (specialist_id = auth.uid());