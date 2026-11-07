import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/AuthForm";
import { Dashboard } from "@/components/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "مركز رعاية | المواعيد وملفات الأطفال" },
    { name: "description", content: "إدارة مواعيد الأطفال وملفات الحالات والحضور بمركز رعاية." },
    { property: "og:title", content: "مركز رعاية | المواعيد وملفات الأطفال" },
    { property: "og:description", content: "إدارة مواعيد الأطفال وملفات الحالات والحضور بمركز رعاية." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
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
