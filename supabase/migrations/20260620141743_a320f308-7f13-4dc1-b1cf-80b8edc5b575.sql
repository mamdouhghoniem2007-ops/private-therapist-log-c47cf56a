
ALTER TABLE public.cases DISABLE TRIGGER cases_after_change_trg;
ALTER TABLE public.cases DISABLE TRIGGER cases_autogen;

INSERT INTO public.cases (id, name, whatsapp, specialist_id, recurring_days, recurring_time, default_duration_minutes, default_cost, default_specialist_percentage, start_date, active, created_by, default_session_kind, payment_type, discount_percentage)
VALUES ('0924fabc-a11d-4c8c-b9e7-e5b749d1b310', 'فهدشكشك', '+201004082684', '701a72df-a841-4ebb-8c99-4dfa7455f396', ARRAY[2,6]::smallint[], '17:00:00', 30, 100, 50, '2025-01-01', true, 'c8cec4e4-780e-4b61-90f2-4e49c50acccd', 'regular', 'per_session', 0);

UPDATE public.appointments
  SET case_id = '0924fabc-a11d-4c8c-b9e7-e5b749d1b310',
      specialist_id = '701a72df-a841-4ebb-8c99-4dfa7455f396'
  WHERE case_name = 'فهدشكشك' AND case_id IS NULL;

UPDATE public.appointments
  SET specialist_id = '701a72df-a841-4ebb-8c99-4dfa7455f396'
  WHERE case_id = '0924fabc-a11d-4c8c-b9e7-e5b749d1b310'
    AND specialist_id = '5c570afe-baae-4deb-b338-729b79a09b01';

ALTER TABLE public.cases ENABLE TRIGGER cases_after_change_trg;
ALTER TABLE public.cases ENABLE TRIGGER cases_autogen;
