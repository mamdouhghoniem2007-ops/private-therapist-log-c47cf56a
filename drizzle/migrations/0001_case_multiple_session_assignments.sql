ALTER TABLE public.cases ADD COLUMN recurring_sessions jsonb;
COMMENT ON COLUMN public.cases.recurring_sessions IS 'Array of {day,time,specialist_id} recurring sessions; NULL uses legacy weekday fields.';
CREATE OR REPLACE FUNCTION public.validate_case_recurring_sessions() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s jsonb; seen text[] := '{}'; slot text;
BEGIN
 IF NEW.recurring_sessions IS NULL THEN RETURN NEW; END IF;
 IF jsonb_typeof(NEW.recurring_sessions) <> 'array' THEN RAISE EXCEPTION 'Session schedule must be an array'; END IF;
 FOR s IN SELECT value FROM jsonb_array_elements(NEW.recurring_sessions) LOOP
  IF jsonb_typeof(s) <> 'object' OR COALESCE(s->>'day','') !~ '^[0-6]$' OR COALESCE(s->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR COALESCE(s->>'specialist_id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN RAISE EXCEPTION 'Each session needs weekday, time and specialist'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=(s->>'specialist_id')::uuid) THEN RAISE EXCEPTION 'Specialist not found'; END IF;
  slot := (s->>'day') || '|' || (s->>'time');
  IF slot=ANY(seen) THEN RAISE EXCEPTION 'Duplicate child appointment time'; END IF;
  seen := array_append(seen,slot);
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER cases_validate_recurring_sessions BEFORE INSERT OR UPDATE OF recurring_sessions ON public.cases FOR EACH ROW EXECUTE FUNCTION public.validate_case_recurring_sessions();
CREATE POLICY "Assigned session specialists view child file" ON public.cases FOR SELECT TO authenticated USING (recurring_sessions @> jsonb_build_array(jsonb_build_object('specialist_id',auth.uid()::text)));
CREATE OR REPLACE FUNCTION public.generate_case_appointments(_case_id uuid, _until date) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cases; d date; s jsonb; schedule jsonb; inserted_count integer := 0; kind text; sub text;
BEGIN
 SELECT * INTO c FROM public.cases WHERE id=_case_id;
 IF NOT FOUND THEN RETURN 0; END IF;
 IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR c.specialist_id=auth.uid() OR c.recurring_sessions @> jsonb_build_array(jsonb_build_object('specialist_id',auth.uid()::text))) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF NOT c.active THEN RETURN 0; END IF;
 schedule := c.recurring_sessions;
 IF schedule IS NULL THEN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day',dow,'time',to_char(COALESCE((c.recurring_times->>dow::text)::time,c.recurring_time),'HH24:MI'),'specialist_id',c.specialist_id)),'[]'::jsonb) INTO schedule FROM unnest(c.recurring_days) AS dow;
 END IF;
 kind:=COALESCE(c.default_session_kind,'regular'); sub:=c.default_session_subtype;
 d:=GREATEST(c.start_date,(now() AT TIME ZONE 'UTC')::date);
 WHILE d<=_until LOOP
  FOR s IN SELECT value FROM jsonb_array_elements(schedule) WHERE (value->>'day')::integer=EXTRACT(DOW FROM d)::integer LOOP
   INSERT INTO public.appointments (case_name,case_whatsapp,specialist_id,scheduled_date,scheduled_time,duration_minutes,cost,specialist_percentage,status,session_kind,session_type,test_type,case_id,created_by,payment_type,discount_percentage)
   VALUES (c.name,c.whatsapp,(s->>'specialist_id')::uuid,d,(s->>'time')::time,c.default_duration_minutes,c.default_cost,c.default_specialist_percentage,'scheduled',kind,CASE WHEN kind='test' THEN NULL ELSE sub END,CASE WHEN kind='test' THEN sub ELSE NULL END,c.id,c.created_by,COALESCE(c.payment_type,'per_session'),COALESCE(c.discount_percentage,0))
   ON CONFLICT (case_id,scheduled_date,scheduled_time) WHERE case_id IS NOT NULL DO NOTHING;
   IF FOUND THEN inserted_count:=inserted_count+1; END IF;
  END LOOP;
  d:=d+1;
 END LOOP;
 RETURN inserted_count;
END; $$;