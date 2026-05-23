
-- Supervisor can manage appointments (insert/update/delete)
CREATE POLICY "Supervisors insert appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors update appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors delete appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Supervisors view all appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));

-- Supervisor needs to see specialist names to assign appointments
CREATE POLICY "Supervisors view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'supervisor'));
