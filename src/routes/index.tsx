import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/AuthForm";
import { Dashboard } from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;
  }
  if (!session) return <AuthForm />;
  return <Dashboard user={session.user} />;
}
