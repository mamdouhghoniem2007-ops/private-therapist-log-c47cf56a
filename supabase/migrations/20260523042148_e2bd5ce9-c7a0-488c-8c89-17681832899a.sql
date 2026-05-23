
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  case_name TEXT NOT NULL,
  session_date DATE NOT NULL,
  session_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  cost NUMERIC(10,2) NOT NULL CHECK (cost >= 0),
  specialist_percentage NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (specialist_percentage >= 0 AND specialist_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_specialist_date ON public.sessions(specialist_id, session_date DESC);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists view own sessions" ON public.sessions
  FOR SELECT TO authenticated USING (auth.uid() = specialist_id);
CREATE POLICY "Specialists insert own sessions" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = specialist_id);
CREATE POLICY "Specialists update own sessions" ON public.sessions
  FOR UPDATE TO authenticated USING (auth.uid() = specialist_id);
CREATE POLICY "Specialists delete own sessions" ON public.sessions
  FOR DELETE TO authenticated USING (auth.uid() = specialist_id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
