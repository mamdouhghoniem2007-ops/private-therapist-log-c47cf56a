
DROP POLICY IF EXISTS "Admins insert cases" ON public.cases;
DROP POLICY IF EXISTS "Admins update cases" ON public.cases;
DROP POLICY IF EXISTS "Admins delete cases" ON public.cases;

CREATE POLICY "Admins insert cases" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update cases" ON public.cases
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete cases" ON public.cases
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Supervisors view all sessions" ON public.sessions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'supervisor'::app_role));
