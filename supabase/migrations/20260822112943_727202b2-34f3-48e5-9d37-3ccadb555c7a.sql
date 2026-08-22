INSERT INTO public.appointments (
  case_name, case_whatsapp, specialist_id, scheduled_date, scheduled_time,
  duration_minutes, cost, specialist_percentage, status, session_kind,
  session_type, test_type, case_id, created_by, payment_type, discount_percentage
)
SELECT c.name, c.whatsapp, c.specialist_id, DATE '2026-08-22', c.recurring_time,
  c.default_duration_minutes, c.default_cost, c.default_specialist_percentage,
  'scheduled', COALESCE(c.default_session_kind,'regular'),
  CASE WHEN COALESCE(c.default_session_kind,'regular') = 'test' THEN NULL ELSE c.default_session_subtype END,
  CASE WHEN COALESCE(c.default_session_kind,'regular') = 'test' THEN c.default_session_subtype ELSE NULL END,
  c.id, c.created_by, COALESCE(c.payment_type,'per_session'), COALESCE(c.discount_percentage,0)
FROM public.cases c
WHERE c.id = '8d02a376-282a-44f1-a3ff-67f92822ba80'
  AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.case_id = c.id AND a.scheduled_date = DATE '2026-08-22');