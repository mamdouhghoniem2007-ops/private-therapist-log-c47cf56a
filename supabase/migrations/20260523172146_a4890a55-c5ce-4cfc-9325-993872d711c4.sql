
CREATE POLICY "Specialists update own appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (auth.uid() = specialist_id);
