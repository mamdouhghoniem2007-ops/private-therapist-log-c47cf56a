
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_number text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS case_whatsapp text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, whatsapp_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'whatsapp_number', '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN lower(NEW.email) = 'r3aya.chnnel@gmail.com' THEN 'admin'::app_role
         ELSE 'specialist'::app_role END
  );
  RETURN NEW;
END;
$function$;
